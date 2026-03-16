export type PublicAppMode = "standard" | "demo" | "connect";

export type AppRuntime = {
  isPagesBuild: boolean;
  mode: PublicAppMode;
  isDemoMode: boolean;
  isConnectInfoMode: boolean;
};

function readBooleanEnvFlag(value: string | boolean | undefined): boolean {
  if (typeof value === "boolean") return value;
  return value === "true";
}

export function resolveAppRuntime(search = window.location.search): AppRuntime {
  const params = new URLSearchParams(search);
  const isPagesBuild = readBooleanEnvFlag(import.meta.env.GITHUB_PAGES);
  const isDemoMode = params.get("demo") === "true";
  const isConnectInfoMode = params.get("connect") === "true";

  let mode: PublicAppMode = "standard";
  if (isDemoMode) mode = "demo";
  else if (isPagesBuild && isConnectInfoMode) mode = "connect";
  else if (isPagesBuild) mode = "demo";

  return {
    isPagesBuild,
    mode,
    isDemoMode: mode === "demo",
    isConnectInfoMode: mode === "connect",
  };
}
