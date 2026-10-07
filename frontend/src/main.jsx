import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.jsx";
import keycloak from "./keycloak";
import "./index.css";

const root = ReactDOM.createRoot(document.getElementById("root"));

keycloak
  .init({ onLoad: "login-required", pkceMethod: "S256" })
  .then((authenticated) => {
    if (authenticated) {
      root.render(
        <React.StrictMode>
          <BrowserRouter>
            <App />
          </BrowserRouter>
        </React.StrictMode>
      );
    }
  })
  .catch((err) => {
    console.error("Keycloak init error:", err);
    root.render(<p>Nie udało się połączyć z Keycloakiem.</p>);
  });