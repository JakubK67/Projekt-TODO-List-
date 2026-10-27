<?php
namespace App\Repository;

use PDO;
use Symfony\Component\HttpKernel\Exception\BadRequestHttpException;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

final class TodoRepository
{
    public function __construct(private PDO $pdo) {}

    public function user(string $keycloakId): array
    {
        $stmt = $this->pdo->prepare('SELECT * FROM users WHERE keycloak_id = ?');
        $stmt->execute([$keycloakId]);
        return $stmt->fetch(PDO::FETCH_ASSOC) ?: throw new NotFoundHttpException('Nie znaleziono użytkownika w bazie');
    }

    public function login(object $token): array
    {
        $stmt = $this->pdo->prepare("INSERT INTO users (keycloak_id, username, first_name, last_name, email, role)
            VALUES (?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE last_login = CURRENT_TIMESTAMP");
        $stmt->execute([$token->sub, $token->preferred_username ?? '', $token->given_name ?? null, $token->family_name ?? null, $token->email ?? null, in_array('admin', $token->realm_access->roles ?? [], true) ? 'admin' : 'user']);
        return $this->user($token->sub);
    }

    public function saveProfile(string $id, array $profile): array
    {
        $stmt = $this->pdo->prepare('UPDATE users SET username = ?, first_name = ?, last_name = ?, email = ? WHERE keycloak_id = ?');
        $stmt->execute([$profile['username'], $profile['first_name'], $profile['last_name'], $profile['email'], $id]);
        return $this->user($id);
    }

    public function projects(string $id): array
    {
        $stmt = $this->pdo->prepare('SELECT id, name, description FROM projects WHERE user_id = ? ORDER BY id ASC');
        $stmt->execute([$id]);
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    public function addProject(string $id, string $name, string $description): array
    {
        $this->user($id);
        $stmt = $this->pdo->prepare('INSERT INTO projects (name, description, user_id) VALUES (?, ?, ?)');
        $stmt->execute([$name, $description, $id]);
        return ['id' => (int) $this->pdo->lastInsertId(), 'name' => $name, 'description' => $description];
    }

    public function editProject(string $id, int $projectId, string $name, string $description): array
    {
        $this->ownedProject($id, $projectId);
        $stmt = $this->pdo->prepare('UPDATE projects SET name = ?, description = ? WHERE id = ? AND user_id = ?');
        $stmt->execute([$name, $description, $projectId, $id]);
        return ['id' => $projectId, 'name' => $name, 'description' => $description];
    }

    public function deleteProject(string $id, int $projectId): int
    {
        $this->pdo->beginTransaction();
        try {
            $this->ownedProject($id, $projectId, true);
            $stmt = $this->pdo->prepare('DELETE FROM tasks WHERE project_id = ?');
            $stmt->execute([$projectId]);
            $deletedTasks = $stmt->rowCount();
            $stmt = $this->pdo->prepare('DELETE FROM projects WHERE id = ? AND user_id = ?');
            $stmt->execute([$projectId, $id]);
            $this->pdo->commit();
            return $deletedTasks;
        } catch (\Throwable $error) {
            if ($this->pdo->inTransaction()) $this->pdo->rollBack();
            throw $error;
        }
    }

    private function ownedProject(string $id, int $projectId, bool $lock = false): void
    {
        $lockSql = $lock && $this->pdo->getAttribute(PDO::ATTR_DRIVER_NAME) === 'mysql' ? ' FOR UPDATE' : '';
        $stmt = $this->pdo->prepare('SELECT id FROM projects WHERE id = ? AND user_id = ?' . $lockSql);
        $stmt->execute([$projectId, $id]);
        if ($stmt->fetchColumn() === false) throw new NotFoundHttpException('Nie znaleziono projektu');
    }

    public function tasks(string $id): array
    {
        $user = $this->user($id);
        $stmt = $this->pdo->prepare('SELECT t.id, t.name, t.description, t.deadline, t.priority, t.status, t.created, t.updated, t.project_id, p.name AS project_name
            FROM tasks t LEFT JOIN projects p ON p.id = t.project_id AND p.user_id = ?
            WHERE t.user_id = ? ORDER BY t.deadline ASC');
        $stmt->execute([$id, $user['id']]);
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    public function allTasks(): array
    {
        $stmt = $this->pdo->query('SELECT t.id, t.name, t.description, t.deadline, t.priority, t.status, t.created, t.updated, t.project_id, p.name AS project_name, u.username AS owner_username, u.email AS owner_email
            FROM tasks t JOIN users u ON u.id = t.user_id LEFT JOIN projects p ON p.id = t.project_id ORDER BY t.deadline ASC, t.id DESC');
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    public function adminChangeTaskStatus(int $taskId, string $status): void
    {
        $stmt = $this->pdo->prepare('UPDATE tasks SET status = ? WHERE id = ?');
        $stmt->execute([$status, $taskId]);
        if ($stmt->rowCount() === 0) {
            $check = $this->pdo->prepare('SELECT id FROM tasks WHERE id = ?');
            $check->execute([$taskId]);
            if ($check->fetchColumn() === false) throw new NotFoundHttpException('Nie znaleziono zadania');
        }
    }

    public function adminDeleteTask(int $taskId): void
    {
        $stmt = $this->pdo->prepare('DELETE FROM tasks WHERE id = ?');
        $stmt->execute([$taskId]);
        if ($stmt->rowCount() === 0) throw new NotFoundHttpException('Nie znaleziono zadania');
    }

    public function ownStatistics(string $keycloakId): array
    {
        $user = $this->user($keycloakId);
        if ($user['public_statistics_token'] === null) {
            $stmt = $this->pdo->prepare('UPDATE users SET public_statistics_token = ? WHERE id = ? AND public_statistics_token IS NULL');
            $stmt->execute([bin2hex(random_bytes(32)), $user['id']]);
            $user = $this->user($keycloakId);
        }
        return $this->statisticsForUser($user) + ['publicToken' => $user['public_statistics_token']];
    }

    public function publicStatistics(string $token): array
    {
        $stmt = $this->pdo->prepare('SELECT id, username FROM users WHERE public_statistics_token = ?');
        $stmt->execute([$token]);
        $user = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!$user) throw new NotFoundHttpException('Nie znaleziono statystyk');
        return $this->statisticsForUser($user);
    }

    private function statisticsForUser(array $user): array
    {
        $stmt = $this->pdo->prepare('SELECT priority, COUNT(*) AS completed FROM tasks WHERE user_id = ? AND status = ? GROUP BY priority');
        $stmt->execute([$user['id'], 'Wykonane']);
        $counts = ['Niski' => 0, 'Normalny' => 0, 'Wysoki' => 0];
        foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
            if (array_key_exists($row['priority'], $counts)) $counts[$row['priority']] = (int) $row['completed'];
        }
        return ['user' => ['username' => $user['username']], 'counts' => $counts];
    }

    public function taskNotes(string $id, int $taskId): array
    {
        $user = $this->user($id);
        $this->checkTask((int) $user['id'], $taskId);
        $stmt = $this->pdo->prepare('SELECT id, content, created, updated FROM task_notes WHERE task_id = ? ORDER BY created ASC, id ASC');
        $stmt->execute([$taskId]);
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    public function addTaskNote(string $id, int $taskId, string $content): array
    {
        $user = $this->user($id);
        $this->checkTask((int) $user['id'], $taskId);
        $stmt = $this->pdo->prepare('INSERT INTO task_notes (task_id, content) VALUES (?, ?)');
        $stmt->execute([$taskId, $content]);
        return ['id' => (int) $this->pdo->lastInsertId(), 'content' => $content];
    }

    public function editTaskNote(string $id, int $taskId, int $noteId, string $content): void
    {
        $user = $this->user($id);
        $this->checkTask((int) $user['id'], $taskId);
        $stmt = $this->pdo->prepare('UPDATE task_notes SET content = ? WHERE id = ? AND task_id = ?');
        $stmt->execute([$content, $noteId, $taskId]);
        if ($stmt->rowCount() === 0) {
            $check = $this->pdo->prepare('SELECT id FROM task_notes WHERE id = ? AND task_id = ?');
            $check->execute([$noteId, $taskId]);
            if ($check->fetchColumn() === false) throw new NotFoundHttpException('Nie znaleziono notatki');
        }
    }

    public function deleteTaskNote(string $id, int $taskId, int $noteId): void
    {
        $user = $this->user($id);
        $this->checkTask((int) $user['id'], $taskId);
        $stmt = $this->pdo->prepare('DELETE FROM task_notes WHERE id = ? AND task_id = ?');
        $stmt->execute([$noteId, $taskId]);
        if ($stmt->rowCount() === 0) throw new NotFoundHttpException('Nie znaleziono notatki');
    }

    public function addTask(string $id, array $task, ?int $projectId): array
    {
        $user = $this->user($id);
        $this->checkProject($id, $projectId);
        $stmt = $this->pdo->prepare('INSERT INTO tasks (name, description, deadline, priority, status, user_id, project_id) VALUES (?, ?, ?, ?, ?, ?, ?)');
        $stmt->execute([$task['name'], $task['description'], $task['deadline'], $task['priority'], $task['status'], $user['id'], $projectId]);
        return ['ok' => true, 'id' => (int) $this->pdo->lastInsertId(), 'user_id' => (int) $user['id'], 'project_id' => $projectId];
    }

    public function editTask(string $id, int $taskId, array $task): void
    {
        $user = $this->user($id);
        $this->checkTask((int) $user['id'], $taskId);
        $projectSql = '';
        $values = [$task['name'], $task['description'], $task['deadline'], $task['priority'], $task['status']];
        if (array_key_exists('project_id', $task)) {
            $this->checkProject($id, $task['project_id']);
            $projectSql = ', project_id = ?';
            $values[] = $task['project_id'];
        }
        $values[] = $taskId;
        $values[] = $user['id'];
        $stmt = $this->pdo->prepare('UPDATE tasks SET name = ?, description = ?, deadline = ?, priority = ?, status = ?' . $projectSql . ' WHERE id = ? AND user_id = ?');
        $stmt->execute($values);
    }

    public function changeTaskStatus(string $id, int $taskId, string $status): void
    {
        if (!in_array($status, ['Do zrobienia', 'Realizowane', 'Wykonane'], true)) {
            throw new BadRequestHttpException('Nieprawidłowy status zadania');
        }
        $user = $this->user($id);
        $this->checkTask((int) $user['id'], $taskId);
        $stmt = $this->pdo->prepare('UPDATE tasks SET status = ? WHERE id = ? AND user_id = ?');
        $stmt->execute([$status, $taskId, $user['id']]);
    }

    public function deleteTask(string $id, int $taskId): void
    {
        $user = $this->user($id);
        $this->checkTask((int) $user['id'], $taskId);
        $stmt = $this->pdo->prepare('DELETE FROM tasks WHERE id = ? AND user_id = ?');
        $stmt->execute([$taskId, $user['id']]);
    }

    private function checkTask(int $userId, int $taskId): void
    {
        $stmt = $this->pdo->prepare('SELECT id FROM tasks WHERE id = ? AND user_id = ?');
        $stmt->execute([$taskId, $userId]);
        if ($stmt->fetchColumn() === false) throw new NotFoundHttpException('Nie znaleziono zadania');
    }

    private function checkProject(string $id, ?int $projectId): void
    {
        if ($projectId === null) return;
        $stmt = $this->pdo->prepare('SELECT id FROM projects WHERE id = ? AND user_id = ?');
        $stmt->execute([$projectId, $id]);
        if ($stmt->fetchColumn() === false) throw new BadRequestHttpException('Wybrany projekt nie istnieje lub nie należy do Ciebie');
    }
}
