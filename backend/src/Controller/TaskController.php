<?php
namespace App\Controller;

use App\Repository\TodoRepository;
use App\Service\Input;
use App\Service\Keycloak;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\HttpKernel\Exception\BadRequestHttpException;

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

    #[Route('/api/tasks/{id}/status', name: 'tasks_status', requirements: ['id' => '\d+'], methods: ['PUT'])]
    public function status(Request $request, string $id): JsonResponse
    {
        $token = $this->keycloak->authenticate($request);
        $body = Input::json($request);
        $status = $body['status'] ?? null;
        if (!is_string($status) || !in_array($status, ['Do zrobienia', 'Realizowane', 'Wykonane'], true)) {
            throw new BadRequestHttpException('Nieprawidłowy status zadania');
        }
        $taskId = Input::id($id);
        $this->repository->changeTaskStatus($token->sub, $taskId, $status);
        return new JsonResponse(['ok' => true, 'id' => $taskId, 'status' => $status]);
    }

    #[Route('/api/tasks/{id}', name: 'tasks_delete', requirements: ['id' => '\d+'], methods: ['DELETE'])]
    public function delete(Request $request, string $id): JsonResponse
    {
        $token = $this->keycloak->authenticate($request);
        $taskId = Input::id($id);
        $this->repository->deleteTask($token->sub, $taskId);
        return new JsonResponse(['ok' => true, 'deleted' => 1]);
    }

    #[Route('/api/tasks/{id}/notes', name: 'task_notes_list', requirements: ['id' => '\\d+'], methods: ['GET'])]
    public function notes(Request $request, string $id): JsonResponse
    {
        $token = $this->keycloak->authenticate($request);
        return new JsonResponse($this->repository->taskNotes($token->sub, Input::id($id)));
    }

    #[Route('/api/tasks/{id}/notes', name: 'task_notes_add', requirements: ['id' => '\\d+'], methods: ['POST'])]
    public function addNote(Request $request, string $id): JsonResponse
    {
        $token = $this->keycloak->authenticate($request);
        $content = Input::text(Input::json($request), 'content', 21845, true);
        return new JsonResponse($this->repository->addTaskNote($token->sub, Input::id($id), $content), 201);
    }

    #[Route('/api/tasks/{id}/notes/{noteId}', name: 'task_notes_edit', requirements: ['id' => '\\d+', 'noteId' => '\\d+'], methods: ['PUT'])]
    public function editNote(Request $request, string $id, string $noteId): JsonResponse
    {
        $token = $this->keycloak->authenticate($request);
        $content = Input::text(Input::json($request), 'content', 21845, true);
        $this->repository->editTaskNote($token->sub, Input::id($id), Input::id($noteId), $content);
        return new JsonResponse(['ok' => true]);
    }

    #[Route('/api/tasks/{id}/notes/{noteId}', name: 'task_notes_delete', requirements: ['id' => '\\d+', 'noteId' => '\\d+'], methods: ['DELETE'])]
    public function deleteNote(Request $request, string $id, string $noteId): JsonResponse
    {
        $token = $this->keycloak->authenticate($request);
        $this->repository->deleteTaskNote($token->sub, Input::id($id), Input::id($noteId));
        return new JsonResponse(['ok' => true]);
    }
}
