<?php

/**
 * This file has been auto-generated
 * by the Symfony Routing Component.
 */

return [
    false, // $matchHost
    [ // $staticRoutes
        '/api/me' => [
            [['_route' => 'account_get', '_controller' => 'App\\Controller\\AccountController::get'], null, ['GET' => 0], null, false, false, null],
            [['_route' => 'account_edit', '_controller' => 'App\\Controller\\AccountController::edit'], null, ['PUT' => 0], null, false, false, null],
        ],
        '/api/me/password' => [[['_route' => 'account_password', '_controller' => 'App\\Controller\\AccountController::password'], null, ['PUT' => 0], null, false, false, null]],
        '/api/projects' => [
            [['_route' => 'projects_list', '_controller' => 'App\\Controller\\ProjectController::list'], null, ['GET' => 0], null, false, false, null],
            [['_route' => 'projects_add', '_controller' => 'App\\Controller\\ProjectController::add'], null, ['POST' => 0], null, false, false, null],
        ],
        '/api/tasks' => [
            [['_route' => 'tasks_list', '_controller' => 'App\\Controller\\TaskController::list'], null, ['GET' => 0], null, false, false, null],
            [['_route' => 'tasks_add', '_controller' => 'App\\Controller\\TaskController::add'], null, ['POST' => 0], null, false, false, null],
        ],
    ],
    [ // $regexpList
        0 => '{^(?'
                .'|/api/(?'
                    .'|projects/(\\d+)(?'
                        .'|(*:32)'
                    .')'
                    .'|tasks/(\\d+)(?'
                        .'|(*:54)'
                    .')'
                .')'
            .')/?$}sDu',
    ],
    [ // $dynamicRoutes
        32 => [
            [['_route' => 'projects_edit', '_controller' => 'App\\Controller\\ProjectController::edit'], ['id'], ['PUT' => 0], null, false, true, null],
            [['_route' => 'projects_delete', '_controller' => 'App\\Controller\\ProjectController::delete'], ['id'], ['DELETE' => 0], null, false, true, null],
        ],
        54 => [
            [['_route' => 'tasks_edit', '_controller' => 'App\\Controller\\TaskController::edit'], ['id'], ['PUT' => 0], null, false, true, null],
            [['_route' => 'tasks_delete', '_controller' => 'App\\Controller\\TaskController::delete'], ['id'], ['DELETE' => 0], null, false, true, null],
            [null, null, null, null, false, false, 0],
        ],
    ],
    null, // $checkCondition
];
