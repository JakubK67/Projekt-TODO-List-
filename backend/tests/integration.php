<?php
$_SERVER['APP_ENV'] = $_ENV['APP_ENV'] = 'test';
$_SERVER['APP_DEBUG'] = $_ENV['APP_DEBUG'] = '0';
$_SERVER['KEYCLOAK_ADMIN_USERNAME'] = $_ENV['KEYCLOAK_ADMIN_USERNAME'] = 'test-admin';
$_SERVER['KEYCLOAK_ADMIN_PASSWORD'] = $_ENV['KEYCLOAK_ADMIN_PASSWORD'] = 'test-password';
require dirname(__DIR__) . '/config/bootstrap.php';

use App\Kernel;
use Firebase\JWT\JWT;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpClient\MockHttpClient;
use Symfony\Component\HttpClient\Response\MockResponse;

final class TestDatabase extends PDO
{
    public function prepare(string $query, array $options = []): PDOStatement|false
    {
        $query = str_replace('ON DUPLICATE KEY UPDATE last_login = CURRENT_TIMESTAMP', 'ON CONFLICT(keycloak_id) DO UPDATE SET last_login = CURRENT_TIMESTAMP', $query);
        return parent::prepare($query, $options);
    }
}

$checks = 0;
function check(bool $condition, string $message): void
{
    global $checks;
    if (!$condition) throw new RuntimeException($message);
    $checks++;
}

$options = ['private_key_bits' => 2048, 'private_key_type' => OPENSSL_KEYTYPE_RSA];
$opensslConfig = 'C:/xampp/php/extras/openssl/openssl.cnf';
if (is_file($opensslConfig)) $options['config'] = $opensslConfig;
$key = openssl_pkey_new($options);
if (!$key) throw new RuntimeException('Nie udało się wygenerować testowego klucza RSA');
openssl_pkey_export($key, $privateKey, null, $options);
$details = openssl_pkey_get_details($key);
$encode = fn(string $value) => rtrim(strtr(base64_encode($value), '+/', '-_'), '=');
$jwks = ['keys' => [['kty' => 'RSA', 'kid' => 'test', 'alg' => 'RS256', 'use' => 'sig', 'n' => $encode($details['rsa']['n']), 'e' => $encode($details['rsa']['e'])]]];
$token = fn(string $id, array $extra = []) => JWT::encode($extra + ['sub' => $id, 'iss' => $_SERVER['KEYCLOAK_ISSUER'], 'azp' => 'todo-frontend', 'preferred_username' => 'first', 'iat' => time(), 'exp' => time() + 300], $privateKey, 'RS256', 'test');
$account = ['id' => 'first-id', 'username' => 'first', 'email' => 'first@example.test', 'emailVerified' => true];
$passwordSaved = false;
$http = new MockHttpClient(function (string $method, string $url, array $options) use ($jwks, &$account, &$passwordSaved) {
    if (str_ends_with($url, '/certs')) return new MockResponse(json_encode($jwks));
    if (str_ends_with($url, '/token')) return new MockResponse('{"access_token":"verified-token"}');
    if (str_ends_with($url, '/userinfo')) return new MockResponse('{"sub":"first-id"}');
    if (str_ends_with($url, '/reset-password')) {
        $passwordSaved = true;
        return new MockResponse('', ['http_code' => 204]);
    }
    if (str_contains($url, '/admin/realms/')) {
        if ($method === 'PUT') {
            $account = json_decode($options['body'], true);
            return new MockResponse('', ['http_code' => 204]);
        }
        return new MockResponse(json_encode($account));
    }
    throw new RuntimeException('Nieoczekiwane wywołanie HTTP w teście');
});

