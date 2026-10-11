<?php
header("Access-Control-Allow-Origin: http://localhost:3000");
header("Access-Control-Allow-Methods: POST, DELETE, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization");
header("Content-Type: application/json; charset=utf-8");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST' && $_SERVER['REQUEST_METHOD'] !== 'DELETE') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit;
}

$data = json_decode(file_get_contents("php://input"));
$id = isset($data->id) ? (int)$data->id : 0;

if ($id <= 0) {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid id']);
    exit;
}

$link = mysqli_connect('db', 'todo', 'admin', 'todo');

if (!$link) {
    http_response_code(500);
    echo json_encode(['error' => 'Database connection failed']);
    exit;
}

$stmt = mysqli_prepare($link, 'DELETE FROM tasks WHERE id = ?');
mysqli_stmt_bind_param($stmt, 'i', $id);

if (mysqli_stmt_execute($stmt)) {
    echo json_encode(['ok' => true, 'deleted' => mysqli_stmt_affected_rows($stmt)]);
} else {
    http_response_code(500);
    echo json_encode(['error' => mysqli_stmt_error($stmt)]);
}

mysqli_stmt_close($stmt);
mysqli_close($link);