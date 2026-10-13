<?php
require __DIR__ . '/../vendor/autoload.php';

use Firebase\JWT\JWK;
use Firebase\JWT\JWT;

header('Access-Control-Allow-Origin: http://localhost:3000');
header('Access-Control-Allow-Headers: Authorization, Content-Type');
header('Access-Control-Allow-Methods: POST, OPTIONS');
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

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    fail(405, 'Method not allowed');
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
        fail(401, 'Nieprawidłowy token');
    }

    if (($token->iss ?? '') !== getenv('KEYCLOAK_ISSUER')) {
        fail(401, 'Nieprawidłowy issuer');
    }
    return $token;
}

$token = authenticate();
$userId = $token->sub ?? '';
if (!is_string($userId) || $userId === '') {
    fail(401, 'Brak identyfikatora użytkownika w tokenie');
}

$data = json_decode(file_get_contents('php://input'), true);
if (!is_array($data) || !is_string($data['name'] ?? null)) {
    fail(400, 'Podaj nazwę projektu');
}
$name = trim($data['name']);
$description = $data['description'] ?? '';
if ($name === '' || preg_match_all('/./us', $name) > 100) {
    fail(400, 'Nazwa projektu musi mieć od 1 do 100 znaków');
}
if (!is_string($description) || strlen($description) > 65535) {
    fail(400, 'Nieprawidłowy lub zbyt długi opis projektu');
}

try {
    $pdo = new PDO(
        getenv('DB_DSN'),
        getenv('DB_USER'),
        getenv('DB_PASSWORD'),
        [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]
    );
    $stmt = $pdo->prepare('SELECT id FROM users WHERE keycloak_id = ?');
    $stmt->execute([$userId]);
    if ($stmt->fetchColumn() === false) {
        fail(404, 'Nie znaleziono użytkownika w bazie');
    }
    $stmt = $pdo->prepare('INSERT INTO projects (name, description, user_id) VALUES (?, ?, ?)');
    $stmt->execute([$name, $description, $userId]);
    http_response_code(201);
    echo json_encode([
        'id' => (int) $pdo->lastInsertId(),
        'name' => $name,
        'description' => $description,
    ], JSON_UNESCAPED_UNICODE);
} catch (PDOException $e) {
    error_log('addprojects.php: ' . $e->getMessage());
    $mysqlCode = (int) ($e->errorInfo[1] ?? 0);
    $messages = [
        1054 => 'Brakuje kolumny w tabeli projects lub users.',
        1146 => 'Brakuje tabeli projects lub users.',
        1364 => 'Tabela projects wymaga dodatkowej wartości bez wartości domyślnej.',
        1366 => 'Typ lub kodowanie danych nie pasuje do tabeli projects.',
        1406 => 'Nazwa lub opis projektu jest za długi.',
        1452 => 'Użytkownik nie spełnia powiązania klucza obcego w projects.',
        1062 => 'Projekt powoduje konflikt z unikalnym wpisem.',
    ];
    fail(500, ($messages[$mysqlCode] ?? 'Nie udało się dodać projektu.') . ' Kod MySQL: ' . $mysqlCode . '.');
}
exit;
