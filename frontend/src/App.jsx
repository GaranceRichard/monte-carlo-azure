import { useEffect, useMemo, useState } from "react";
import {
  checkPat,
  clearAdoPat,
  getAccessibleOrgs,
  getProjectsByOrg,
  getTeamOptions,
  getTeamsByProject,
  postForecast,
  setAdoPat,
} from "./api";
import AppHeader from "./components/AppHeader";
import OrgStep from "./components/steps/OrgStep";
import PatStep from "./components/steps/PatStep";
import ProjectStep from "./components/steps/ProjectStep";
import SimulationStep from "./components/steps/SimulationStep";
import TeamStep from "./components/steps/TeamStep";

function normalPdf(x, mean, std) {
  if (!std || std <= 0) return 0;
  const z = (x - mean) / std;
  return (1 / (std * Math.sqrt(2 * Math.PI))) * Math.exp(-0.5 * z * z);
}

export default function App() {
  const defaultDoneStateOptions = ["Done", "Closed", "Resolved"];
  const defaultWorkItemTypeOptions = ["User Story", "Product Backlog Item", "Bug"];

  const [patInput, setPatInput] = useState("");
  const [step, setStep] = useState("pat");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [userName, setUserName] = useState("Utilisateur");
  const [orgHint, setOrgHint] = useState("");
  const [orgs, setOrgs] = useState([]);
  const [selectedOrg, setSelectedOrg] = useState("");

  const [projects, setProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState("");

  const [teams, setTeams] = useState([]);
  const [selectedTeam, setSelectedTeam] = useState("");

  const [startDate, setStartDate] = useState("2025-10-01");
  const [endDate, setEndDate] = useState("2026-01-19");
  const [simulationMode, setSimulationMode] = useState("backlog_to_weeks");
  const [backlogSize, setBacklogSize] = useState(120);
  const [targetWeeks, setTargetWeeks] = useState(12);

  const [workItemTypeOptions, setWorkItemTypeOptions] = useState(defaultWorkItemTypeOptions);
  const [statesByType, setStatesByType] = useState({});
  const [doneStates, setDoneStates] = useState([]);
  const [types, setTypes] = useState([]);

  const [nSims, setNSims] = useState(20000);
  const [result, setResult] = useState(null);
  const [activeChartTab, setActiveChartTab] = useState("throughput");

  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem("theme");
    const initial = saved === "light" || saved === "dark" ? saved : "dark";
    document.documentElement.setAttribute("data-theme", initial);
    return initial;
  });

  const throughputData = useMemo(() => {
    if (!result?.weekly_throughput) return [];
    return result.weekly_throughput.map((r) => ({
      week: String(r.week).slice(0, 10),
      throughput: r.throughput,
    }));
  }, [result]);

  const mcHistData = useMemo(() => {
    const dist = result?.result_distribution;
    if (!dist?.length) return [];

    const counts = new Map();
    for (const w of dist) counts.set(w, (counts.get(w) || 0) + 1);

    const xs = Array.from(counts.keys()).sort((a, b) => a - b);
    const N = dist.length;
    const mean = dist.reduce((a, b) => a + b, 0) / N;
    const variance = dist.reduce((a, b) => a + (b - mean) ** 2, 0) / N;
    const std = Math.sqrt(variance);

    return xs.map((x) => ({
      x,
      count: counts.get(x) || 0,
      gauss: normalPdf(x, mean, std) * N,
    }));
  }, [result]);

  const probabilityCurveData = useMemo(() => {
    const dist = result?.result_distribution;
    if (!dist?.length) return [];

    const counts = new Map();
    for (const w of dist) counts.set(w, (counts.get(w) || 0) + 1);

    const xs = Array.from(counts.keys()).sort((a, b) => a - b);
    const N = dist.length;
    let cumulative = 0;

    return xs.map((x) => {
      cumulative += counts.get(x) || 0;
      return { x, probability: (cumulative / N) * 100 };
    });
  }, [result]);

  const tooltipBaseProps = {
    cursor: false,
    contentStyle: {
      background: "var(--panel)",
      border: "1px solid var(--border)",
      borderRadius: 10,
      boxShadow: "0 6px 20px rgba(0,0,0,0.22)",
    },
    labelStyle: { color: "var(--muted)", fontWeight: 700 },
    itemStyle: { color: "var(--text)", fontWeight: 700 },
  };

  const filteredDoneStateOptions = useMemo(() => {
    if (!types.length) return [];
    const out = new Set();
    for (const t of types) {
      const states = statesByType?.[t] || [];
      for (const s of states) out.add(s);
    }
    return Array.from(out).sort();
  }, [types, statesByType]);

  useEffect(() => {
    setDoneStates((prev) => prev.filter((s) => filteredDoneStateOptions.includes(s)));
  }, [filteredDoneStateOptions]);

  useEffect(() => {
    if (step !== "simulation" || !selectedOrg || !selectedProject || !selectedTeam) return;
    let active = true;
    (async () => {
      try {
        const options = await getTeamOptions(selectedOrg, selectedProject, selectedTeam);
        if (!active) return;
        const nextTypes = (
          options.workItemTypes?.length ? options.workItemTypes : defaultWorkItemTypeOptions
        )
          .slice()
          .sort((a, b) => a.localeCompare(b, "fr", { sensitivity: "base" }));
        setWorkItemTypeOptions(nextTypes);
        setStatesByType(options.statesByType || {});
        setDoneStates([]);
        setTypes([]);
      } catch {
        if (!active) return;
        setWorkItemTypeOptions(defaultWorkItemTypeOptions);
        setStatesByType({});
        setDoneStates([]);
        setTypes([]);
      }
    })();
    return () => {
      active = false;
    };
  }, [step, selectedOrg, selectedProject, selectedTeam]);

  function toggleTheme() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    localStorage.setItem("theme", next);
    document.documentElement.setAttribute("data-theme", next);
  }

  async function submitPat() {
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
    } catch (e) {
      const msg = e.message || String(e);
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

  async function goToProjects() {
    const org = selectedOrg.trim();
    if (!org) {
      setErr("Selectionnez une organisation.");
      return;
    }
    setErr("");
    setLoading(true);
    try {
      const list = await getProjectsByOrg(org);
      setSelectedOrg(org);
      setProjects(list);
      setSelectedProject(list.length > 0 ? (list[0].name || "") : "");
      setStep("projects");
    } catch (e) {
      setErr(e.message || String(e));
    } finally {
      setLoading(false);
    }
  }

  async function goToTeams() {
    const org = selectedOrg.trim();
    const project = selectedProject.trim();
    if (!org || !project) {
      setErr("Selectionnez un projet.");
      return;
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
    } catch (e) {
      setErr(e.message || String(e));
    } finally {
      setLoading(false);
    }
  }

  function goToSimulation() {
    if (!selectedTeam) {
      setErr("Selectionnez une equipe.");
      return;
    }
    setErr("");
    setResult(null);
    setActiveChartTab("throughput");
    setStep("simulation");
  }

  async function runForecast() {
    if (!selectedTeam) {
      setErr("Selectionnez une equipe.");
      return;
    }
    setErr("");
    setLoading(true);
    setResult(null);
    setActiveChartTab("throughput");
    try {
      const payload = {
        org: selectedOrg,
        project: selectedProject,
        mode: simulationMode,
        team_name: selectedTeam,
        area_path: null,
        start_date: startDate,
        end_date: endDate,
        backlog_size: simulationMode === "backlog_to_weeks" ? Number(backlogSize) : undefined,
        target_weeks: simulationMode === "weeks_to_items" ? Number(targetWeeks) : undefined,
        done_states: doneStates,
        work_item_types: types,
        n_sims: Number(nSims),
      };
      const r = await postForecast(payload);
      setResult(r);
    } catch (e) {
      setErr(e.message || String(e));
    } finally {
      setLoading(false);
    }
  }

  function disconnect() {
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
    setWorkItemTypeOptions(defaultWorkItemTypeOptions);
    setStatesByType({});
    setDoneStates([]);
    setTypes([]);
    setResult(null);
    setStep("pat");
    setLoading(false);
  }

  const backLabel =
    step === "org"
      ? "Changer PAT"
      : step === "projects"
        ? "Changer ORG"
      : step === "teams"
        ? "Changer projet"
        : step === "simulation"
          ? "Changer équipe"
          : "";

  const handleBack =
    step === "org"
      ? () => setStep("pat")
      : step === "projects"
        ? () => setStep("org")
      : step === "teams"
        ? () => setStep("projects")
      : step === "simulation"
          ? () => setStep("teams")
          : null;

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: 24 }}>
      <AppHeader
        theme={theme}
        toggleTheme={toggleTheme}
        showDisconnect={step !== "pat"}
        onDisconnect={disconnect}
        backLabel={backLabel}
        onBack={handleBack}
      />

      {step === "pat" && (
        <PatStep
          err={err}
          patInput={patInput}
          setPatInput={setPatInput}
          loading={loading}
          onSubmit={submitPat}
        />
      )}

      {step === "org" && (
        <OrgStep
          err={err}
          userName={userName}
          orgs={orgs}
          orgHint={orgHint}
          selectedOrg={selectedOrg}
          setSelectedOrg={setSelectedOrg}
          loading={loading}
          onContinue={goToProjects}
        />
      )}

      {step === "projects" && (
        <ProjectStep
          err={err}
          selectedOrg={selectedOrg}
          projects={projects}
          selectedProject={selectedProject}
          setSelectedProject={setSelectedProject}
          loading={loading}
          onContinue={goToTeams}
        />
      )}

      {step === "teams" && (
        <TeamStep
          err={err}
          selectedProject={selectedProject}
          teams={teams}
          selectedTeam={selectedTeam}
          setSelectedTeam={setSelectedTeam}
          loading={loading}
          onContinue={goToSimulation}
        />
      )}

      {step === "simulation" && (
        <SimulationStep
          err={err}
          selectedTeam={selectedTeam}
          startDate={startDate}
          setStartDate={setStartDate}
          endDate={endDate}
          setEndDate={setEndDate}
          simulationMode={simulationMode}
          setSimulationMode={setSimulationMode}
          backlogSize={backlogSize}
          setBacklogSize={setBacklogSize}
          targetWeeks={targetWeeks}
          setTargetWeeks={setTargetWeeks}
          nSims={nSims}
          setNSims={setNSims}
          workItemTypeOptions={workItemTypeOptions}
          types={types}
          setTypes={setTypes}
          filteredDoneStateOptions={filteredDoneStateOptions}
          doneStates={doneStates}
          setDoneStates={setDoneStates}
          loading={loading}
          onRunForecast={runForecast}
          result={result}
          activeChartTab={activeChartTab}
          setActiveChartTab={setActiveChartTab}
          throughputData={throughputData}
          mcHistData={mcHistData}
          probabilityCurveData={probabilityCurveData}
          tooltipBaseProps={tooltipBaseProps}
        />
      )}
    </div>
  );
}
