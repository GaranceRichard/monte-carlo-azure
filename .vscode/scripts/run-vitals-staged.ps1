param(
  [Parameter(Mandatory = $true)]
  [string]$WorkspaceRoot
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

Push-Location $WorkspaceRoot
try {
  Write-Host "[coverage-vitals] rates"
  powershell -NoProfile -ExecutionPolicy Bypass -File ".vscode\scripts\run-vitals-coverage.ps1" -WorkspaceRoot $WorkspaceRoot
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

  Write-Host "[coverage-vitals] compliance"
  powershell -NoProfile -ExecutionPolicy Bypass -File ".vscode\scripts\run-vitals-compliance.ps1" -WorkspaceRoot $WorkspaceRoot -ReuseExistingReport
  exit $LASTEXITCODE
}
finally {
  Pop-Location
}
