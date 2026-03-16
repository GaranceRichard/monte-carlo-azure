import { lazy, Suspense } from "react";
import OrgStep from "./components/steps/OrgStep";
import PatStep from "./components/steps/PatStep";
import ProjectStep from "./components/steps/ProjectStep";
import TeamStep from "./components/steps/TeamStep";

const SimulationStep = lazy(() => import("./components/steps/SimulationStep"));
const PortfolioStep = lazy(() => import("./components/steps/PortfolioStep"));

type AppFlowContentProps = {
  onboardingState: any;
  onboardingActions: any;
  simulation: any;
  runtime: { isDemoMode: boolean };
  onGoToSimulation: () => void;
  onGoToPortfolio: () => void;
};

export function AppFlowContent({
  onboardingState,
  onboardingActions,
  simulation,
  runtime,
  onGoToSimulation,
  onGoToPortfolio,
}: AppFlowContentProps): JSX.Element | null {
  if (onboardingState.step === "pat") {
    return (
      <div className="flow-card flow-card--animated">
        <PatStep
          err={onboardingState.err}
          patInput={onboardingState.patInput}
          serverUrlInput={onboardingState.serverUrlInput}
          setPatInput={onboardingActions.setPatInput}
          setServerUrlInput={onboardingActions.setServerUrlInput}
          loading={onboardingState.loading}
          onSubmit={onboardingActions.submitPat}
        />
      </div>
    );
  }

  if (onboardingState.step === "org") {
    return (
      <div className="flow-card flow-card--animated">
        <OrgStep
          err={onboardingState.err}
          userName={onboardingState.userName}
          orgs={onboardingState.orgs}
          orgHint={onboardingState.orgHint}
          selectedOrg={onboardingState.selectedOrg}
          deploymentTarget={onboardingState.deploymentTarget}
          setSelectedOrg={onboardingActions.setSelectedOrg}
          loading={onboardingState.loading}
          onContinue={onboardingActions.goToProjects}
        />
      </div>
    );
  }

  if (onboardingState.step === "projects") {
    return (
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
    );
  }

  if (onboardingState.step === "teams") {
    return (
      <div className="flow-card flow-card--animated">
        <TeamStep
          err={onboardingState.err}
          selectedProject={onboardingState.selectedProject}
          teams={onboardingState.teams}
          selectedTeam={onboardingState.selectedTeam}
          setSelectedTeam={onboardingActions.setSelectedTeam}
          loading={onboardingState.loading}
          onContinue={onGoToSimulation}
          onPortfolio={onGoToPortfolio}
        />
      </div>
    );
  }

  if (onboardingState.step === "portfolio") {
    return (
      <div className="flow-card flow-card--animated">
        <Suspense fallback={<div className="p-4 text-sm text-[var(--muted)]">Chargement du portefeuille...</div>}>
          <PortfolioStep
            demoMode={runtime.isDemoMode}
            selectedOrg={onboardingState.selectedOrg}
            selectedProject={onboardingState.selectedProject}
            teams={onboardingState.teams}
            pat={onboardingState.sessionPat}
            serverUrl={onboardingState.sessionServerUrl}
          />
        </Suspense>
      </div>
    );
  }

  if (onboardingState.step === "simulation") {
    return (
      <div className="flow-card flow-card--animated flow-card--simulation">
        <Suspense fallback={<div className="p-4 text-sm text-[var(--muted)]">Chargement de la simulation...</div>}>
          <SimulationStep selectedTeam={onboardingState.selectedTeam} simulation={simulation} />
        </Suspense>
      </div>
    );
  }

  return null;
}

