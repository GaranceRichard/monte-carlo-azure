import PublicConnectNotice from "./components/PublicConnectNotice";

type RuntimeMode = "standard" | "demo" | "connect";
type OnboardingStep = "pat" | "org" | "projects" | "teams" | "simulation" | "portfolio";
type DeploymentTarget = "cloud" | "onprem";

const ONBOARDING_ORDER = ["pat", "org", "projects", "teams"] as const;

export function renderPublicMode(mode: RuntimeMode): JSX.Element | null {
  if (mode === "connect") return <PublicConnectNotice />;
  return null;
}

export function PublicModeGate({
  mode,
  children,
}: {
  mode: RuntimeMode;
  children: JSX.Element;
}): JSX.Element {
  return renderPublicMode(mode) ?? children;
}

export function OnboardingStepper({
  isDemoMode,
  step,
  deploymentTarget,
  onStepBack,
}: {
  isDemoMode: boolean;
  step: OnboardingStep;
  deploymentTarget: DeploymentTarget;
  onStepBack: (target: (typeof ONBOARDING_ORDER)[number]) => void;
}): JSX.Element | null {
  const onboardingLabels: Record<(typeof ONBOARDING_ORDER)[number], string> = {
    pat: "Connexion",
    org: deploymentTarget === "onprem" ? "Collection" : "Organisation",
    projects: "Projet",
    teams: "Ã‰quipe",
  };
  const currentOnboardingIndex = ONBOARDING_ORDER.findIndex((entry) => entry === step);
  if (isDemoMode || currentOnboardingIndex < 0) return null;

  return (
    <div className="flow-stepper">
      <div className="flow-stepper-row">
        {ONBOARDING_ORDER.map((entry, idx) =>
          idx < currentOnboardingIndex ? (
            <button
              key={entry}
              type="button"
              className="flow-step flow-step-btn"
              onClick={() => onStepBack(entry)}
              title={entry === "pat" ? "Revenir au dÃ©but (dÃ©connexion)" : "Revenir Ã  cette Ã©tape"}
            >
              {idx + 1}. {onboardingLabels[entry]}
            </button>
          ) : (
            <div key={entry} className={`flow-step ${idx === currentOnboardingIndex ? "flow-step--active" : ""}`}>
              {idx + 1}. {onboardingLabels[entry]}
            </div>
          ),
        )}
      </div>
      <div className="flow-stepper-caption">
        Ã‰tape {currentOnboardingIndex + 1} / {ONBOARDING_ORDER.length}
      </div>
    </div>
  );
}
