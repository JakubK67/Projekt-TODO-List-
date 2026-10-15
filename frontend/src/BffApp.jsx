import { useEffect, useState } from 'react';
import { Navigate, NavLink, Route, Routes, useNavigate } from 'react-router-dom';
import keycloak from './keycloak';
import { apiFetch, setCsrfToken } from './api.js';
import Home from './pages/Home.jsx';
import Projects from './pages/Projects.jsx';
import Users from './pages/Users.jsx';
import UserMenu from './pages/UserMenu.jsx';
import './App.css';

function AdminGuard({ auth, children }) {
  const [allowed, setAllowed] = useState(null);
  useEffect(() => {
    apiFetch('/api/admin').then(response => setAllowed(response.ok)).catch(() => setAllowed(false));
  }, []);
  if (allowed === null) return <p>Sprawdzanie uprawnień…</p>;
  return allowed ? children : <p role="alert">Brak uprawnień do tej strony.</p>;
}

export default function BffApp() {
  const [auth, setAuth] = useState(null);
  const [error, setError] = useState('');
  const [mfaRequired, setMfaRequired] = useState(false);
  const [busy, setBusy] = useState(true);
  const [logoutBusy, setLogoutBusy] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const response = await fetch('/auth/session', {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ access_token: keycloak.token, refresh_token: keycloak.refreshToken, id_token: keycloak.idToken }),
        });
        const result = await response.json();
        if (response.status === 403) {
          if (!sessionStorage.getItem('todo-mfa-step-up')) {
            sessionStorage.setItem('todo-mfa-step-up', 'attempted');
            // Keycloak tworzy jednorazowy adres i kontekst wymaganej akcji; nie zapisujemy tab_id ani client_data.
            await keycloak.login({ action: 'CONFIGURE_TOTP', redirectUri: window.location.href });
            return;
          }
          setMfaRequired(true);
          setError('Aby wejść do aplikacji, skonfiguruj lub potwierdź MFA.');
          return;
        }
        if (!response.ok) throw new Error('Nie udało się zalogować.');
        sessionStorage.removeItem('todo-mfa-step-up');
        setCsrfToken(result.csrfToken);
        // Token przekazujemy do backendu raz; aplikacja korzysta dalej z sesji HttpOnly.
        keycloak.clearToken();
        if (active) setAuth(result);
      } catch {
        if (active) setError('Nie udało się zalogować. Odśwież stronę lub spróbuj ponownie.');
      } finally {
        if (active) setBusy(false);
      }
    })();
    return () => { active = false; };
  }, []);

  const logout = async () => {
    setLogoutBusy(true);
    try {
      const response = await apiFetch('/auth/logout', { method: 'POST' });
      const result = await response.json();
      if (!response.ok) throw new Error();
      window.location.assign(result.logoutUrl);
    } catch {
      setError('Nie udało się zakończyć sesji. Spróbuj ponownie.');
      setLogoutBusy(false);
    }
  };

  if (busy) return <main className="content"><p>Trwa bezpieczne logowanie…</p></main>;
  if (mfaRequired) {
    const accountUrl = `${import.meta.env.VITE_KEYCLOAK_URL.replace(/\/$/, '')}/realms/${import.meta.env.VITE_KEYCLOAK_REALM}/account`;
    const continueWithMfa = () => {
      sessionStorage.removeItem('todo-mfa-step-up');
      keycloak.login({ action: 'CONFIGURE_TOTP', redirectUri: window.location.href });
    };
    return <main className="content"><p role="alert">{error}</p><p><a href={accountUrl} target="_blank" rel="noreferrer">Otwórz Bezpieczeństwo konta i skonfiguruj TOTP</a>, a następnie ponów logowanie.</p><button type="button" onClick={continueWithMfa}>Ponów uwierzytelnienie MFA</button></main>;
  }
  if (!auth) return <main className="content"><p role="alert">{error || 'Brak dostępu.'}</p></main>;

  const accountUrl = `${import.meta.env.VITE_KEYCLOAK_URL.replace(/\/$/, '')}/realms/${import.meta.env.VITE_KEYCLOAK_REALM}/account`;
  return (
    <div className="page">
      <nav className="nav">
        <button className="nav-button" onClick={() => navigate('/')}>Zadania</button>
        <button className="nav-button" onClick={() => navigate('/projects')}>Projekty</button>
        {auth.isAdmin && <NavLink to="/admin">Administracja</NavLink>}
        <div className="user-menu">
          <button className="nav-button" onClick={() => navigate('/panel')}>
            {auth.username}{auth.isAdmin ? ' (administrator)' : ' (użytkownik)'}
          </button>
          <button className="btn secondary user-menu-logout nav-button" onClick={logout} disabled={logoutBusy}>
            {logoutBusy ? 'Wylogowywanie…' : 'Wyloguj'}
          </button>
        </div>
        <a className="nav-button" href={accountUrl} target="_blank" rel="noreferrer">Bezpieczeństwo konta</a>
      </nav>
      <main className="content">
        {error && <p role="alert">{error}</p>}
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/projects" element={<Projects />} />
          <Route path="/panel" element={<UserMenu />} />
          <Route path="/usermenu" element={<Navigate to="/panel" replace />} />
          <Route path="/admin" element={<AdminGuard auth={auth}><Users /></AdminGuard>} />
          <Route path="/users" element={<AdminGuard auth={auth}><Users /></AdminGuard>} />
          <Route path="*" element={<p>Nie znaleziono strony.</p>} />
        </Routes>
      </main>
    </div>
  );
}
