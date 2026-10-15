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
