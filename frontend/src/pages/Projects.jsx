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
    <section className="card">
      <h2>Projekty</h2>

      {projekty.map(projekt => (
        <div key={projekt.id}>
          <h3>{projekt.name}</h3>
          <p className="muted">{projekt.description}</p>
        </div>
      ))}
    </section>
  );
}