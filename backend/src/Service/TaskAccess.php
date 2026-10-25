<?php
namespace App\Service;

use App\Repository\TodoRepository;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

final class TaskAccess
{
    public function __construct(private TodoRepository $repository) {}

    public function assertOwns(string $sub, int $taskId): void
    {
        foreach ($this->repository->tasks($sub) as $task) {
            $id = is_array($task) ? ($task['id'] ?? null) : ($task->id ?? null);
            if ((int) $id === $taskId) {
                return;
            }
        }
        throw new NotFoundHttpException('Nie znaleziono zadania.');
    }
}
