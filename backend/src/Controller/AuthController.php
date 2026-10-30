<?php
namespace App\Controller;

use App\Repository\TodoRepository;
use App\Service\Keycloak;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpKernel\Exception\AccessDeniedHttpException;
use Symfony\Component\HttpKernel\Exception\HttpException;
use Symfony\Component\Routing\Attribute\Route;

final class AuthController
{
    public function __construct(private Keycloak $keycloak, private TodoRepository $repository, private string $frontendOrigin) {}

    #[Route('/auth/session', name: 'auth_session', methods: ['POST'])]
    public function establish(Request $request): JsonResponse
    {
        if ($request->headers->get('Origin') !== $this->frontendOrigin) {
            throw new AccessDeniedHttpException('Nie udało się rozpocząć sesji.');
        }
        try {
            $tokens = json_decode($request->getContent(), true, 512, JSON_THROW_ON_ERROR);
        } catch (\Throwable) {
            throw new HttpException(400, 'Nie udało się rozpocząć sesji.');
        }
        if (!is_array($tokens)) throw new HttpException(400, 'Nie udało się rozpocząć sesji.');
        $token = $this->keycloak->establishSession($request, $tokens);
        $this->repository->login($token);
        return new JsonResponse($this->keycloak->sessionInfo($request, $token));
    }

    #[Route('/auth/me', name: 'auth_me', methods: ['GET'])]
    public function me(Request $request): JsonResponse
    {
        return new JsonResponse($this->keycloak->sessionInfo($request, $this->keycloak->authenticate($request)));
    }

    #[Route('/auth/logout', name: 'auth_logout', methods: ['POST'])]
    public function logout(Request $request): JsonResponse
    {
        $this->keycloak->authenticate($request);
        return new JsonResponse(['logoutUrl' => $this->keycloak->logoutUrl($request)]);
    }

    #[Route('/api/admin', name: 'auth_admin_guard', methods: ['GET'])]
    public function admin(Request $request): JsonResponse
    {
        $token = $this->keycloak->authenticate($request);
        if (!$this->keycloak->hasRole($token, 'admin')) {
            throw new AccessDeniedHttpException('Brak uprawnień.');
        }
        return new JsonResponse(['allowed' => true]);
    }
}
