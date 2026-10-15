<?php
namespace App\Controller;

use App\Repository\TodoRepository;
use App\Service\Input;
use App\Service\Keycloak;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\HttpKernel\Exception\BadRequestHttpException;

final class ProjectController
{
    public function __construct(private Keycloak $keycloak, private TodoRepository $repository) {}

    #[Route('/api/projects', name: 'projects_list', methods: ['GET'])]
    public function list(Request $request): JsonResponse
    {
        $token = $this->keycloak->authenticate($request);
        return new JsonResponse($this->repository->projects($token->sub));
    }

    #[Route('/api/projects', name: 'projects_add', methods: ['POST'])]
    public function add(Request $request): JsonResponse
    {
        $token = $this->keycloak->authenticate($request);
        $body = Input::json($request);
        $description = Input::text($body, 'description', 65535);
        if (strlen($description) > 65535) throw new BadRequestHttpException('Zbyt długi opis projektu');
        return new JsonResponse($this->repository->addProject($token->sub, Input::text($body, 'name', 100, true), $description), 201);
    }
}
