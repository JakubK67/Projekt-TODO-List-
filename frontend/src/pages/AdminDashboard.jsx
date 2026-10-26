import { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { formatDate } from '../utils/date';
import './AdminDashboard.css';

const TASK_STATUSES = ['Do zrobienia', 'Realizowane', 'Wykonane'];
const ALL_STATUSES = 'Wszystkie';
const TASKS_ENDPOINT = '/api/admin/tasks';

function getErrorMessage(error, fallback) {
  return error.response?.data?.error || fallback;
}

function matchesSearch(task, searchTerm) {
  if (!searchTerm) return true;

  const searchableFields = [
    task.name,
    task.description,
    task.owner_username,
    task.owner_email,
    task.project_name,
  ];

  return searchableFields.some(value =>
    String(value || '').toLocaleLowerCase('pl').includes(searchTerm),
  );
}

function StatusOverview({ tasks, selectedStatus, onSelectStatus }) {
  const counts = TASK_STATUSES.map(status => ({
    status,
    count: tasks.filter(task => task.status === status).length,
  }));

  return (
    <div className="admin-dashboard__stats">
      {counts.map(({ status, count }) => {
        const isSelected = selectedStatus === status;

        return (
          <button
            aria-pressed={isSelected}
            className={isSelected ? 'is-active' : ''}
            key={status}
            onClick={() => onSelectStatus(isSelected ? ALL_STATUSES : status)}
            type="button"
          >
            <strong>{count}</strong>
            <span>{status}</span>
          </button>
        );
      })}
    </div>
  );
}

function TaskFilters({ query, status, onQueryChange, onStatusChange }) {
  return (
    <div className="admin-dashboard__toolbar">
      <label htmlFor="admin-task-search">Szukaj zadania lub użytkownika</label>
      <input
        id="admin-task-search"
        onChange={event => onQueryChange(event.target.value)}
        placeholder="Nazwa, opis, użytkownik, email lub projekt"
        type="search"
        value={query}
      />

      <label htmlFor="admin-task-status">Status</label>
      <select
        id="admin-task-status"
        onChange={event => onStatusChange(event.target.value)}
        value={status}
      >
        <option>{ALL_STATUSES}</option>
        {TASK_STATUSES.map(taskStatus => (
          <option key={taskStatus}>{taskStatus}</option>
        ))}
      </select>
    </div>
  );
}

function TaskCard({ task, onStatusChange, onDelete }) {
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);
  const priorityClass = `priority-${String(task.priority).toLowerCase()}`;
  const shouldShowDescriptionToggle = (task.description || '').length > 240;

  return (
    <article className={`admin-dashboard__task ${priorityClass}`}>
      <div className="admin-dashboard__task-heading">
        <div className="admin-dashboard__task-title">
          {task.project_name && (
            <span className="admin-dashboard__project">{task.project_name}</span>
          )}
          <h2>{task.name}</h2>
        </div>
        <span className="admin-dashboard__priority">
          Priorytet: {task.priority}
        </span>
      </div>

      <p
        className={`admin-dashboard__description${
          isDescriptionExpanded ? ' is-expanded' : ''
        }`}
      >
        {task.description || 'Brak opisu'}
      </p>

      {shouldShowDescriptionToggle && (
        <button
          aria-expanded={isDescriptionExpanded}
          className="admin-dashboard__description-toggle"
          onClick={() => setIsDescriptionExpanded(expanded => !expanded)}
          type="button"
        >
          {isDescriptionExpanded ? 'Zwiń opis' : 'Pokaż cały opis'}
        </button>
      )}

      <TaskDetails task={task} />

      <div className="admin-dashboard__actions">
        <label htmlFor={`admin-status-${task.id}`}>Zmień status</label>
        <select
          id={`admin-status-${task.id}`}
          onChange={event => onStatusChange(task, event.target.value)}
          value={task.status}
        >
          {TASK_STATUSES.map(status => (
            <option key={status}>{status}</option>
          ))}
        </select>
        <button onClick={() => onDelete(task)} type="button">
          Usuń zadanie
        </button>
      </div>
    </article>
  );
}

