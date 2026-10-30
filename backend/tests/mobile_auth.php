<?php
foreach (['APP_ENV' => 'test', 'APP_DEBUG' => '0', 'COOKIE_SECURE' => '0', 'KEYCLOAK_MFA_ACR_VALUES' => '2',
    'FRONTEND_ORIGIN' => 'http://localhost:3000', 'KEYCLOAK_MOBILE_CLIENT_ID' => 'todo-mobile',
    'KEYCLOAK_MOBILE_ISSUER' => 'http://192.168.1.9:8081/realms/todo-app',
    'MOBILE_WEB_ORIGINS' => 'http://localhost:3030,http://192.168.1.9:3030'] as $key => $value) {
    $_SERVER[$key] = $_ENV[$key] = $value;
}
require dirname(__DIR__) . '/config/bootstrap.php';

use App\Kernel;
use Firebase\JWT\JWT;
use Symfony\Component\HttpClient\MockHttpClient;
use Symfony\Component\HttpClient\Response\MockResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Session\Session;
use Symfony\Component\HttpFoundation\Session\Storage\MockArraySessionStorage;

final class MobileTestKernel extends Kernel
{
    public function getCacheDir(): string { return sys_get_temp_dir() . '/todo-mobile-auth-' . getmypid(); }
}

final class MobileTestDatabase extends PDO
{
    public function prepare(string $query, array $options = []): PDOStatement|false
    {
        return parent::prepare(str_replace('ON DUPLICATE KEY UPDATE last_login = CURRENT_TIMESTAMP',
            'ON CONFLICT(keycloak_id) DO UPDATE SET last_login = CURRENT_TIMESTAMP', $query), $options);
    }
}

$checks = 0;
function verify(bool $condition, string $message): void
{
    global $checks;
    if (!$condition) throw new RuntimeException($message);
    $checks++;
}

