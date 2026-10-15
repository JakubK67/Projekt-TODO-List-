<?php
namespace App\Controller;

use App\Repository\TodoRepository;
use App\Service\Input;
use App\Service\Keycloak;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\HttpKernel\Exception\BadRequestHttpException;

final class AccountController
{
    public function __construct(private Keycloak $keycloak, private TodoRepository $repository) {}

    #[Route('/api/me', name: 'account_get', methods: ['GET'])]
    public function get(Request $request): JsonResponse
    {
        return new JsonResponse($this->repository->login($this->keycloak->authenticate($request)));
    }

    #[Route('/api/me', name: 'account_edit', methods: ['PUT'])]
    public function edit(Request $request): JsonResponse
    {
        $token = $this->keycloak->authenticate($request);
        $body = Input::json($request);
        $profile = [
            'username' => Input::text($body, 'username', 255, true),
            'email' => Input::text($body, 'email', 255, true),
            'first_name' => Input::text($body, 'first_name', 100),
            'last_name' => Input::text($body, 'last_name', 100),
        ];
        if (!filter_var($profile['email'], FILTER_VALIDATE_EMAIL)) throw new BadRequestHttpException('Nieprawidłowy email');
        $this->repository->user($token->sub);
        $this->keycloak->updateProfile($token, $profile);
        return new JsonResponse($this->repository->saveProfile($token->sub, $profile));
    }

    #[Route('/api/me/password', name: 'account_password', methods: ['PUT'])]
    public function password(Request $request): JsonResponse
    {
        $token = $this->keycloak->authenticate($request);
        $body = Input::json($request);
        foreach (['current', 'next', 'confirm'] as $field) {
            if (!is_string($body[$field] ?? null) || $body[$field] === '') throw new BadRequestHttpException('Uzupełnij wszystkie pola hasła');
        }
        if ($body['next'] !== $body['confirm']) throw new BadRequestHttpException('Nowe hasła nie są zgodne');
        $this->keycloak->changePassword($token, $body['current'], $body['next']);
        return new JsonResponse(['message' => 'Hasło zostało zmienione.']);
    }
}
