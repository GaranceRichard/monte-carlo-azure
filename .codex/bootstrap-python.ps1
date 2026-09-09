$ErrorActionPreference = "Stop"

$gitRootOutput = & git rev-parse --show-toplevel 2> $null
$gitExitCode = $LASTEXITCODE
$repositoryRoot = [string]($gitRootOutput | Select-Object -First 1)
if ($gitExitCode -ne 0 -or [string]::IsNullOrWhiteSpace($repositoryRoot)) {
    Write-Error "Unable to resolve the Git worktree root."
    exit 1
}
$repositoryRoot = [System.IO.Path]::GetFullPath($repositoryRoot.Trim())
$bootstrap = Join-Path $repositoryRoot "Scripts/setup_git_hooks.py"
$environmentRoot = Join-Path $repositoryRoot ".venv"
$localPython = Join-Path $environmentRoot "Scripts/python.exe"

function Test-PythonCommand {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Executable,
        [string[]]$PrefixArguments = @(),
        [string[]]$ProbeArguments = @("-c", "import sys")
    )

    try {
        & $Executable @PrefixArguments @ProbeArguments *> $null
        return $LASTEXITCODE -eq 0
    }
    catch {
        return $false
    }
}

function Invoke-Bootstrap {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Executable,
        [string[]]$PrefixArguments = @()
    )

    & $Executable @PrefixArguments $bootstrap --root $repositoryRoot --bootstrap-only --quiet-if-ready
    exit $LASTEXITCODE
}

if (Test-Path -LiteralPath $localPython -PathType Leaf) {
    $probe = @(
        "-c",
        "import pathlib,sys; expected=pathlib.Path(sys.argv[1]).resolve(); actual=pathlib.Path(sys.prefix).resolve(); raise SystemExit(0 if actual == expected and sys.prefix != sys.base_prefix and sys.version_info >= (3, 10) else 1)",
        $environmentRoot
    )
    if (Test-PythonCommand -Executable $localPython -ProbeArguments $probe) {
        Invoke-Bootstrap -Executable $localPython
    }
}

$launcher = Get-Command py.exe -ErrorAction SilentlyContinue
if ($null -ne $launcher -and (Test-PythonCommand -Executable $launcher.Source -PrefixArguments @("-3"))) {
    Invoke-Bootstrap -Executable $launcher.Source -PrefixArguments @("-3")
}

foreach ($name in @("python3.exe", "python.exe")) {
    $candidate = Get-Command $name -ErrorAction SilentlyContinue
    if ($null -ne $candidate -and (Test-PythonCommand -Executable $candidate.Source)) {
        Invoke-Bootstrap -Executable $candidate.Source
    }
}

Write-Error "Python 3.10+ is required to prepare the worktree-local .venv."
exit 1
