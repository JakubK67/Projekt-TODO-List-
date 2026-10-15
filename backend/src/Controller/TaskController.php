<?php
namespace App\Controller;

use App\Repository\TodoRepository;
use App\Service\Input;
use App\Service\Keycloak;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Attribute\Route;

final class TaskController
{
    public function __construct(private Keycloak $keycloak, private TodoRepository $repository) {}

    #[Route('/api/tasks', name: 'tasks_list', methods: ['GET'])]
    public function list(Request $request): JsonResponse
    {
        $token = $this->keycloak->authenticate($request);
        return new JsonResponse($this->repository->tasks($token->sub));
    }

    #[Route('/api/tasks', name: 'tasks_add', methods: ['POST'])]
    public function add(Request $request): JsonResponse
    {
        $token = $this->keycloak->authenticate($request);
        $body = Input::json($request);
        $project = $body['project_id'] ?? null;
        $projectId = $project === null || $project === '' ? null : Input::id($project);
        return new JsonResponse($this->repository->addTask($token->sub, Input::task($body), $projectId), 201);
    }

    #[Route('/api/tasks/{id}', name: 'tasks_edit', requirements: ['id' => '\d+'], methods: ['PUT'])]
    public function edit(Request $request, string $id): JsonResponse
    {
        $token = $this->keycloak->authenticate($request);
        $body = Input::json($request);
        $task = Input::task($body);
        if (array_key_exists('project_id', $body)) {
            $project = $body['project_id'];
            $task['project_id'] = $project === null || $project === '' ? null : Input::id($project);
        }
        $this->repository->editTask($token->sub, Input::id($id), $task);
        return new JsonResponse(['ok' => true]);
    }

    #[Route('/api/tasks/{id}', name: 'tasks_delete', requirements: ['id' => '\d+'], methods: ['DELETE'])]
    public function delete(Request $request, string $id): JsonResponse
    {
        $token = $this->keycloak->authenticate($request);
        $taskId = Input::id($id);
        $this->repository->deleteTask($token->sub, $taskId);
        return new JsonResponse(['ok' => true, 'deleted' => 1]);
    }
}
