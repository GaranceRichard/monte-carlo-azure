import { lazy, Suspense, useEffect, useState } from "react";
import AppHeader from "./components/AppHeader";
import OrgStep from "./components/steps/OrgStep";
import PatStep from "./components/steps/PatStep";
import ProjectStep from "./components/steps/ProjectStep";
import TeamStep from "./components/steps/TeamStep";
import { useOnboarding } from "./hooks/useOnboarding";
import { useSimulation } from "./hooks/useSimulation";
import { storageGetItem, storageSetItem } from "./storage";
import "./App.css";

type ThemeMode = "light" | "dark";
const SimulationStep = lazy(() => import("./components/steps/SimulationStep"));

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
    const saved = storageGetItem("theme");
    const initial: ThemeMode = saved === "light" || saved === "dark" ? saved : "dark";
    document.documentElement.setAttribute("data-theme", initial);
    return initial;
  });

  function toggleTheme() {
    const next: ThemeMode = theme === "dark" ? "light" : "dark";
    setTheme(next);
    storageSetItem("theme", next);
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

  useEffect(() => {
    const isGlobalOrgStep = onboardingState.step === "org" && onboardingState.orgs.length > 0;
    if (!isGlobalOrgStep) return;

    function handleBackspaceDisconnect(event: KeyboardEvent): void {
      if (event.key !== "Backspace") return;
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      const isEditable = tag === "input" || tag === "textarea" || !!target?.isContentEditable;
      if (isEditable) return;
      event.preventDefault();
      handleDisconnect();
    }

    window.addEventListener("keydown", handleBackspaceDisconnect);
    return () => {
      window.removeEventListener("keydown", handleBackspaceDisconnect);
    };
  }, [onboardingState.step, onboardingState.orgs.length]);

  useEffect(() => {
    if (onboardingState.step !== "projects") return;

    function handleBackspaceToOrg(event: KeyboardEvent): void {
      if (event.key !== "Backspace") return;
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      const isEditable = tag === "input" || tag === "textarea" || !!target?.isContentEditable;
      if (isEditable) return;
      event.preventDefault();
      onboardingActions.goBack();
    }

    window.addEventListener("keydown", handleBackspaceToOrg);
    return () => {
      window.removeEventListener("keydown", handleBackspaceToOrg);
    };
  }, [onboardingState.step, onboardingActions]);

  useEffect(() => {
    if (onboardingState.step !== "teams") return;

    function handleBackspaceToProjects(event: KeyboardEvent): void {
      if (event.key !== "Backspace") return;
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      const isEditable = tag === "input" || tag === "textarea" || !!target?.isContentEditable;
      if (isEditable) return;
      event.preventDefault();
      onboardingActions.goBack();
    }

    window.addEventListener("keydown", handleBackspaceToProjects);
    return () => {
      window.removeEventListener("keydown", handleBackspaceToProjects);
    };
  }, [onboardingState.step, onboardingActions]);

  useEffect(() => {
    if (onboardingState.step !== "simulation") return;

    function handleBackspaceToTeams(event: KeyboardEvent): void {
      if (event.key !== "Backspace") return;
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      const isEditable = tag === "input" || tag === "textarea" || !!target?.isContentEditable;
      if (isEditable) return;
      event.preventDefault();
      onboardingActions.goBack();
    }

    window.addEventListener("keydown", handleBackspaceToTeams);
    return () => {
      window.removeEventListener("keydown", handleBackspaceToTeams);
    };
  }, [onboardingState.step, onboardingActions]);

  const onboardingOrder = ["pat", "org", "projects", "teams"] as const;
  const onboardingLabels: Record<(typeof onboardingOrder)[number], string> = {
    pat: "Connexion",
    org: "Organisation",
    projects: "Projet",
    teams: "Équipe",
  };
  const currentOnboardingIndex = onboardingOrder.findIndex((step) => step === onboardingState.step);
  const isSimulationStep = onboardingState.step === "simulation";
  const backLabel =
    onboardingState.step === "org" || onboardingState.step === "projects" || onboardingState.step === "teams"
      ? ""
      : onboardingState.backLabel;

  function handleStepperBack(target: (typeof onboardingOrder)[number]): void {
    if (target === "pat") {
      handleDisconnect();
      return;
    }
    onboardingActions.goToStep(target);
  }

  return (
    <div className={`app-shell ${isSimulationStep ? "app-shell--simulation" : ""}`}>
      <AppHeader
        theme={theme}
        toggleTheme={toggleTheme}
        showDisconnect={onboardingState.step !== "pat"}
        onDisconnect={handleDisconnect}
        backLabel={backLabel}
        onBack={onboardingActions.goBack}
      />

      {currentOnboardingIndex >= 0 && (
        <div className="flow-stepper">
          <div className="flow-stepper-row">
            {onboardingOrder.map((step, idx) => (
              idx < currentOnboardingIndex ? (
                <button
                  key={step}
                  type="button"
                  className="flow-step flow-step-btn"
                  onClick={() => handleStepperBack(step)}
                  title={step === "pat" ? "Revenir au début (déconnexion)" : "Revenir à cette étape"}
                >
                  {idx + 1}. {onboardingLabels[step]}
                </button>
              ) : (
                <div
                  key={step}
                  className={`flow-step ${idx === currentOnboardingIndex ? "flow-step--active" : ""}`}
                >
                  {idx + 1}. {onboardingLabels[step]}
                </div>
              )
            ))}
          </div>
          <div className="flow-stepper-caption">
            Étape {currentOnboardingIndex + 1} / {onboardingOrder.length}
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
        <div className="flow-card flow-card--animated flow-card--simulation">
          <Suspense fallback={<div className="p-4 text-sm text-[var(--muted)]">Chargement de la simulation...</div>}>
            <SimulationStep selectedTeam={onboardingState.selectedTeam} simulation={simulation} />
          </Suspense>
        </div>
      )}
    </div>
  );
}
