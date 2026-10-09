import { use, useState } from "react";

const STATUSES = ["do zrobienia", "realizowane", "wykonane"];
const PRIORITIES = ["Niski", "Normalny", "Wysoki"];
const EMPTY_FORM = { name: "", description: "", dueDate: "", priority: "Normalny" };

const fmt = (iso) => (iso ? new Date(iso).toLocaleString("pl-PL") : "-");
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString("pl-PL") : "-");

export default function Home() {

  return (
    <>
            <div className="new-task">
                <form>
                    <h1>Nowe Zadanie</h1>
                    <input type="text" name="nazwa" placeholder="Nazwa Zadania*" required></input>
                    <textarea name="opis" placeholder="Opis"></textarea>
                    <label htmlFor="priorytet">Priorytet:</label><br />
                    <div className="radio-group">

                      <input type="radio" id="niski" name="priorytet" value="0" defaultChecked></input>
                      <label htmlFor="niski">Niski</label><br />
                    </div>

                    <div className="radio-group">
                      <input type="radio" id="normalny" name="priorytet" value="1"></input>
                      <label htmlFor="normalny">Normalny</label><br />
                    </div>

                    <div className="radio-group">
                      <input type="radio" id="wysoki" name="priorytet" value="2"></input>
                      <label htmlFor="wysoki">Wysoki</label>
                    </div><br /><br />
                    <label htmlFor="termin">Termin*</label>
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

