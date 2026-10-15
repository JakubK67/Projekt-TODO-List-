<?php

namespace ContainerBYzDxza;

class UriSignerGhostC209a2a extends \Symfony\Component\HttpFoundation\UriSigner implements \Symfony\Component\VarExporter\LazyObjectInterface
{
    use \Symfony\Component\VarExporter\LazyGhostTrait;
    private const LAZY_OBJECT_PROPERTY_SCOPES = [
        "\0".parent::class."\0".'clock' => [parent::class, 'clock', null, 16],
        "\0".parent::class."\0".'expirationParameter' => [parent::class, 'expirationParameter', null, 16],
        "\0".parent::class."\0".'hashParameter' => [parent::class, 'hashParameter', null, 16],
        "\0".parent::class."\0".'secret' => [parent::class, 'secret', null, 16],
        'clock' => [parent::class, 'clock', null, 16],
        'expirationParameter' => [parent::class, 'expirationParameter', null, 16],
        'hashParameter' => [parent::class, 'hashParameter', null, 16],
        'secret' => [parent::class, 'secret', null, 16],
    ];
}
class_exists(\Symfony\Component\VarExporter\Internal\Hydrator::class);
class_exists(\Symfony\Component\VarExporter\Internal\LazyObjectRegistry::class);
class_exists(\Symfony\Component\VarExporter\Internal\LazyObjectState::class);

if (!\class_exists('UriSignerGhostC209a2a', false)) {
    \class_alias(__NAMESPACE__.'\\UriSignerGhostC209a2a', 'UriSignerGhostC209a2a', false);
}
