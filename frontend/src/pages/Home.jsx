import axios from 'axios';
import { use, useState } from "react";

const STATUSES = ["do zrobienia", "realizowane", "wykonane"];
const PRIORITIES = ["Niski", "Normalny", "Wysoki"];
const EMPTY_FORM = { name: "", description: "", dueDate: "", priority: "Normalny" };

export default function Home() {

  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [priority, setPrior] = useState('0');
  const [deadline, setDl] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    const res = await axios.post('http://localhost:8080/tasks.php', {name, desc, priority, deadline})
    console.log(res)

  } 

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
                <p className="no-task-text">Tu pojawią się zadania projektu kiedy zostaną dodane!</p>
            </div>
    </>
  );
}

