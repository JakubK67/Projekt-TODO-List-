import { useEffect, useState } from 'react';
import { Navigate, NavLink, Route, Routes, useNavigate } from 'react-router-dom';
import keycloak from './keycloak';
import { apiFetch, setCsrfToken } from './api.js';
import Home from './pages/Home.jsx';
import Projects from './pages/Projects.jsx';
import Users from './pages/Users.jsx';
import UserMenu from './pages/UserMenu.jsx';
import Kanban from './pages/Kanban.jsx';
import Statistics from './pages/Statistics.jsx';
import './App.css';

function AdminGuard({ children }) {
  const [allowed, setAllowed] = useState(null);
  useEffect(() => {
    apiFetch('/api/admin').then(response => setAllowed(response.ok)).catch(() => setAllowed(false));
  }, []);
  if (allowed === null) return <p>Sprawdzanie uprawnień…</p>;
  return allowed ? children : <p role="alert">Brak uprawnień do tej strony.</p>;
}

export default function AuthenticatedApp() {
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
          setMfaRequired(true);
          setError('Keycloak nie potwierdził dodatkowego uwierzytelnienia. Spróbuj przejść weryfikację ponownie.');
          return;
        }
        if (!response.ok) throw new Error('Nie udało się zalogować.');
        setCsrfToken(result.csrfToken);
        // Token przekazujemy do backendu raz; aplikacja korzysta dalej z sesji HttpOnly.
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
    const continueWithMfa = () => {
      const acr = import.meta.env.VITE_KEYCLOAK_MFA_ACR || '2';
      keycloak.login({ acr: { values: [acr], essential: true }, acrValues: acr });
    };
    return (
      <main className="content auth-state-page">
        <section className="auth-card" aria-labelledby="mfa-title">
          <div className="auth-card-mark" aria-hidden="true">✓</div>
          <p className="auth-card-eyebrow">Wymagane dodatkowe zabezpieczenie</p>
          <h1 id="mfa-title">Dokończ weryfikację</h1>
          <p className="auth-card-copy">Nie udało się potwierdzić MFA. Upewnij się, że metoda uwierzytelniania jest skonfigurowana, i spróbuj ponownie.</p>
          <p className="auth-card-error" role="alert">{error}</p>
          <div className="auth-card-actions">
            <button className="auth-primary" type="button" onClick={continueWithMfa}>Kontynuuj weryfikację MFA</button>
          </div>
          <p className="auth-card-footnote">Przy pierwszej konfiguracji Keycloak wyświetli kod QR. Po zeskanowaniu potwierdź go kodem z aplikacji.</p>
        </section>
      </main>
    );
  }
  if (!auth) return <main className="content"><p role="alert">{error || 'Brak dostępu.'}</p></main>;

  return (
    <div className="page">
      <nav className="nav">
        <button className="nav-button" onClick={() => navigate('/tasks')}>Zadania</button>
        <button className="nav-button" onClick={() => navigate('/kanban')}>Kanban</button>
        <button className="nav-button" onClick={() => navigate('/projects')}>Projekty</button>
        {auth.isAdmin && <NavLink to="/admin">Administracja</NavLink>}
        <div className="user-menu">
          <button className="nav-button" onClick={() => navigate('/panel')}>
            {auth.username}{auth.isAdmin ? ' (administrator)' : ' (użytkownik)'}
          </button>
          <div className="user-menu-dropdown">
            <button type="button" className="nav-button" onClick={() => navigate('/statistics')}>Statystyki</button>
            <button type="button" className="btn secondary user-menu-logout nav-button" onClick={logout} disabled={logoutBusy}>
              {logoutBusy ? 'Wylogowywanie…' : 'Wyloguj'}
            </button>
          </div>
        </div>
      </nav>
      <main className="content">
        {error && <p role="alert">{error}</p>}
        <Routes>
          <Route path="/" element={<Navigate to="/tasks" replace />} />
          <Route path="/index" element={<Navigate to="/tasks" replace />} />
          <Route path="/index.html" element={<Navigate to="/tasks" replace />} />
          <Route path="/tasks" element={<Home />} />
          <Route path="/kanban" element={<Kanban />} />
          <Route path="/projects" element={<Projects />} />
          <Route path="/panel" element={<UserMenu />} />
          <Route path="/statistics" element={<Statistics />} />
          <Route path="/usermenu" element={<Navigate to="/panel" replace />} />
          <Route path="/admin" element={<AdminGuard><Users /></AdminGuard>} />
          <Route path="/users" element={<AdminGuard><Users /></AdminGuard>} />
          <Route path="*" element={<p>Nie znaleziono strony.</p>} />
        </Routes>
      </main>
    </div>
  );
}
