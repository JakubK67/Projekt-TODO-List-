import { NavLink, Navigate, Route, Routes } from "react-router-dom";
import keycloak from "./keycloak";
import Home from "./pages/Home.jsx";
import Projects from "./pages/Projects.jsx";
import Users from "./pages/Users.jsx";
import "./App.css";

export default function App() {
  const username = keycloak.tokenParsed?.preferred_username;
  const isAdmin = keycloak.hasRealmRole("admin");

  return (
    <div className="page">
      <header className="topbar">
        <h1>TODO App</h1>
        <nav className="nav">
          <NavLink to="/" end>Zadania</NavLink>
          <NavLink to="/projects">Projekty</NavLink>
          {isAdmin && <NavLink to="/users">Użytkownicy</NavLink>}
        </nav>
        <div className="user">
          <span>
            {username} ({isAdmin ? "administrator" : "użytkownik"})
          </span>
          <button
            className="btn secondary"
            onClick={() => keycloak.logout({ redirectUri: window.location.origin })}
          >
            Wyloguj
          </button>
        </div>
      </header>

      <main className="content">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/projects" element={<Projects />} />
          <Route
            path="/users"
            element={isAdmin ? <Users /> : <Navigate to="/" replace />}
          />
          <Route path="*" element={<p>Nie znaleziono strony.</p>} />
        </Routes>
      </main>
    </div>
  );
}