$kernel = null;
try {
    $options = ['private_key_bits' => 2048, 'private_key_type' => OPENSSL_KEYTYPE_RSA];
    if (is_file('C:/xampp/php/extras/openssl/openssl.cnf')) $options['config'] = 'C:/xampp/php/extras/openssl/openssl.cnf';
    $key = openssl_pkey_new($options);
    openssl_pkey_export($key, $privateKey, null, $options);
    $details = openssl_pkey_get_details($key);
    $encode = fn(string $value) => rtrim(strtr(base64_encode($value), '+/', '-_'), '=');
    $jwks = ['keys' => [['kty' => 'RSA', 'kid' => 'mobile-test', 'alg' => 'RS256', 'use' => 'sig', 'n' => $encode($details['rsa']['n']), 'e' => $encode($details['rsa']['e'])]]];
    $sign = fn(array $extra = []) => JWT::encode($extra + ['iss' => $_SERVER['KEYCLOAK_MOBILE_ISSUER'],
        'sub' => 'owner', 'aud' => 'todo-mobile', 'azp' => 'todo-mobile', 'typ' => 'Bearer', 'amr' => ['pwd', 'otp'],
        'preferred_username' => 'first', 'iat' => time(), 'exp' => time() + 300], $privateKey, 'RS256', 'mobile-test');
    $pdo = new MobileTestDatabase('sqlite::memory:', null, null, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC]);
    $pdo->exec("CREATE TABLE users (id INTEGER PRIMARY KEY AUTOINCREMENT, keycloak_id TEXT UNIQUE, username TEXT, first_name TEXT, last_name TEXT, email TEXT, role TEXT, last_login TEXT DEFAULT CURRENT_TIMESTAMP);
        CREATE TABLE projects (id INTEGER PRIMARY KEY, name TEXT, description TEXT, user_id TEXT);
        CREATE TABLE tasks (id INTEGER PRIMARY KEY, name TEXT, description TEXT, deadline TEXT, priority TEXT, status TEXT, created TEXT, updated TEXT, user_id INTEGER, project_id INTEGER);
        INSERT INTO users (id, keycloak_id, username) VALUES (1, 'owner', 'first'), (2, 'other', 'second');
        INSERT INTO tasks VALUES (1, 'Wlasne', '', '2026-10-30', 'Wysoki', 'Do zrobienia', '', '', 1, NULL), (2, 'Cudze', '', NULL, 'Normalny', 'Wykonane', '', '', 2, NULL);");
    $kernel = new MobileTestKernel('test', false);
    $kernel->boot();
    $container = $kernel->getContainer()->get('test.service_container');
    $container->set(PDO::class, $pdo);
    $container->set('http_client', new MockHttpClient(function (string $method, string $url) use ($jwks) {
        if (str_ends_with($url, '/certs')) return new MockResponse(json_encode($jwks));
        throw new RuntimeException('Nieoczekiwane polaczenie Keycloak');
    }));
    $call = function (string $method, string $path, ?string $token = null, ?Session $session = null, array $extra = [], array $body = []) use ($kernel) {
        $headers = ['CONTENT_TYPE' => 'application/json'] + $extra;
        if ($token !== null) $headers['HTTP_AUTHORIZATION'] = 'Bearer ' . $token;
        $request = Request::create($path, $method, [], [], [], $headers, json_encode($body, JSON_FORCE_OBJECT));
        $request->setSession($session ?? new Session(new MockArraySessionStorage()));
        $response = $kernel->handle($request);
        $kernel->terminate($request, $response);
        return [$response->getStatusCode(), json_decode($response->getContent(), true), $response];
    };
    [$status, $user] = $call('GET', '/api/mobile/me', $sign());
    verify($status === 200 && $user === ['sub' => 'owner', 'username' => 'first'], 'Logowanie mobilne po podpisanym tokenie');
    [$status, $tasks] = $call('GET', '/api/tasks', $sign());
    verify($status === 200 && count($tasks) === 1 && $tasks[0]['id'] === 1, 'Ten sam endpoint zwraca tylko wlasne zadania');
    verify($call('GET', '/api/tasks', $sign(['sub' => 'other']))[1][0]['id'] === 2, 'Izolacja drugiego konta');
    foreach ([['iss' => 'http://evil.test/realms/todo-app'], ['aud' => 'todo-frontend'], ['azp' => 'todo-frontend'],
        ['typ' => 'ID'], ['exp' => time() - 60], ['exp' => null], ['sub' => '']] as $extra) {
        verify($call('GET', '/api/tasks', $sign($extra))[0] === 401, 'Odrzucenie nieprawidlowych danych tokena');
    }
    verify($call('GET', '/api/tasks', 'invalid')[0] === 401, 'Odrzucenie niepodpisanego tokena');
    $forged = explode('.', $sign());
    $forged[1] = $encode(json_encode(['iss' => $_SERVER['KEYCLOAK_MOBILE_ISSUER'], 'sub' => 'other', 'aud' => 'todo-mobile', 'azp' => 'todo-mobile', 'typ' => 'Bearer', 'amr' => ['otp'], 'exp' => time() + 300]));
    verify($call('GET', '/api/tasks', implode('.', $forged))[0] === 401, 'Podmiana uzytkownika bez prawidlowego podpisu nie jest mozliwa');
    verify($call('GET', '/api/tasks', $sign(['amr' => ['pwd'], 'acr' => '1']))[0] === 403, 'Mobilne MFA nadal wymagane');
    verify($call('GET', '/api/tasks')[0] === 401, 'Zadania nadal wymagaja logowania');
    verify($call('GET', '/api/mobile/me')[0] === 401, 'Profil mobilny nie jest publiczny');
    $webToken = $sign(['iss' => $_SERVER['KEYCLOAK_ISSUER'], 'aud' => 'todo-frontend', 'azp' => 'todo-frontend']);
    verify($call('GET', '/api/tasks', $webToken)[0] === 401, 'Token webowy nie otwiera trybu Bearer');
    $webSession = new Session(new MockArraySessionStorage());
    $webSession->set('oidc_access_token', $webToken);
    $webSession->set('csrf_token', 'test-csrf');
    verify($call('GET', '/api/tasks', null, $webSession)[0] === 200, 'Logowanie sesyjne aplikacji webowej nadal dziala');
    verify($call('DELETE', '/api/tasks/1', null, $webSession)[0] === 403, 'Webowe CSRF nie zostalo wylaczone');
    verify($call('DELETE', '/api/tasks/2', $sign())[0] === 404, 'Token mobilny nie moze usunac cudzego zadania');
    verify($call('GET', '/api/tasks', $sign(['aud' => ['account', 'todo-mobile']]))[0] === 200, 'Token moze miec wielu prawidlowych odbiorcow');
    verify($call('GET', '/api/tasks', $sign(['amr' => ['pwd'], 'acr' => '2']))[0] === 200, 'Akceptacja potwierdzonego poziomu ACR');
    verify($call('GET', '/api/mobile/me', $sign(['sub' => 'new-user', 'preferred_username' => 'new']))[0] === 200, 'Pierwsze logowanie tworzy lokalnego uzytkownika');
    verify($call('GET', '/api/tasks', $sign(['sub' => 'new-user']))[1] === [], 'Nowe konto ma pusta liste wlasnych zadan');
    $token = $sign();
    $otherToken = $sign(['sub' => 'other']);
    [$status, $project] = $call('POST', '/api/projects', $token, null, [], ['name' => 'Mobilny projekt', 'description' => 'Opis']);
    verify($status === 201 && $project['name'] === 'Mobilny projekt', 'Tworzenie projektu przez token mobilny');
    $projectPath = '/api/projects/' . $project['id'];
    verify($call('GET', '/api/projects', $token)[1] === [$project], 'Lista wlasnych projektow');
    verify($call('GET', '/api/projects', $otherToken)[1] === [], 'Projekty nie sa widoczne dla innego konta');
    verify($call('GET', '/api/projects')[0] === 401, 'Projekty wymagaja logowania');
    [$status, $edited] = $call('PUT', $projectPath, $token, null, [], ['name' => 'Nowa nazwa', 'description' => 'Nowy opis']);
    verify($status === 200 && $edited['description'] === 'Nowy opis', 'Edycja nazwy i opisu projektu');
    verify($call('PUT', $projectPath, $otherToken, null, [], ['name' => 'Cudzy', 'description' => ''])[0] === 404, 'Brak edycji cudzego projektu');
    $taskBody = ['name' => 'Wlasne', 'description' => '', 'deadline' => '2026-10-30', 'priority' => 'Wysoki', 'status' => 'Do zrobienia', 'project_id' => $project['id']];
    verify($call('PUT', '/api/tasks/1', $token, null, [], $taskBody)[0] === 200, 'Przypisanie istniejacego zadania do projektu');
    verify($call('GET', '/api/tasks', $token)[1][0]['project_name'] === 'Nowa nazwa', 'Zadanie wyswietla aktualna nazwe projektu');
    verify($call('PUT', '/api/tasks/2', $otherToken, null, [], $taskBody)[0] === 400, 'Nie mozna przypisac zadania do cudzego projektu');
    verify($call('PUT', '/api/tasks/1', $token, null, [], array_replace($taskBody, ['project_id' => null]))[0] === 200, 'Odpisanie zadania z projektu');
    verify($call('GET', '/api/tasks', $token)[1][0]['project_id'] === null, 'Brak projektu zapisywany jako null');
    verify($call('PUT', '/api/tasks/1', $token, null, [], $taskBody)[0] === 200, 'Ponowne przypisanie zadania');
    [$status, $createdTask] = $call('POST', '/api/tasks', $token, null, [], $taskBody);
    verify($status === 201 && $createdTask['project_id'] === $project['id'], 'Dodanie nowego zadania bezposrednio w projekcie');
    verify($call('DELETE', $projectPath, $otherToken)[0] === 404, 'Brak usuwania cudzego projektu');
    [$status, $deleted] = $call('DELETE', $projectPath, $token);
    verify($status === 200 && $deleted['deleted_tasks'] === 2, 'Usuniecie projektu wraz z jego zadaniami');
    verify($call('GET', '/api/tasks', $token)[1] === [] && $call('GET', '/api/projects', $token)[1] === [], 'Usuniety projekt i zadania znikaja z list');
    verify(count($call('GET', '/api/tasks', $otherToken)[1]) === 1, 'Usuniecie projektu zachowuje zadania innego konta');
    [$status, , $response] = $call('OPTIONS', '/api/tasks', null, null, ['HTTP_ORIGIN' => 'http://localhost:3030']);
    verify($status === 204 && $response->headers->get('Access-Control-Allow-Origin') === 'http://localhost:3030', 'CORS dla podgladu Expo w przegladarce');
    verify(!$response->headers->has('Access-Control-Allow-Credentials'), 'Podglad Expo nie uzyskuje dostepu do cookies sesji webowej');
    verify($call('GET', '/api/tasks', $sign(), null, ['HTTP_ORIGIN' => 'http://localhost:3030'])[2]->headers->get('Access-Control-Allow-Origin') === 'http://localhost:3030', 'Autoryzowany odczyt mobilny jest dostepny z podgladu web');
    verify(!$call('OPTIONS', '/api/tasks', null, null, ['HTTP_ORIGIN' => 'https://evil.test'])[2]->headers->has('Access-Control-Allow-Origin'), 'CORS nie zezwala na dowolne strony');
    verify($call('OPTIONS', '/api/tasks', null, null, ['HTTP_ORIGIN' => 'http://localhost:3000'])[2]->headers->get('Access-Control-Allow-Credentials') === 'true', 'Aplikacja webowa zachowuje obsluge sesji');
    echo "OK: $checks sprawdzen mobilnych JWT, izolacji zadan i zabezpieczen webowych. SQLite i mock Keycloak.\n";
} catch (Throwable $error) {
    fwrite(STDERR, get_class($error) . ': ' . $error->getMessage() . "\n");
    exit(1);
} finally { $kernel?->shutdown(); }
