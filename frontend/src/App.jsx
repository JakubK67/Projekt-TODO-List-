import keycloak from "./keycloak";

export default function App() {
  return (
    <div>
      <h1>TODO App</h1>
      <p>Zalogowany: {keycloak.tokenParsed?.preferred_username}</p>
      <button onClick={() => keycloak.logout()}>Wyloguj</button>
    </div>
  );
}
