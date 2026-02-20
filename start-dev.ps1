[CmdletBinding()]
param(
    [string]$BackendHost = "127.0.0.1",
    [int]$BackendPort = 8000,
    [string]$FrontendHost = "127.0.0.1",
    [int]$FrontendPort = 5173,
    [switch]$InstallDeps
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
