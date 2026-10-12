import axios from 'axios';
import keycloak from '../keycloak';
import { useState, useEffect } from "react";

const API_URL = 'http://localhost:8080';
const PRIORITIES = ['Niski', 'Normalny', 'Wysoki'];
const STATUSES = ['Do zrobienia', 'Realizowane', 'Wykonane'];

export default function Home() {
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [priority, setPrior] = useState('0');
  const [deadline, setDl] = useState('');
  const [tasks, setTasks] = useState([]);
  const [status, setStatus] = useState('0');
  const [submitError, setSubmitError] = useState('');
  const [tasksError, setTasksError] = useState('');

  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});

  const startEdit = (t) => {
    setEditingId(t.id);
    setEditForm({
      name: t.name,
      description: t.description ?? '',
      deadline: t.deadline ?? '',
      priority: String(Math.max(PRIORITIES.indexOf(t.priority), 0)),
      status: String(Math.max(STATUSES.indexOf(t.status), 0)),
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm({});
  };

  const handleEditChange = (e) => {
    setEditForm({ ...editForm, [e.target.name]: e.target.value });
  };

  const saveEdit = async (e, id) => {
    e.preventDefault();
    try {
      await axios.post(`${API_URL}/edittasks.php`, {
        id,
        name: editForm.name,
        description: editForm.description,
        deadline: editForm.deadline,
        priority: PRIORITIES[editForm.priority],
        status: STATUSES[editForm.status],
      });
      cancelEdit();
      loadTasks();
    } catch (err) {
      console.error(err);
    }
  };

  const loadTasks = async () => {
    setTasksError('');
    try {
      await keycloak.updateToken(30);
      const res = await axios.get(`${API_URL}/showtasks.php`, {
        headers: { Authorization: `Bearer ${keycloak.token}` },
      });
      setTasks(res.data);
    } catch (err) {
      setTasksError(err.response?.data?.error || 'Nie udało się pobrać zadań. Sprawdź połączenie z backendem.');
      console.error(err);
    }
  };

  useEffect(() => {
    loadTasks();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitError('');
    try {
      await keycloak.updateToken(30);
      await axios.post(
        `${API_URL}/addtasks.php`,
        { name, desc, priority, deadline, status },
        { headers: { Authorization: `Bearer ${keycloak.token}` } },
      );
      loadTasks();
    } catch (err) {
      setSubmitError(err.response?.data?.error || 'Nie udało się dodać zadania. Sprawdź połączenie z backendem.');
      console.error(err);
    }
  };

  const handleDelete = async (id) => {
  try {
    await axios.post(`${API_URL}/deletetasks.php`, { id });
    loadTasks();
  } catch (err) {
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
                    <input type="date" name="termin" id="termin" required onChange={(e) => setDl(e.target.value)} /><br /><br />
                    <button type="submit">Dodaj Zadanie</button>
                    {submitError && <p role="alert">{submitError}</p>}
                    <p>* - Pola wymagane</p>
                </form>
            </div>

            <div className="tasks">
              {tasksError && <p role="alert">{tasksError}</p>}
              {tasks.map((t) => (
                <div className={`task priority-${t.priority.toLowerCase()}`} key={t.id}>
                  {editingId === t.id ? (
                    <>
                      <form onSubmit={(e) => saveEdit(e, t.id)}>
                        <h1>Edytuj Zadanie</h1>
                        <input type="text" name="name" placeholder="Nazwa Zadania*" required maxLength={100}
                          value={editForm.name} onChange={handleEditChange} />
                        <textarea name="description" placeholder="Opis"
                          value={editForm.description} onChange={handleEditChange}></textarea>

                        <label>Priorytet:</label><br />
                        {PRIORITIES.map((p, i) => (
                          <div className="radio-group" key={p}>
                            <input type="radio" id={`edit-prior-${t.id}-${i}`} name="priority" value={String(i)}
                              checked={editForm.priority === String(i)} onChange={handleEditChange} />
                            <label htmlFor={`edit-prior-${t.id}-${i}`}>{p}</label><br />
                          </div>
                        ))}
                        <br />

                        <label htmlFor={`edit-deadline-${t.id}`}>Termin*</label>
                        <input type="date" name="deadline" id={`edit-deadline-${t.id}`} required
                          value={editForm.deadline} onChange={handleEditChange} /><br /><br />

                        <label>Status:</label><br />
                        {STATUSES.map((s, i) => (
                          <div className="radio-group" key={s}>
                            <input type="radio" id={`edit-status-${t.id}-${i}`} name="status" value={String(i)}
                              checked={editForm.status === String(i)} onChange={handleEditChange} />
                            <label htmlFor={`edit-status-${t.id}-${i}`}>{s}</label><br />
                          </div>
                        ))}
                        <br />

                        <button type="submit">Zapisz</button>
                        <button type="button" onClick={cancelEdit}>Anuluj</button>
                        <p>* - Pola wymagane</p>
                      </form>
                    </>
                  ) : (
                    <>
                      <h3>{t.name}</h3>
                      <p>{t.description}</p>
                      <p>Priorytet: {t.priority}</p>
                      <p>Termin: {t.deadline}</p>
                      <p>Status: {t.status}</p>
                      <button type="button" onClick={() => startEdit(t)}>Edytuj</button>
                      <button type="button" onClick={() => handleDelete(t.id)}>Usuń</button>
                    </>
                  )}
                </div>
              ))}
            </div>
    </>
  );
}

