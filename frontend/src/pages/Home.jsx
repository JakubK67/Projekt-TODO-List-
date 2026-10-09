import axios from 'axios';
import { useState, useEffect } from "react";

const API_URL = 'http://localhost:8080';

export default function Home() {
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [priority, setPrior] = useState('0');
  const [deadline, setDl] = useState('');
  const [tasks, setTasks] = useState([]);

  const loadTasks = async () => {
    try {
      const res = await axios.get(`${API_URL}/showtasks.php`);
      setTasks(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadTasks();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API_URL}/addtasks.php`, { name, desc, priority, deadline });
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
                    <label htmlFor="priorytet">Priorytet:</label><br />
                    <div className="radio-group">

                      <input type="radio" id="niski" name="priorytet" value="0" defaultChecked onChange={(e) => setPrior(e.target.value)}></input>
                      <label htmlFor="niski">Niski</label><br />
                    </div>

                    <div className="radio-group">
                      <input type="radio" id="normalny" name="priorytet" value="1" onChange={(e) => setPrior(e.target.value)}></input>
                      <label htmlFor="normalny">Normalny</label><br />
                    </div>

                    <div className="radio-group">
                      <input type="radio" id="wysoki" name="priorytet" value="2" onChange={(e) => setPrior(e.target.value)}></input>
                      <label htmlFor="wysoki">Wysoki</label>
                    </div><br /><br />
                    <label htmlFor="termin">Termin*</label>
                    <input type="date" name="termin" id="termin" required onChange={(e) => setDl(e.target.value)}></input><br></br><br></br>
                    <button type="submit">Dodaj Zadanie</button>
                    <p>* - Pola wymagane</p>
                </form>
            </div>

            <div className="tasks">
              {tasks.length === 0 ? (
                <p className="no-task-text">Tu pojawią się zadania projektu kiedy zostaną dodane!</p>
              ) : (
                tasks.map((t) => (
                  <div className="task" key={t.id}>
                    <h3>{t.name}</h3>
                    <p>{t.description}</p>
                    <p>Priorytet: {t.priority}</p>
                    <p>Status: {t.status}</p>
                    <p>{t.deadline}</p>
                  </div>
                ))
              )}
            </div>
    </>
  );
}

