<?php
require __DIR__ . '/../vendor/autoload.php';

use Firebase\JWT\JWT;
use Firebase\JWT\JWK;

header("Access-Control-Allow-Origin: http://localhost:3000");
header("Access-Control-Allow-Methods: GET, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization");
header("Content-Type: application/json; charset=utf-8");
header('Cache-Control: no-store');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit;
}

function fail(int $code, string $message): never {
    http_response_code($code);
    echo json_encode(['error' => $message], JSON_UNESCAPED_UNICODE);
    exit;
}

$header = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
if (!preg_match('/^Bearer\s+(.+)$/i', $header, $matches)) {
    fail(401, 'Brak tokenu');
}

$realmUrl = rtrim(getenv('KEYCLOAK_URL'), '/')
    . '/realms/' . getenv('KEYCLOAK_REALM');
try {
    $jwks = json_decode(file_get_contents($realmUrl . '/protocol/openid-connect/certs'), true);
    JWT::$leeway = 30;
    $token = JWT::decode($matches[1], JWK::parseKeySet($jwks, 'RS256'));
} catch (Throwable $e) {
    fail(401, 'Nieprawidłowy token');
}

if (($token->iss ?? '') !== getenv('KEYCLOAK_ISSUER')) {
    fail(401, 'Nieprawidłowy issuer');
}

$keycloak_id = $token->sub ?? '';
if (!is_string($keycloak_id) || $keycloak_id === '') {
    fail(401, 'Brak identyfikatora użytkownika w tokenie');
}

try {
    $pdo = new PDO(
        getenv('DB_DSN'),
        getenv('DB_USER'),
        getenv('DB_PASSWORD'),
        [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]
    );
    $stmt = $pdo->prepare('SELECT id FROM users WHERE keycloak_id = ?');
    $stmt->execute([$keycloak_id]);
    $user = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$user) {
        fail(404, 'Nie znaleziono użytkownika w bazie');
    }
    $user_id = (int) $user['id'];
    $stmt = $pdo->prepare("
    SELECT id, name, description, deadline, priority, status, created, updated
    FROM tasks
    WHERE user_id = ?
    ORDER BY deadline ASC
");

    $stmt->execute([$user_id]);
    echo json_encode($stmt->fetchAll(PDO::FETCH_ASSOC), JSON_UNESCAPED_UNICODE);
} catch (PDOException $e) {
    error_log('showtasks.php: ' . $e->getMessage());
    fail(500, 'Nie udało się pobrać zadań');
}
