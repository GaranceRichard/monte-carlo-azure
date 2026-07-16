import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const scriptPath = fileURLToPath(import.meta.url);
const defaultRepositoryRoot = path.resolve(path.dirname(scriptPath), "..", "..");

function quoteCommandArgument(value, platform) {
  if (platform === "win32") {
    return `"${value.replaceAll('"', '\\"')}"`;
  }
  return `'${value.replaceAll("'", "'\\''")}'`;
}

export function resolveBackendWebServer({
  repositoryRoot = defaultRepositoryRoot,
  env = process.env,
  platform = process.platform,
} = {}) {
  const resolvedRepositoryRoot = path.resolve(repositoryRoot);
  const localPython = platform === "win32"
    ? path.join(resolvedRepositoryRoot, ".venv", "Scripts", "python.exe")
    : path.join(resolvedRepositoryRoot, ".venv", "bin", "python");
  const exposedPython = env.MONTECARLO_E2E_PYTHON?.trim();
  const fallbackPython = env.PYTHON?.trim() || "python";
  const pythonExecutable = exposedPython
    || (fs.existsSync(localPython) ? localPython : fallbackPython);
  const backendScript = path.join(resolvedRepositoryRoot, "run_app.py");
  const args = ["run_app.py", "--host", "127.0.0.1", "--port", "8000", "--no-browser"];
  const command = [pythonExecutable, ...args]
    .map((argument) => quoteCommandArgument(argument, platform))
    .join(" ");

  return {
    args,
    backendScript,
    command,
    cwd: resolvedRepositoryRoot,
    pythonExecutable,
    pythonSource: exposedPython
      ? "host-exposed"
      : (pythonExecutable === localPython ? "repository-venv" : "path-fallback"),
  };
}

export function missingBackendDependency(launch) {
  if (!fs.existsSync(launch.backendScript)) {
    return `backend script: ${launch.backendScript}`;
  }
  const pathLikeExecutable = path.isAbsolute(launch.pythonExecutable)
    || launch.pythonExecutable.includes("/")
    || launch.pythonExecutable.includes("\\");
  if (pathLikeExecutable) {
    const executablePath = path.isAbsolute(launch.pythonExecutable)
      ? launch.pythonExecutable
      : path.resolve(launch.cwd, launch.pythonExecutable);
    if (!fs.existsSync(executablePath)) {
      return `Python executable: ${executablePath}`;
    }
  }
  return null;
}

export function formatBackendLaunchError(launch, missingDependency) {
  return [
    "Unable to start the Playwright backend webServer.",
    `Command: ${launch.command}`,
    `CWD: ${launch.cwd}`,
    `Missing dependency: ${missingDependency}`,
  ].join("\n");
}

if (process.argv[1] && path.resolve(process.argv[1]) === scriptPath) {
  const launch = resolveBackendWebServer();
  const missingDependency = missingBackendDependency(launch);
  console.log(JSON.stringify({ ...launch, missingDependency }));
  if (missingDependency) {
    console.error(formatBackendLaunchError(launch, missingDependency));
    process.exitCode = 2;
  }
}
