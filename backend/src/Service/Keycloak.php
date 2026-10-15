<?php
namespace App\Service;

use Firebase\JWT\JWK;
use Firebase\JWT\JWT;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpKernel\Exception\HttpException;
use Symfony\Contracts\HttpClient\HttpClientInterface;

class Keycloak
{
    public function __construct(private HttpClientInterface $http, private string $baseUrl, private string $realm, private string $issuer, private string $clientId, private string $adminUsername, private string $adminPassword, private string $mfaAcrValues, private string $frontendOrigin) {}

    public function authenticate(Request $request): object
    {
        $session = $request->getSession();
        $accessToken = $session->get('oidc_access_token');
        if (!is_string($accessToken) || $accessToken === '') {
            throw new HttpException(401, 'Sesja wygasła. Zaloguj się ponownie.');
        }
        $parts = explode('.', $accessToken);
        $payload = count($parts) === 3 ? json_decode(base64_decode(strtr($parts[1], '-_', '+/')), true) : null;
        if (!is_array($payload) || !is_numeric($payload['exp'] ?? null) || (int) $payload['exp'] <= time() + 20) {
            $refresh = $session->get('oidc_refresh_token');
            if (!is_string($refresh) || $refresh === '') {
                $session->invalidate();
                throw new HttpException(401, 'Sesja wygasła. Zaloguj się ponownie.');
            }
            try {
                $tokens = $this->send('POST', $this->realmUrl() . '/protocol/openid-connect/token', ['body' => [
                    'grant_type' => 'refresh_token', 'client_id' => $this->clientId, 'refresh_token' => $refresh,
                ]]);
                $accessToken = (string) ($tokens['access_token'] ?? '');
                $session->set('oidc_access_token', $accessToken);
                $session->set('oidc_refresh_token', $tokens['refresh_token'] ?? $refresh);
                if (isset($tokens['id_token'])) $session->set('oidc_id_token', $tokens['id_token']);
            } catch (\Throwable) {
                $session->invalidate();
                throw new HttpException(401, 'Sesja wygasła. Zaloguj się ponownie.');
            }
        }
        $token = $this->validateOidcToken($accessToken, true);
        if (!in_array($request->getMethod(), ['GET', 'HEAD', 'OPTIONS'], true)) {
            $csrf = (string) $session->get('csrf_token', '');
            if ($request->headers->get('Origin') !== $this->frontendOrigin || $csrf === '' || !hash_equals($csrf, $request->headers->get('X-CSRF-Token', ''))) {
                throw new HttpException(403, 'Brak uprawnień do wykonania tej operacji.');
            }
        }
        return $token;

        /* Poprzedni tryb Bearer został wyłączony; tokeny API są dostępne wyłącznie z sesji HttpOnly.
        if (!preg_match('/^Bearer\s+(.+)$/i', $request->headers->get('Authorization', ''), $matches)) {
            throw new HttpException(401, 'Brak tokenu');
        }
        $jwks = $this->send('GET', $this->realmUrl() . '/protocol/openid-connect/certs');
        try {
            JWT::$leeway = 30;
            $token = JWT::decode($matches[1], JWK::parseKeySet($jwks, 'RS256'));
        } catch (\Throwable) {
            throw new HttpException(401, 'Nieprawidłowy token');
        }
        $audiences = (array) ($token->aud ?? []);
        if (($token->iss ?? '') !== $this->issuer || !is_string($token->sub ?? null) || $token->sub === '' || (($token->azp ?? '') !== $this->clientId && !in_array($this->clientId, $audiences, true))) {
            throw new HttpException(401, 'Nieprawidłowy token');
        }
        return $token;
        */
    }

    public function validateOidcToken(string $rawToken, bool $requireMfa = false): object
    {
        try {
            JWT::$leeway = 5;
            $jwks = $this->send('GET', $this->realmUrl() . '/protocol/openid-connect/certs');
            $token = JWT::decode($rawToken, JWK::parseKeySet($jwks, 'RS256'));
        } catch (\Throwable) {
            throw new HttpException(401, 'Sesja wygasła. Zaloguj się ponownie.');
        }
        $audiences = is_array($token->aud ?? null) ? $token->aud : [$token->aud ?? null];
        if (($token->iss ?? '') !== $this->issuer || !is_string($token->sub ?? null) || $token->sub === '' || !in_array($this->clientId, $audiences, true)) {
            throw new HttpException(401, 'Sesja wygasła. Zaloguj się ponownie.');
        }
        if ($requireMfa && !$this->hasMfa($token)) {
            throw new HttpException(403, 'Wymagane jest dodatkowe uwierzytelnienie.');
        }
        return $token;
    }

    public function hasMfa(object $token): bool
    {
        $allowedAcr = array_filter(array_map('trim', explode(',', $this->mfaAcrValues)));
        $amr = $token->amr ?? [];
        if (!is_array($amr)) $amr = [$amr];
        return in_array((string) ($token->acr ?? ''), $allowedAcr, true)
            || (bool) array_intersect(array_map('strval', $amr), ['otp', 'mfa', 'hwk', 'swk']);
    }

