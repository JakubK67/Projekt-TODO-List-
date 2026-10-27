export type User = { sub: string; username: string };
type Tokens = { accessToken: string; refreshToken: string; expiresAt: number };
type Config = { apiUrl: string; issuer: string; clientId: string };
type Storage = { get: () => Promise<string | null>; set: (value: string) => Promise<void>; remove: () => Promise<void> };
export type DeviceLogin = { deviceCode: string; userCode: string; verificationUrl: string; expiresAt: number; interval: number };

export class ApiError extends Error {
  status: number;
  constructor(message: string, status = 0) { super(message); this.status = status; }
}

export function wait(milliseconds: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const abort = () => { clearTimeout(timer); signal?.removeEventListener('abort', abort); reject(new Error('Anulowano logowanie.')); };
    const timer = setTimeout(() => { signal?.removeEventListener('abort', abort); resolve(); }, milliseconds);
    signal?.addEventListener('abort', abort, { once: true });
    if (signal?.aborted) abort();
  });
}

export class SessionClient {
  private config: Config;
  private storage: Storage;
  private request: typeof fetch;
  private delay: typeof wait;
  private tokens: Tokens | null = null;
  private refreshPromise: Promise<void> | null = null;
  private persistence: Promise<void> = Promise.resolve();
  onExpired: () => void = () => {};

  constructor(config: Config, storage: Storage, request: typeof fetch = fetch, delay: typeof wait = wait) {
    this.config = config; this.storage = storage; this.delay = delay;
    this.request = async (url, options = {}) => {
      const controller = new AbortController();
      const abort = () => controller.abort();
      options.signal?.addEventListener('abort', abort, { once: true });
      if (options.signal?.aborted) controller.abort();
      const timer = setTimeout(abort, 15000);
      try { return await request(url, { ...options, signal: controller.signal }); } catch (err) {
        if (options.signal?.aborted) throw err;
        throw new ApiError('Nie można połączyć się z serwerem. Sprawdź sieć Wi-Fi i adres serwera.');
      } finally { clearTimeout(timer); options.signal?.removeEventListener('abort', abort); }
    };
  }

  private async json(response: Response): Promise<Record<string, unknown>> {
    try { return await response.json(); } catch { throw new ApiError('Nieprawidłowa odpowiedź serwera.', response.status); }
  }

