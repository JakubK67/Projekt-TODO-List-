<?php
namespace App\EventSubscriber;

use Symfony\Component\EventDispatcher\EventSubscriberInterface;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\HttpKernel\Event\ExceptionEvent;
use Symfony\Component\HttpKernel\Event\RequestEvent;
use Symfony\Component\HttpKernel\Event\ResponseEvent;
use Symfony\Component\HttpKernel\Exception\HttpExceptionInterface;

final class ApiSubscriber implements EventSubscriberInterface
{
    public function __construct(private string $allowedOrigin) {}

    public static function getSubscribedEvents(): array
    {
        return ['kernel.request' => ['onRequest', 100], 'kernel.response' => 'onResponse', 'kernel.exception' => ['onException', 100]];
    }

    public function onRequest(RequestEvent $event): void
    {
        if ($event->getRequest()->isMethod('OPTIONS')) $event->setResponse(new Response('', 204));
    }

    public function onResponse(ResponseEvent $event): void
    {
        $headers = $event->getResponse()->headers;
        if ($event->getRequest()->headers->get('Origin') === $this->allowedOrigin) {
            $headers->set('Access-Control-Allow-Origin', $this->allowedOrigin);
            $event->getResponse()->setVary('Origin', false);
        }
        $headers->set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
        $headers->set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
        $headers->set('Cache-Control', 'no-store');
    }

    public function onException(ExceptionEvent $event): void
    {
        $error = $event->getThrowable();
        $status = $error instanceof HttpExceptionInterface ? $error->getStatusCode() : 500;
        if ($status >= 500) error_log(get_class($error) . ': ' . $error->getMessage());
        $message = $status >= 500 ? 'Błąd usługi. Sprawdź logi backendu.' : $error->getMessage();
        $event->setResponse(new JsonResponse(['error' => $message], $status, $error instanceof HttpExceptionInterface ? $error->getHeaders() : []));
    }
}
