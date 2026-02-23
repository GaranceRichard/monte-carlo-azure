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
    pat: onboardingState.sessionPat,
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

  const onboardingOrder = ["pat", "org", "projects", "teams"] as const;
  const onboardingLabels: Record<(typeof onboardingOrder)[number], string> = {
    pat: "Connexion",
    org: "Organisation",
    projects: "Projet",
    teams: "Equipe",
  };
  const currentOnboardingIndex = onboardingOrder.findIndex((step) => step === onboardingState.step);

  return (
    <div className="app-shell">
      <AppHeader
        theme={theme}
        toggleTheme={toggleTheme}
        showDisconnect={onboardingState.step !== "pat"}
        onDisconnect={handleDisconnect}
        backLabel={onboardingState.backLabel}
        onBack={onboardingActions.goBack}
      />

      {currentOnboardingIndex >= 0 && (
        <div className="flow-stepper">
          <div className="flow-stepper-row">
            {onboardingOrder.map((step, idx) => (
              <div
                key={step}
                className={`flow-step ${idx === currentOnboardingIndex ? "flow-step--active" : ""}`}
              >
                {idx + 1}. {onboardingLabels[step]}
              </div>
            ))}
          </div>
          <div className="flow-stepper-caption">
            Etape {currentOnboardingIndex + 1} / {onboardingOrder.length}
          </div>
        </div>
      )}

      {onboardingState.step === "pat" && (
        <div className="flow-card flow-card--animated">
          <PatStep
            err={onboardingState.err}
            patInput={onboardingState.patInput}
            setPatInput={onboardingActions.setPatInput}
            loading={onboardingState.loading}
            onSubmit={onboardingActions.submitPat}
          />
        </div>
      )}

      {onboardingState.step === "org" && (
        <div className="flow-card flow-card--animated">
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
        </div>
      )}

      {onboardingState.step === "projects" && (
        <div className="flow-card flow-card--animated">
          <ProjectStep
            err={onboardingState.err}
            selectedOrg={onboardingState.selectedOrg}
            projects={onboardingState.projects}
            selectedProject={onboardingState.selectedProject}
            setSelectedProject={onboardingActions.setSelectedProject}
            loading={onboardingState.loading}
            onContinue={onboardingActions.goToTeams}
          />
        </div>
      )}

      {onboardingState.step === "teams" && (
        <div className="flow-card flow-card--animated">
          <TeamStep
            err={onboardingState.err}
            selectedProject={onboardingState.selectedProject}
            teams={onboardingState.teams}
            selectedTeam={onboardingState.selectedTeam}
            setSelectedTeam={onboardingActions.setSelectedTeam}
            loading={onboardingState.loading}
            onContinue={handleGoToSimulation}
          />
        </div>
      )}

      {onboardingState.step === "simulation" && (
        <div className="flow-card flow-card--animated">
          <SimulationStep selectedTeam={onboardingState.selectedTeam} simulation={simulation} />
        </div>
      )}
    </div>
  );
}
