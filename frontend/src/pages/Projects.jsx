import { useState, useEffect } from "react";
import { PieChart, Pie, Tooltip, Legend } from 'recharts';

import { apiFetch } from '../api.js';

const API_URL = '';
const STATUSES = ['Do zrobienia', 'Realizowane', 'Wykonane'];
const COLORS = ['#ef4444', '#f59e0b', '#22c55e'];

async function readResponse(response) {
  let data;
  try {
    data = await response.json();
  } catch {
    throw new Error(`Backend nie zwrócił poprawnego JSON (HTTP ${response.status}). Sprawdź logi backendu.`);
  }
  if (!response.ok) {
    throw new Error(`${data.error || 'Błąd żądania'} (HTTP ${response.status})`);
  }
  return data;
}

function ProjectStatusChart({ tasks }) {
  const data = STATUSES
    .map((status, i) => ({
      name: status,
      value: tasks.filter(t => t.status === status).length,
      fill: COLORS[i],
    }))
    .filter(d => d.value > 0);

  return (
    <PieChart width={250} height={220}>
      <Pie data={data} dataKey="value" nameKey="name" outerRadius={65} />
      <Tooltip />
      <Legend />
    </PieChart>
  );
}

export default function Projects() {
  const [projekty, setProjekty] = useState([]);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [tasks, setTasks] = useState([]);
  const [tasksError, setTasksError] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({ name: '', description: '' });
  const [actionError, setActionError] = useState('');
  const [busyId, setBusyId] = useState(null);

  useEffect(() => {
    document.title = 'Projekty';
    let active = true;
    (async () => {
      try {
        const response = await apiFetch(`${API_URL}/api/projects`);
        const data = await readResponse(response);
        if (active) setProjekty(data);
      } catch (err) {
        if (active) setError(err.message);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const response = await apiFetch(`${API_URL}/api/tasks`);
        const data = await readResponse(response);
        if (active) setTasks(data);
      } catch (err) {
        if (active) setTasksError(err.message);
      }
    })();
    return () => { active = false; };
  }, []);

  const tasksByProject = tasks.reduce((acc, task) => {
    if (task.project_id != null) {
      (acc[task.project_id] ||= []).push(task);
    }
    return acc;
  }, {});

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (saving) return;
    setError('');
    setSaving(true);
    try {
      const response = await apiFetch(`${API_URL}/api/projects`, {
        method: 'POST',
        body: JSON.stringify({ name, description }),
      });
      const project = await readResponse(response);
      setProjekty(previous => [...previous, project]);
      setName('');
      setDescription('');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const startEdit = project => {
    setEditingId(project.id);
    setEditForm({ name: project.name, description: project.description ?? '' });
    setActionError('');
  };

  const saveProject = async event => {
    event.preventDefault();
    if (busyId !== null) return;
    setBusyId(editingId);
    setActionError('');
    try {
      const response = await apiFetch(`/api/projects/${editingId}`, {
        method: 'PUT',
        body: JSON.stringify(editForm),
      });
      const updated = await readResponse(response);
      setProjekty(previous => previous.map(project => Number(project.id) === Number(updated.id) ? updated : project));
      setEditingId(null);
    } catch (err) {
      setActionError(err.message);
    } finally {
      setBusyId(null);
    }
  };

  const deleteProject = async project => {
    if (busyId !== null) return;
    if (!window.confirm(`Czy na pewno usunąć projekt „${project.name}” i WSZYSTKIE należące do niego zadania? Tej operacji nie można cofnąć.`)) return;
    setBusyId(project.id);
    setActionError('');
    try {
      const response = await apiFetch(`/api/projects/${project.id}`, { method: 'DELETE' });
      await readResponse(response);
      setProjekty(previous => previous.filter(item => Number(item.id) !== Number(project.id)));
      setTasks(previous => previous.filter(task => Number(task.project_id) !== Number(project.id)));
      if (editingId === project.id) setEditingId(null);
    } catch (err) {
      setActionError(err.message);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <>
      <div className="new-task">
        <form onSubmit={handleSubmit}>
          <h1>Nowy Projekt</h1>
          <input type="text" name="nazwa" aria-label="Nazwa projektu" placeholder="Nazwa Projektu*" required maxLength={100} value={name} onChange={event => setName(event.target.value)} />
          <textarea name="opis" aria-label="Opis projektu" placeholder="Opis projektu" value={description} onChange={event => setDescription(event.target.value)} />
          <button type="submit" disabled={saving || loading}>{saving ? 'Dodawanie…' : 'Dodaj Projekt'}</button>
          {error && <p role="alert">{error}</p>}
          <p>* - Pola wymagane</p>
        </form>
      </div>
      <div className="projects">
        {actionError && <p role="alert">{actionError}</p>}
        {loading && <p>Ładowanie projektów…</p>}
        {!loading && !error && projekty.length === 0 && <p className="no-projects-text">Nie masz jeszcze projektów.</p>}
        {tasksError && <p role="alert">{tasksError}</p>}
        {projekty.map(project => {
          const projectTasks = tasksByProject[project.id] ?? [];
          return (
            <div className={`project${editingId === project.id ? ' new-task' : ''}`} key={project.id}>
              <div className="project-half">
                {editingId === project.id ? (
                  <form onSubmit={saveProject}>
                    <h3>Edytuj projekt</h3>
                    <label htmlFor={`project-name-${project.id}`}>Nazwa projektu*</label>
                    <input id={`project-name-${project.id}`} type="text" required maxLength={100} value={editForm.name} onChange={event => setEditForm({ ...editForm, name: event.target.value })} />
                    <label htmlFor={`project-description-${project.id}`}>Opis</label>
                    <textarea id={`project-description-${project.id}`} value={editForm.description} onChange={event => setEditForm({ ...editForm, description: event.target.value })} />
                    <button type="submit" disabled={busyId !== null}>{busyId === project.id ? 'Zapisywanie…' : 'Zapisz'}</button>{' '}
                    <button type="button" disabled={busyId !== null} onClick={() => setEditingId(null)}>Anuluj</button>
                  </form>
                ) : (
                  <>
                    <h3>{project.name}</h3>
                    {project.description && <p>{project.description}</p>}
                    <button type="button" disabled={busyId !== null} onClick={() => startEdit(project)}>Edytuj</button>{' '}
                  </>
                )}
                <button className={editingId === project.id ? 'project-delete-editing' : undefined} type="button" disabled={busyId !== null} onClick={() => deleteProject(project)}>Usuń projekt</button>
                <h4>Zadania:</h4>
                {projectTasks.length === 0 ? (
                  <p>Brak zadań w tym projekcie.</p>
                ) : (
                  <>
                    <ul>
                      {projectTasks.map(task => <li key={task.id}>{task.name}</li>)}
                    </ul>
                  </>
                )}
              </div>
              <div className="project-half">
                {projectTasks.length === 0 ? (
                  <p>Brak zadań w tym projekcie.</p>
                ) : (
                  <>
                    <ProjectStatusChart tasks={projectTasks} />
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
