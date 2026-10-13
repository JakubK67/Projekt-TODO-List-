<?php
require __DIR__ . '/../vendor/autoload.php';

use Firebase\JWT\JWK;
use Firebase\JWT\JWT;

header('Access-Control-Allow-Origin: http://localhost:3000');
header('Access-Control-Allow-Headers: Authorization, Content-Type');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

function fail(int $code, string $msg): never {
    http_response_code($code);
    echo json_encode(['error' => $msg]);
    exit;
}

$pdo = new PDO(
    getenv('DB_DSN'),
    getenv('DB_USER'),
    getenv('DB_PASSWORD'),
    [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]
);

function ensureColumn(PDO $pdo, string $table, string $column, string $definition): void {
    $stmt = $pdo->prepare("
        SELECT COUNT(*)
        FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?
    ");
    $stmt->execute([$table, $column]);
    if ((int) $stmt->fetchColumn() === 0) {
        $pdo->exec("ALTER TABLE `$table` ADD COLUMN `$column` $definition");
    }
}

$pdo->exec("
    CREATE TABLE IF NOT EXISTS users (
        id          INT NOT NULL AUTO_INCREMENT UNIQUE,
        keycloak_id VARCHAR(64)  NOT NULL PRIMARY KEY,
        username    VARCHAR(255) NOT NULL,
        first_name  VARCHAR(100) NULL,
        last_name   VARCHAR(100) NULL,
        email       VARCHAR(255) NULL,
        role        VARCHAR(20)  NOT NULL DEFAULT 'user',
        created_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
        last_login  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
");

ensureColumn($pdo, 'users', 'id', 'INT NOT NULL AUTO_INCREMENT UNIQUE FIRST');
ensureColumn($pdo, 'users', 'first_name', 'VARCHAR(100) NULL AFTER username');
ensureColumn($pdo, 'users', 'last_name', 'VARCHAR(100) NULL AFTER first_name');

$pdo->exec("
    CREATE TABLE IF NOT EXISTS projects (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        description TEXT,
        user_id VARCHAR(64) NOT NULL,
        KEY user_id (user_id),
        CONSTRAINT projects_ibfk_1 FOREIGN KEY (user_id) REFERENCES users(keycloak_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
");

$pdo->exec("
    CREATE TABLE IF NOT EXISTS tasks (
        id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        description TEXT NULL,
        deadline DATE DEFAULT NULL,
        created DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        priority ENUM('Niski', 'Normalny', 'Wysoki') NOT NULL DEFAULT 'Normalny',
        status ENUM('Do zrobienia', 'Realizowane', 'Wykonane') NOT NULL DEFAULT 'Do zrobienia',
        user_id INT NOT NULL DEFAULT 1,
        project_id INT DEFAULT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_polish_ci
");


function kcRequest(string $url, string $method, ?array $body = null, ?string $token = null): array {
    $headers = $token ? "Authorization: Bearer $token\r\nContent-Type: application/json\r\n" : "Content-Type: application/x-www-form-urlencoded\r\n";
    $content = $body === null ? '' : ($token ? json_encode($body) : http_build_query($body));
    $ctx = stream_context_create(['http' => ['method' => $method, 'header' => $headers, 'content' => $content, 'ignore_errors' => true, 'timeout' => 10]]);
    $response = file_get_contents($url, false, $ctx);
    $status = (int) preg_replace('/^HTTP\/\S+\s+(\d+).*$/', '$1', $http_response_header[0] ?? 'HTTP/1.1 500');
    if ($response === false || $status < 200 || $status >= 300) {
        fail($status === 400 || $status === 401 ? 400 : 502, $status === 400 || $status === 401 ? 'Nieprawidłowe hasło lub dane.' : 'Nie udało się zapisać zmian konta.');
    }
    return json_decode($response, true) ?? [];
}

function kcAdminToken(): string {
    $url = rtrim(getenv('KEYCLOAK_URL'), '/') . '/realms/master/protocol/openid-connect/token';
    $data = kcRequest($url, 'POST', ['client_id' => 'admin-cli', 'grant_type' => 'password', 'username' => getenv('KEYCLOAK_ADMIN_USERNAME'), 'password' => getenv('KEYCLOAK_ADMIN_PASSWORD')]);
    return $data['access_token'] ?? fail(502, 'Brak dostępu do usługi konta.');
}
function authenticate(): object {
    $header = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
    if (!preg_match('/^Bearer\s+(.+)$/i', $header, $m)) {
        fail(401, 'Brak tokenu');
    }

    $realmUrl = rtrim(getenv('KEYCLOAK_URL'), '/') . '/realms/' . getenv('KEYCLOAK_REALM');
    $jwks = json_decode(file_get_contents($realmUrl . '/protocol/openid-connect/certs'), true);

    try {
        JWT::$leeway = 30;
        $token = JWT::decode($m[1], JWK::parseKeySet($jwks, 'RS256'));
    } catch (Throwable $e) {
        fail(401, 'NieprawidĹ‚owy token');
    }

    if (($token->iss ?? '') !== getenv('KEYCLOAK_ISSUER')) {
        fail(401, 'NieprawidĹ‚owy issuer');
    }
    return $token;
}

$path = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);

if ($path === '/api/me' && $_SERVER['REQUEST_METHOD'] === 'GET') {
    $token = authenticate();
    $roles = $token->realm_access->roles ?? [];
    $role = in_array('admin', $roles, true) ? 'admin' : 'user';

    $stmt = $pdo->prepare("
        INSERT INTO users (keycloak_id, username, first_name, last_name, email, role)
        VALUES (:id, :username, :first_name, :last_name, :email, :role) AS new
        ON DUPLICATE KEY UPDATE
            last_login = CURRENT_TIMESTAMP
    ");
    $stmt->execute([
        ':id'         => $token->sub,
        ':username'   => $token->preferred_username ?? '',
        ':first_name' => $token->given_name ?? null,
        ':last_name'  => $token->family_name ?? null,
        ':email'      => $token->email ?? null,
        ':role'       => $role,
    ]);


    $stmt = $pdo->prepare("SELECT * FROM users WHERE keycloak_id = :id");
    $stmt->execute([':id' => $token->sub]);

    echo json_encode($stmt->fetch(PDO::FETCH_ASSOC));
    exit;
}

if ($path === '/api/me' && $_SERVER['REQUEST_METHOD'] === 'PUT') {
    $token = authenticate();
    $body = json_decode(file_get_contents('php://input'), true) ?? [];
    $username = trim((string) ($body['username'] ?? ''));
    $email = trim((string) ($body['email'] ?? ''));
    $firstName = trim((string) ($body['first_name'] ?? ''));
    $lastName = trim((string) ($body['last_name'] ?? ''));
    if ($username === '' || strlen($username) > 255 || !filter_var($email, FILTER_VALIDATE_EMAIL) || strlen($firstName) > 100 || strlen($lastName) > 100) fail(422, 'Sprawdź poprawność danych.');
    $realm = rawurlencode(getenv('KEYCLOAK_REALM'));
    $userPath = '/admin/realms/' . $realm . '/users/' . rawurlencode($token->sub);
    $adminToken = kcAdminToken();
    $user = kcRequest(rtrim(getenv('KEYCLOAK_URL'), '/') . $userPath, 'GET', null, $adminToken);
    $user['username'] = $username;
    $user['email'] = $email;
    $user['firstName'] = $firstName;
    $user['lastName'] = $lastName;
    kcRequest(rtrim(getenv('KEYCLOAK_URL'), '/') . $userPath, 'PUT', $user, $adminToken);
    $stmt = $pdo->prepare('UPDATE users SET username = ?, first_name = ?, last_name = ?, email = ? WHERE keycloak_id = ?');
    $stmt->execute([$username, $firstName, $lastName, $email, $token->sub]);
    echo json_encode(['username' => $username, 'first_name' => $firstName, 'last_name' => $lastName, 'email' => $email]);
    exit;
}

if ($path === '/api/me/password' && $_SERVER['REQUEST_METHOD'] === 'PUT') {
    $token = authenticate();
    $body = json_decode(file_get_contents('php://input'), true) ?? [];
    $current = (string) ($body['current'] ?? '');
    $next = (string) ($body['next'] ?? '');
    if ($current === '' || $next === '' || $next !== ($body['confirm'] ?? null)) fail(422, 'Sprawdź obecne hasło oraz zgodność nowych haseł.');
    $base = rtrim(getenv('KEYCLOAK_URL'), '/');
    $realm = rawurlencode(getenv('KEYCLOAK_REALM'));
    kcRequest($base . '/realms/' . $realm . '/protocol/openid-connect/token', 'POST', ['client_id' => 'admin-cli', 'grant_type' => 'password', 'username' => $token->preferred_username ?? '', 'password' => $current]);
    $adminToken = kcAdminToken();
    kcRequest($base . '/admin/realms/' . $realm . '/users/' . rawurlencode($token->sub) . '/reset-password', 'PUT', ['type' => 'password', 'value' => $next, 'temporary' => false], $adminToken);
    echo json_encode(['message' => 'Hasło zostało zmienione.']);
    exit;
}
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


