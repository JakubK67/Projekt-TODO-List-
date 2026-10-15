$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $PSScriptRoot
$envPath = Join-Path $projectRoot '.env'
if (-not (Test-Path -LiteralPath $envPath)) {
    throw 'Nie znaleziono pliku .env w katalogu projektu.'
}

$config = @{}
foreach ($line in Get-Content -LiteralPath $envPath) {
    if ($line -match '^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$' -and $matches[1] -notmatch '^#') {
        $config[$matches[1]] = $matches[2].Trim('"').Trim("'")
    }
}

$required = @('KC_ADMIN_USER', 'KC_ADMIN_PASSWORD')
foreach ($name in $required) {
    if ([string]::IsNullOrWhiteSpace($config[$name])) {
        throw "Brak wartości $name w pliku .env."
    }
}

$keycloakUrl = if ($config['KEYCLOAK_PUBLIC_URL']) { $config['KEYCLOAK_PUBLIC_URL'].TrimEnd('/') } else { 'http://localhost:8081' }
$realm = if ($config['KEYCLOAK_REALM']) { $config['KEYCLOAK_REALM'] } else { 'todo-app' }
$tokenUrl = "$keycloakUrl/realms/master/protocol/openid-connect/token"

try {
    $tokenResponse = Invoke-RestMethod -Method Post -Uri $tokenUrl -ContentType 'application/x-www-form-urlencoded' -Body @{
        client_id = 'admin-cli'
        grant_type = 'password'
        username = $config['KC_ADMIN_USER']
        password = $config['KC_ADMIN_PASSWORD']
    }
} catch {
    throw 'Logowanie do Keycloak Admin API nie powiodlo sie. Sprawdz, czy Keycloak dziala i czy dane administratora w .env sa poprawne.'
}

$headers = @{ Authorization = "Bearer $($tokenResponse.access_token)" }
$apiRoot = "$keycloakUrl/admin/realms/$([uri]::EscapeDataString($realm))/authentication"

function Find-OtpExecution([string]$flowAlias) {
    $encodedFlow = [uri]::EscapeDataString($flowAlias)
    $flowExecutions = Invoke-RestMethod -Method Get -Uri "$apiRoot/flows/$encodedFlow/executions" -Headers $headers
    return $flowExecutions | Where-Object providerId -eq 'auth-otp-form' | Select-Object -First 1
}

try {
    $realmUrl = "$keycloakUrl/admin/realms/$([uri]::EscapeDataString($realm))"
    $realmConfig = Invoke-RestMethod -Method Get -Uri $realmUrl -Headers $headers
    $browserFlow = [string] $realmConfig.browserFlow
    if ([string]::IsNullOrWhiteSpace($browserFlow)) {
        throw 'Realm nie ma ustawionego browserFlow.'
    }

    $otpExecution = Find-OtpExecution $browserFlow
    if (-not $otpExecution) {
        throw "W aktywnym browserFlow '$browserFlow' nie znaleziono wykonania formularza OTP."
    }

    $body = @{
        alias = 'otp AMR reference'
        config = @{
            'default.reference.value' = 'otp'
            'default.reference.maxAge' = '36000'
        }
    } | ConvertTo-Json -Depth 5

    $executionUrl = "$apiRoot/executions/$($otpExecution.id)"
    $executionDetails = Invoke-RestMethod -Method Get -Uri $executionUrl -Headers $headers
    if ($executionDetails.authenticatorConfig) {
        $configId = [uri]::EscapeDataString($executionDetails.authenticatorConfig)
        Invoke-RestMethod -Method Put -Uri "$apiRoot/config/$configId" -Headers $headers -ContentType 'application/json' -Body $body | Out-Null
    } else {
        Invoke-RestMethod -Method Post -Uri "$apiRoot/executions/$($otpExecution.id)/config" -Headers $headers -ContentType 'application/json' -Body $body | Out-Null
    }

    $updatedExecution = Invoke-RestMethod -Method Get -Uri $executionUrl -Headers $headers
    if (-not $updatedExecution.authenticatorConfig) {
        throw 'Keycloak nie zapisal konfiguracji OTP.'
    }

    $savedConfigId = [uri]::EscapeDataString($updatedExecution.authenticatorConfig)
    $savedConfig = Invoke-RestMethod -Method Get -Uri "$apiRoot/config/$savedConfigId" -Headers $headers
    if ($savedConfig.config.'default.reference.value' -ne 'otp') {
        throw 'Keycloak zapisal nieoczekiwana konfiguracje OTP.'
    }

    $clientId = if ($config['KEYCLOAK_CLIENT_ID']) { $config['KEYCLOAK_CLIENT_ID'] } else { 'todo-frontend' }
    $clientsUrl = "$keycloakUrl/admin/realms/$([uri]::EscapeDataString($realm))/clients?clientId=$([uri]::EscapeDataString($clientId))"
    $clients = Invoke-RestMethod -Method Get -Uri $clientsUrl -Headers $headers
    $client = $clients | Where-Object clientId -eq $clientId | Select-Object -First 1
    if (-not $client) {
        throw "Nie znaleziono klienta OIDC '$clientId'."
    }

    $mapperUrl = "$keycloakUrl/admin/realms/$([uri]::EscapeDataString($realm))/clients/$($client.id)/protocol-mappers/models"
    $mappers = Invoke-RestMethod -Method Get -Uri $mapperUrl -Headers $headers
    $amrMapper = $mappers | Where-Object protocolMapper -eq 'oidc-amr-mapper' | Select-Object -First 1
    $mapper = @{
        name = 'todo-frontend-amr'
        protocol = 'openid-connect'
        protocolMapper = 'oidc-amr-mapper'
        consentRequired = $false
        config = @{
            'id.token.claim' = 'true'
            'access.token.claim' = 'true'
            'userinfo.token.claim' = 'false'
            'lightweight.claim' = 'false'
        }
    } | ConvertTo-Json -Depth 5

    if (-not $amrMapper) {
        Invoke-RestMethod -Method Post -Uri $mapperUrl -Headers $headers -ContentType 'application/json' -Body $mapper | Out-Null
        $mappers = Invoke-RestMethod -Method Get -Uri $mapperUrl -Headers $headers
        $amrMapper = $mappers | Where-Object protocolMapper -eq 'oidc-amr-mapper' | Select-Object -First 1
    }

    if (-not $amrMapper -or $amrMapper.config.'id.token.claim' -ne 'true' -or $amrMapper.config.'access.token.claim' -ne 'true') {
        throw 'Brak aktywnego mapera AMR z wlaczonym tokenem ID i access tokenem.'
    }

    Write-Host 'Konfiguracja OTP zostala naprawiona. Nowy token po logowaniu powinien zawierac amr=otp.'
    Write-Host 'Wyloguj sie z aplikacji i zaloguj ponownie, aby rozpoczac nowa sesje.'
} catch {
    if ($_.Exception.Message -like 'Realm *' -or $_.Exception.Message -like 'W aktywnym browserFlow*' -or $_.Exception.Message -like 'Keycloak *') {
        throw
    }
    throw 'Aktualizacja flow OTP nie powiodla sie. Sprawdz, czy konto z .env ma uprawnienia administratora w realm master.'
}
