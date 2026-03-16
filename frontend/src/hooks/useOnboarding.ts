import { useMemo, useRef, useState } from "react";
import { listProjectsDirect, listTeamsDirect, resolvePatOrganizationScopeDirect } from "../adoClient";
import {
  extractOnPremCollectionName,
  getAdoDeploymentTarget,
  normalizeAdoServerUrl,
  type AdoDeploymentTarget,
} from "../adoPlatform";
import type { AppStep, NamedEntity } from "../types";
import { sortTeams } from "../utils/teamSort";
import { DEMO_CONFIG } from "../demoData";

function sortNamedEntities(items: NamedEntity[]): NamedEntity[] {
  return [...items].sort((a, b) => (a.name || "").localeCompare(b.name || "", "fr", { sensitivity: "base" }));
}

type OnboardingState = {
  patInput: string;
  serverUrlInput: string;
  sessionPat: string;
  sessionServerUrl: string;
  deploymentTarget: AdoDeploymentTarget;
  step: AppStep;
  loading: boolean;
  err: string;
  userName: string;
  orgHint: string;
  orgs: NamedEntity[];
  selectedOrg: string;
  projects: NamedEntity[];
  selectedProject: string;
  teams: NamedEntity[];
  selectedTeam: string;
  backLabel: string;
};

type OnboardingActions = {
  setPatInput: (value: string) => void;
  setServerUrlInput: (value: string) => void;
  setSelectedOrg: (value: string) => void;
  setSelectedProject: (value: string) => void;
  setSelectedTeam: (value: string) => void;
  submitPat: () => Promise<void>;
  goToProjects: () => Promise<boolean>;
  goToTeams: () => Promise<boolean>;
  goToSimulation: () => boolean;
  goToPortfolio: () => boolean;
  goToStep: (target: "pat" | "org" | "projects" | "teams") => void;
  goBack: () => void;
  disconnect: () => void;
  setErr: (value: string) => void;
};

