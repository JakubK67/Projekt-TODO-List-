import { useState } from "react";

const STATUSES = ["do zrobienia", "realizowane", "wykonane"];
const PRIORITIES = ["Niski", "Normalny", "Wysoki"];
const EMPTY_FORM = { name: "", description: "", dueDate: "", priority: "Normalny" };

const fmt = (iso) => (iso ? new Date(iso).toLocaleString("pl-PL") : "-");
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString("pl-PL") : "-");

export default function Home() {
  const [tasks, setTasks] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState(null);
  const [filter, setFilter] = useState("wszystkie");

  const done = tasks.filter((t) => t.status === "wykonane").length;
  const percent = tasks.length ? Math.round((done / tasks.length) * 100) : 0;
  const visible =
    filter === "wszystkie" ? tasks : tasks.filter((t) => t.status === filter);

  function handleSubmit(e) {
    e.preventDefault();
    if (!form.name.trim()) return;
    const now = new Date().toISOString();

    if (editingId) {
      setTasks(tasks.map((t) => (t.id === editingId ? { ...t, ...form, updatedAt: now } : t)));
      setEditingId(null);
    } else {
      setTasks([
        ...tasks,
        { id: crypto.randomUUID(), ...form, status: "do zrobienia", createdAt: now, updatedAt: now },
      ]);
    }
    setForm(EMPTY_FORM);
  }

  function startEdit(task) {
    setEditingId(task.id);
    setForm({
      name: task.name,
      description: task.description,
      dueDate: task.dueDate,
      priority: task.priority,
    });
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(EMPTY_FORM);
  }

  function changeStatus(id, status) {
    setTasks(tasks.map((t) => (t.id === id ? { ...t, status, updatedAt: new Date().toISOString() } : t)));
  }

  function remove(id) {
    if (window.confirm("Usunąć to zadanie?")) setTasks(tasks.filter((t) => t.id !== id));
  }

  return (
    <>
      <section className="card">
        <h2>{editingId ? "Edytuj zadanie" : "Nowe zadanie"}</h2>
        <form onSubmit={handleSubmit} className="form">
          <input
            placeholder="Nazwa zadania *"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
          />
          <textarea
            placeholder="Opis"
            rows={3}
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
          <div className="row">
            <label>
              Termin
              <input
                type="date"
                value={form.dueDate}
                onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
              />
            </label>
            <label>
              Priorytet
              <select
                value={form.priority}
                onChange={(e) => setForm({ ...form, priority: e.target.value })}
              >
                {PRIORITIES.map((p) => (
                  <option key={p}>{p}</option>
                ))}
              </select>
            </label>
          </div>
          <div className="row">
            <button type="submit" className="btn">
              {editingId ? "Zapisz zmiany" : "Dodaj zadanie"}
            </button>
            {editingId && (
              <button type="button" className="btn secondary" onClick={cancelEdit}>
                Anuluj
              </button>
            )}
          </div>
        </form>
      </section>

      <section className="card">
        <div className="list-head">
          <h2>Zadania ({visible.length})</h2>
          <select value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="wszystkie">Wszystkie</option>
            {STATUSES.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </div>

        <div className="progress">
          <div className="bar" style={{ width: `${percent}%` }} />
        </div>
        <p className="muted">Ukończono: {percent}% ({done} z {tasks.length})</p>

        {visible.length === 0 && <p className="muted">Brak zadań.</p>}

        <ul className="tasks">
          {visible.map((t) => (
            <li key={t.id} className={`task prio-${t.priority}`}>
              <div className="task-main">
                <strong>{t.name}</strong>
                {t.description && <p>{t.description}</p>}
                <small className="muted">
                  Termin: {fmtDate(t.dueDate)} | Priorytet: {t.priority}
                  <br />
                  Dodano: {fmt(t.createdAt)} | Edycja: {fmt(t.updatedAt)}
                </small>
              </div>
              <div className="task-actions">
                <select value={t.status} onChange={(e) => changeStatus(t.id, e.target.value)}>
                  {STATUSES.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
                <button className="btn secondary" onClick={() => startEdit(t)}>Edytuj</button>
                <button className="btn danger" onClick={() => remove(t.id)}>Usuń</button>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}