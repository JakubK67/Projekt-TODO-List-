<?php
namespace App\Service;

use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpKernel\Exception\BadRequestHttpException;

final class Input
{
    public static function json(Request $request): array
    {
        try {
            $body = json_decode($request->getContent(), true, 512, JSON_THROW_ON_ERROR);
        } catch (\JsonException) {
            throw new BadRequestHttpException('Nieprawidłowe dane JSON');
        }
        if (!is_array($body) || !str_starts_with(ltrim($request->getContent()), '{')) {
            throw new BadRequestHttpException('Oczekiwano obiektu JSON');
        }
        return $body;
    }

    public static function text(array $body, string $field, int $max, bool $required = false): string
    {
        $value = $body[$field] ?? '';
        if (!is_string($value)) {
            throw new BadRequestHttpException('Nieprawidłowe pole: ' . $field);
        }
        $value = trim($value);
        $length = preg_match_all('/./us', $value);
        if ($length === false || $length > $max || ($required && $value === '')) {
            throw new BadRequestHttpException('Nieprawidłowe lub zbyt długie pole: ' . $field);
        }
        return $value;
    }

    public static function id(mixed $value): int
    {
        if ((!is_int($value) && !is_string($value)) || filter_var($value, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1, 'max_range' => 2147483647]]) === false) {
            throw new BadRequestHttpException('Nieprawidłowy identyfikator');
        }
        return (int) $value;
    }

    public static function task(array $body): array
    {
        $deadline = $body['deadline'] ?? null;
        if ($deadline === '') $deadline = null;
        if ($deadline !== null) {
            $date = is_string($deadline) ? \DateTimeImmutable::createFromFormat('!Y-m-d', $deadline) : false;
            if (!$date || $date->format('Y-m-d') !== $deadline || $date->format('Y') < '1000') {
                throw new BadRequestHttpException('Nieprawidłowa data zadania');
            }
        }
        return [
            'name' => self::text($body, 'name', 100, true),
            'description' => self::text(['description' => $body['description'] ?? $body['desc'] ?? ''], 'description', 21845),
            'deadline' => $deadline,
            'priority' => self::choice($body['priority'] ?? 1, ['Niski', 'Normalny', 'Wysoki']),
            'status' => self::choice($body['status'] ?? 0, ['Do zrobienia', 'Realizowane', 'Wykonane']),
        ];
    }

    private static function choice(mixed $value, array $choices): string
    {
        if (is_string($value) && in_array($value, $choices, true)) return $value;
        if ((is_int($value) || is_string($value)) && preg_match('/^[0-2]$/', (string) $value)) return $choices[(int) $value];
        throw new BadRequestHttpException('Nieprawidłowy priorytet lub status');
    }
}
