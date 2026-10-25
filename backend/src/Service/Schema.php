<?php
namespace App\Service;

use PDO;

final class Schema
{
    public function __construct(private PDO $pdo) {}

    public function initialize(): void
    {
        $pdo = $this->pdo;

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
        
        $this->ensureColumn($pdo, 'users', 'id', 'INT NOT NULL AUTO_INCREMENT UNIQUE FIRST');
        $this->ensureColumn($pdo, 'users', 'first_name', 'VARCHAR(100) NULL AFTER username');
        $this->ensureColumn($pdo, 'users', 'last_name', 'VARCHAR(100) NULL AFTER first_name');
        
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

        $pdo->exec("
            CREATE TABLE IF NOT EXISTS task_files (
                id            INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
                task_id       INT NOT NULL,
                original_name VARCHAR(255) NOT NULL,
                stored_name   VARCHAR(64)  NOT NULL UNIQUE,
                mime_type     VARCHAR(100) NOT NULL,
                size          INT UNSIGNED NOT NULL,
                created_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
                KEY task_id (task_id),
                CONSTRAINT task_files_ibfk_1 FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
        ");
    }

    private function ensureColumn(PDO $pdo, string $table, string $column, string $definition): void {
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
}