$pdo = new TestDatabase('sqlite::memory:', null, null, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC]);
$pdo->exec("CREATE TABLE users (id INTEGER PRIMARY KEY AUTOINCREMENT, keycloak_id TEXT UNIQUE NOT NULL, username TEXT, first_name TEXT, last_name TEXT, email TEXT, role TEXT, last_login TEXT DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE projects (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, description TEXT, user_id TEXT);
    CREATE TABLE tasks (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, description TEXT, deadline TEXT, priority TEXT, status TEXT, user_id INTEGER, project_id INTEGER, created TEXT DEFAULT CURRENT_TIMESTAMP, updated TEXT DEFAULT CURRENT_TIMESTAMP);
    INSERT INTO users (keycloak_id, username) VALUES ('first-id', 'first'), ('second-id', 'second');");
$kernel = new Kernel('test', false);
$kernel->boot();
$container = $kernel->getContainer()->get('test.service_container');
$container->set(PDO::class, $pdo);
$container->set('http_client', $http);

$call = function (string $method, string $path, ?array $body = null, ?string $bearer = null, array $headers = []) use ($kernel) {
    $server = ['CONTENT_TYPE' => 'application/json', 'HTTP_ORIGIN' => 'http://localhost:3000'] + $headers;
    if ($bearer !== null) $server['HTTP_AUTHORIZATION'] = 'Bearer ' . $bearer;
    $request = Request::create($path, $method, [], [], [], $server, $body === null ? null : json_encode($body));
    $response = $kernel->handle($request);
    $kernel->terminate($request, $response);
    return [$response->getStatusCode(), json_decode($response->getContent(), true), $response];
};

foreach (['/api/tasks', '/api/projects', '/api/me'] as $path) check($call('GET', $path)[0] === 401, 'Endpoint bez tokenu: ' . $path);
check($call('PUT', '/api/tasks/1', ['name' => 'X'])[0] === 401, 'Edycja bez tokenu');
check($call('DELETE', '/api/tasks/1')[0] === 401, 'Usuwanie bez tokenu');
check($call('GET', '/api/tasks', null, 'invalid')[0] === 401, 'Nieprawidłowy JWT');
check($call('GET', '/api/tasks', null, $token('first-id', ['iss' => 'wrong']))[0] === 401, 'Nieprawidłowy issuer');
check($call('GET', '/api/tasks', null, $token('first-id', ['azp' => 'wrong']))[0] === 401, 'Nieprawidłowy klient');
check($call('GET', '/api/tasks', null, $token('first-id', ['exp' => time() - 100]))[0] === 401, 'Wygasły JWT');
$first = $token('first-id');
$second = $token('second-id');
check($call('GET', '/api/me', null, $first)[0] === 200, 'Profil użytkownika');
check($call('GET', '/api/me', null, $token('third-id'))[0] === 200, 'Pierwsze logowanie');
[$status, $project] = $call('POST', '/api/projects', ['name' => 'Praktyki', 'description' => 'Opis'], $first);
check($status === 201, 'Dodanie projektu');
check(count($call('GET', '/api/projects', null, $first)[1]) === 1, 'Własne projekty');
check($call('GET', '/api/projects', null, $second)[1] === [], 'Cudze projekty są ukryte');
check($call('POST', '/api/projects', ['name' => '  '], $first)[0] === 400, 'Pusta nazwa');
$body = ['name' => 'Zadanie', 'deadline' => '2026-10-20', 'priority' => '1', 'status' => '0', 'project_id' => $project['id']];
check($call('POST', '/api/tasks', $body, $second)[0] === 400, 'Nie można użyć cudzego projektu');
check($call('POST', '/api/tasks', array_replace($body, ['deadline' => '2026-02-30']), $first)[0] === 400, 'Nieprawidłowa data');
[$status, $task] = $call('POST', '/api/tasks', $body, $first);
check($status === 201 && $task['user_id'] === 1, 'Zadanie należy do liczbowego users.id');
[$status, $free] = $call('POST', '/api/tasks', array_replace($body, ['project_id' => null]), $first);
check($status === 201 && $free['project_id'] === null, 'Zadanie bez projektu');
$list = $call('GET', '/api/tasks', null, $first)[1];
check(count($list) === 2 && $list[0]['project_name'] === 'Praktyki', 'Lista z nazwą projektu');
check($call('GET', '/api/tasks', null, $second)[1] === [], 'Cudze zadania są ukryte');
check($call('PUT', '/api/tasks/' . $task['id'], $body, $second)[0] === 404, 'Blokada edycji cudzego zadania');
check($call('DELETE', '/api/tasks/' . $task['id'], null, $second)[0] === 404, 'Blokada usuwania cudzego zadania');
check($call('PUT', '/api/tasks/' . $task['id'], array_replace($body, ['name' => 'Zmienione']), $first)[0] === 200, 'Edycja własnego zadania');
check($call('PUT', '/api/tasks/' . $free['id'], $body, $first)[0] === 200, 'Przypisanie zadania do projektu podczas edycji');
check((int) $pdo->query('SELECT project_id FROM tasks WHERE id = ' . $free['id'])->fetchColumn() === $project['id'], 'Projekt edytowanego zadania zapisany');
$withoutProject = $body;
unset($withoutProject['project_id']);
check($call('PUT', '/api/tasks/' . $free['id'], $withoutProject, $first)[0] === 200, 'Edycja bez pola projektu');
check((int) $pdo->query('SELECT project_id FROM tasks WHERE id = ' . $free['id'])->fetchColumn() === $project['id'], 'Pominięcie pola zachowuje projekt');
[$status, $foreignProject] = $call('POST', '/api/projects', ['name' => 'Cudzy projekt'], $second);
check($call('PUT', '/api/tasks/' . $free['id'], array_replace($body, ['project_id' => $foreignProject['id']]), $first)[0] === 400, 'Blokada przypisania do cudzego projektu');
check($call('PUT', '/api/tasks/' . $free['id'], array_replace($body, ['project_id' => 999999]), $first)[0] === 400, 'Blokada nieistniejącego projektu');
check($call('PUT', '/api/tasks/' . $free['id'], array_replace($body, ['project_id' => 'abc']), $first)[0] === 400, 'Nieprawidłowy identyfikator projektu podczas edycji');
check($call('PUT', '/api/tasks/' . $free['id'], array_replace($body, ['project_id' => null]), $first)[0] === 200, 'Usunięcie przypisania projektu');
check($pdo->query('SELECT project_id FROM tasks WHERE id = ' . $free['id'])->fetchColumn() === null, 'Brak projektu zapisany jako NULL');
check($call('GET', '/showtasks.php', null, $first)[0] === 404, 'Stary adres został usunięty');
check($call('DELETE', '/api/tasks/' . $task['id'], null, $first)[0] === 200, 'Usunięcie własnego zadania');
check(count($call('GET', '/api/tasks', null, $first)[1]) === 1, 'Zadanie zostało usunięte');
[$status] = $call('PUT', '/api/me', ['username' => 'renamed', 'email' => 'new@example.test', 'first_name' => 'Jan', 'last_name' => 'Nowak'], $first);
check($status === 200 && $account['username'] === 'renamed' && $account['emailVerified'] === false, 'Profil w Keycloak');
check($pdo->query("SELECT username FROM users WHERE keycloak_id = 'first-id'")->fetchColumn() === 'renamed', 'Profil w lokalnej bazie');
check($call('PUT', '/api/me/password', ['current' => 'old', 'next' => 'new', 'confirm' => 'different'], $first)[0] === 400, 'Niezgodne hasła');
check($call('PUT', '/api/me/password', ['current' => 'old', 'next' => 'new', 'confirm' => 'new'], $first)[0] === 200 && $passwordSaved, 'Zmiana hasła przez Keycloak');
[$status, , $response] = $call('OPTIONS', '/api/tasks');
check($status === 204 && $response->headers->get('Access-Control-Allow-Origin') === 'http://localhost:3000', 'Preflight CORS');
check($call('GET', '/missing')[0] === 404, 'Błąd JSON dla brakującej trasy');
$kernel->shutdown();
echo "OK: $checks sprawdzeń. SQLite i mock Keycloak; bez połączenia z rzeczywistymi usługami.\n";
