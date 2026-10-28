$ErrorActionPreference = 'Stop'
$global:mobileTestClient = $null
$global:mobileTestCreates = 0
$global:mobileTestUpdates = 0
$global:mobileTestScopes = @()

function Get-Content {
    param([string] $LiteralPath, [switch] $Raw, [string] $Encoding)
    if ([System.IO.Path]::GetFileName($LiteralPath) -eq '.env') {
        return @('KC_ADMIN_USER=test-admin', 'KC_ADMIN_PASSWORD=test-password', 'KEYCLOAK_REALM=todo-app')
    }
    Microsoft.PowerShell.Management\Get-Content @PSBoundParameters
}

function Invoke-RestMethod {
    param([string] $Method = 'Get', [string] $Uri, $Body, $Headers, $TimeoutSec, $ContentType)
    if ($Uri.EndsWith('/realms/master/protocol/openid-connect/token')) { return @{ access_token = 'test-token' } }
    if ($Uri.Contains('?clientId=todo-mobile')) {
        if ($null -eq $global:mobileTestClient) { return ,@() }
        return ,@($global:mobileTestClient)
    }
    if ($Uri.EndsWith('/client-scopes')) {
        return ,@('basic', 'profile', 'email', 'roles' | ForEach-Object { [pscustomobject]@{ id = "scope-$_"; name = $_ } })
    }
    if ($Uri.Contains('/clients/mobile-test-id/default-client-scopes/') -and $Method -eq 'Put') {
        $global:mobileTestScopes += ($Uri -split '/')[-1]
        return
    }
    if ($Uri.EndsWith('/clients') -and $Method -eq 'Post') {
        $global:mobileTestClient = $Body | ConvertFrom-Json
        $global:mobileTestClient | Add-Member -NotePropertyName id -NotePropertyValue 'mobile-test-id'
        $global:mobileTestCreates++
        return
    }
    if ($Uri.EndsWith('/clients/mobile-test-id')) {
        if ($Method -eq 'Put') {
            $global:mobileTestClient = $Body | ConvertFrom-Json
            $global:mobileTestUpdates++
            return
        }
        return $global:mobileTestClient
    }
    throw 'Nieoczekiwana operacja administracyjna w tescie.'
}

$setup = Join-Path (Split-Path -Parent $PSScriptRoot) 'configure-mobile-client.ps1'
& $setup
if ($global:mobileTestCreates -ne 1 -or $global:mobileTestClient.clientId -ne 'todo-mobile') { throw 'Nie utworzono klienta mobilnego.' }
if ($global:mobileTestClient.directAccessGrantsEnabled) { throw 'Logowanie haslem w aplikacji musi byc wylaczone.' }
if ($global:mobileTestClient.attributes.'oauth2.device.authorization.grant.enabled' -ne 'true') { throw 'Brak obslugi Device Authorization Grant.' }
if ('scope-basic' -notin $global:mobileTestScopes) { throw 'Brak zakresu basic z identyfikatorem sub.' }
$global:mobileTestClient.attributes | Add-Member -NotePropertyName 'custom-setting' -NotePropertyValue 'preserve'
$global:mobileTestClient.protocolMappers[0] | Add-Member -NotePropertyName id -NotePropertyValue 'existing-mapper-id'
& $setup
if ($global:mobileTestCreates -ne 1 -or $global:mobileTestUpdates -ne 1) { throw 'Ponowne uruchomienie powinno aktualizowac tego samego klienta.' }
if ($global:mobileTestClient.attributes.'custom-setting' -ne 'preserve') { throw 'Usunieto niestandardowy atrybut klienta.' }
if ($global:mobileTestClient.protocolMappers[0].id -ne 'existing-mapper-id') { throw 'Identyfikator istniejacego mappera musi zostac zachowany.' }
'OK: konfiguracja i ponowna konfiguracja klienta mobilnego z symulowanym Keycloak.'
