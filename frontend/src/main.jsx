import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import PublicStatistics from "./pages/PublicStatistics.jsx";
import "./index.css";

const root = ReactDOM.createRoot(document.getElementById("root"));

if (/^\/statistics\/[^/]+\/?$/.test(window.location.pathname)) {
  root.render(
    <React.StrictMode>
      <BrowserRouter>
        <Routes><Route path="/statistics/:token" element={<PublicStatistics />} /></Routes>
      </BrowserRouter>
    </React.StrictMode>
  );
} else {
  Promise.all([import('./AuthenticatedApp.jsx'), import('./keycloak')])
    .then(async ([{ default: AuthenticatedApp }, { default: keycloak }]) => {
      const authenticated = await keycloak.init({ onLoad: "login-required", pkceMethod: "S256" });
      if (!authenticated) return;
      root.render(
        <React.StrictMode>
          <BrowserRouter>
            <AuthenticatedApp />
          </BrowserRouter>
        </React.StrictMode>
      );
    })
    .catch((err) => {
      console.error("Keycloak init error:", err);
      root.render(<p>Nie udało się połączyć z Keycloakiem.</p>);
    });
}
