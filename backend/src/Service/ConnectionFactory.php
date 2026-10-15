<?php
namespace App\Service;

use PDO;
use PDOException;

final class ConnectionFactory
{
    public function connect(string $dsn, string $username, string $password): PDO
    {
        $options = [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC];
        try {
            $pdo = new PDO($dsn, $username, $password, $options);
        } catch (PDOException $error) {
            if (!str_starts_with($dsn, 'mysql:') || (int) ($error->errorInfo[1] ?? 0) !== 1049) {
                throw $error;
            }
            if (!preg_match('/(?:^mysql:|;)dbname=([^;]+)/', $dsn, $matches)) {
                throw $error;
            }
            $database = $matches[1];
            if (!preg_match('/^[a-zA-Z0-9_-]{1,64}$/', $database)) {
                throw new \RuntimeException('Nieprawidłowa nazwa bazy w DB_DSN', 0, $error);
            }
            $serverDsn = preg_replace('/(?<=mysql:)dbname=[^;]+;?|;dbname=[^;]+/', '', $dsn);
            $server = new PDO($serverDsn, $username, $password, $options);
            $server->exec("CREATE DATABASE IF NOT EXISTS `$database` CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci");
            $pdo = new PDO($dsn, $username, $password, $options);
        }
        if ($pdo->getAttribute(PDO::ATTR_DRIVER_NAME) === 'mysql') {
            $stmt = $pdo->query("SELECT COUNT(*) FROM information_schema.TABLES
                WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME IN ('users', 'projects', 'tasks')");
            if ((int) $stmt->fetchColumn() !== 3) {
                (new Schema($pdo))->initialize();
            }
        }
        return $pdo;
    }
}
