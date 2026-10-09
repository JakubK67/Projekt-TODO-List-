<?php
header("Access-Control-Allow-Origin: http://localhost:3000");
header("Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization");
header("Content-Type: application/json");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

if ($_SERVER["REQUEST_METHOD"] === "POST") {
    $data = json_decode(file_get_contents("php://input"));

    $link = mysqli_connect('db', 'todo', 'admin', 'todo');

    if (!$link) {
        http_response_code(500);
        echo json_encode(['error' => 'Brak połączenia z bazą']);
        exit;
    }

    $priorities = ['Niski', 'Normalny', 'Wysoki'];
    $priority = $priorities[(int)$data->priority] ?? 'Normalny';

    $name     = mysqli_real_escape_string($link, $data->name);
    $desc     = mysqli_real_escape_string($link, $data->desc);
    $deadline = mysqli_real_escape_string($link, $data->deadline);

    $send = "INSERT INTO tasks (name, description, deadline, priority)
             VALUES ('$name', '$desc', '$deadline', '$priority')";

    if (mysqli_query($link, $send)) {
        echo json_encode(['ok' => true, 'id' => mysqli_insert_id($link)]);
    } else {
        http_response_code(500);
        echo json_encode(['error' => mysqli_error($link)]);
    }

    mysqli_close($link);
    exit;
}

http_response_code(405);
echo json_encode(['error' => 'Method not allowed']);