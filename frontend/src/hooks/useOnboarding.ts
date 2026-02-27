import { useMemo, useRef, useState } from "react";
import { listProjectsDirect, listTeamsDirect, resolvePatOrganizationScopeDirect } from "../adoClient";
import type { AppStep, NamedEntity } from "../types";
import { sortTeams } from "../utils/teamSort";

type OnboardingState = {
  patInput: string;
  sessionPat: string;
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

export function useOnboarding(): { state: OnboardingState; actions: OnboardingActions } {
  const [patInput, setPatInput] = useState("");
  const [sessionPat, setSessionPat] = useState("");
  const [step, setStep] = useState<AppStep>("pat");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [userName, setUserName] = useState("Utilisateur");
  const [orgHint, setOrgHint] = useState("");
  const [orgs, setOrgs] = useState<NamedEntity[]>([]);
  const [selectedOrg, setSelectedOrg] = useState("");
  const [projects, setProjects] = useState<NamedEntity[]>([]);
  const [selectedProject, setSelectedProject] = useState("");
  const [teams, setTeams] = useState<NamedEntity[]>([]);
  const [selectedTeam, setSelectedTeam] = useState("");
  const submitInFlightRef = useRef(false);

  const failPatValidation = (message: string) => {
    setPatInput("");
    setErr(message);
  };

  async function submitPat(): Promise<void> {
    if (submitInFlightRef.current) return;
    const clean = patInput.trim();
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
      const resolved = await resolvePatOrganizationScopeDirect(clean).catch(() => null);
      if (resolved) {
        setUserName(resolved.displayName || "Utilisateur");
        if (resolved.scope === "global" && resolved.organizations.length > 0) {
          setOrgs(resolved.organizations);
          setSelectedOrg(resolved.organizations[0].name || "");
          setOrgHint("PAT global detecte: selectionnez une organisation accessible.");
        } else {
          setOrgs([]);
          setSelectedOrg("");
          setOrgHint("PAT local: saisissez votre organisation manuellement.");
        }
      } else {
        setUserName("Utilisateur");
        setOrgs([]);
        setSelectedOrg("");
        setOrgHint("Verification automatique impossible. Saisissez votre organisation manuellement.");
      }
      setStep("org");
    } finally {
      setLoading(false);
      submitInFlightRef.current = false;
    }
  }

  async function goToProjects(): Promise<boolean> {
    const org = selectedOrg.trim();
    if (!org) {
      setErr("Selectionnez une organisation.");
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
      const list = await listProjectsDirect(org, sessionPat);
      setSelectedOrg(org);
      setProjects(list);
      setSelectedProject(list.length > 0 ? (list[0].name || "") : "");
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
      const list = await listTeamsDirect(org, project, sessionPat);
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
    if (step === "org") setStep("pat");
    else if (step === "projects") setStep("org");
    else if (step === "teams") setStep("projects");
    else if (step === "portfolio") setStep("teams");
    else if (step === "simulation") setStep("teams");
  }

  function goToStep(target: "pat" | "org" | "projects" | "teams"): void {
    setErr("");
    setStep(target);
  }

  function disconnect(): void {
    setSessionPat("");
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
    if (step === "projects") return "Changer ORG";
    if (step === "teams") return "Changer projet";
    if (step === "portfolio") return "Changer équipe";
    if (step === "simulation") return "Changer équipe";
    return "";
  }, [step]);

  return {
    state: {
      patInput,
      sessionPat,
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