    public function establishSession(Request $request, array $tokens): object
    {
        $token = $this->validateOidcToken((string) ($tokens['access_token'] ?? ''), true);
        $idToken = (string) ($tokens['id_token'] ?? '');
        if ($idToken === '') throw new HttpException(401, 'Nie udało się rozpocząć sesji.');
        $identity = $this->validateOidcToken($idToken);
        if (($identity->sub ?? null) !== $token->sub) throw new HttpException(401, 'Nie udało się rozpocząć sesji.');
        $session = $request->getSession();
        // Rotujemy identyfikator, aby ograniczyć ryzyko session fixation.
        $session->migrate(true);
        $session->set('oidc_access_token', $tokens['access_token']);
        $session->set('oidc_refresh_token', $tokens['refresh_token'] ?? null);
        $session->set('oidc_id_token', $idToken);
        $session->set('csrf_token', bin2hex(random_bytes(32)));
        return $token;
    }

    public function sessionInfo(Request $request, object $token): array
    {
        return [
            'sub' => $token->sub,
            'username' => $token->preferred_username ?? '',
            'isAdmin' => in_array('admin', $token->realm_access->roles ?? [], true),
            'csrfToken' => $request->getSession()->get('csrf_token'),
        ];
    }

    public function logoutUrl(Request $request): string
    {
        $session = $request->getSession();
        $idToken = (string) $session->get('oidc_id_token', '');
        $session->invalidate();
        $params = ['client_id' => $this->clientId, 'post_logout_redirect_uri' => $this->frontendOrigin];
        if ($idToken !== '') $params['id_token_hint'] = $idToken;
        return rtrim($this->issuer, '/') . '/protocol/openid-connect/logout?' . http_build_query($params);
    }

    public function updateProfile(object $token, array $profile): void
    {
        $admin = $this->adminToken();
        $url = $this->userUrl($token->sub);
        $user = $this->send('GET', $url, ['auth_bearer' => $admin]);
        $user['username'] = $profile['username'];
        if (($user['email'] ?? '') !== $profile['email']) $user['emailVerified'] = false;
        $user['email'] = $profile['email'];
        $user['firstName'] = $profile['first_name'];
        $user['lastName'] = $profile['last_name'];
        $this->send('PUT', $url, ['auth_bearer' => $admin, 'json' => $user]);
    }

    public function changePassword(object $token, string $current, string $next): void
    {
        $admin = $this->adminToken();
        $user = $this->send('GET', $this->userUrl($token->sub), ['auth_bearer' => $admin]);
        $verified = $this->send('POST', $this->realmUrl() . '/protocol/openid-connect/token', ['body' => [
            'client_id' => 'admin-cli', 'grant_type' => 'password', 'scope' => 'openid', 'username' => $user['username'], 'password' => $current,
        ]]);
        $accessToken = $verified['access_token'] ?? '';
        $verifiedUser = $this->send('GET', $this->realmUrl() . '/protocol/openid-connect/userinfo', ['auth_bearer' => $accessToken]);
        if (($verifiedUser['sub'] ?? '') !== $token->sub) throw new HttpException(400, 'Nieprawidłowe obecne hasło');
        $this->send('PUT', $this->userUrl($token->sub) . '/reset-password', ['auth_bearer' => $admin, 'json' => ['type' => 'password', 'value' => $next, 'temporary' => false]]);
    }

    private function adminToken(): string
    {
        if ($this->adminUsername === '' || $this->adminPassword === '') throw new HttpException(503, 'Brak konfiguracji usługi konta');
        $result = $this->send('POST', rtrim($this->baseUrl, '/') . '/realms/master/protocol/openid-connect/token', ['body' => [
            'client_id' => 'admin-cli', 'grant_type' => 'password', 'username' => $this->adminUsername, 'password' => $this->adminPassword,
        ]]);
        return $result['access_token'] ?? throw new HttpException(502, 'Brak dostępu do usługi konta');
    }

    private function realmUrl(): string
    {
        return rtrim($this->baseUrl, '/') . '/realms/' . rawurlencode($this->realm);
    }

    private function userUrl(string $id): string
    {
        return rtrim($this->baseUrl, '/') . '/admin/realms/' . rawurlencode($this->realm) . '/users/' . rawurlencode($id);
    }

    private function send(string $method, string $url, array $options = []): array
    {
        try {
            $response = $this->http->request($method, $url, $options + ['timeout' => 10]);
            $status = $response->getStatusCode();
            $content = $response->getContent(false);
        } catch (\Throwable $e) {
            throw new HttpException(502, 'Keycloak jest niedostępny', $e);
        }
        if ($status < 200 || $status >= 300) {
            throw new HttpException(in_array($status, [400, 401, 403, 409], true) ? 400 : 502, 'Keycloak odrzucił dane konta lub hasło');
        }
        if ($content === '') return [];
        try {
            return json_decode($content, true, 512, JSON_THROW_ON_ERROR);
        } catch (\Throwable $e) {
            throw new HttpException(502, 'Nieprawidłowa odpowiedź Keycloak', $e);
        }
    }
}
