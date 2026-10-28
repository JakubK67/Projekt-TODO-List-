param([string] $KeycloakUrl = '', [string] $Realm = '')

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$config = @{}
foreach ($line in Get-Content -LiteralPath (Join-Path $projectRoot '.env')) {
    if ($line -match '^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$') {
        $config[$matches[1]] = $matches[2].Trim('"').Trim("'")
    }
}
if (-not $KeycloakUrl) { $KeycloakUrl = if ($config['KEYCLOAK_PUBLIC_URL']) { $config['KEYCLOAK_PUBLIC_URL'] } else { 'http://localhost:8081' } }
if (-not $Realm) { $Realm = if ($config['KEYCLOAK_REALM']) { $config['KEYCLOAK_REALM'] } else { 'todo-app' } }
if (-not $config['KC_ADMIN_USER'] -or -not $config['KC_ADMIN_PASSWORD']) { throw 'Brak danych administratora Keycloak w .env.' }

$stage = 'logowanie administratora'
try {
    $token = Invoke-RestMethod -Method Post -Uri "$($KeycloakUrl.TrimEnd('/'))/realms/master/protocol/openid-connect/token" -TimeoutSec 15 -Body @{
        client_id = 'admin-cli'; grant_type = 'password'; username = $config['KC_ADMIN_USER']; password = $config['KC_ADMIN_PASSWORD']
    }
    $headers = @{ Authorization = "Bearer $($token.access_token)" }
    $client = Get-Content -LiteralPath (Join-Path $PSScriptRoot 'todo-mobile-client.json') -Raw -Encoding UTF8 | ConvertFrom-Json
    $baseUrl = "$($KeycloakUrl.TrimEnd('/'))/admin/realms/$([uri]::EscapeDataString($Realm))/clients"
    $stage = 'odczyt klienta mobilnego'
    $existing = Invoke-RestMethod -Uri "$baseUrl`?clientId=$($client.clientId)" -Headers $headers -TimeoutSec 15
    $existing = @($existing)
    if ($existing.Count -gt 0) {
        $saved = Invoke-RestMethod -Uri "$baseUrl/$($existing[0].id)" -Headers $headers -TimeoutSec 15
        foreach ($property in $client.PSObject.Properties) {
            if ($property.Name -eq 'attributes') {
                if (-not $saved.attributes) { $saved | Add-Member -NotePropertyName attributes -NotePropertyValue ([pscustomobject]@{}) -Force }
                foreach ($attribute in $property.Value.PSObject.Properties) {
                    $saved.attributes | Add-Member -NotePropertyName $attribute.Name -NotePropertyValue $attribute.Value -Force
                }
            } elseif ($property.Name -eq 'protocolMappers') {
                $mappers = @($saved.protocolMappers | Where-Object { $_.name -notin $client.protocolMappers.name })
                foreach ($mapper in $client.protocolMappers) {
                    $previous = $saved.protocolMappers | Where-Object name -eq $mapper.name | Select-Object -First 1
                    if ($previous.id) { $mapper | Add-Member -NotePropertyName id -NotePropertyValue $previous.id -Force }
                    $mappers += $mapper
                }
                $saved | Add-Member -NotePropertyName protocolMappers -NotePropertyValue $mappers -Force
            } else {
                $saved | Add-Member -NotePropertyName $property.Name -NotePropertyValue $property.Value -Force
            }
        }
        $stage = 'aktualizacja klienta mobilnego'
        Invoke-RestMethod -Method Put -Uri "$baseUrl/$($saved.id)" -Headers $headers -ContentType 'application/json' -Body ($saved | ConvertTo-Json -Depth 20) -TimeoutSec 15 | Out-Null
    } else {
        $stage = 'utworzenie klienta mobilnego'
        Invoke-RestMethod -Method Post -Uri $baseUrl -Headers $headers -ContentType 'application/json' -Body ($client | ConvertTo-Json -Depth 20) -TimeoutSec 15 | Out-Null
    }
    $stage = 'przypisanie zakresow klienta mobilnego'
    $configured = Invoke-RestMethod -Uri "$baseUrl`?clientId=$($client.clientId)" -Headers $headers -TimeoutSec 15
    $configured = @($configured)[0]
    $availableScopes = Invoke-RestMethod -Uri "$($KeycloakUrl.TrimEnd('/'))/admin/realms/$([uri]::EscapeDataString($Realm))/client-scopes" -Headers $headers -TimeoutSec 15
    foreach ($scopeName in $client.defaultClientScopes) {
        $scope = $availableScopes | Where-Object name -eq $scopeName | Select-Object -First 1
        if (-not $scope.id) { throw "Brak zakresu $scopeName w realmie." }
        Invoke-RestMethod -Method Put -Uri "$baseUrl/$($configured.id)/default-client-scopes/$($scope.id)" -Headers $headers -TimeoutSec 15 | Out-Null
    }
    Write-Output 'Klient todo-mobile zostal skonfigurowany. Konta i konfiguracja aplikacji webowej zostaly zachowane.'
} catch {
    $status = if ($_.Exception.Response) { [int]$_.Exception.Response.StatusCode } else { 0 }
    $hint = switch ($status) {
        400 { 'Keycloak odrzucil dane. Sprawdz konfiguracje klienta i dane administratora w .env.' }
        401 { 'Sprawdz dane administratora Keycloak w .env.' }
        403 { 'Konto administratora nie ma uprawnien do konfiguracji klientow.' }
        404 { 'Sprawdz adres Keycloak i nazwe realmu w .env.' }
        409 { 'Klient o tej nazwie juz istnieje. Uruchom skrypt ponownie.' }
        0 { 'Sprawdz, czy Keycloak dziala i czy jego adres jest poprawny.' }
        default { 'Sprawdz logi Keycloak.' }
    }
    $httpInfo = if ($status) { " (HTTP $status)" } else { '' }
    throw "Nie udalo sie skonfigurowac klienta mobilnego: $stage$httpInfo. $hint"
}
