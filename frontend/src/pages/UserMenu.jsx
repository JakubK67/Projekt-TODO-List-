import { useEffect, useState } from 'react';
import keycloak from '../keycloak';

export default function UserMenu() {
  const [profile, setProfile] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    document.title = 'Panel uzytkownika';
    let active = true;
    (async () => {
      try {
        await keycloak.updateToken(30);
        const data = await keycloak.loadUserProfile();
        if (active) setProfile(data);
      } catch {
        if (active) setError('Nie udało się pobrać danych konta. Odśwież stronę i spróbuj ponownie.');
      }
    })();
    return () => { active = false; };
  }, []);

  const openSettings = async (password = false) => {
    setError('');
    setBusy(true);
    const redirectUri = `${window.location.origin}/usermenu`;
    try {
      if (password) {
        await keycloak.login({ action: 'UPDATE_PASSWORD', redirectUri });
      } else {
        window.location.assign(keycloak.createAccountUrl({ redirectUri }));
      }
    } catch {
      setError('Nie udało się otworzyć ustawień konta. Spróbuj ponownie.');
      setBusy(false);
    }
  };

  return (
    <section className="new-task user-profile">
      <h1>Panel użytkownika</h1>
      {!profile && !error && <p>Ładowanie danych konta…</p>}
      {profile && (
        <dl>
          <dt>Nazwa użytkownika</dt><dd>{profile.username || 'Brak'}</dd>
          <dt>Email</dt><dd>{profile.email || 'Brak'}</dd>
          <dt>Imię</dt><dd>{profile.firstName || 'Brak'}</dd>
          <dt>Nazwisko</dt><dd>{profile.lastName || 'Brak'}</dd>
          <dt>Weryfikacja emaila</dt><dd>{profile.emailVerified ? 'Email potwierdzony' : 'Email niepotwierdzony'}</dd>
        </dl>
      )}
      <div className="user-profile-actions">
        <button type="button" disabled={busy} onClick={() => openSettings()}>Zmień dane konta</button>
        <button type="button" disabled={busy} onClick={() => openSettings(true)}>Zmień hasło</button>
      </div>
      {error && <p role="alert">{error}</p>}
    </section>
  );
}
