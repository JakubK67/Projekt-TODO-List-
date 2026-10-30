<?php
namespace App\Service;

use PDO;
use RuntimeException;

final class TaskFiles
{
    public const MAX_FILES = 5;
    public const MAX_TOTAL_BYTES = 15 * 1024 * 1024;

    private const ALLOWED = [
        'image/png'       => 'png',
        'image/jpeg'      => 'jpg',
        'application/pdf' => 'pdf',
    ];

    public function __construct(private PDO $pdo, private string $storageDir) {}

    public function initializeSchema(): void
    {
        $this->pdo->exec("
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
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
        ");
    }

    public function list(int $taskId): array
    {
        $stmt = $this->pdo->prepare(
            'SELECT id, task_id, original_name, mime_type, size, created_at
             FROM task_files WHERE task_id = ? ORDER BY id'
        );
        $stmt->execute([$taskId]);
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    public function upload(int $taskId, array $files): array
    {
        $incoming = $this->normalize($files);
        if (!$incoming) {
            throw new RuntimeException('Nie wybrano żadnych plików.', 422);
        }

        $this->pdo->beginTransaction();
        $saved = [];
        try {
            $lock = $this->pdo->prepare('SELECT id FROM tasks WHERE id = ? FOR UPDATE');
            $lock->execute([$taskId]);
            if (!$lock->fetchColumn()) {
                throw new RuntimeException('Nie znaleziono zadania.', 404);
            }

            $usage = $this->pdo->prepare(
                'SELECT COUNT(*), COALESCE(SUM(size), 0) FROM task_files WHERE task_id = ?'
            );
            $usage->execute([$taskId]);
            [$count, $total] = array_map('intval', $usage->fetch(PDO::FETCH_NUM));

            if ($count + count($incoming) > self::MAX_FILES) {
                throw new RuntimeException(
                    sprintf('Zadanie może mieć maksymalnie %d plików (obecnie: %d).', self::MAX_FILES, $count),
                    422
                );
            }

            $validated = [];
            foreach ($incoming as $f) {
                $validated[] = $this->validate($f);
                $total += $f['size'];
            }
            if ($total > self::MAX_TOTAL_BYTES) {
                throw new RuntimeException(
                    sprintf('Łączny rozmiar plików zadania nie może przekraczać %d MB.', self::MAX_TOTAL_BYTES / 1048576),
                    422
                );
            }

            if (!is_dir($this->storageDir) && !mkdir($this->storageDir, 0750, true) && !is_dir($this->storageDir)) {
                throw new RuntimeException('Nie udało się przygotować katalogu na pliki.', 500);
            }

            $insert = $this->pdo->prepare(
                'INSERT INTO task_files (task_id, original_name, stored_name, mime_type, size)
                 VALUES (?, ?, ?, ?, ?)'
            );
            foreach ($validated as $v) {
                $stored = bin2hex(random_bytes(16)) . '.' . $v['ext'];
                $target = $this->storageDir . DIRECTORY_SEPARATOR . $stored;
                if (!move_uploaded_file($v['tmp_name'], $target)) {
                    throw new RuntimeException('Nie udało się zapisać pliku.', 500);
                }
                $saved[] = $target;
                $insert->execute([$taskId, $v['name'], $stored, $v['mime'], $v['size']]);
            }

            $this->pdo->commit();
        } catch (\Throwable $e) {
            if ($this->pdo->inTransaction()) {
                $this->pdo->rollBack();
            }
            foreach ($saved as $path) {
                @unlink($path);
            }
            throw $e;
        }

        return $this->list($taskId);
    }

    public function delete(int $taskId, int $fileId): void
    {
        $stmt = $this->pdo->prepare('SELECT stored_name FROM task_files WHERE id = ? AND task_id = ?');
        $stmt->execute([$fileId, $taskId]);
        $stored = $stmt->fetchColumn();
        if ($stored === false) {
            throw new RuntimeException('Nie znaleziono pliku.', 404);
        }
        $this->pdo->prepare('DELETE FROM task_files WHERE id = ?')->execute([$fileId]);
        @unlink($this->storageDir . DIRECTORY_SEPARATOR . $stored);
    }

    public function deleteAllForTask(int $taskId): void
    {
        $stmt = $this->pdo->prepare('SELECT stored_name FROM task_files WHERE task_id = ?');
        $stmt->execute([$taskId]);
        foreach ($stmt->fetchAll(PDO::FETCH_COLUMN) as $stored) {
            @unlink($this->storageDir . DIRECTORY_SEPARATOR . $stored);
        }
    }

    public function removeStoredFiles(array $storedNames): void
    {
        foreach ($storedNames as $storedName) {
            if (!is_string($storedName) || basename($storedName) !== $storedName) {
                continue;
            }

            @unlink($this->storageDir . DIRECTORY_SEPARATOR . $storedName);
        }
    }

    public function find(int $taskId, int $fileId): array
    {
        $stmt = $this->pdo->prepare(
            'SELECT original_name, stored_name, mime_type, size FROM task_files WHERE id = ? AND task_id = ?'
        );
        $stmt->execute([$fileId, $taskId]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        $path = $row ? $this->storageDir . DIRECTORY_SEPARATOR . $row['stored_name'] : null;
        if (!$row || !is_file($path)) {
            throw new RuntimeException('Nie znaleziono pliku.', 404);
        }

        return [
            'original_name' => $row['original_name'],
            'mime_type'     => $row['mime_type'],
            'size'          => (int) $row['size'],
            'path'          => $path,
        ];
    }

    private function validate(array $f): array
    {
        $label = $f['name'];

        if ($f['error'] === UPLOAD_ERR_INI_SIZE || $f['error'] === UPLOAD_ERR_FORM_SIZE) {
            throw new RuntimeException("Plik „{$label}” jest zbyt duży.", 422);
        }
        if ($f['error'] !== UPLOAD_ERR_OK) {
            throw new RuntimeException("Nie udało się wgrać pliku „{$label}”.", 422);
        }
        if (!is_uploaded_file($f['tmp_name'])) {
            throw new RuntimeException("Nieprawidłowy plik „{$label}”.", 422);
        }
        if ($f['size'] <= 0) {
            throw new RuntimeException("Plik „{$label}” jest pusty.", 422);
        }

        $mime = (new \finfo(FILEINFO_MIME_TYPE))->file($f['tmp_name']);
        if (!isset(self::ALLOWED[$mime])) {
            throw new RuntimeException("Plik „{$label}” ma niedozwolony format. Dozwolone: PNG, JPG, PDF.", 422);
        }

        return [
            'tmp_name' => $f['tmp_name'],
            'name'     => $label,
            'size'     => $f['size'],
            'mime'     => $mime,
            'ext'      => self::ALLOWED[$mime],
        ];
    }

    private function normalize(array $files): array
    {
        $out = [];
        $isMulti = is_array($files['name'] ?? null);
        $n = $isMulti ? count($files['name']) : (isset($files['name']) ? 1 : 0);

        for ($i = 0; $i < $n; $i++) {
            $get = fn(string $k) => $isMulti ? $files[$k][$i] : $files[$k];
            if ((int) $get('error') === UPLOAD_ERR_NO_FILE) {
                continue;
            }
            $name = preg_replace('/[\x00-\x1F\x7F]/u', '', basename((string) $get('name')));
            $out[] = [
                'name'     => mb_substr($name !== '' ? $name : 'plik', 0, 255),
                'tmp_name' => (string) $get('tmp_name'),
                'size'     => (int) $get('size'),
                'error'    => (int) $get('error'),
            ];
        }
        return $out;
    }
}
