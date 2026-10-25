<?php
namespace App\Controller;

use App\Service\Input;
use App\Service\Keycloak;
use App\Service\TaskAccess;
use App\Service\TaskFiles;
use RuntimeException;
use Symfony\Component\HttpFoundation\BinaryFileResponse;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\HttpFoundation\ResponseHeaderBag;
use Symfony\Component\HttpKernel\Exception\HttpExceptionInterface;
use Symfony\Component\Routing\Attribute\Route;

final class TaskFilesController
{
    public function __construct(
        private Keycloak $keycloak,
        private TaskAccess $access,
        private TaskFiles $files,
    ) {}

    #[Route('/api/tasks/{taskId}/files', name: 'task_files_list', requirements: ['taskId' => '\d+'], methods: ['GET'])]
    public function list(Request $request, string $taskId): Response
    {
        return $this->guard(function () use ($request, $taskId) {
            $id = $this->authorize($request, $taskId);
            return new JsonResponse($this->files->list($id));
        });
    }

    #[Route('/api/tasks/{taskId}/files', name: 'task_files_upload', requirements: ['taskId' => '\d+'], methods: ['POST'])]
    public function upload(Request $request, string $taskId): Response
    {
        return $this->guard(function () use ($request, $taskId) {
            $id = $this->authorize($request, $taskId);
            return new JsonResponse($this->files->upload($id, $_FILES['files'] ?? []), 201);
        });
    }

    #[Route('/api/tasks/{taskId}/files/{fileId}', name: 'task_files_download', requirements: ['taskId' => '\d+', 'fileId' => '\d+'], methods: ['GET'])]
    public function download(Request $request, string $taskId, string $fileId): Response
    {
        return $this->guard(function () use ($request, $taskId, $fileId) {
            $id = $this->authorize($request, $taskId);
            $info = $this->files->find($id, Input::id($fileId));

            $response = new BinaryFileResponse($info['path']);
            $response->headers->set('Content-Type', $info['mime_type']);
            $response->headers->set('X-Content-Type-Options', 'nosniff');
            $response->setContentDisposition(
                ResponseHeaderBag::DISPOSITION_ATTACHMENT,
                $info['original_name'],
                preg_replace('/[^A-Za-z0-9._-]+/', '_', $info['original_name'])
            );
            return $response;
        });
    }

    #[Route('/api/tasks/{taskId}/files/{fileId}', name: 'task_files_delete', requirements: ['taskId' => '\d+', 'fileId' => '\d+'], methods: ['DELETE'])]
    public function delete(Request $request, string $taskId, string $fileId): Response
    {
        return $this->guard(function () use ($request, $taskId, $fileId) {
            $id = $this->authorize($request, $taskId);
            $this->files->delete($id, Input::id($fileId));
            return new JsonResponse(['ok' => true]);
        });
    }

    private function authorize(Request $request, string $taskId): int
    {
        $token = $this->keycloak->authenticate($request);
        $id = Input::id($taskId);
        $this->access->assertOwns($token->sub, $id);
        return $id;
    }

    private function guard(callable $action): Response
    {
        try {
            return $action();
        } catch (HttpExceptionInterface $e) {
            throw $e;
        } catch (RuntimeException $e) {
            $code = in_array($e->getCode(), [404, 422, 500], true) ? $e->getCode() : 500;
            return new JsonResponse(['error' => $e->getMessage()], $code);
        }
    }
}
