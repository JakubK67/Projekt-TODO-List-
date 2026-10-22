<?php
namespace Symfony\Component\HttpKernel\Exception {
    class BadRequestHttpException extends \RuntimeException {}
}

namespace {
    require dirname(__DIR__) . '/src/Service/Input.php';

    use App\Service\Input;
    use Symfony\Component\HttpKernel\Exception\BadRequestHttpException;

    $checks = 0;

    function verify(bool $condition, string $message): void
    {
        global $checks;
        if (!$condition) throw new \RuntimeException($message);
        $checks++;
    }

    function rejects(callable $operation, string $message): void
    {
        try {
            $operation();
        } catch (BadRequestHttpException) {
            verify(true, $message);
            return;
        }
        verify(false, $message);
    }

    $task = Input::task(['name' => '  Zadanie  ', 'description' => 'Opis']);
    verify($task['name'] === 'Zadanie', 'Nazwa zadania jest przycinana');
    verify($task['description'] === 'Opis', 'Opis zadania jest zachowany');
    verify(Input::task(['name' => str_repeat('ż', 100)])['name'] === str_repeat('ż', 100), 'Limit nazwy liczy znaki Unicode, nie bajty');
    rejects(fn() => Input::task(['name' => '']), 'Pusta nazwa zadania jest odrzucana');
    rejects(fn() => Input::task(['name' => " \t\n"]), 'Nazwa z samych białych znaków jest odrzucana');
    rejects(fn() => Input::task(['name' => str_repeat('a', 101)]), 'Nazwa ponad limit jest odrzucana');
    verify(strlen(Input::task(['name' => 'OK', 'description' => str_repeat('a', 5000)])['description']) === 5000, 'Opis zadania w limicie jest akceptowany');
    rejects(fn() => Input::task(['name' => 'OK', 'description' => str_repeat('a', 5001)]), 'Opis zadania ponad limit jest odrzucany');
    verify(Input::text(['description' => str_repeat('a', 5000)], 'description', 5000) !== '', 'Opis projektu w limicie jest akceptowany');
    rejects(fn() => Input::text(['description' => str_repeat('a', 5001)], 'description', 5000), 'Opis projektu ponad limit jest odrzucany');

    echo "OK: $checks sprawdzeń walidacji backendu.\n";
}
