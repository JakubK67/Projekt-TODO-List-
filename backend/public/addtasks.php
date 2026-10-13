<?php
require __DIR__ . '/../vendor/autoload.php';

use Firebase\JWT\JWT;
use Firebase\JWT\JWK;

header("Access-Control-Allow-Origin: http://localhost:3000");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization");
header("Content-Type: application/json; charset=utf-8");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

function fail($code, $message) {
    http_response_code($code);
    echo json_encode(['error' => $message]);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    fail(405, 'Method not allowed');
}

$header = $_SERVER['HTTP_AUTHORIZATION'] ?? '';

if (!preg_match('/^Bearer\s+(.+)$/i', $header, $matches)) {
    fail(401, 'Brak tokenu');
}

$realmUrl = rtrim(getenv('KEYCLOAK_URL'), '/')
    . '/realms/' . getenv('KEYCLOAK_REALM');

try {
    $jwks = json_decode(
        file_get_contents($realmUrl . '/protocol/openid-connect/certs'),
        true
    );

    JWT::$leeway = 30;

    $token = JWT::decode(
        $matches[1],
        JWK::parseKeySet($jwks, 'RS256')
    );
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
} catch (PDOException $e) {
    fail(500, 'Brak połączenia z bazą');
}

$stmt = $pdo->prepare('SELECT id FROM users WHERE keycloak_id = ?');
$stmt->execute([$keycloak_id]);
$user = $stmt->fetch(PDO::FETCH_ASSOC);

if (!$user) {
    fail(404, 'Nie znaleziono użytkownika w bazie');
}

$user_id = (int) $user['id'];

$data = json_decode(file_get_contents("php://input"));

if (!is_object($data)) {
    fail(400, 'Nieprawidłowe dane JSON');
}

$name = trim($data->name ?? '');
$desc = $data->desc ?? '';
$deadline = $data->deadline ?? null;

if ($name === '' || preg_match_all('/./us', $name) > 100) {
    fail(400, 'Nieprawidłowa nazwa zadania');
}

if ($deadline === '') {
    $deadline = null;
}

$priorities = ['Niski', 'Normalny', 'Wysoki'];
$priority = $priorities[(int)($data->priority ?? 1)] ?? 'Normalny';
$statuses = ['Do zrobienia', 'Realizowane', 'Wykonane'];
$status = $statuses[(int)($data->status ?? 0)] ?? 'Do zrobienia';
$project_id = $data->project_id ?? null;
if ($project_id === '') {
    $project_id = null;
}
if ($project_id !== null) {
    if ((!is_int($project_id) && !is_string($project_id))
        || filter_var($project_id, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1, 'max_range' => 2147483647]]) === false) {
        fail(400, 'Nieprawidłowy projekt');
    }
    $project_id = (int) $project_id;
}

try {
    if ($project_id !== null) {
        $stmt = $pdo->prepare('SELECT id FROM projects WHERE id = ? AND user_id = ?');
        $stmt->execute([$project_id, $keycloak_id]);
        if ($stmt->fetchColumn() === false) {
            fail(400, 'Wybrany projekt nie istnieje lub nie należy do Ciebie');
        }
    }
    $stmt = $pdo->prepare(
        "INSERT INTO tasks
        (name, description, deadline, priority, status, user_id, project_id)
        VALUES (?, ?, ?, ?, ?, ?, ?)"
    );

    $stmt->execute([$name, $desc, $deadline, $priority, $status, $user_id, $project_id]);
    http_response_code(201);

    echo json_encode([
        'ok' => true,
        'id' => (int) $pdo->lastInsertId(),
        'user_id' => $user_id,
        'project_id' => $project_id
    ]);
} catch (PDOException $e) {
    error_log('addtasks.php: ' . $e->getMessage());
    $mysqlCode = (int) ($e->errorInfo[1] ?? 0);
    $messages = [
        1054 => 'Tabela tasks ma inną strukturę: brakuje kolumny używanej przy zapisie.',
        1146 => 'Brakuje tabeli tasks w bazie używanej przez backend.',
        1048 => 'Wymagana kolumna nie może mieć pustej wartości.',
        1364 => 'Tabela tasks wymaga dodatkowej wartości bez wartości domyślnej.',
        1366 => 'Typ lub kodowanie danych nie pasuje do kolumny w tabeli tasks.',
        1292 => 'Nieprawidłowa data zadania.',
        1265 => 'Wartość nie pasuje do typu kolumny, np. priorytetu lub statusu.',
        1406 => 'Wartość jest za długa dla kolumny w tabeli tasks.',
        1452 => 'Użytkownik lub projekt nie spełnia powiązania klucza obcego.',
        1062 => 'Zapis powoduje konflikt z istniejącym unikalnym wpisem.',
    ];
    $message = $messages[$mysqlCode] ?? 'Nie udało się dodać zadania.';
    fail(500, $message . ' Kod MySQL: ' . $mysqlCode . '.');
}
