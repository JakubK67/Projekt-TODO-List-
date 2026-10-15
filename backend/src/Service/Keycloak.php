<?php
namespace App\Service;

use Firebase\JWT\JWK;
use Firebase\JWT\JWT;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpKernel\Exception\HttpException;
use Symfony\Contracts\HttpClient\HttpClientInterface;

class Keycloak
{
    public function __construct(private HttpClientInterface $http, private string $baseUrl, private string $realm, private string $issuer, private string $clientId, private string $adminUsername, private string $adminPassword) {}

    public function authenticate(Request $request): object
    {
        if (!preg_match('/^Bearer\s+(.+)$/i', $request->headers->get('Authorization', ''), $matches)) {
            throw new HttpException(401, 'Brak tokenu');
        }
        $jwks = $this->send('GET', $this->realmUrl() . '/protocol/openid-connect/certs');
        try {
            JWT::$leeway = 30;
            $token = JWT::decode($matches[1], JWK::parseKeySet($jwks, 'RS256'));
        } catch (\Throwable) {
            throw new HttpException(401, 'Nieprawidłowy token');
        }
        $audiences = (array) ($token->aud ?? []);
        if (($token->iss ?? '') !== $this->issuer || !is_string($token->sub ?? null) || $token->sub === '' || (($token->azp ?? '') !== $this->clientId && !in_array($this->clientId, $audiences, true))) {
            throw new HttpException(401, 'Nieprawidłowy token');
        }
        return $token;
    }

    public function updateProfile(object $token, array $profile): void
    {
        $admin = $this->adminToken();
        $url = $this->userUrl($token->sub);
        $user = $this->send('GET', $url, ['auth_bearer' => $admin]);
        $user['username'] = $profile['username'];
        if (($user['email'] ?? '') !== $profile['email']) $user['emailVerified'] = false;
        $user['email'] = $profile['email'];
        $user['firstName'] = $profile['first_name'];
        $user['lastName'] = $profile['last_name'];
        $this->send('PUT', $url, ['auth_bearer' => $admin, 'json' => $user]);
    }

    public function changePassword(object $token, string $current, string $next): void
    {
        $admin = $this->adminToken();
        $user = $this->send('GET', $this->userUrl($token->sub), ['auth_bearer' => $admin]);
        $verified = $this->send('POST', $this->realmUrl() . '/protocol/openid-connect/token', ['body' => [
            'client_id' => 'admin-cli', 'grant_type' => 'password', 'scope' => 'openid', 'username' => $user['username'], 'password' => $current,
        ]]);
        $accessToken = $verified['access_token'] ?? '';
        $verifiedUser = $this->send('GET', $this->realmUrl() . '/protocol/openid-connect/userinfo', ['auth_bearer' => $accessToken]);
        if (($verifiedUser['sub'] ?? '') !== $token->sub) throw new HttpException(400, 'Nieprawidłowe obecne hasło');
        $this->send('PUT', $this->userUrl($token->sub) . '/reset-password', ['auth_bearer' => $admin, 'json' => ['type' => 'password', 'value' => $next, 'temporary' => false]]);
    }

    private function adminToken(): string
    {
        if ($this->adminUsername === '' || $this->adminPassword === '') throw new HttpException(503, 'Brak konfiguracji usługi konta');
        $result = $this->send('POST', rtrim($this->baseUrl, '/') . '/realms/master/protocol/openid-connect/token', ['body' => [
            'client_id' => 'admin-cli', 'grant_type' => 'password', 'username' => $this->adminUsername, 'password' => $this->adminPassword,
        ]]);
        return $result['access_token'] ?? throw new HttpException(502, 'Brak dostępu do usługi konta');
    }

    private function realmUrl(): string
    {
        return rtrim($this->baseUrl, '/') . '/realms/' . rawurlencode($this->realm);
    }

    private function userUrl(string $id): string
    {
        return rtrim($this->baseUrl, '/') . '/admin/realms/' . rawurlencode($this->realm) . '/users/' . rawurlencode($id);
    }

    private function send(string $method, string $url, array $options = []): array
    {
        try {
            $response = $this->http->request($method, $url, $options + ['timeout' => 10]);
            $status = $response->getStatusCode();
            $content = $response->getContent(false);
        } catch (\Throwable $e) {
            throw new HttpException(502, 'Keycloak jest niedostępny', $e);
        }
        if ($status < 200 || $status >= 300) {
            throw new HttpException(in_array($status, [400, 401, 403, 409], true) ? 400 : 502, 'Keycloak odrzucił dane konta lub hasło');
        }
        if ($content === '') return [];
        try {
            return json_decode($content, true, 512, JSON_THROW_ON_ERROR);
        } catch (\Throwable $e) {
            throw new HttpException(502, 'Nieprawidłowa odpowiedź Keycloak', $e);
        }
    }
}