function TaskDetails({ task }) {
  return (
    <dl className="admin-dashboard__details">
      <div>
        <dt>Użytkownik</dt>
        <dd>
          {task.owner_username || 'Nieznany'}
          {task.owner_email && <span>{task.owner_email}</span>}
        </dd>
      </div>
      <div>
        <dt>Termin</dt>
        <dd>{formatDate(task.deadline)}</dd>
      </div>
      <div>
        <dt>Status</dt>
        <dd>{task.status}</dd>
      </div>
    </dl>
  );
}

function TaskList({ tasks, loading, onStatusChange, onDelete }) {
  if (loading) {
    return <p className="admin-dashboard__empty">Ładowanie zadań…</p>;
  }

  if (tasks.length === 0) {
    return (
      <p className="admin-dashboard__empty">
        Brak zadań pasujących do wyszukiwania.
      </p>
    );
  }

  return (
    <div className="admin-dashboard__tasks">
      {tasks.map(task => (
        <TaskCard
          key={task.id}
          onDelete={onDelete}
          onStatusChange={onStatusChange}
          task={task}
        />
      ))}
    </div>
  );
}

export default function AdminDashboard() {
  const [tasks, setTasks] = useState([]);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState(ALL_STATUSES);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const loadTasks = useCallback(async () => {
    setError('');

    try {
      const response = await axios.get(TASKS_ENDPOINT);
      setTasks(response.data);
    } catch (requestError) {
      setError(
        getErrorMessage(requestError, 'Nie udało się pobrać wszystkich zadań.'),
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  const filteredTasks = useMemo(() => {
    const searchTerm = query.trim().toLocaleLowerCase('pl');

    return tasks.filter(task => {
      const matchesStatus =
        statusFilter === ALL_STATUSES || task.status === statusFilter;

      return matchesStatus && matchesSearch(task, searchTerm);
    });
  }, [query, statusFilter, tasks]);

  const changeTaskStatus = async (task, status) => {
    setError('');

    try {
      await axios.put(`${TASKS_ENDPOINT}/${task.id}/status`, { status });
      setTasks(previousTasks =>
        previousTasks.map(item =>
          item.id === task.id ? { ...item, status } : item,
        ),
      );
    } catch (requestError) {
      setError(
        getErrorMessage(requestError, 'Nie udało się zmienić statusu zadania.'),
      );
    }
  };

  const deleteTask = async task => {
    const confirmed = window.confirm(
      `Usunąć zadanie „${task.name}” użytkownika ${task.owner_username}? Tej operacji nie można cofnąć.`,
    );

    if (!confirmed) return;

    setError('');

    try {
      await axios.delete(`${TASKS_ENDPOINT}/${task.id}`);
      setTasks(previousTasks =>
        previousTasks.filter(item => item.id !== task.id),
      );
    } catch (requestError) {
      setError(
        getErrorMessage(requestError, 'Nie udało się usunąć zadania.'),
      );
    }
  };

  return (
    <section className="admin-dashboard">
      <DashboardHeader taskCount={tasks.length} />

      <StatusOverview
        onSelectStatus={setStatusFilter}
        selectedStatus={statusFilter}
        tasks={tasks}
      />

      <TaskFilters
        onQueryChange={setQuery}
        onStatusChange={setStatusFilter}
        query={query}
        status={statusFilter}
      />

      {error && (
        <p className="admin-dashboard__error" role="alert">
          {error}
        </p>
      )}

      <TaskList
        loading={loading}
        onDelete={deleteTask}
        onStatusChange={changeTaskStatus}
        tasks={filteredTasks}
      />
    </section>
  );
}

function DashboardHeader({ taskCount }) {
  return (
    <header className="admin-dashboard__header">
      <div>
        <p className="admin-dashboard__eyebrow">Panel zarządzania</p>
        <h1>Wszystkie zadania</h1>
        <p>Przeglądaj i zarządzaj zadaniami wszystkich użytkowników.</p>
      </div>
      <div className="admin-dashboard__total">
        <strong>{taskCount}</strong>
        <span>zadań łącznie</span>
      </div>
    </header>
  );
}
