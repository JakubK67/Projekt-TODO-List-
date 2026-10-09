export default function Projects() {
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