import { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import './AdminUsers.css';

const USERS_ENDPOINT = '/api/admin/users';

function getErrorMessage(error, fallback) {
  return error.response?.data?.error || fallback;
}

function getFullName(user) {
  return [user.first_name, user.last_name].filter(Boolean).join(' ') || '—';
}

function formatLoginDate(value) {
  const match = typeof value === 'string'
    ? value.match(/^(\d{4})-(\d{2})-(\d{2})/)
    : null;

  return match ? `${match[3]}-${match[2]}-${match[1]}` : '—';
}

function UserCard({ user, isCurrentUser, onSave, onDelete }) {
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [draft, setDraft] = useState(() => ({
    username: user.username || '',
    email: user.email || '',
    first_name: user.first_name || '',
    last_name: user.last_name || '',
  }));

  const startEditing = () => {
    setDraft({
      username: user.username || '',
      email: user.email || '',
      first_name: user.first_name || '',
      last_name: user.last_name || '',
    });
    setIsEditing(true);
  };

  const updateDraft = event => {
    setDraft(previous => ({
      ...previous,
      [event.target.name]: event.target.value,
    }));
  };

  const saveChanges = async event => {
    event.preventDefault();
    setIsSaving(true);
    const saved = await onSave(user.keycloak_id, draft);
    setIsSaving(false);

    if (saved) {
      setIsEditing(false);
    }
  };

  const deleteUser = async () => {
    const confirmed = window.confirm(
      `Usunąć konto użytkownika „${user.username}” razem z jego zadaniami i projektami? Tej operacji nie można cofnąć.`,
    );

    if (confirmed) {
      await onDelete(user);
    }
  };

  return (
    <article className="admin-users__card">
      <div className="admin-users__heading">
        <div>
          <h2>{user.username}</h2>
          <p>{getFullName(user)}</p>
        </div>
        <span className={`admin-users__role is-${user.role}`}>
          {user.role === 'admin' ? 'Administrator' : 'Użytkownik'}
        </span>
      </div>

      {isEditing ? (
        <form className="admin-users__form" onSubmit={saveChanges}>
          <label>
            Login
            <input
              autoComplete="username"
              maxLength={255}
              name="username"
              onChange={updateDraft}
              required
              value={draft.username}
            />
          </label>
          <label>
            Email
            <input
              autoComplete="email"
              maxLength={255}
              name="email"
              onChange={updateDraft}
              required
              type="email"
              value={draft.email}
            />
          </label>
          <label>
            Imię
            <input
              autoComplete="given-name"
              maxLength={100}
              name="first_name"
              onChange={updateDraft}
              value={draft.first_name}
            />
          </label>
          <label>
            Nazwisko
            <input
              autoComplete="family-name"
              maxLength={100}
              name="last_name"
              onChange={updateDraft}
              value={draft.last_name}
            />
          </label>
          <div className="admin-users__actions">
            <button disabled={isSaving} type="submit">
              {isSaving ? 'Zapisywanie…' : 'Zapisz zmiany'}
            </button>
            <button
              className="admin-users__button-secondary"
              disabled={isSaving}
              onClick={() => setIsEditing(false)}
              type="button"
            >
              Anuluj
            </button>
          </div>
        </form>
      ) : (
        <>
          <dl className="admin-users__details">
            <div>
              <dt>Email</dt>
              <dd>{user.email || '—'}</dd>
            </div>
            <div>
              <dt>Imię i nazwisko</dt>
              <dd>{getFullName(user)}</dd>
            </div>
            <div>
              <dt>Ostatnie logowanie</dt>
              <dd>{formatLoginDate(user.last_login)}</dd>
            </div>
          </dl>
          <div className="admin-users__actions">
            <button onClick={startEditing} type="button">
              Edytuj dane
            </button>
            <button
              className="admin-users__button-danger"
              disabled={isCurrentUser}
              onClick={deleteUser}
              title={isCurrentUser ? 'Nie możesz usunąć własnego konta' : undefined}
              type="button"
            >
              Usuń użytkownika
            </button>
          </div>
        </>
      )}
    </article>
  );
}

export default function AdminUsers({ currentUserId }) {
  const [users, setUsers] = useState([]);
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    document.title = 'Użytkownicy';
    let isCurrent = true;

    axios.get(USERS_ENDPOINT)
      .then(response => {
        if (isCurrent) {
          setUsers(response.data);
        }
      })
      .catch(requestError => {
        if (isCurrent) {
          setError(getErrorMessage(requestError, 'Nie udało się pobrać użytkowników.'));
        }
      })
      .finally(() => {
        if (isCurrent) {
          setLoading(false);
        }
      });

    return () => {
      isCurrent = false;
    };
  }, []);

  const filteredUsers = useMemo(() => {
    const searchTerm = query.trim().toLocaleLowerCase('pl');

    if (!searchTerm) return users;

    return users.filter(user => [
      user.username,
      user.email,
      user.first_name,
      user.last_name,
      user.role,
    ].some(value => String(value || '').toLocaleLowerCase('pl').includes(searchTerm)));
  }, [query, users]);

  const saveUser = async (keycloakId, profile) => {
    setError('');

    try {
      const response = await axios.put(`${USERS_ENDPOINT}/${keycloakId}`, profile);
      setUsers(previousUsers => previousUsers.map(user => (
        user.keycloak_id === keycloakId ? response.data : user
      )));
      return true;
    } catch (requestError) {
      setError(getErrorMessage(requestError, 'Nie udało się zapisać danych użytkownika.'));
      return false;
    }
  };

  const deleteUser = async user => {
    setError('');

    try {
      await axios.delete(`${USERS_ENDPOINT}/${user.keycloak_id}`);
      setUsers(previousUsers => previousUsers.filter(
        item => item.keycloak_id !== user.keycloak_id,
      ));
    } catch (requestError) {
      setError(getErrorMessage(requestError, 'Nie udało się usunąć użytkownika.'));
    }
  };

  return (
    <section className="admin-users">
      <header className="admin-users__header">
        <div>
          <p className="admin-users__eyebrow">Zarządzanie kontami</p>
          <h1>Użytkownicy</h1>
        </div>
        <div className="admin-dashboard__total">
          <strong>{users.length}</strong>
          <span>kont łącznie</span>
        </div>
      </header>

      <label className="admin-users__search-label" htmlFor="admin-user-search">
        Szukaj użytkownika
      </label>
      <input
        className="admin-users__search"
        id="admin-user-search"
        onChange={event => setQuery(event.target.value)}
        placeholder="Login, email, imię lub nazwisko"
        type="search"
        value={query}
      />

      {error && <p className="admin-users__error" role="alert">{error}</p>}
      {loading ? (
        <p className="admin-users__empty">Ładowanie użytkowników…</p>
      ) : filteredUsers.length === 0 ? (
        <p className="admin-users__empty">Nie znaleziono użytkowników.</p>
      ) : (
        <div className="admin-users__list">
          {filteredUsers.map(user => (
            <UserCard
              isCurrentUser={user.keycloak_id === currentUserId}
              key={user.keycloak_id}
              onDelete={deleteUser}
              onSave={saveUser}
              user={user}
            />
          ))}
        </div>
      )}
    </section>
  );
}
