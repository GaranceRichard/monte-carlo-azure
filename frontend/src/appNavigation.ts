import { useEffect } from "react";

type OnboardingStep = "pat" | "org" | "projects" | "teams" | "simulation" | "portfolio";
type DeploymentTarget = "cloud" | "onprem";

function isEditableTarget(target: EventTarget | null): boolean {
  const element = target as HTMLElement | null;
  const tag = element?.tagName?.toLowerCase();
  return tag === "input" || tag === "textarea" || !!element?.isContentEditable;
}

export function useAppBackspaceNavigation({
  step,
  orgCount,
  goBack,
  disconnect,
}: {
  step: OnboardingStep;
  orgCount: number;
  goBack: () => void;
  disconnect: () => void;
}): void {
  useEffect(() => {
    const isGlobalOrgStep = step === "org" && orgCount > 0;
    const canGoBack = step === "projects" || step === "teams" || step === "simulation" || step === "portfolio";
    if (!isGlobalOrgStep && !canGoBack) return;

    function handleBackspaceNavigation(event: KeyboardEvent): void {
      if (event.key !== "Backspace") return;
      if (isEditableTarget(event.target)) return;
      event.preventDefault();
      if (isGlobalOrgStep) {
        disconnect();
        return;
      }
      goBack();
    }

    window.addEventListener("keydown", handleBackspaceNavigation);
    return () => {
      window.removeEventListener("keydown", handleBackspaceNavigation);
    };
  }, [disconnect, goBack, orgCount, step]);
}

export function resolveAppBackLabel({
  step,
  deploymentTarget,
  fallbackBackLabel,
}: {
  step: OnboardingStep;
  deploymentTarget: DeploymentTarget;
  fallbackBackLabel: string;
}): string {
  if (step === "org" || step === "projects" || step === "teams") return "";
  if (step === "portfolio" || step === "simulation") return fallbackBackLabel;
  return deploymentTarget === "onprem" ? fallbackBackLabel : fallbackBackLabel;
}

export function goToSimulationAndReset(goToSimulation: () => boolean, resetForTeamSelection: () => void): void {
  if (goToSimulation()) {
    resetForTeamSelection();
  }
}

export function handleStepperBackAction(
  target: "pat" | "org" | "projects" | "teams",
  disconnect: () => void,
  goToStep: (value: "pat" | "org" | "projects" | "teams") => void,
): void {
  if (target === "pat") {
    disconnect();
    return;
  }
  goToStep(target);
}