  private async form(endpoint: string, body: Record<string, string>, signal?: AbortSignal) {
    try {
      return await this.request(`${this.config.issuer}/protocol/openid-connect/${endpoint}`, {
        method: 'POST', credentials: 'omit', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ client_id: this.config.clientId, ...body }).toString(), signal,
      });
    } catch {
      throw new ApiError(signal?.aborted ? 'Anulowano logowanie.' : 'Nie można połączyć się z Keycloak. Sprawdź połączenie z serwerem.');
    }
  }

  private parseTokens(data: Record<string, unknown>, previousRefresh?: string): Tokens {
    const refreshToken = data.refresh_token ?? previousRefresh;
    if (typeof data.access_token !== 'string' || typeof refreshToken !== 'string' || !refreshToken
      || typeof data.expires_in !== 'number' || data.expires_in <= 0) throw new ApiError('Keycloak nie zwrócił prawidłowej sesji.');
    return { accessToken: data.access_token, refreshToken, expiresAt: Date.now() + data.expires_in * 1000 };
  }

  private persist(): Promise<void> {
    const save = async () => {
      if (this.tokens) await this.storage.set(JSON.stringify({ ...this.config, ...this.tokens }));
      else await this.storage.remove();
    };
    this.persistence = this.persistence.catch(() => {}).then(save);
    return this.persistence;
  }

  private async expire() {
    this.tokens = null;
    this.onExpired();
    await this.persist();
  }

  async beginLogin(signal?: AbortSignal): Promise<DeviceLogin> {
    const response = await this.form('auth/device', { scope: 'openid profile email' }, signal);
    const data = await this.json(response);
    if (!response.ok) throw new ApiError('Nie udało się rozpocząć logowania. Sprawdź konfigurację klienta todo-mobile w Keycloak.', response.status);
    if (typeof data.device_code !== 'string' || typeof data.user_code !== 'string' || typeof data.verification_uri !== 'string'
      || typeof data.expires_in !== 'number' || data.expires_in <= 0) throw new ApiError('Nieprawidłowa odpowiedź logowania.');
    const url = new URL(typeof data.verification_uri_complete === 'string' ? data.verification_uri_complete : data.verification_uri);
    if (url.origin !== new URL(this.config.issuer).origin) throw new ApiError('Nieprawidłowy adres logowania Keycloak.');
    if (!data.verification_uri_complete) url.searchParams.set('user_code', data.user_code);
    return { deviceCode: data.device_code, userCode: data.user_code, verificationUrl: url.href,
      expiresAt: Date.now() + data.expires_in * 1000, interval: Math.max(5, Number(data.interval) || 5) * 1000 };
  }

  async finishLogin(device: DeviceLogin, signal?: AbortSignal): Promise<User> {
    let interval = device.interval;
    while (Date.now() < device.expiresAt) {
      await this.delay(interval, signal);
      if (Date.now() >= device.expiresAt) break;
      const response = await this.form('token', { grant_type: 'urn:ietf:params:oauth:grant-type:device_code', device_code: device.deviceCode }, signal);
      const data = await this.json(response);
      if (data.error === 'authorization_pending') continue;
      if (data.error === 'slow_down') { interval += 5000; continue; }
      if (!response.ok) throw new ApiError(data.error === 'access_denied' ? 'Nie zatwierdzono logowania.' : 'Logowanie wygasło. Spróbuj ponownie.', response.status);
      const tokens = this.parseTokens(data);
      const user = await this.profile(tokens.accessToken, signal);
      if (signal?.aborted) throw new ApiError('Anulowano logowanie.');
      this.tokens = tokens;
      try { await this.persist(); } catch {
        this.tokens = null;
        throw new ApiError('Nie udało się bezpiecznie zapisać sesji na urządzeniu.');
      }
      if (signal?.aborted) { await this.expire(); throw new ApiError('Anulowano logowanie.'); }
      return user;
    }
    throw new ApiError('Kod logowania wygasł. Rozpocznij logowanie ponownie.');
  }

  private async profile(token: string, signal?: AbortSignal): Promise<User> {
    const response = await this.request(`${this.config.apiUrl}/api/mobile/me`, {
      headers: { Authorization: `Bearer ${token}` }, credentials: 'omit', signal,
    });
    const data = await this.json(response);
    if (!response.ok) {
      const message = response.status === 403 ? 'Dokończ weryfikację OTP w Keycloak i zaloguj się ponownie.'
        : response.status === 401 ? 'Backend odrzucił token. Sprawdź konfigurację logowania mobilnego.'
        : response.status === 404 ? 'Backend nie udostępnia logowania mobilnego. Przebuduj usługę backend.'
        : response.status >= 500 ? 'Błąd backendu podczas wczytywania konta. Sprawdź logi backendu.'
        : 'Nie udało się wczytać konta.';
      throw new ApiError(`${message} (HTTP ${response.status})`, response.status);
    }
    if (typeof data.sub !== 'string' || typeof data.username !== 'string') throw new ApiError('Nieprawidłowe dane użytkownika.');
    return { sub: data.sub, username: data.username };
  }

  async restore(): Promise<User | null> {
    const saved = await this.storage.get();
    if (!saved) return null;
    try {
      const data = JSON.parse(saved);
      if (data.apiUrl !== this.config.apiUrl || data.issuer !== this.config.issuer || data.clientId !== this.config.clientId
        || typeof data.accessToken !== 'string' || typeof data.refreshToken !== 'string' || typeof data.expiresAt !== 'number') {
        await this.storage.remove(); return null;
      }
      this.tokens = { accessToken: data.accessToken, refreshToken: data.refreshToken, expiresAt: data.expiresAt };
    } catch { await this.storage.remove(); return null; }
    try {
      await this.ensureToken();
      return await this.profile(this.tokens!.accessToken);
    } catch (err) {
      if (err instanceof ApiError && [400, 401, 403].includes(err.status)) { await this.expire(); return null; }
      throw err;
    }
  }

  private async ensureToken(force = false): Promise<void> {
    if (!this.tokens) throw new ApiError('Zaloguj się ponownie.', 401);
    if (!force && this.tokens.expiresAt > Date.now() + 30000) return;
    if (!this.refreshPromise) {
      const previous = this.tokens;
      this.refreshPromise = (async () => {
        const response = await this.form('token', { grant_type: 'refresh_token', refresh_token: previous.refreshToken });
        const data = await this.json(response);
        if (this.tokens !== previous) throw new ApiError('Sesja została zakończona.', 401);
        if (!response.ok) {
          if ([400, 401].includes(response.status)) await this.expire();
          throw new ApiError('Nie udało się odświeżyć sesji. Zaloguj się ponownie.', response.status);
        }
        this.tokens = this.parseTokens(data, previous.refreshToken);
        await this.persist();
      })().finally(() => { this.refreshPromise = null; });
    }
    await this.refreshPromise;
  }

  async api(path: string, signal?: AbortSignal): Promise<unknown> {
    await this.ensureToken();
    const get = () => this.request(`${this.config.apiUrl}${path}`, {
      headers: { Authorization: `Bearer ${this.tokens!.accessToken}` }, credentials: 'omit', signal,
    });
    let response = await get();
    if (response.status === 401) { await this.ensureToken(true); response = await get(); }
    if (response.status === 401) await this.expire();
    const data = await response.json();
    if (!response.ok) throw new ApiError(response.status === 401 ? 'Sesja wygasła. Zaloguj się ponownie.' : 'Nie udało się pobrać danych z serwera.', response.status);
    return data;
  }

  async logout(): Promise<void> {
    const previous = this.tokens;
    await this.expire();
    if (previous) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 5000);
      try { await this.form('revoke', { token: previous.refreshToken, token_type_hint: 'refresh_token' }, controller.signal); } catch {} finally { clearTimeout(timer); }
    }
  }
}
