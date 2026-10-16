import { useEffect, useState } from 'react';
import './UserMenu.css';
import { apiFetch } from '../api.js';

export default function UserMenu() {
  const [profile, setProfile] = useState({ username: '', first_name: '', last_name: '', email: '' });
  const [passwords, setPasswords] = useState({ current: '', next: '', confirm: '' });
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [showPasswordForm, setShowPasswordForm] = useState(false);

  const request = async (path, options = {}) => {
    const response = await apiFetch(path, options);
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Wystąpił błąd. Spróbuj ponownie.');
    return data;
  };

  useEffect(() => {
    document.title = 'Panel uzytkownika';
    let active = true;
    request('/api/me')
      .then(data => { if (active) setProfile(data); })
      .catch(err => { if (active) setError(err.message); });
    return () => { active = false; };
  }, []);

  const saveProfile = async event => {
    event.preventDefault();
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const updated = await request('/api/me', {
        method: 'PUT',
        body: JSON.stringify(profile),
      });
      setProfile(updated);
      setMessage('Dane profilu zostały zapisane.');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const changePassword = async event => {
    event.preventDefault();
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await request('/api/me/password', {
        method: 'PUT',
        body: JSON.stringify(passwords),
      });
      setPasswords({ current: '', next: '', confirm: '' });
      setShowPasswordForm(false);
      setMessage('Hasło zostało zmienione.');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="new-task user-profile">
      <h1>Panel użytkownika</h1>
      {error && <p role="alert">{error}</p>}
      {message && <p role="status">{message}</p>}
      <form onSubmit={saveProfile}>
        <label htmlFor="profile-username">Nazwa użytkownika</label>
        <input id="profile-username" type="text" value={profile.username || ''} onChange={event => setProfile({ ...profile, username: event.target.value })} required />
        <label htmlFor="profile-email">Email</label>
        <input id="profile-email" type="email" value={profile.email || ''} onChange={event => setProfile({ ...profile, email: event.target.value })} required />
        <label htmlFor="profile-first-name">Imię</label>
        <input id="profile-first-name" type="text" value={profile.first_name || ''} onChange={event => setProfile({ ...profile, first_name: event.target.value })} />
        <label htmlFor="profile-last-name">Nazwisko</label>
        <input id="profile-last-name" type="text" value={profile.last_name || ''} onChange={event => setProfile({ ...profile, last_name: event.target.value })} />
        <button type="submit" disabled={busy}>Zapisz profil</button>
      </form>
      <button
        className="user-profile-password-toggle"
        type="button"
        onClick={() => setShowPasswordForm(value => !value)}
        aria-expanded={showPasswordForm}
      >
        {showPasswordForm ? 'Anuluj zmianę hasła' : 'Zmień hasło'}
      </button>
      {showPasswordForm && <form onSubmit={changePassword}>
        <h2>Zmiana hasła</h2>
        <label htmlFor="current-password">Obecne hasło</label>
        <input id="current-password" type="password" autoComplete="current-password" value={passwords.current} onChange={event => setPasswords({ ...passwords, current: event.target.value })} required />
        <label htmlFor="new-password">Nowe hasło</label>
        <input id="new-password" type="password" autoComplete="new-password" value={passwords.next} onChange={event => setPasswords({ ...passwords, next: event.target.value })} required />
        <label htmlFor="confirm-password">Powtórz nowe hasło</label>
        <input id="confirm-password" type="password" autoComplete="new-password" value={passwords.confirm} onChange={event => setPasswords({ ...passwords, confirm: event.target.value })} required />
        <button type="submit" disabled={busy}>Zapisz nowe hasło</button>
      </form>}
    </section>
  );
}
