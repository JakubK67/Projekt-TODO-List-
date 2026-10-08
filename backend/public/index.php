<?php
require __DIR__ . '/../vendor/autoload.php';

use Firebase\JWT\JWK;
use Firebase\JWT\JWT;

header('Access-Control-Allow-Origin: http://localhost:3000');
header('Access-Control-Allow-Headers: Authorization, Content-Type');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

function fail(int $code, string $msg): never {
    http_response_code($code);
    echo json_encode(['error' => $msg]);
    exit;
}

// Połączenie z bazą MySQL
$pdo = new PDO(
    getenv('DB_DSN'),
    getenv('DB_USER'),
    getenv('DB_PASSWORD'),
    [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION
    ]
);

// Tabela użytkowników aplikacji
$pdo->exec("
    CREATE TABLE IF NOT EXISTS users (
        keycloak_id VARCHAR(64) NOT NULL PRIMARY KEY,
        username VARCHAR(255) NOT NULL,
        email VARCHAR(255) NULL,
        role VARCHAR(20) NOT NULL DEFAULT 'user',
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        last_login TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) CHARACTER SET utf8mb4
");

// Tabela projektów
$pdo->exec("
    CREATE TABLE IF NOT EXISTS projects (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        description TEXT,
        user_id VARCHAR(64) NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(keycloak_id)
    ) CHARACTER SET utf8mb4
");

// Sprawdzanie tokenu Keycloak
function authenticate(): object {
    $header = $_SERVER['HTTP_AUTHORIZATION'] ?? '';

    if (!preg_match('/^Bearer\s+(.+)$/i', $header, $m)) {
        fail(401, 'Brak tokenu');
    }

    $realmUrl = rtrim(getenv('KEYCLOAK_URL'), '/')
        . '/realms/'
        . getenv('KEYCLOAK_REALM');

    $jwksJson = @file_get_contents(
        $realmUrl . '/protocol/openid-connect/certs'
    );

    if ($jwksJson === false) {
        fail(503, 'Nie można połączyć się z Keycloak');
    }

    $jwks = json_decode($jwksJson, true);

    if (!is_array($jwks)) {
        fail(503, 'Nieprawidłowa odpowiedź Keycloak');
    }

    try {
        JWT::$leeway = 30;

        $token = JWT::decode(
            $m[1],
            JWK::parseKeySet($jwks, 'RS256')
        );
    } catch (Throwable $e) {
        fail(401, 'Nieprawidłowy token');
    }

    if (($token->iss ?? '') !== getenv('KEYCLOAK_ISSUER')) {
        fail(401, 'Nieprawidłowy issuer');
    }

    // Sprawdzenie, czy token jest przeznaczony dla aplikacji.
    // W Keycloak należy skonfigurować odpowiednią audience.
    $audiences = (array) ($token->aud ?? []);

    if (!in_array('todo-backend', $audiences, true)) {
        fail(401, 'Nieprawidłowy odbiorca tokenu');
    }

    return $token;
}

// Aktualny adres API
$path = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);

// Pobieranie i zapisywanie zalogowanego użytkownika
if ($path === '/api/me' && $_SERVER['REQUEST_METHOD'] === 'GET') {

    $token = authenticate();

    $login = $token->preferred_username ?? '';
    $email = $token->email ?? null;
    $id = $token->sub;

    $roles = $token->realm_access->roles ?? [];
    $role = in_array('admin', $roles, true) ? 'admin' : 'user';

    // Zapis do tabeli users
    $stmt = $pdo->prepare("
        INSERT INTO users (keycloak_id, username, email, role)
        VALUES (:id, :username, :email, :role) AS new
        ON DUPLICATE KEY UPDATE
            username = new.username,
            email = new.email,
            role = new.role,
            last_login = CURRENT_TIMESTAMP
    ");

    $stmt->execute([
        ':id' => $id,
        ':username' => $login,
        ':email' => $email,
        ':role' => $role
    ]);

    // Zapis do tabeli uzytkownicy
    // Tabela musi mieć kolumnę keycloak_id,
    // a haslo musi dopuszczać NULL.
    if ($email !== null && $email !== '') {
        $stmt = $pdo->prepare("
            INSERT INTO uzytkownicy (keycloak_id, login, email)
            VALUES (:id, :login, :email) AS new
            ON DUPLICATE KEY UPDATE
                login = new.login,
                email = new.email
        ");

        $stmt->execute([
            ':id' => $id,
            ':login' => $login,
            ':email' => $email
        ]);
    }

    // Pobranie danych użytkownika
    $stmt = $pdo->prepare("
        SELECT *
        FROM users
        WHERE keycloak_id = :id
    ");

    $stmt->execute([':id' => $id]);

    echo json_encode($stmt->fetch(PDO::FETCH_ASSOC));
    exit;
}

// Pobieranie projektów zalogowanego użytkownika
if ($path === '/api/projects' && $_SERVER['REQUEST_METHOD'] === 'GET') {

    $token = authenticate();

    $stmt = $pdo->prepare("
        SELECT id, name, description
        FROM projects
        WHERE user_id = ?
    ");

    $stmt->execute([$token->sub]);

    $projekty = $stmt->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode($projekty);
    exit;
}

fail(404, 'Nie znaleziono');