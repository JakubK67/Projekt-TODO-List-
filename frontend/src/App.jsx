import { NavLink, Navigate, Route, Routes } from "react-router-dom";
import keycloak from "./keycloak";
import Home from "./pages/Home.jsx";
import Projects from "./pages/Projects.jsx";
import Users from "./pages/Users.jsx";
import { useNavigate } from "react-router-dom";
import "./App.css";

import { useEffect } from "react";
import keycloak from "./keycloak";


useEffect(() => {
  (async () => {
    await keycloak.updateToken(30);
    const res = await fetch(import.meta.env.VITE_API_URL + "/api/me", {
      headers: { Authorization: `Bearer ${keycloak.token}` },
    });
    console.log("Użytkownik z bazy:", await res.json());
  })();
}, []);

export default function App() {
  const username = keycloak.tokenParsed?.preferred_username;
  const isAdmin = keycloak.hasRealmRole("admin");
  const navigate = useNavigate();

  return (
    <div className="page">
        <nav className="nav">
          <button className="nav-button" onClick={() => navigate("/")}>Zadania</button>
          <button className="nav-button" onClick={() => navigate("/projects")}>Projekty</button>
          {isAdmin && <NavLink to="/users">Użytkownicy</NavLink>}
        <button className="nav-button">
          <span>
            {username} ({isAdmin ? "administrator" : "użytkownik"})
          </span>

        </button>
          <button className="btn secondary" onClick={() => keycloak.logout({ redirectUri: window.location.origin })}>
            Wyloguj
          </button>
        </nav>

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

