<?php
require dirname(__DIR__) . '/vendor/autoload.php';

use Symfony\Component\Dotenv\Dotenv;

$envFile = dirname(__DIR__) . '/.env';
(new Dotenv())->bootEnv(is_file($envFile) ? $envFile : $envFile . '.dist');
