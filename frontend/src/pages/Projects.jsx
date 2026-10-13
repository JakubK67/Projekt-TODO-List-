import { useState, useEffect } from "react";
import { PieChart, Pie, Tooltip, Legend } from 'recharts';

import keycloak from '../keycloak';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';
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

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        await keycloak.updateToken(30);
        const response = await fetch(`${API_URL}/api/projects`, {
          headers: { Authorization: `Bearer ${keycloak.token}` },
        });
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
        await keycloak.updateToken(30);
        const response = await fetch(`${API_URL}/showtasks.php`, {
          headers: { Authorization: `Bearer ${keycloak.token}` },
        });
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
      await keycloak.updateToken(30);
      const response = await fetch(`${API_URL}/addprojects.php`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${keycloak.token}`,
          'Content-Type': 'application/json',
        },
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
        {loading && <p>Ładowanie projektów…</p>}
        {!loading && !error && projekty.length === 0 && <p className="no-projects-text">Nie masz jeszcze projektów.</p>}
        {tasksError && <p role="alert">{tasksError}</p>}
        {projekty.map(project => {
          const projectTasks = tasksByProject[project.id] ?? [];
          return (
            <div className="project" key={project.id}>
              <div className="project-half">
                <h3>{project.name}</h3>
                {project.description && <p>{project.description}</p>}
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