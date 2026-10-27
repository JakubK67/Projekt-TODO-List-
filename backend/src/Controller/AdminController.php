<?php
namespace App\Controller;

use App\Repository\TodoRepository;
use App\Service\Keycloak;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpKernel\Exception\AccessDeniedHttpException;
use Symfony\Component\HttpKernel\Exception\BadRequestHttpException;
use Symfony\Component\Routing\Attribute\Route;

final class AdminController
{
    public function __construct(private Keycloak $keycloak, private TodoRepository $repository) {}

    private function authorize(Request $request): void
    {
        $token = $this->keycloak->authenticate($request);
        if (!$this->keycloak->hasRole($token, 'admin')) {
            throw new AccessDeniedHttpException('Ta funkcja wymaga uprawnień administratora.');
        }
    }

    #[Route('/api/admin/tasks', name: 'admin_tasks_list', methods: ['GET'])]
    public function tasks(Request $request): JsonResponse
    {
        $this->authorize($request);
        return new JsonResponse($this->repository->allTasks());
    }

    #[Route('/api/admin/tasks/{id}/status', name: 'admin_tasks_status', requirements: ['id' => '\\d+'], methods: ['PUT'])]
    public function status(Request $request, string $id): JsonResponse
    {
        $this->authorize($request);
        $status = $request->toArray()['status'] ?? null;
        if (!is_string($status) || !in_array($status, ['Do zrobienia', 'Realizowane', 'Wykonane'], true)) {
            throw new BadRequestHttpException('Nieprawidłowy status zadania.');
        }
        $taskId = (int) $id;
        $this->repository->adminChangeTaskStatus($taskId, $status);
        return new JsonResponse(['ok' => true, 'id' => $taskId, 'status' => $status]);
    }

    #[Route('/api/admin/tasks/{id}', name: 'admin_tasks_delete', requirements: ['id' => '\\d+'], methods: ['DELETE'])]
    public function delete(Request $request, string $id): JsonResponse
    {
        $this->authorize($request);
        $this->repository->adminDeleteTask((int) $id);
        return new JsonResponse(['ok' => true, 'deleted' => 1]);
    }
}
