import axios from 'axios';
import '../api.js';
import { useState, useEffect, useRef } from "react";
import ReportPanel from './ReportPanel';
import DateInput from '../components/DateInput';
import CalendarView from '../components/CalendarView';
import TaskFiles from '../components/TaskFiles';
import { formatDate } from '../utils/date';
import { MAX_DESCRIPTION_LENGTH, validateDescription, validateTaskName } from '../utils/validation';

const API_URL = '';
const requestErrorMessage = (error, fallback) => {
  if (!error.response) return fallback;
  return error.response.data?.error || error.response.data?.message || `Serwer zwrócił błąd HTTP ${error.response.status}.`;
};
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
  const descriptionInput = useRef(null);
  const [priority, setPrior] = useState('0');
  const [deadline, setDl] = useState('');
  const [tasks, setTasks] = useState([]);
  const [status, setStatus] = useState('0');
  const [submitError, setSubmitError] = useState('');
  const [tasksError, setTasksError] = useState('');
  const [projects, setProjects] = useState([]);
  const [projectId, setProjectId] = useState('');
  const [projectsError, setProjectsError] = useState('');
  const [notesByTask, setNotesByTask] = useState({});
  const [openNotes, setOpenNotes] = useState({});
  const [noteDrafts, setNoteDrafts] = useState({});
  const [editNoteDraft, setEditNoteDraft] = useState('');
  const [editingNote, setEditingNote] = useState(null);
  const [notesError, setNotesError] = useState({});
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
    const nameError = validateTaskName(editForm.name ?? '');
    const descriptionError = validateDescription(editForm.description ?? '');
    if (nameError || descriptionError) {
      setEditError(nameError || descriptionError);
      return;
    }
    try {
      await axios.put(`${API_URL}/api/tasks/${id}`, {
        id,
        name: editForm.name.trim(),
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
    const nameError = validateTaskName(name);
    const descriptionError = validateDescription(descriptionInput.current?.value ?? '');
    if (nameError || descriptionError) {
      setSubmitError(nameError || descriptionError);
      return;
    }
    try {
      await axios.post(
        `${API_URL}/api/tasks`,
        { name: name.trim(), description: descriptionInput.current?.value ?? '', priority, deadline, status, project_id: projectId === '' ? null : Number(projectId) },
      );
      loadTasks();
    } catch (err) {
      setSubmitError(requestErrorMessage(err, 'Nie udało się połączyć z backendem.'));
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

  const toggleNotes = async (taskId) => {
    if (openNotes[taskId]) {
      setOpenNotes(previous => ({ ...previous, [taskId]: false }));
      return;
    }
    setOpenNotes(previous => ({ ...previous, [taskId]: true }));
    if (notesByTask[taskId]) return;
    try {
      const response = await axios.get(`${API_URL}/api/tasks/${taskId}/notes`);
      setNotesByTask(previous => ({ ...previous, [taskId]: response.data }));
    } catch (err) {
      setNotesError(previous => ({ ...previous, [taskId]: err.response?.data?.error || 'Nie udało się pobrać notatek.' }));
    }
  };

  const saveNote = async (event, taskId, noteId = null) => {
    event.preventDefault();
    const content = noteId ? editNoteDraft : noteDrafts[taskId] ?? '';
    try {
      if (noteId) {
        await axios.put(`${API_URL}/api/tasks/${taskId}/notes/${noteId}`, { content });
      } else {
        await axios.post(`${API_URL}/api/tasks/${taskId}/notes`, { content });
      }
      const response = await axios.get(`${API_URL}/api/tasks/${taskId}/notes`);
      setNotesByTask(previous => ({ ...previous, [taskId]: response.data }));
      setNoteDrafts(previous => ({ ...previous, [taskId]: '' }));
      setEditingNote(null);
      setEditNoteDraft('');
      setNotesError(previous => ({ ...previous, [taskId]: '' }));
    } catch (err) {
      setNotesError(previous => ({ ...previous, [taskId]: err.response?.data?.error || 'Nie udało się zapisać notatki.' }));
    }
  };

  const deleteNote = async (taskId, noteId) => {
    if (!window.confirm('Usunąć tę notatkę?')) return;
    try {
      await axios.delete(`${API_URL}/api/tasks/${taskId}/notes/${noteId}`);
      setNotesByTask(previous => ({ ...previous, [taskId]: previous[taskId].filter(note => note.id !== noteId) }));
    } catch (err) {
      setNotesError(previous => ({ ...previous, [taskId]: err.response?.data?.error || 'Nie udało się usunąć notatki.' }));
    }
  };



  return (
    <>
            <div className="new-task">
                <form onSubmit={handleSubmit}>
                    <h1>Nowe Zadanie</h1>
                    <input type="text" name="nazwa" placeholder="Nazwa zadania* (maks. 100 znaków)" required maxLength={100} value={name} aria-invalid={Boolean(submitError && validateTaskName(name))} aria-describedby="add-task-name-error" onInvalid={() => setSubmitError('Wpisz nazwę zadania.')} onChange={(e) => { setName(e.target.value); setSubmitError(''); }} />
                    {submitError && validateTaskName(name) && <p id="add-task-name-error" role="alert">{submitError}</p>}
                    <textarea ref={descriptionInput} name="opis" placeholder={`Opis (maks. ${MAX_DESCRIPTION_LENGTH} znaków)`} maxLength={MAX_DESCRIPTION_LENGTH} />
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
                    {submitError && !validateTaskName(name) && <p role="alert">{submitError}</p>}
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
                        <input type="text" name="name" placeholder="Nazwa zadania* (maks. 100 znaków)" required maxLength={100}
                          value={editForm.name} aria-invalid={Boolean(editError && validateTaskName(editForm.name ?? ''))} aria-describedby={`edit-task-name-error-${t.id}`} onInvalid={() => setEditError('Wpisz nazwę zadania.')} onChange={event => { handleEditChange(event); setEditError(''); }} />
                        {editError && validateTaskName(editForm.name ?? '') && <p id={`edit-task-name-error-${t.id}`} role="alert">{editError}</p>}
                        <textarea name="description" placeholder={`Opis (maks. ${MAX_DESCRIPTION_LENGTH} znaków)`} maxLength={MAX_DESCRIPTION_LENGTH}
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
                        {editError && !validateTaskName(editForm.name ?? '') && <p role="alert">{editError}</p>}
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
                      <section className="task-notes" aria-label={`Notatki do zadania: ${t.name}`}>
                        <button
                          className="task-notes-toggle"
                          type="button"
                          onClick={() => toggleNotes(t.id)}
                        >
                          <span aria-hidden="true">✎</span>
                          {openNotes[t.id] ? 'Ukryj notatki' : 'Notatki'}
                          {notesByTask[t.id]?.length > 0 && (
                            <span className="task-notes-count">
                              {notesByTask[t.id].length}
                            </span>
                          )}
                        </button>
                        {openNotes[t.id] && <div className="task-notes-content">
                          {(notesByTask[t.id] || []).map(note => <article className="task-note" key={note.id}>
                            {editingNote === note.id ? <form onSubmit={event => saveNote(event, t.id, note.id)}>
                              <textarea maxLength={21845} required value={editNoteDraft} onChange={event => setEditNoteDraft(event.target.value)} />
                              <div className="task-note-actions"><button type="submit">Zapisz</button> <button className="task-note-secondary" type="button" onClick={() => { setEditingNote(null); setEditNoteDraft(''); }}>Anuluj</button></div>
                            </form> : <><p>{note.content}</p><div className="task-note-actions"><button className="task-note-secondary" type="button" onClick={() => { setEditingNote(note.id); setEditNoteDraft(note.content); }}>Edytuj</button> <button className="task-note-danger" type="button" onClick={() => deleteNote(t.id, note.id)}>Usuń</button></div></>}
                          </article>)}
                          <form className="task-note-form" onSubmit={event => saveNote(event, t.id)}>
                            <label htmlFor={`note-${t.id}`}>Dodaj notatkę</label>
                            <textarea id={`note-${t.id}`} maxLength={21845} required value={noteDrafts[t.id] ?? ''} onChange={event => setNoteDrafts(previous => ({ ...previous, [t.id]: event.target.value }))} />
                            <button type="submit">Dodaj notatkę</button>
                          </form>
                          {notesError[t.id] && <p role="alert">{notesError[t.id]}</p>}
                        </div>}
                      </section>
                      <div className="task-actions">
                        <button type="button" onClick={() => startEdit(t)}>Edytuj</button>
                        <button type="button" onClick={() => handleDelete(t.id)}>Usuń</button>
                      </div>
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
