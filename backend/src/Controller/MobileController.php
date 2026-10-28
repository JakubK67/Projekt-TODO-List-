<?php
namespace App\Controller;

use App\Repository\TodoRepository;
use App\Service\Keycloak;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Attribute\Route;

final class MobileController
{
    public function __construct(private Keycloak $keycloak, private TodoRepository $repository) {}

    #[Route('/api/mobile/me', name: 'mobile_me', methods: ['GET'])]
    public function me(Request $request): JsonResponse
    {
        $token = $this->keycloak->authenticate($request);
        $this->repository->login($token);
        return new JsonResponse(['sub' => $token->sub, 'username' => $token->preferred_username ?? '']);
    }
}
