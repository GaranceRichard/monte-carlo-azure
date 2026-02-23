import { useMemo, useState } from "react";
import { checkPat, clearAdoPat, getAccessibleOrgs, getProjectsByOrg, getTeamsByProject, setAdoPat } from "../api";
import type { AppStep, NamedEntity } from "../types";

type OnboardingState = {
  patInput: string;
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
  goBack: () => void;
  disconnect: () => void;
  setErr: (value: string) => void;
};

export function useOnboarding(): { state: OnboardingState; actions: OnboardingActions } {
  const [patInput, setPatInput] = useState("");
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

  async function submitPat(): Promise<void> {
    const clean = patInput.trim();
    if (!clean) {
      setErr("PAT requis pour continuer.");
      return;
    }

    setErr("");
    setLoading(true);
    setAdoPat(clean);
    try {
      const check = await checkPat();
      setUserName(check?.user_name || "Utilisateur");
      const orgList = await getAccessibleOrgs();
      setOrgs(orgList);
      if (orgList.length > 0) {
        setSelectedOrg(orgList[0].name || "");
        setOrgHint("");
      } else {
        setSelectedOrg("");
        setOrgHint("PAT non global: indiquez manuellement votre organisation.");
      }
      setStep("org");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes("Aucune organisation Azure DevOps accessible")) {
        setOrgs([]);
        setSelectedOrg("");
        setOrgHint("PAT non global: indiquez manuellement votre organisation.");
        setStep("org");
        return;
      }
      clearAdoPat();
      setStep("pat");
      setErr(msg);
    } finally {
      setLoading(false);
    }
  }

  async function goToProjects(): Promise<boolean> {
    const org = selectedOrg.trim();
    if (!org) {
      setErr("Selectionnez une organisation.");
      return false;
    }
    setErr("");
    setLoading(true);
    try {
      const list = await getProjectsByOrg(org);
      setSelectedOrg(org);
      setProjects(list);
      setSelectedProject(list.length > 0 ? (list[0].name || "") : "");
      setStep("projects");
      return true;
    } catch (e: unknown) {
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
    setErr("");
    setLoading(true);
    try {
      const list = await getTeamsByProject(org, project);
      setSelectedOrg(org);
      setSelectedProject(project);
      setTeams(list);
      setSelectedTeam(list.length > 0 ? (list[0].name || "") : "");
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

  function goBack(): void {
    if (step === "org") setStep("pat");
    else if (step === "projects") setStep("org");
    else if (step === "teams") setStep("projects");
    else if (step === "simulation") setStep("teams");
  }

  function disconnect(): void {
    clearAdoPat();
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
    if (step === "simulation") return "Changer equipe";
    return "";
  }, [step]);

  return {
    state: {
      patInput,
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
      goBack,
      disconnect,
      setErr,
    },
  };
}
