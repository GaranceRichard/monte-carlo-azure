param(
    [string]$WorkspaceRoot
)

$frontendUnit = Join-Path $WorkspaceRoot "frontend\coverage\coverage-final.json"
$backendJson = Join-Path $WorkspaceRoot ".coverage.backend.json"
$e2eJson = Join-Path $WorkspaceRoot "frontend\coverage\e2e-coverage-summary.json"
$vitalsJson = Join-Path $WorkspaceRoot "frontend\coverage\vitals-coverage-report.json"

$deadline = (Get-Date).AddMinutes(3)
while ((Get-Date) -lt $deadline) {
    if ((Test-Path $frontendUnit) -and (Test-Path $backendJson) -and (Test-Path $e2eJson)) {
        break
    }
    Start-Sleep -Seconds 2
}

if (-not (Test-Path $frontendUnit)) { throw "Missing frontend unit coverage artifact: $frontendUnit" }
if (-not (Test-Path $backendJson)) { throw "Missing backend coverage artifact: $backendJson" }
if (-not (Test-Path $e2eJson)) { throw "Missing E2E coverage artifact: $e2eJson" }

& "$WorkspaceRoot\.venv\Scripts\python.exe" "$WorkspaceRoot\Scripts\report_vitals_coverage.py" --output $vitalsJson
