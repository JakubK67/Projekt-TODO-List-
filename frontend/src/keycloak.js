import Keycloak from "keycloak-js";

// Authorization Code + PKCE; keycloak-js trzyma tokeny wyłącznie w pamięci.
const keycloak = new Keycloak({
  url: import.meta.env.VITE_KEYCLOAK_URL,
  realm: import.meta.env.VITE_KEYCLOAK_REALM,
  clientId: import.meta.env.VITE_KEYCLOAK_CLIENT_ID,
});

export default keycloak;
