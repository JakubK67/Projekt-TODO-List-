<?php
namespace App\Controller;

use App\Repository\TodoRepository;
use App\Service\Keycloak;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Attribute\Route;

final class StatisticsController
{
    public function __construct(private TodoRepository $repository) {}

    #[Route('/api/statistics', name: 'statistics_own', methods: ['GET'])]
    public function own(Request $request, Keycloak $keycloak): JsonResponse
    {
        $token = $keycloak->authenticate($request);
        return new JsonResponse($this->repository->ownStatistics($token->sub));
    }

    #[Route('/api/public/statistics/{token}', name: 'statistics_public', requirements: ['token' => '[a-f0-9]{64}'], methods: ['GET'])]
    public function publicView(string $token): JsonResponse
    {
        return new JsonResponse($this->repository->publicStatistics($token));
    }
}
