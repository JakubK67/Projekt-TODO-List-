<?php
$_SERVER['APP_ENV'] = $_ENV['APP_ENV'] = 'test';
$_SERVER['APP_DEBUG'] = $_ENV['APP_DEBUG'] = '0';
$_SERVER['COOKIE_SECURE'] = $_ENV['COOKIE_SECURE'] = '0';
$_SERVER['KEYCLOAK_MFA_ACR_VALUES'] = $_ENV['KEYCLOAK_MFA_ACR_VALUES'] = '2';
$_SERVER['FRONTEND_ORIGIN'] = $_ENV['FRONTEND_ORIGIN'] = 'http://localhost:3000';
require dirname(__DIR__) . '/config/bootstrap.php';

use App\Controller\StatisticsController;
use App\Kernel;
use App\Repository\TodoRepository;
use App\Service\Keycloak;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Session\Session;
use Symfony\Component\HttpFoundation\Session\Storage\MockArraySessionStorage;
use Symfony\Component\HttpClient\MockHttpClient;

final class StatisticsTestKernel extends Kernel
{
    public function getCacheDir(): string
    {
        return sys_get_temp_dir() . '/todo-public-statistics-' . getmypid();
    }
}

final class StatisticsTestIdentity extends Keycloak
{
    public function __construct() {}
    public function authenticate(Request $request): object
    {
        return (object) ['sub' => 'owner'];
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
    $pdo = new PDO('sqlite::memory:', null, null, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC]);
    $pdo->exec("CREATE TABLE users (id INTEGER PRIMARY KEY, keycloak_id TEXT, username TEXT, email TEXT, public_statistics_token TEXT UNIQUE);
        CREATE TABLE tasks (id INTEGER PRIMARY KEY, user_id INTEGER, status TEXT, priority TEXT, name TEXT, description TEXT);
        INSERT INTO users VALUES (1, 'owner', 'first', 'private@example.test', NULL), (2, 'other', 'second', 'secret@example.test', NULL), (3, 'empty', 'empty', NULL, NULL);
        INSERT INTO tasks VALUES (1, 1, 'Wykonane', 'Niski', 'Private task', 'Private description');
        INSERT INTO tasks VALUES (2, 1, 'Wykonane', 'Wysoki', 'Secret', 'Secret');
        INSERT INTO tasks VALUES (3, 1, 'Realizowane', 'Wysoki', 'In progress', 'Private');
        INSERT INTO tasks VALUES (4, 2, 'Wykonane', 'Normalny', 'Other task', 'Other description');");
    $originalTasks = $pdo->query('SELECT * FROM tasks')->fetchAll();
    $repository = new TodoRepository($pdo);
    $controller = new StatisticsController($repository);
    $own = json_decode($controller->own(Request::create('/api/statistics'), new StatisticsTestIdentity())->getContent(), true);
    $token = $own['publicToken'];
    $otherToken = $repository->ownStatistics('other')['publicToken'];
    $emptyToken = $repository->ownStatistics('empty')['publicToken'];
    verify(preg_match('/^[a-f0-9]{64}$/', $token) === 1, 'Losowy token ma 256 bitów zamiast ID użytkownika');
    verify(count(array_unique([$token, $otherToken, $emptyToken])) === 3, 'Każdy użytkownik ma inny token');
    verify($repository->ownStatistics('owner')['publicToken'] === $token, 'Link jest stabilny przy ponownym otwarciu statystyk');
    $kernel = new StatisticsTestKernel('test', false);
    $kernel->boot();
    $container = $kernel->getContainer()->get('test.service_container');
    $container->set(PDO::class, $pdo);
    $container->set('http_client', new MockHttpClient(function () {
        throw new RuntimeException('Publiczne statystyki nie mogą wymagać połączenia z Keycloak');
    }));
    $call = function (string $method, string $path) use ($kernel) {
        $request = Request::create($path, $method, [], [], [], ['CONTENT_TYPE' => 'application/json'], '{}');
        $request->setSession(new Session(new MockArraySessionStorage()));
        $response = $kernel->handle($request);
        $kernel->terminate($request, $response);
        return [$response->getStatusCode(), json_decode($response->getContent(), true)];
    };

    [$status, $data] = $call('GET', '/api/public/statistics/' . $token);
    verify($status === 200, 'Publiczny endpoint musi działać bez sesji i Keycloak');
    verify($data === ['user' => ['username' => 'first'], 'counts' => ['Niski' => 1, 'Normalny' => 0, 'Wysoki' => 1]], 'Wyłącznie zbiorcze statystyki właściciela, bez ID, prywatnych danych i zadań');
    verify($call('GET', '/api/public/statistics/' . $otherToken)[1]['counts'] === ['Niski' => 0, 'Normalny' => 1, 'Wysoki' => 0], 'Statystyki różnych użytkowników nie mogą się mieszać');
    verify($call('GET', '/api/public/statistics/' . $emptyToken)[1]['counts'] === ['Niski' => 0, 'Normalny' => 0, 'Wysoki' => 0], 'Konto bez zadań ma zerowe statystyki');
    verify($call('GET', '/api/public/statistics/' . bin2hex(random_bytes(32)))[0] === 404, 'Nieznany token: 404');
    foreach (['1', '0', 'owner', 'first', substr($token, 1), $token . 'a'] as $invalidToken) {
        verify($call('GET', '/api/public/statistics/' . $invalidToken)[0] === 404, 'ID, login i nieprawidłowe tokeny nie mogą udostępniać statystyk');
    }
    verify($call('POST', '/api/public/statistics/' . $token)[0] === 405, 'Publiczny endpoint tylko do odczytu');
    foreach ([['GET', '/api/tasks'], ['POST', '/api/tasks'], ['PUT', '/api/tasks/1'], ['DELETE', '/api/tasks/1'], ['PUT', '/api/tasks/1/status'], ['GET', '/api/statistics']] as [$method, $path]) {
        verify($call($method, $path)[0] === 401, "Brak sesji musi blokować $method $path");
    }
    verify($pdo->query('SELECT * FROM tasks')->fetchAll() === $originalTasks, 'Publiczny odczyt i odrzucone operacje nie mogą zmieniać zadań');
    unset($own['publicToken']);
    verify($own === $data, 'Własne statystyki wynikają z uwierzytelnionej tożsamości');
    echo "OK: $checks sprawdzeń publicznych statystyk i ochrony zadań. SQLite i testowa tożsamość.\n";
} catch (Throwable $error) {
    fwrite(STDERR, get_class($error) . ': ' . $error->getMessage() . "\n");
    exit(1);
} finally {
    $kernel?->shutdown();
}
