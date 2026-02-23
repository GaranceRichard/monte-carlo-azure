import { useState } from "react";
import AppHeader from "./components/AppHeader";
import OrgStep from "./components/steps/OrgStep";
import PatStep from "./components/steps/PatStep";
import ProjectStep from "./components/steps/ProjectStep";
import SimulationStep from "./components/steps/SimulationStep";
import TeamStep from "./components/steps/TeamStep";
import { useOnboarding } from "./hooks/useOnboarding";
import { useSimulation } from "./hooks/useSimulation";
import "./App.css";

type ThemeMode = "light" | "dark";

export default function App() {
  const onboarding = useOnboarding();
  const { state: onboardingState, actions: onboardingActions } = onboarding;
  const simulation = useSimulation({
    step: onboardingState.step,
    selectedOrg: onboardingState.selectedOrg,
    selectedProject: onboardingState.selectedProject,
    selectedTeam: onboardingState.selectedTeam,
  });

  const [theme, setTheme] = useState<ThemeMode>(() => {
    const saved = localStorage.getItem("theme");
    const initial: ThemeMode = saved === "light" || saved === "dark" ? saved : "dark";
    document.documentElement.setAttribute("data-theme", initial);
    return initial;
  });

  function toggleTheme() {
    const next: ThemeMode = theme === "dark" ? "light" : "dark";
    setTheme(next);
    localStorage.setItem("theme", next);
    document.documentElement.setAttribute("data-theme", next);
  }

  function handleGoToSimulation() {
    const moved = onboardingActions.goToSimulation();
    if (moved) simulation.resetForTeamSelection();
  }

  function handleDisconnect() {
    onboardingActions.disconnect();
    simulation.resetAll();
  }

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: 24 }}>
      <AppHeader
        theme={theme}
        toggleTheme={toggleTheme}
        showDisconnect={onboardingState.step !== "pat"}
        onDisconnect={handleDisconnect}
        backLabel={onboardingState.backLabel}
        onBack={onboardingActions.goBack}
      />

      {onboardingState.step === "pat" && (
        <PatStep
          err={onboardingState.err}
          patInput={onboardingState.patInput}
          setPatInput={onboardingActions.setPatInput}
          loading={onboardingState.loading}
          onSubmit={onboardingActions.submitPat}
        />
      )}

      {onboardingState.step === "org" && (
        <OrgStep
          err={onboardingState.err}
          userName={onboardingState.userName}
          orgs={onboardingState.orgs}
          orgHint={onboardingState.orgHint}
          selectedOrg={onboardingState.selectedOrg}
          setSelectedOrg={onboardingActions.setSelectedOrg}
          loading={onboardingState.loading}
          onContinue={onboardingActions.goToProjects}
        />
      )}

      {onboardingState.step === "projects" && (
        <ProjectStep
          err={onboardingState.err}
          selectedOrg={onboardingState.selectedOrg}
          projects={onboardingState.projects}
          selectedProject={onboardingState.selectedProject}
          setSelectedProject={onboardingActions.setSelectedProject}
          loading={onboardingState.loading}
          onContinue={onboardingActions.goToTeams}
        />
      )}

      {onboardingState.step === "teams" && (
        <TeamStep
          err={onboardingState.err}
          selectedProject={onboardingState.selectedProject}
          teams={onboardingState.teams}
          selectedTeam={onboardingState.selectedTeam}
          setSelectedTeam={onboardingActions.setSelectedTeam}
          loading={onboardingState.loading}
          onContinue={handleGoToSimulation}
        />
      )}

      {onboardingState.step === "simulation" && (
        <SimulationStep selectedTeam={onboardingState.selectedTeam} simulation={simulation} />
      )}
    </div>
  );
}
