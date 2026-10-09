<?php
header("Access-Control-Allow-Origin: http://localhost:3000");
header("Access-Control-Allow-Methods: GET, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization");
header("Content-Type: application/json; charset=utf-8");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit;
}

$link = mysqli_connect('db', 'todo', 'admin', 'todo');

if (!$link) {
    http_response_code(500);
    echo json_encode(['error' => 'Database connection failed']);
    exit;
}

mysqli_set_charset($link, 'utf8mb4');

$result = mysqli_query(
    $link,
    "SELECT id, name, description, deadline, priority, status, created, updated
     FROM tasks
     ORDER BY deadline ASC"
);

if (!$result) {
    http_response_code(500);
    echo json_encode(['error' => mysqli_error($link)]);
    mysqli_close($link);
    exit;
}

$tasks = mysqli_fetch_all($result, MYSQLI_ASSOC);

echo json_encode($tasks, JSON_UNESCAPED_UNICODE);

mysqli_free_result($result);
mysqli_close($link);