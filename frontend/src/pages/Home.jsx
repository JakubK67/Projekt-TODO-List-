import axios from 'axios';
import '../api.js';
import { useState, useEffect } from "react";
import ReportPanel from './ReportPanel';
import DateInput from '../components/DateInput';
import CalendarView from '../components/CalendarView';
import TaskFiles from '../components/TaskFiles';
import { formatDate } from '../utils/date';

const API_URL = '';
const PRIORITIES = ['Niski', 'Normalny', 'Wysoki'];
const STATUSES = ['Do zrobienia', 'Realizowane', 'Wykonane'];
const VIEWS = [
  { id: 'list', label: 'Lista' },
  { id: 'calendar', label: 'Kalendarz' },
];

const loadView = () => {
  try {
    const saved = localStorage.getItem('tasksView');
    return VIEWS.some(v => v.id === saved) ? saved : 'list';
  } catch {
    return 'list';
  }
};

export default function Home() {
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [priority, setPrior] = useState('0');
  const [deadline, setDl] = useState('');
  const [tasks, setTasks] = useState([]);
  const [status, setStatus] = useState('0');
  const [submitError, setSubmitError] = useState('');
  const [tasksError, setTasksError] = useState('');
  const [projects, setProjects] = useState([]);
  const [projectId, setProjectId] = useState('');
  const [projectsError, setProjectsError] = useState('');
  const [view, setView] = useState(loadView);

  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [editError, setEditError] = useState('');

  const changeView = (id) => {
    setView(id);
    try {
      localStorage.setItem('tasksView', id);
    } catch {
      
    }
  };

  const startEdit = (t) => {
    setEditError('');
    setEditingId(t.id);
    setEditForm({
      name: t.name,
      description: t.description ?? '',
      deadline: t.deadline ?? '',
      priority: String(Math.max(PRIORITIES.indexOf(t.priority), 0)),
      status: String(Math.max(STATUSES.indexOf(t.status), 0)),
      project_id: t.project_id == null ? '' : String(t.project_id),
    });
  };

  const cancelEdit = () => {
    setEditError('');
    setEditingId(null);
    setEditForm({});
  };

  const handleEditChange = (e) => {
    setEditForm({ ...editForm, [e.target.name]: e.target.value });
  };

  const saveEdit = async (e, id) => {
    e.preventDefault();
    setEditError('');
    try {
      await axios.put(`${API_URL}/api/tasks/${id}`, {
        id,
        name: editForm.name,
        description: editForm.description,
        deadline: editForm.deadline,
        priority: PRIORITIES[editForm.priority],
        status: STATUSES[editForm.status],
        project_id: editForm.project_id === '' ? null : Number(editForm.project_id),
      });
      cancelEdit();
      loadTasks();
    } catch (err) {
      setEditError(err.response?.data?.error || 'Nie udało się zapisać zadania.');
      console.error(err);
    }
  };

  const loadTasks = async () => {
    setTasksError('');
    try {
      const res = await axios.get(`${API_URL}/api/tasks`);
      setTasks(res.data);
    } catch (err) {
      setTasksError(err.response?.data?.error || 'Nie udało się pobrać zadań. Sprawdź połączenie z backendem.');
      console.error(err);
    }
  };

  useEffect(() => {
    document.title = 'Zadania';
    loadTasks();
    let active = true;
    (async () => {
      try {
        const response = await axios.get(`${API_URL}/api/projects`);
        if (active) setProjects(response.data);
      } catch (err) {
        if (active) setProjectsError(err.response?.data?.error || 'Nie udało się pobrać projektów. Możesz dodać zadanie bez projektu.');
      }
    })();
    return () => { active = false; };
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitError('');
    try {
      await axios.post(
        `${API_URL}/api/tasks`,
        { name, desc, priority, deadline, status, project_id: projectId === '' ? null : Number(projectId) },
      );
      loadTasks();
    } catch (err) {
      setSubmitError(err.response?.data?.error || 'Nie udało się dodać zadania. Sprawdź połączenie z backendem.');
      console.error(err);
    }
  };

  const handleDelete = async (id) => {
    const task = tasks.find(item => item.id === id);
    if (!window.confirm(`Czy na pewno usunąć zadanie „${task?.name || 'Wybrane zadanie'}”? Tej operacji nie można cofnąć.`)) return;
    try {
      await axios.delete(`${API_URL}/api/tasks/${id}`);
      loadTasks();
    } catch (err) {
      setTasksError(err.response?.data?.error || 'Nie udało się usunąć zadania.');
      console.error(err);
    }
  };

  return (
    <>
            <div className="new-task">
                <form onSubmit={handleSubmit}>
                    <h1>Nowe Zadanie</h1>
                    <input type="text" name="nazwa" placeholder="Nazwa Zadania*" required onChange={(e) => setName(e.target.value)}></input>
                    <textarea name="opis" placeholder="Opis" onChange={(e) => setDesc(e.target.value)}></textarea>
                    <label htmlFor="add-project">Projekt:</label><br />
                    <select id="add-project" name="project_id" value={projectId} onChange={event => setProjectId(event.target.value)}>
                      <option value="">Brak</option>
                      {projects.map(project => <option key={project.id} value={project.id}>{project.name}</option>)}
                    </select><br /><br />
                    {projectsError && <p role="alert">{projectsError}</p>}
                    <label>Priorytet:</label><br />
                    {PRIORITIES.map((p, i) => (
                      <div className="radio-group" key={p}>
                        <input type="radio" id={`add-prior-${i}`} name="priorytet" value={String(i)}
                          checked={priority === String(i)} onChange={(e) => setPrior(e.target.value)} />
                        <label htmlFor={`add-prior-${i}`}>{p}</label><br />
                      </div>
                    ))}
                    <br />
                    <label>Status:</label><br />
                    {STATUSES.map((s, i) => (
                      <div className="radio-group" key={s}>
                        <input type="radio" id={`add-status-${i}`} name="status" value={String(i)}
                          checked={status === String(i)} onChange={(e) => setStatus(e.target.value)} />
                        <label htmlFor={`add-status-${i}`}>{s}</label><br />
                      </div>
                    ))}
                    <br />
                    <label htmlFor="termin">Termin*</label>
                    <DateInput name="termin" id="termin" required value={deadline} onChange={setDl} /><br /><br />
                    <button type="submit">Dodaj Zadanie</button>
                    {submitError && <p role="alert">{submitError}</p>}
                    <p>* - Pola wymagane</p>
                </form>
            </div>

            <div className="view-switch" role="group" aria-label="Widok zadań">
              {VIEWS.map(v => (
                <button
                  type="button"
                  key={v.id}
                  aria-pressed={view === v.id}
                  disabled={view === v.id}
                  onClick={() => changeView(v.id)}
                >
                  {v.label}
                </button>
              ))}
            </div>

            {view === 'calendar' ? (
              <>
                {tasksError && <p role="alert">{tasksError}</p>}
                <CalendarView tasks={tasks} />
              </>
            ) : (
            <div className="tasks">
              {tasksError && <p role="alert">{tasksError}</p>}
              {tasks.map((t) => (
                <div className={`task priority-${t.priority.toLowerCase()}${editingId === t.id ? ' new-task' : ''}`} key={t.id}>
                  {editingId === t.id ? (
                    <>
                      <form onSubmit={(e) => saveEdit(e, t.id)}>
                        <h1>Edytuj Zadanie</h1>
                        <input type="text" name="name" placeholder="Nazwa Zadania*" required maxLength={100}
                          value={editForm.name} onChange={handleEditChange} />
                        <textarea name="description" placeholder="Opis"
                          value={editForm.description} onChange={handleEditChange}></textarea>

                        <label htmlFor={`edit-project-${t.id}`}>Projekt:</label><br />
                        <select id={`edit-project-${t.id}`} name="project_id" value={editForm.project_id} onChange={handleEditChange}>
                          <option value="">Brak</option>
                          {projects.map(project => <option key={project.id} value={project.id}>{project.name}</option>)}
                        </select><br /><br />
                        {projectsError && <p role="alert">{projectsError}</p>}

                        <label>Priorytet:</label><br />
                        {PRIORITIES.map((p, i) => (
                          <div className="radio-group" key={p}>
                            <input type="radio" id={`edit-prior-${t.id}-${i}`} name="priority" value={String(i)}
                              checked={editForm.priority === String(i)} onChange={handleEditChange} />
                            <label htmlFor={`edit-prior-${t.id}-${i}`}>{p}</label><br />
                          </div>
                        ))}
                        <br />

                        <label>Status:</label><br />
                        {STATUSES.map((s, i) => (
                          <div className="radio-group" key={s}>
                            <input type="radio" id={`edit-status-${t.id}-${i}`} name="status" value={String(i)}
                              checked={editForm.status === String(i)} onChange={handleEditChange} />
                            <label htmlFor={`edit-status-${t.id}-${i}`}>{s}</label><br />
                          </div>
                        ))}
                        <br />

                        <label htmlFor={`edit-deadline-${t.id}`}>Termin*</label>
                        <DateInput name="deadline" id={`edit-deadline-${t.id}`} required
                          value={editForm.deadline} onChange={value => setEditForm(previous => ({ ...previous, deadline: value }))} /><br /><br />

                        <button type="submit">Zapisz</button>
                        {' '}
                        <button type="button" onClick={cancelEdit}>Anuluj</button>
                        {editError && <p role="alert">{editError}</p>}
                        <p>* - Pola wymagane</p>
                      </form>
                    </>
                  ) : (
                    <>
                      {t.project_name && <h2>{t.project_name}</h2>}
                      <h3>{t.name}</h3>
                      <p>Termin: {formatDate(t.deadline)}</p>
                      <p>Priorytet: {t.priority}</p>
                      <p>Status: {t.status}</p>
                      <p>Opis: {t.description || 'Brak opisu'}</p>
                      <button type="button" onClick={() => startEdit(t)}>Edytuj</button>
                      {' '}
                      <button type="button" onClick={() => handleDelete(t.id)}>Usuń</button>
                      <TaskFiles taskId={t.id} />
                    </>
                  )}
                </div>
              ))}
            </div>
            )}
            <ReportPanel tasks={tasks} />
    </>
  );
}