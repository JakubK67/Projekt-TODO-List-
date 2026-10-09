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
        keycloak_id VARCHAR(64)  NOT NULL PRIMARY KEY,
        username    VARCHAR(255) NOT NULL,
        first_name  VARCHAR(100) NULL,
        last_name   VARCHAR(100) NULL,
        email       VARCHAR(255) NULL,
        role        VARCHAR(20)  NOT NULL DEFAULT 'user',
        created_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
        last_login  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) CHARACTER SET utf8mb4
");

ensureColumn($pdo, 'users', 'first_name', 'VARCHAR(100) NULL AFTER username');
ensureColumn($pdo, 'users', 'last_name', 'VARCHAR(100) NULL AFTER first_name');

$pdo->exec("
    CREATE TABLE IF NOT EXISTS projects (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        description TEXT,
        user_id VARCHAR(64) NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(keycloak_id)
    )
");


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
        fail(401, 'Nieprawidłowy token');
    }

    if (($token->iss ?? '') !== getenv('KEYCLOAK_ISSUER')) {
        fail(401, 'Nieprawidłowy issuer');
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
            username   = new.username,
            first_name = new.first_name,
            last_name  = new.last_name,
            email      = new.email,
            role       = new.role,
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
