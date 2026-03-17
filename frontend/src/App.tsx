import { useEffect, useState } from "react";
import AppHeader from "./components/AppHeader";
import { AppFlowContent } from "./AppFlowContent";
import { useOnboarding } from "./hooks/useOnboarding";
import { useSimulation } from "./hooks/useSimulation";
import { resolveAppRuntime } from "./runtime";
import { ensureMontecarloClientCookie } from "./clientId";
import { storageGetItem } from "./storage";
import {
  goToSimulationAndReset,
  handleStepperBackAction,
  resolveAppBackLabel,
  useAppBackspaceNavigation,
} from "./appNavigation";
import { applyTheme, persistTheme, resolveInitialTheme, type ThemeMode } from "./appTheme";
import { OnboardingStepper, PublicModeGate } from "./appShellSections";
import "./App.css";

export default function App() {
  const runtime = resolveAppRuntime();
  const onboarding = useOnboarding({ demoMode: runtime.isDemoMode });
  const { state: onboardingState, actions: onboardingActions } = onboarding;
  const simulation = useSimulation({
    demoMode: runtime.isDemoMode,
    step: onboardingState.step,
    selectedOrg: onboardingState.selectedOrg,
    selectedProject: onboardingState.selectedProject,
    selectedTeam: onboardingState.selectedTeam,
    pat: onboardingState.sessionPat,
    serverUrl: onboardingState.sessionServerUrl,
  });

  const [theme, setTheme] = useState<ThemeMode>(() => {
    const initial = resolveInitialTheme(storageGetItem("theme"));
    applyTheme(initial);
    return initial;
  });

  function toggleTheme() {
    const next: ThemeMode = theme === "dark" ? "light" : "dark";
    setTheme(next);
    persistTheme(next);
  }

  function handleGoToSimulation() {
    goToSimulationAndReset(onboardingActions.goToSimulation, simulation.resetForTeamSelection);
  }

  function handleGoToPortfolio() {
    onboardingActions.goToPortfolio();
  }

  function handleDisconnect() {
    onboardingActions.disconnect();
    simulation.resetAll();
  }

  useEffect(() => {
    ensureMontecarloClientCookie();
  }, []);

  useAppBackspaceNavigation({
    step: onboardingState.step,
    orgCount: onboardingState.orgs.length,
    goBack: onboardingActions.goBack,
    disconnect: handleDisconnect,
  });

  const isSimulationStep = onboardingState.step === "simulation";
  const backLabel = resolveAppBackLabel({
    step: onboardingState.step,
    deploymentTarget: onboardingState.deploymentTarget,
    fallbackBackLabel: onboardingState.backLabel,
  });

  function handleStepperBack(target: "pat" | "org" | "projects" | "teams"): void {
    handleStepperBackAction(target, handleDisconnect, onboardingActions.goToStep);
  }

  return (
    <PublicModeGate mode={runtime.mode}>
      <div className={`app-shell ${isSimulationStep ? "app-shell--simulation" : ""}`}>
        <AppHeader
          theme={theme}
          toggleTheme={toggleTheme}
          showDisconnect={onboardingState.step !== "pat" && !runtime.isDemoMode}
          onDisconnect={handleDisconnect}
          backLabel={backLabel}
          onBack={onboardingActions.goBack}
          showDemoBadge={runtime.isDemoMode && onboardingState.step === "simulation"}
        />

        <OnboardingStepper
          isDemoMode={runtime.isDemoMode}
          step={onboardingState.step}
          deploymentTarget={onboardingState.deploymentTarget}
          onStepBack={handleStepperBack}
        />

        <AppFlowContent
          onboardingState={onboardingState}
          onboardingActions={onboardingActions}
          simulation={simulation}
          runtime={runtime}
          onGoToSimulation={handleGoToSimulation}
          onGoToPortfolio={handleGoToPortfolio}
        />
      </div>
    </PublicModeGate>
  );
}
