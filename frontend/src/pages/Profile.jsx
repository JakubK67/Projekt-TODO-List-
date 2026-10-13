import keycloak from "../keycloak";

export default function Profile() {
  const t = keycloak.tokenParsed || {};
  const verified = t.email_verified === true;

  // Przekierowanie na ekran Keycloaka, po zapisaniu użytkownik wraca na tę stronę
  const runAction = (action) =>
    keycloak.login({ action, redirectUri: window.location.href });

  return (
    <section className="card">
      <h2>Mój profil</h2>

      <p><strong>Login:</strong> {t.preferred_username}</p>
      <p><strong>Imię:</strong> {t.given_name || "-"}</p>
      <p><strong>Nazwisko:</strong> {t.family_name || "-"}</p>
      <p>
        <strong>E-mail:</strong> {t.email || "-"}{" "}
        <span className="muted">
          ({verified ? "zweryfikowany" : "niezweryfikowany"})
        </span>
      </p>

      <div className="row">
        <button className="btn" onClick={() => runAction("UPDATE_PROFILE")}>
          Edytuj imię, nazwisko i e-mail
        </button>
        <button className="btn secondary" onClick={() => runAction("UPDATE_PASSWORD")}>
          Zmień hasło
        </button>
        {!verified && t.email && (
          <button className="btn secondary" onClick={() => runAction("VERIFY_EMAIL")}>
            Zweryfikuj e-mail
          </button>
        )}
      </div>
    </section>
  );
}
