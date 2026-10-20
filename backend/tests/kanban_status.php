<?php
require dirname(__DIR__) . '/vendor/autoload.php';

use App\Controller\TaskController;
use App\Repository\TodoRepository;
use App\Service\Keycloak;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpKernel\Exception\HttpExceptionInterface;
use Symfony\Component\HttpKernel\Exception\UnauthorizedHttpException;

final class KanbanTestIdentity extends Keycloak
{
    public function __construct(public ?string $subject = 'owner') {}

    public function authenticate(Request $request): object
    {
        if ($this->subject === null) throw new UnauthorizedHttpException('Bearer', 'Brak sesji testowej');
        return (object) ['sub' => $this->subject];
    }
}

$checks = 0;
function verify(bool $condition, string $message): void
{
    global $checks;
    if (!$condition) throw new RuntimeException($message);
    $checks++;
}

function expectError(callable $action, int $status): void
{
    try {
        $action();
    } catch (HttpExceptionInterface $error) {
        verify($error->getStatusCode() === $status, 'Nieoczekiwany status błędu');
        return;
    }
    throw new RuntimeException('Brak oczekiwanego błędu HTTP ' . $status);
}

try {
    $pdo = new PDO('sqlite::memory:', null, null, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC]);
    $pdo->exec("CREATE TABLE users (id INTEGER PRIMARY KEY, keycloak_id TEXT);
        CREATE TABLE tasks (id INTEGER PRIMARY KEY, user_id INTEGER, status TEXT, name TEXT, description TEXT, deadline TEXT, priority TEXT, project_id INTEGER);
        INSERT INTO users VALUES (1, 'owner'), (2, 'other');
        INSERT INTO tasks VALUES (1, 1, 'Do zrobienia', 'Zadanie', 'Opis', '2026-10-25', 'Wysoki', 12);
        INSERT INTO tasks VALUES (2, 2, 'Do zrobienia', 'Cudze zadanie', '', NULL, 'Niski', NULL);");
    $identity = new KanbanTestIdentity();
    $repository = new TodoRepository($pdo);
    $controller = new TaskController($identity, $repository);
    $send = function (array $body, string $id = '1') use ($controller) {
        return $controller->status(Request::create('/api/tasks/' . $id . '/status', 'PUT', [], [], [], ['CONTENT_TYPE' => 'application/json'], json_encode($body)), $id);
    };
    $original = $pdo->query('SELECT * FROM tasks WHERE id = 1')->fetch();
    foreach (['Realizowane', 'Wykonane', 'Do zrobienia'] as $status) {
        $response = $send(['status' => $status]);
        $data = json_decode($response->getContent(), true);
        verify($response->getStatusCode() === 200 && $data['status'] === $status, 'Odpowiedź zmiany statusu');
        $saved = $pdo->query('SELECT * FROM tasks WHERE id = 1')->fetch();
        verify($saved['status'] === $status, 'Status zapisany w bazie');
        unset($saved['status']);
        $unchanged = $original;
        unset($unchanged['status']);
        verify($saved === $unchanged, 'Pozostałe pola zadania muszą zostać zachowane');
    }
    foreach ([[], ['status' => 'Nieznany'], ['status' => null], ['status' => ['Wykonane']], ['status' => 1]] as $body) {
        expectError(fn() => $send($body), 400);
    }
    expectError(fn() => $send(['status' => 'Wykonane'], '0'), 400);
    expectError(fn() => $send(['status' => 'Wykonane'], '999'), 404);
    expectError(fn() => $send(['status' => 'Wykonane'], '2'), 404);
    verify($pdo->query('SELECT status FROM tasks WHERE id = 2')->fetchColumn() === 'Do zrobienia', 'Cudze zadanie nie może się zmienić');
    $identity->subject = 'other';
    expectError(fn() => $send(['status' => 'Wykonane']), 404);
    $identity->subject = null;
    expectError(fn() => $send(['status' => 'Wykonane']), 401);
    verify($pdo->query('SELECT status FROM tasks WHERE id = 1')->fetchColumn() === 'Do zrobienia', 'Odrzucone żądania nie mogą zmieniać statusu');
    echo "OK: $checks sprawdzeń Kanban. SQLite i testowa tożsamość; bez połączenia z Keycloak.\n";
} catch (Throwable $error) {
    fwrite(STDERR, get_class($error) . ': ' . $error->getMessage() . "\n");
    exit(1);
}
