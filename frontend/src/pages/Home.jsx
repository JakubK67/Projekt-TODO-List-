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
            <div className="new-task">
                <form action="" method="post">
                    <h1>Nowe Zadanie</h1>
                    <input type="text" name="nazwa" placeholder="Nazwa Zadania*" required></input>
                    <textarea name="opis" placeholder="Opis"></textarea>
                    <label htmlfor="priorytet">Priorytet:</label>
                    <label htmlfor="niski">Niski</label>
                    <input type="radio" id="niski" name="priorytet" value="0" defaultChecked></input>
                    <label htmlfor="normalny">Normalny</label>
                    <input type="radio" id="normalny" name="priorytet" value="1"></input>
                    <label htmlfor="wysoki">Wysoki</label>
                    <input type="radio" id="wysoki" name="priorytet" value="2"></input><br /><br />
                    <label htmlfor="termin">Termin*</label>
                    <input type="date" name="termin" id="termin" required></input><br></br><br></br>
                    <button type="submit">Dodaj Zadanie</button>
                    <p>* - Pola wymagane</p>
                </form>
            </div>

            <div className="tasks">
                <p className="no-task-text">Tu pojawią się zadania projektu kiedy zostaną dodane!</p>
            </div>
    </>
  );
}

//GIKO MA MAŁĄ PAŁKĘ