export function useOnboarding({ demoMode = false }: { demoMode?: boolean } = {}): { state: OnboardingState; actions: OnboardingActions } {
  const [patInput, setPatInput] = useState("");
  const [serverUrlInput, setServerUrlInput] = useState("");
  const [sessionPat, setSessionPat] = useState(demoMode ? "demo-session" : "");
  const [sessionServerUrl, setSessionServerUrl] = useState("");
  const [deploymentTarget, setDeploymentTarget] = useState<AdoDeploymentTarget>("cloud");
  const [step, setStep] = useState<AppStep>(demoMode ? "simulation" : "pat");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [userName, setUserName] = useState(demoMode ? "Visiteur" : "Utilisateur");
  const [orgHint, setOrgHint] = useState(demoMode ? "Donnees de demonstration prechargees." : "");
  const [orgs, setOrgs] = useState<NamedEntity[]>(demoMode ? DEMO_CONFIG.orgs : []);
  const [selectedOrg, setSelectedOrg] = useState(demoMode ? DEMO_CONFIG.org : "");
  const [projects, setProjects] = useState<NamedEntity[]>(demoMode ? DEMO_CONFIG.projects : []);
  const [selectedProject, setSelectedProject] = useState(demoMode ? DEMO_CONFIG.selectedProject : "");
  const [teams, setTeams] = useState<NamedEntity[]>(demoMode ? DEMO_CONFIG.teams : []);
  const [selectedTeam, setSelectedTeam] = useState(demoMode ? DEMO_CONFIG.selectedTeam : "");
  const submitInFlightRef = useRef(false);

  const failPatValidation = (message: string) => {
    setPatInput("");
    setErr(message);
  };

  async function submitPat(): Promise<void> {
    if (demoMode) {
      setErr("");
      setStep("simulation");
      return;
    }
    if (submitInFlightRef.current) return;
    const clean = patInput.trim();
    const normalizedServerUrl = normalizeAdoServerUrl(serverUrlInput);
    const nextDeploymentTarget = getAdoDeploymentTarget(normalizedServerUrl);
    if (!clean) {
      failPatValidation("PAT requis pour continuer.");
      return;
    }
    if (/\s/.test(clean)) {
      failPatValidation("Format PAT invalide (espaces ou retours a la ligne interdits).");
      return;
    }
    if (clean.length < 20) {
      failPatValidation("PAT invalide ou insuffisant.");
      return;
    }

    setErr("");
    setLoading(true);
    submitInFlightRef.current = true;
    try {
      setSessionPat(clean);
      setSessionServerUrl(normalizedServerUrl);
      setDeploymentTarget(nextDeploymentTarget);

      let resolved: Awaited<ReturnType<typeof resolvePatOrganizationScopeDirect>> | null = null;
      try {
        resolved = await resolvePatOrganizationScopeDirect(clean, normalizedServerUrl);
      } catch (error: unknown) {
        if (nextDeploymentTarget === "onprem") {
          setSessionPat("");
          setSessionServerUrl("");
          setDeploymentTarget("cloud");
          setErr(error instanceof Error ? error.message : String(error));
          return;
        }
        resolved = null;
      }
      if (resolved) {
        if (resolved.resolvedServerUrl) {
          setSessionServerUrl(resolved.resolvedServerUrl);
        }
        setUserName(resolved.displayName || "Utilisateur");
        if (resolved.organizations.length > 0) {
          setOrgs(resolved.organizations);
          setSelectedOrg(resolved.organizations[0].name || "");
          setOrgHint(
            nextDeploymentTarget === "onprem"
              ? "Serveur Azure DevOps Server detecte: verifiez la collection puis continuez."
              : "PAT global detecte: selectionnez une organisation accessible.",
          );
        } else {
          const onPremCollection = nextDeploymentTarget === "onprem" ? extractOnPremCollectionName(normalizedServerUrl) : "";
          setOrgs(nextDeploymentTarget === "onprem" && onPremCollection ? [{ name: onPremCollection }] : []);
          setSelectedOrg(onPremCollection);
          setOrgHint(
            nextDeploymentTarget === "onprem"
              ? (
                onPremCollection
                  ? "Serveur Azure DevOps Server detecte: verifiez la collection puis continuez."
                  : "Serveur Azure DevOps Server detecte: saisissez le nom de la collection manuellement."
              )
              : "PAT local: saisissez votre organisation manuellement.",
          );
        }
      } else {
        setUserName("Utilisateur");
        setOrgs([]);
        setSelectedOrg(nextDeploymentTarget === "onprem" ? extractOnPremCollectionName(normalizedServerUrl) : "");
        setOrgHint(
          nextDeploymentTarget === "onprem"
            ? "Verification automatique impossible. Saisissez ou confirmez la collection Azure DevOps Server."
            : "Verification automatique impossible. Saisissez votre organisation manuellement.",
        );
      }
      setStep("org");
    } finally {
      setLoading(false);
      submitInFlightRef.current = false;
    }
  }

  async function goToProjects(): Promise<boolean> {
    if (demoMode) {
      setErr("");
      setSelectedOrg(DEMO_CONFIG.org);
      setProjects(DEMO_CONFIG.projects);
      setSelectedProject(DEMO_CONFIG.selectedProject);
      setStep("simulation");
      return true;
    }
    const org = selectedOrg.trim();
    if (!org) {
      setErr(deploymentTarget === "onprem" ? "Selectionnez une collection." : "Selectionnez une organisation.");
      return false;
    }
    if (!sessionPat) {
      setErr("PAT manquant. Reconnectez-vous.");
      setStep("pat");
      return false;
    }

    setErr("");
    setLoading(true);
    try {
      const list = await listProjectsDirect(org, sessionPat, sessionServerUrl);
      const sortedList = sortNamedEntities(list);
      setSelectedOrg(org);
      setProjects(sortedList);
      setSelectedProject(sortedList.length > 0 ? (sortedList[0].name || "") : "");
      setStep("projects");
      return true;
    } catch (e: unknown) {
      if (orgs.length === 0) {
        setSelectedOrg("");
      }
      setErr(e instanceof Error ? e.message : String(e));
      return false;
    } finally {
      setLoading(false);
    }
  }

  async function goToTeams(): Promise<boolean> {
    if (demoMode) {
      setErr("");
      setSelectedOrg(DEMO_CONFIG.org);
      setSelectedProject(DEMO_CONFIG.selectedProject);
      setTeams(DEMO_CONFIG.teams);
      setSelectedTeam(DEMO_CONFIG.selectedTeam);
      setStep("simulation");
      return true;
    }
    const org = selectedOrg.trim();
    const project = selectedProject.trim();
    if (!org || !project) {
      setErr("Selectionnez un projet.");
      return false;
    }
    if (!sessionPat) {
      setErr("PAT manquant. Reconnectez-vous.");
      setStep("pat");
      return false;
    }

    setErr("");
    setLoading(true);
    try {
      const list = await listTeamsDirect(org, project, sessionPat, sessionServerUrl);
      const sortedList = sortTeams(list);
      setSelectedOrg(org);
      setSelectedProject(project);
      setTeams(list);
      setSelectedTeam(sortedList.length > 0 ? (sortedList[0].name || "") : "");
      setStep("teams");
      return true;
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : String(e));
      return false;
    } finally {
      setLoading(false);
    }
  }

  function goToSimulation(): boolean {
    if (!selectedTeam) {
      setErr("Selectionnez une equipe.");
      return false;
    }
    setErr("");
    setStep("simulation");
    return true;
  }

  function goToPortfolio(): boolean {
    if (!selectedTeam) {
      setErr("Selectionnez une equipe.");
      return false;
    }
    setErr("");
    setStep("portfolio");
    return true;
  }

  function goBack(): void {
    if (demoMode) {
      if (step === "simulation" || step === "portfolio") setStep("teams");
      return;
    }
    if (step === "org") setStep("pat");
    else if (step === "projects") setStep("org");
    else if (step === "teams") setStep("projects");
    else if (step === "portfolio") setStep("teams");
    else if (step === "simulation") setStep("teams");
  }

  function goToStep(target: "pat" | "org" | "projects" | "teams"): void {
    if (demoMode) {
      if (target === "teams") setStep("teams");
      return;
    }
    setErr("");
    setStep(target);
  }

  function disconnect(): void {
    if (demoMode) {
      setErr("");
      setUserName("Visiteur");
      setOrgHint("Donnees de demonstration prechargees.");
      setOrgs(DEMO_CONFIG.orgs);
      setSelectedOrg(DEMO_CONFIG.org);
      setProjects(DEMO_CONFIG.projects);
      setSelectedProject(DEMO_CONFIG.selectedProject);
      setTeams(DEMO_CONFIG.teams);
      setSelectedTeam(DEMO_CONFIG.selectedTeam);
      setStep("simulation");
      setLoading(false);
      return;
    }
    setSessionPat("");
    setServerUrlInput("");
    setSessionServerUrl("");
    setDeploymentTarget("cloud");
    setPatInput("");
    setErr("");
    setUserName("Utilisateur");
    setOrgHint("");
    setOrgs([]);
    setSelectedOrg("");
    setProjects([]);
    setSelectedProject("");
    setTeams([]);
    setSelectedTeam("");
    setStep("pat");
    setLoading(false);
  }

  const backLabel = useMemo((): string => {
    if (step === "org") return "Changer PAT";
    if (step === "projects") return deploymentTarget === "onprem" ? "Changer collection" : "Changer ORG";
    if (step === "teams") return "Changer projet";
    if (step === "portfolio") return "Changer \u00E9quipe";
    if (step === "simulation") return "Changer \u00E9quipe";
    return "";
  }, [deploymentTarget, step]);

  return {
    state: {
      patInput,
      serverUrlInput,
      sessionPat,
      sessionServerUrl,
      deploymentTarget,
      step,
      loading,
      err,
      userName,
      orgHint,
      orgs,
      selectedOrg,
      projects,
      selectedProject,
      teams,
      selectedTeam,
      backLabel,
    },
    actions: {
      setPatInput,
      setServerUrlInput,
      setSelectedOrg,
      setSelectedProject,
      setSelectedTeam,
      submitPat,
      goToProjects,
      goToTeams,
      goToSimulation,
      goToPortfolio,
      goToStep,
      goBack,
      disconnect,
      setErr,
    },
  };
}
