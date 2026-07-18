param(
  [Parameter(Mandatory = $true)]
  [string]$WorkspaceRoot
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$workspaceFullPath = [System.IO.Path]::GetFullPath($WorkspaceRoot).TrimEnd(
  [System.IO.Path]::DirectorySeparatorChar,
  [System.IO.Path]::AltDirectorySeparatorChar
)
$pytestTempRoot = [System.IO.Path]::GetFullPath(
  (Join-Path $workspaceFullPath ".tmp\pytest")
)
$workspacePrefix = $workspaceFullPath + [System.IO.Path]::DirectorySeparatorChar
if (-not $pytestTempRoot.StartsWith(
  $workspacePrefix,
  [System.StringComparison]::OrdinalIgnoreCase
)) {
  throw "Pytest temporary root must stay inside the workspace."
}
$pytestBaseTemp = Join-Path $pytestTempRoot (
  "coverage-staged-{0}-{1}" -f $PID, [System.Guid]::NewGuid().ToString("N")
)
New-Item -ItemType Directory -Path $pytestBaseTemp -Force | Out-Null

$locationPushed = $false
try {
  Push-Location $WorkspaceRoot
  $locationPushed = $true

  Write-Host "[coverage] test classification compliance"
  & "$WorkspaceRoot\.venv\Scripts\python.exe" Scripts/check_test_classification.py
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

  Write-Host "[coverage] lint"
  npm --prefix frontend run lint
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

  Write-Host "[coverage] typecheck"
  npm --prefix frontend run typecheck
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

  Write-Host "[coverage] build"
  npm --prefix frontend run build
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

  Write-Host "[coverage] versioned Python"
  & "$WorkspaceRoot\.venv\Scripts\python.exe" -m pytest --cov --cov-config=.coveragerc --cov-report=json:.coverage.python.json --cov-report=term-missing -q --basetemp "$pytestBaseTemp"
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

  Write-Host "[coverage] Python scope and per-file compliance"
  & "$WorkspaceRoot\.venv\Scripts\python.exe" Scripts/check_python_coverage.py
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

  Write-Host "[coverage] frontend unit coverage"
  npm --prefix frontend run test:unit:coverage
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

  Write-Host "[coverage] e2e coverage"
  powershell -NoProfile -ExecutionPolicy Bypass -File ".vscode\scripts\run-e2e-coverage.ps1" -workspaceRoot $WorkspaceRoot -Workers 2
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

  Write-Host "[coverage] vitals"
  powershell -NoProfile -ExecutionPolicy Bypass -File ".vscode\scripts\run-vitals-staged.ps1" -WorkspaceRoot $WorkspaceRoot
  exit $LASTEXITCODE
}
finally {
  if ($locationPushed) {
    Pop-Location
  }
  $pytestBaseTempFullPath = [System.IO.Path]::GetFullPath($pytestBaseTemp)
  $pytestTempPrefix = $pytestTempRoot.TrimEnd(
    [System.IO.Path]::DirectorySeparatorChar,
    [System.IO.Path]::AltDirectorySeparatorChar
  ) + [System.IO.Path]::DirectorySeparatorChar
  if (
    $pytestBaseTempFullPath.StartsWith(
      $pytestTempPrefix,
      [System.StringComparison]::OrdinalIgnoreCase
    ) -and
    (Test-Path -LiteralPath $pytestBaseTempFullPath)
  ) {
    Remove-Item -LiteralPath $pytestBaseTempFullPath -Recurse -Force
  }
}
