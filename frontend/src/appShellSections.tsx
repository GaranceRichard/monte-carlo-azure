import PublicConnectNotice from "./components/PublicConnectNotice";
import PublicLandingPage from "./components/PublicLandingPage";

type RuntimeMode = "standard" | "landing" | "demo" | "connect";
type OnboardingStep = "pat" | "org" | "projects" | "teams" | "simulation" | "portfolio";
type DeploymentTarget = "cloud" | "onprem";

const ONBOARDING_ORDER = ["pat", "org", "projects", "teams"] as const;

export function renderPublicMode(mode: RuntimeMode): JSX.Element | null {
  if (mode === "landing") return <PublicLandingPage />;
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

export function DemoBanner({ isDemoMode }: { isDemoMode: boolean }): JSX.Element | null {
  if (!isDemoMode) return null;
  return (
    <div className="mb-3 flex flex-col gap-2 rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-950 md:flex-row md:items-center md:justify-between">
      <div>
        <b>Vous êtes en mode démo</b> - les données sont fictives.
      </div>
      <a href="?connect=true" className="font-semibold text-sky-900 underline underline-offset-4">
        Connecter un vrai compte
      </a>
    </div>
  );
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
    teams: "Équipe",
  };
  const currentOnboardingIndex = ONBOARDING_ORDER.findIndex((entry) => entry === step);
  if (isDemoMode || currentOnboardingIndex < 0) return null;

  return (
    <div className="flow-stepper">
      <div className="flow-stepper-row">
        {ONBOARDING_ORDER.map((entry, idx) => (
          idx < currentOnboardingIndex ? (
            <button
              key={entry}
              type="button"
              className="flow-step flow-step-btn"
              onClick={() => onStepBack(entry)}
              title={entry === "pat" ? "Revenir au début (déconnexion)" : "Revenir à cette étape"}
            >
              {idx + 1}. {onboardingLabels[entry]}
            </button>
          ) : (
            <div key={entry} className={`flow-step ${idx === currentOnboardingIndex ? "flow-step--active" : ""}`}>
              {idx + 1}. {onboardingLabels[entry]}
            </div>
          )
        ))}
      </div>
      <div className="flow-stepper-caption">
        Étape {currentOnboardingIndex + 1} / {ONBOARDING_ORDER.length}
      </div>
    </div>
  );
}
