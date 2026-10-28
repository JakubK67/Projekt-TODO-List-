<?php
namespace App\Controller;

use App\Repository\TodoRepository;
use App\Service\Input;
use App\Service\Keycloak;
use App\Service\TaskFiles;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpKernel\Exception\AccessDeniedHttpException;
use Symfony\Component\HttpKernel\Exception\BadRequestHttpException;
use Symfony\Component\Routing\Attribute\Route;

final class AdminController
{
    public function __construct(private Keycloak $keycloak, private TodoRepository $repository, private TaskFiles $files) {}

    private function authorize(Request $request): object
    {
        $token = $this->keycloak->authenticate($request);
        if (!$this->keycloak->hasRole($token, 'admin')) {
            throw new AccessDeniedHttpException('Ta funkcja wymaga uprawnień administratora.');
        }

        return $token;
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

    #[Route('/api/admin/users', name: 'admin_users_list', methods: ['GET'])]
    public function users(Request $request): JsonResponse
    {
        $this->authorize($request);
        return new JsonResponse($this->repository->adminUsers());
    }

    #[Route('/api/admin/users/{keycloakId}', name: 'admin_users_edit', methods: ['PUT'])]
    public function editUser(Request $request, string $keycloakId): JsonResponse
    {
        $this->authorize($request);
        $body = Input::json($request);
        $profile = [
            'username' => Input::text($body, 'username', 255, true),
            'email' => Input::text($body, 'email', 255, true),
            'first_name' => Input::text($body, 'first_name', 100),
            'last_name' => Input::text($body, 'last_name', 100),
        ];

        if (!filter_var($profile['email'], FILTER_VALIDATE_EMAIL)) {
            throw new BadRequestHttpException('Nieprawidłowy email.');
        }

        $this->keycloak->updateManagedUser($keycloakId, $profile);
        return new JsonResponse($this->repository->adminUpdateUser($keycloakId, $profile));
    }

    #[Route('/api/admin/users/{keycloakId}', name: 'admin_users_delete', methods: ['DELETE'])]
    public function deleteUser(Request $request, string $keycloakId): JsonResponse
    {
        $admin = $this->authorize($request);
        $this->repository->assertAdminCanDeleteUser($keycloakId, $admin->sub);
        $this->keycloak->deleteManagedUser($keycloakId);
        $deletedUser = $this->repository->adminDeleteUser($keycloakId, $admin->sub);
        $this->files->removeStoredFiles($deletedUser['stored_files']);

        return new JsonResponse(['ok' => true, 'deleted' => 1]);
    }
}
