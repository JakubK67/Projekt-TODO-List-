import { useState, useEffect } from "react";

export default function Projects({ keycloak }) {
  const [projekty, setProjekty] = useState([]);

  useEffect(() => {
    if (!keycloak?.token) return;

    fetch("http://localhost:8080/api/projects", {
      headers: {
        Authorization: "Bearer " + keycloak.token
      }
    })
      .then(odpowiedz => {
        if (!odpowiedz.ok) {
          throw new Error("Nie udało się pobrać projektówji");
        }
        return odpowiedz.json();
      })
      .then(dane => setProjekty(dane))
      .catch(blad => console.log(blad));

  }, [keycloak?.token]);

  return (
    <>
      <div className="new-task">
          <form>
              <h1>Nowy Projekt</h1>
              <input type="text" name="nazwa" placeholder="Nazwa Projektu*" required></input>
              <button type="submit">Dodaj Projekt</button>
              <p>* - Pola wymagane</p>
          </form>

          <div className="projects">
              <p className="no-projects-text">Tu pojawią się zadania projektu kiedy zostaną dodane!</p>
          </div>
      </div>
    </>
  );
}