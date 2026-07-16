param(
  [Parameter(Mandatory = $true)]
  [string]$workspaceRoot,
  [int]$Workers = 2
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

Push-Location $workspaceRoot
$viteProcess = $null
try {
  $env:PLAYWRIGHT_WEB_PORT = "4174"
  $env:PLAYWRIGHT_REUSE_SERVER = "1"
  $env:PLAYWRIGHT_WORKERS = "$Workers"
  $viteStartInfo = [System.Diagnostics.ProcessStartInfo]::new()
  $viteStartInfo.FileName = "cmd.exe"
  $viteStartInfo.Arguments = "/c npm --prefix frontend run dev -- --host 127.0.0.1 --port 4174"
  $viteStartInfo.WorkingDirectory = $workspaceRoot
  $viteStartInfo.UseShellExecute = $false
  $viteStartInfo.CreateNoWindow = $true
  $viteProcess = [System.Diagnostics.Process]::Start($viteStartInfo)

  $ready = $false
  for ($i = 0; $i -lt 60; $i++) {
    Start-Sleep -Seconds 1
    try {
      Invoke-WebRequest "http://127.0.0.1:4174" -UseBasicParsing | Out-Null
      $ready = $true
      break
    }
    catch {
      if ($viteProcess.HasExited) {
        throw "Le serveur Vite coverage s'est arrete avant d'etre pret."
      }
    }
  }

  if (-not $ready) {
    throw "Timeout en attendant le serveur Vite coverage sur http://127.0.0.1:4174."
  }

  npm --prefix frontend run test:e2e:coverage:console
  exit $LASTEXITCODE
}
finally {
  if ($viteProcess -and -not $viteProcess.HasExited) {
    Stop-Process -Id $viteProcess.Id -Force
  }
  Remove-Item Env:PLAYWRIGHT_WEB_PORT -ErrorAction SilentlyContinue
  Remove-Item Env:PLAYWRIGHT_REUSE_SERVER -ErrorAction SilentlyContinue
  Remove-Item Env:PLAYWRIGHT_WORKERS -ErrorAction SilentlyContinue
  Pop-Location
}
