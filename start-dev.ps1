[CmdletBinding()]
param(
    [string]$BackendHost = "127.0.0.1",
    [int]$BackendPort = 8000,
    [string]$FrontendHost = "127.0.0.1",
    [int]$FrontendPort = 5173,
    [int]$MongoPort = 27017,
    [string]$MongoDbName = "montecarlo",
    [switch]$InstallDeps,
    [switch]$ThreeTerminals,
    [int]$HealthIntervalSeconds = 5
)

$ErrorActionPreference = "Stop"
$root = if ($PSScriptRoot) { $PSScriptRoot } else { (Get-Location).Path }

function Write-Step {
    param([string]$Message)
    Write-Host "[start-dev] $Message"
}

if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
    throw "npm est introuvable. Installe Node.js 18+ puis relance."
}

$venvPython = Join-Path $root ".venv\Scripts\python.exe"
$pythonExe = if (Test-Path $venvPython) { $venvPython } else { "python" }

if (-not (Get-Command $pythonExe -ErrorAction SilentlyContinue) -and -not (Test-Path $pythonExe)) {
    throw "Python introuvable. Installe Python 3.10+ ou cree .venv."
}

if ($InstallDeps) {
    Write-Step "Installation des dependances Python..."
    & $pythonExe -m pip install -r (Join-Path $root "requirements.txt")

    Write-Step "Installation des dependances frontend..."
    Push-Location (Join-Path $root "frontend")
    try {
        & npm install
    }
    finally {
        Pop-Location
    }
}

if ($HealthIntervalSeconds -lt 1) {
    throw "HealthIntervalSeconds doit etre >= 1."
}

$env:APP_MONGO_URL = "mongodb://127.0.0.1:$MongoPort"
$env:APP_MONGO_DB = $MongoDbName

if ($ThreeTerminals) {
    Write-Step "Mode dev local active (mongo + backend + frontend + health monitor)."

    $mongoScript = Join-Path $root ".vscode\scripts\start-mongo-dev.ps1"
    $mongoDbPath = Join-Path $root ".local-mongo\db"
    $backendCmd = "`$env:APP_MONGO_URL='mongodb://127.0.0.1:$MongoPort'; `$env:APP_MONGO_DB='$MongoDbName'; & '$pythonExe' run_app.py --host $BackendHost --port $BackendPort --no-browser"
    $frontendCmd = "npm run dev -- --host $FrontendHost --port $FrontendPort"
    $healthCmd = @"
while (`$true) {
    try {
        `$api = Invoke-RestMethod -Uri 'http://$BackendHost`:$BackendPort/health' -TimeoutSec 2
        `$mongo = Invoke-RestMethod -Uri 'http://$BackendHost`:$BackendPort/health/mongo' -TimeoutSec 2
        Write-Host ("[{0}] health=OK api={1} mongo={2}" -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), `$api.status, `$mongo.status) -ForegroundColor Green
    }
    catch {
        Write-Host ("[{0}] health=KO {1}" -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), `$_.Exception.Message) -ForegroundColor Red
    }
    Start-Sleep -Seconds $HealthIntervalSeconds
}
"@

    Start-Process -FilePath "powershell" -ArgumentList @("-NoExit", "-ExecutionPolicy", "Bypass", "-File", $mongoScript, "-DbPath", $mongoDbPath, "-Port", "$MongoPort") -WorkingDirectory $root | Out-Null
    Start-Process -FilePath "powershell" -ArgumentList @("-NoExit", "-Command", $backendCmd) -WorkingDirectory $root | Out-Null
    Start-Process -FilePath "powershell" -ArgumentList @("-NoExit", "-Command", $frontendCmd) -WorkingDirectory (Join-Path $root "frontend") | Out-Null
    Start-Process -FilePath "powershell" -ArgumentList @("-NoExit", "-Command", $healthCmd) -WorkingDirectory $root | Out-Null

    Write-Step "4 terminaux lances."
    exit 0
}

Write-Step "Demarrage backend sur http://$BackendHost`:$BackendPort"
$backend = Start-Process -FilePath $pythonExe `
    -ArgumentList @("run_app.py", "--host", $BackendHost, "--port", "$BackendPort", "--no-browser") `
    -WorkingDirectory $root `
    -PassThru `
    -NoNewWindow

Start-Sleep -Seconds 2
if ($backend.HasExited) {
    throw "Le backend s'est arrete juste apres le lancement (code $($backend.ExitCode))."
}

Write-Step "Demarrage frontend sur http://$FrontendHost`:$FrontendPort"
Push-Location (Join-Path $root "frontend")
try {
    & npm run dev -- --host $FrontendHost --port $FrontendPort
}
finally {
    Pop-Location
    if ($backend -and -not $backend.HasExited) {
        Write-Step "Arret du backend (PID $($backend.Id))"
        Stop-Process -Id $backend.Id -Force
    }
}
