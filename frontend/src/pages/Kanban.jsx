import { useEffect, useRef, useState } from 'react';
import { apiFetch } from '../api';
import { formatDate } from '../utils/date';
import './Kanban.css';

const COLUMNS = [
  { status: 'Do zrobienia', key: 'todo' },
  { status: 'Realizowane', key: 'progress' },
  { status: 'Wykonane', key: 'done' },
];

async function readResponse(response) {
  let data;
  try {
    data = await response.json();
  } catch {
    throw new Error('Nieprawidłowa odpowiedź serwera. Spróbuj ponownie.');
  }
  if (!response.ok) throw new Error(data.error || 'Nie udało się zapisać zmiany.');
  return data;
}

export default function Kanban() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [pending, setPending] = useState({});
  const pendingIds = useRef(new Set());

  useEffect(() => {
    document.title = 'Kanban';
    const controller = new AbortController();
    loadTasks(controller.signal);
    return () => controller.abort();
  }, []);

  async function loadTasks(signal) {
    setLoading(true);
    setError('');
    try {
      const response = await apiFetch('/api/tasks', { signal });
      const data = await readResponse(response);
      if (!Array.isArray(data)) throw new Error('Nie udało się pobrać listy zadań.');
      if (!signal?.aborted) setTasks(data);
    } catch (err) {
      if (!signal?.aborted) setError(err.message || 'Nie udało się pobrać zadań.');
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }

  async function changeStatus(task, status) {
    if (status === task.status || pendingIds.current.has(task.id)) return;
    pendingIds.current.add(task.id);
    setPending(previous => ({ ...previous, [task.id]: true }));
    setError('');
    const previousStatus = task.status;
    setTasks(previous => previous.map(item => item.id === task.id ? { ...item, status } : item));
    try {
      const response = await apiFetch(`/api/tasks/${task.id}/status`, {
        method: 'PUT',
        body: JSON.stringify({ status }),
      });
      await readResponse(response);
    } catch (err) {
      setTasks(previous => previous.map(item => item.id === task.id ? { ...item, status: previousStatus } : item));
      setError(`${err.message || 'Nie udało się zapisać statusu.'} Przywrócono poprzedni status zadania „${task.name}”.`);
    } finally {
      pendingIds.current.delete(task.id);
      setPending(previous => {
        const updated = { ...previous };
        delete updated[task.id];
        return updated;
      });
    }
  }

  return (
    <section className="kanban-page" aria-labelledby="kanban-title">
      <header className="kanban-heading">
        <div>
          <h1 id="kanban-title">Tablica Kanban</h1>
        </div>
        <span className="kanban-total">{tasks.length} zadań</span>
      </header>
      {error && <p className="kanban-error" role="alert">{error}</p>}
      {loading ? <p role="status">Ładowanie zadań…</p> : (
        <>
          {error && tasks.length === 0 && <button type="button" onClick={() => loadTasks()}>Spróbuj ponownie</button>}
          <div className="kanban-board">
            {COLUMNS.map(column => {
              const columnTasks = tasks.filter(task => task.status === column.status);
              return (
                <section key={column.key} aria-labelledby={`kanban-${column.key}`}
                  className={`kanban-column kanban-column-${column.key}`}>
                  <header className="kanban-column-heading">
                    <h2 id={`kanban-${column.key}`}>{column.status}</h2>
                    <span aria-label={`Liczba zadań: ${columnTasks.length}`}>{columnTasks.length}</span>
                  </header>
                  <div className="kanban-cards">
                    {columnTasks.length === 0 && <p className="kanban-empty">Brak zadań w tej kolumnie.</p>}
                    {columnTasks.map(task => (
                      <article key={task.id} aria-busy={Boolean(pending[task.id])}
                        className="kanban-card">
                        {task.project_name && <p className="kanban-project">{task.project_name}</p>}
                        <h3>{task.name}</h3>
                        {task.description && <p className="kanban-description">{task.description}</p>}
                        <dl className="kanban-details">
                          <div><dt>Termin</dt><dd>{formatDate(task.deadline) || 'Brak'}</dd></div>
                          <div><dt>Priorytet</dt><dd>{task.priority}</dd></div>
                        </dl>
                        <label htmlFor={`kanban-status-${task.id}`}>Status</label>
                        <select id={`kanban-status-${task.id}`} aria-label={`Status zadania: ${task.name}`}
                          value={task.status} disabled={Boolean(pending[task.id])}
                          onChange={event => changeStatus(task, event.target.value)}>
                          {COLUMNS.map(item => <option key={item.key} value={item.status}>{item.status}</option>)}
                        </select>
                        {pending[task.id] && <span className="kanban-saving">Zapisywanie…</span>}
                      </article>
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        </>
      )}
    </section>
  );
}
