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
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ComposedChart,
  Bar,
} from "recharts";

function normalPdf(x, mean, std) {
  if (!std || std <= 0) return 0;
  const z = (x - mean) / std;
  return (1 / (std * Math.sqrt(2 * Math.PI))) * Math.exp(-0.5 * z * z);
}

export default function App() {
  const defaultDoneStateOptions = ["Done", "Closed", "Resolved"];
  const defaultWorkItemTypeOptions = ["User Story", "Product Backlog Item", "Bug"];

  const [patInput, setPatInput] = useState("");
  const [step, setStep] = useState("pat"); // pat | org | projects | teams | simulation
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [userName, setUserName] = useState("Utilisateur");

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

  const [doneStateOptions, setDoneStateOptions] = useState(defaultDoneStateOptions);
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

  function toggleTheme() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    localStorage.setItem("theme", next);
    document.documentElement.setAttribute("data-theme", next);
  }

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
      return {
        x,
        probability: (cumulative / N) * 100,
      };
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
      setSelectedOrg(orgList.length > 0 ? (orgList[0].name || "") : "");
      setStep("org");
    } catch (e) {
      clearAdoPat();
      setStep("pat");
      setErr(e.message || String(e));
    } finally {
      setLoading(false);
    }
  }

  async function goToProjects() {
    if (!selectedOrg) {
      setErr("Selectionnez une organisation.");
      return;
    }
    setErr("");
    setLoading(true);
    try {
      const list = await getProjectsByOrg(selectedOrg);
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
    if (!selectedOrg || !selectedProject) {
      setErr("Selectionnez un projet.");
      return;
    }
    setErr("");
    setLoading(true);
    try {
      const list = await getTeamsByProject(selectedOrg, selectedProject);
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

  useEffect(() => {
    if (step !== "simulation" || !selectedOrg || !selectedProject || !selectedTeam) return;
    let active = true;
    (async () => {
      try {
        const options = await getTeamOptions(selectedOrg, selectedProject, selectedTeam);
        if (!active) return;
        const nextStates = options.doneStates?.length ? options.doneStates : defaultDoneStateOptions;
        const nextTypes = (
          options.workItemTypes?.length ? options.workItemTypes : defaultWorkItemTypeOptions
        ).slice().sort((a, b) => a.localeCompare(b, "fr", { sensitivity: "base" }));
        const nextStatesByType = options.statesByType || {};
        setDoneStateOptions(nextStates);
        setWorkItemTypeOptions(nextTypes);
        setStatesByType(nextStatesByType);
        setDoneStates([]);
        setTypes([]);
      } catch {
        if (!active) return;
        setDoneStateOptions(defaultDoneStateOptions);
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
    setOrgs([]);
    setSelectedOrg("");
    setProjects([]);
    setSelectedProject("");
    setTeams([]);
    setSelectedTeam("");
    setDoneStateOptions(defaultDoneStateOptions);
    setWorkItemTypeOptions(defaultWorkItemTypeOptions);
    setStatesByType({});
    setDoneStates([]);
    setTypes([]);
    setResult(null);
    setStep("pat");
    setLoading(false);
  }

  function Header({ showDisconnect = false, backLabel = "", onBack = null }) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          marginBottom: 8,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button
            onClick={toggleTheme}
            title={theme === "dark" ? "Passer en mode jour" : "Passer en mode nuit"}
            style={{
              width: 42,
              height: 42,
              borderRadius: 12,
              border: "1px solid var(--border)",
              background: "var(--panel)",
              cursor: "pointer",
              display: "grid",
              placeItems: "center",
              fontSize: 18,
            }}
          >
            {theme === "dark" ? "🌙" : "☀️"}
          </button>
          <h2 style={{ margin: 0 }}>Simulation Monte Carlo</h2>
        </div>

        {(backLabel || showDisconnect) && (
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {backLabel && onBack && (
              <button
                onClick={onBack}
                style={{
                  padding: "10px 14px",
                  borderRadius: 12,
                  border: "1px solid var(--border)",
                  background: "var(--panel)",
                  color: "var(--text)",
                  cursor: "pointer",
                  fontWeight: 700,
                  whiteSpace: "nowrap",
                }}
              >
                {backLabel}
              </button>
            )}
            {showDisconnect && (
              <button
                onClick={disconnect}
                style={{
                  padding: "10px 14px",
                  borderRadius: 12,
                  border: "1px solid var(--border)",
                  background: "var(--btnBg)",
                  color: "var(--btnText)",
                  cursor: "pointer",
                  fontWeight: 700,
                  whiteSpace: "nowrap",
                }}
              >
                Se déconnecter
              </button>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: 24 }}>
      <Header
        showDisconnect={step !== "pat"}
        backLabel={step === "projects" ? "Changer ORG" : step === "teams" ? "Changer projet" : step === "simulation" ? "Changer équipe" : ""}
        onBack={
          step === "projects"
            ? () => setStep("org")
            : step === "teams"
              ? () => setStep("projects")
              : step === "simulation"
                ? () => setStep("teams")
                : null
        }
      />

      {step === "pat" && (
        <>
          <h2 style={{ marginTop: 0 }}>Connexion Azure DevOps</h2>
          <p style={{ color: "var(--muted)" }}>
            Entrez votre PAT pour cette session. Il est utilisé uniquement en mémoire et n&apos;est pas sauvegardé.
          </p>
          {err && (
            <div style={{ background: "var(--dangerBg)", border: "1px solid var(--dangerBorder)", padding: 12, borderRadius: 10, marginTop: 14 }}>
              <b>Erreur :</b> {err}
            </div>
          )}
          <label style={{ display: "block", marginTop: 10, color: "var(--muted)" }}>PAT</label>
          <input
            type="password"
            value={patInput}
            onChange={(e) => setPatInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !loading) submitPat();
            }}
            style={{ width: "100%", padding: 10, marginTop: 6 }}
          />
          <button
            onClick={submitPat}
            disabled={loading}
            style={{ width: "100%", marginTop: 16, padding: 12, borderRadius: 12, border: "1px solid var(--border)", background: loading ? "var(--softBorder)" : "var(--btnBg)", color: loading ? "var(--text)" : "var(--btnText)", cursor: loading ? "not-allowed" : "pointer", fontWeight: 700 }}
          >
            {loading ? "Validation..." : "Se connecter"}
          </button>
        </>
      )}

      {step === "org" && (
        <>
          <h2 style={{ marginTop: 0 }}>Bienvenue {userName}</h2>
          <p style={{ color: "var(--muted)" }}>Selectionnez l&apos;organisation Azure DevOps a utiliser.</p>
          {err && (
            <div style={{ background: "var(--dangerBg)", border: "1px solid var(--dangerBorder)", padding: 12, borderRadius: 10, marginTop: 14 }}>
              <b>Erreur :</b> {err}
            </div>
          )}
          <label style={{ display: "block", marginTop: 12, color: "var(--muted)" }}>Organisations accessibles</label>
          <select value={selectedOrg} onChange={(e) => setSelectedOrg(e.target.value)} style={{ width: "100%", padding: 10, marginTop: 6 }}>
            {orgs.length === 0 && <option value="">Aucune organisation accessible</option>}
            {orgs.map((org) => (
              <option key={org.id || org.name} value={org.name || ""}>{org.name}</option>
            ))}
          </select>
          <button
            onClick={goToProjects}
            disabled={loading || !selectedOrg}
            style={{ width: "100%", marginTop: 16, padding: 12, borderRadius: 12, border: "1px solid var(--border)", background: loading ? "var(--softBorder)" : "var(--btnBg)", color: loading ? "var(--text)" : "var(--btnText)", cursor: loading || !selectedOrg ? "not-allowed" : "pointer", fontWeight: 700 }}
          >
            {loading ? "Chargement..." : "Choisir cette organisation"}
          </button>
        </>
      )}

      {step === "projects" && (
        <>
          <h2 style={{ marginTop: 0 }}>Choix du projet</h2>
          <p style={{ color: "var(--muted)" }}>Organisation sélectionnée: <b>{selectedOrg}</b></p>
          {err && (
            <div style={{ background: "var(--dangerBg)", border: "1px solid var(--dangerBorder)", padding: 12, borderRadius: 10, marginTop: 14 }}>
              <b>Erreur :</b> {err}
            </div>
          )}
          <label style={{ display: "block", marginTop: 12, color: "var(--muted)" }}>Projets accessibles</label>
          <select value={selectedProject} onChange={(e) => setSelectedProject(e.target.value)} style={{ width: "100%", padding: 10, marginTop: 6 }}>
            {projects.length === 0 && <option value="">Aucun projet accessible</option>}
            {projects.map((project) => (
              <option key={project.id || project.name} value={project.name || ""}>{project.name}</option>
            ))}
          </select>
          <button
            onClick={goToTeams}
            disabled={loading || !selectedProject}
            style={{ width: "100%", marginTop: 16, padding: 12, borderRadius: 12, border: "1px solid var(--border)", background: loading ? "var(--softBorder)" : "var(--btnBg)", color: loading ? "var(--text)" : "var(--btnText)", cursor: loading || !selectedProject ? "not-allowed" : "pointer", fontWeight: 700 }}
          >
            {loading ? "Chargement..." : "Choisir ce Projet"}
          </button>
        </>
      )}

      {step === "teams" && (
        <>
          <h2 style={{ marginTop: 0 }}>Choix de l&apos;équipe</h2>
          <p style={{ color: "var(--muted)" }}>Projet sélectionné: <b>{selectedProject}</b></p>
          {err && (
            <div style={{ background: "var(--dangerBg)", border: "1px solid var(--dangerBorder)", padding: 12, borderRadius: 10, marginTop: 14 }}>
              <b>Erreur :</b> {err}
            </div>
          )}
          <label style={{ display: "block", marginTop: 12, color: "var(--muted)" }}>Equipes disponibles</label>
          <select value={selectedTeam} onChange={(e) => setSelectedTeam(e.target.value)} style={{ width: "100%", padding: 10, marginTop: 6 }}>
            {teams.length === 0 && <option value="">Aucune equipe disponible</option>}
            {teams.map((team) => (
              <option key={team.id || team.name} value={team.name || ""}>{team.name}</option>
            ))}
          </select>
          <button
            onClick={goToSimulation}
            disabled={loading || !selectedTeam}
            style={{ width: "100%", marginTop: 16, padding: 12, borderRadius: 12, border: "1px solid var(--border)", background: loading ? "var(--softBorder)" : "var(--btnBg)", color: loading ? "var(--text)" : "var(--btnText)", cursor: loading || !selectedTeam ? "not-allowed" : "pointer", fontWeight: 700 }}
          >
            Choisir cette équipe
          </button>
        </>
      )}

      {step === "simulation" && (
        <>
          <div style={{ fontSize: 24, fontWeight: 800, marginTop: 6 }}>
            Equipe: {selectedTeam}
          </div>

          {err && (
            <div style={{ background: "var(--dangerBg)", border: "1px solid var(--dangerBorder)", padding: 12, borderRadius: 10, marginTop: 14 }}>
              <b>Erreur :</b> {err}
            </div>
          )}

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(340px, 420px) 1fr",
              gap: 16,
              alignItems: "stretch",
              marginTop: 10,
            }}
          >
            <div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={{ display: "block", color: "var(--muted)" }}>Début historique</label>
                  <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} style={{ width: "100%", padding: 10, marginTop: 6 }} />
                </div>
                <div>
                  <label style={{ display: "block", color: "var(--muted)" }}>Fin historique</label>
                  <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} style={{ width: "100%", padding: 10, marginTop: 6 }} />
                </div>
              </div>

              <label style={{ display: "block", marginTop: 10, color: "var(--muted)" }}>Type de simulation</label>
              <select
                value={simulationMode}
                onChange={(e) => {
                  setSimulationMode(e.target.value);
                  setResult(null);
                }}
                style={{ width: "100%", padding: 10, marginTop: 6 }}
              >
                <option value="backlog_to_weeks">Nombre d'items de backlog vers semaines</option>
                <option value="weeks_to_items">Nombre de semaines vers items livrés</option>
              </select>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 10 }}>
                <div>
                  <label style={{ display: "block", color: "var(--muted)" }}>
                    {simulationMode === "backlog_to_weeks" ? "Backlog (items)" : "Semaines ciblées"}
                  </label>
                  {simulationMode === "backlog_to_weeks" ? (
                    <input type="number" min="1" value={backlogSize} onChange={(e) => setBacklogSize(e.target.value)} style={{ width: "100%", padding: 10, marginTop: 6 }} />
                  ) : (
                    <input type="number" min="1" value={targetWeeks} onChange={(e) => setTargetWeeks(e.target.value)} style={{ width: "100%", padding: 10, marginTop: 6 }} />
                  )}
                </div>
                <div>
                  <label style={{ display: "block", color: "var(--muted)" }}>Simulations</label>
                  <input type="number" min="1000" step="1000" value={nSims} onChange={(e) => setNSims(e.target.value)} style={{ width: "100%", padding: 10, marginTop: 6 }} />
                </div>
              </div>

              <label style={{ display: "block", marginTop: 10, color: "var(--muted)" }}>Types de tickets pris en compte</label>
              <div
                style={{
                  marginTop: 6,
                  border: "1px solid var(--border)",
                  borderRadius: 10,
                  padding: 6,
                  maxHeight: 88,
                  overflowY: "auto",
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  columnGap: 12,
                }}
              >
                {workItemTypeOptions.map((ticketType) => (
                  <label key={ticketType} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                    <input
                      type="checkbox"
                      checked={types.includes(ticketType)}
                      onChange={(e) => {
                        setTypes((prev) => {
                          const next = e.target.checked
                            ? [...prev, ticketType]
                            : prev.filter((t) => t !== ticketType);
                          return next;
                        });
                      }}
                    />
                    <span>{ticketType}</span>
                  </label>
                ))}
              </div>

              <label style={{ display: "block", marginTop: 10, color: "var(--muted)" }}>États de résolution</label>
              <div
                style={{
                  marginTop: 6,
                  border: "1px solid var(--border)",
                  borderRadius: 10,
                  padding: 8,
                  maxHeight: 96,
                  overflowY: "auto",
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  columnGap: 12,
                }}
              >
                {filteredDoneStateOptions.map((state) => (
                  <label key={state} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                    <input
                      type="checkbox"
                      checked={doneStates.includes(state)}
                      disabled={!types.length}
                      onChange={(e) => {
                        setDoneStates((prev) =>
                          e.target.checked ? [...prev, state] : prev.filter((s) => s !== state)
                        );
                      }}
                    />
                    <span>{state}</span>
                  </label>
                ))}
                {!types.length && (
                  <div style={{ gridColumn: "1 / -1", color: "var(--muted)", fontSize: 13 }}>
                    Sélectionnez d'abord un ou plusieurs tickets.
                  </div>
                )}
              </div>

              <button
                onClick={runForecast}
                disabled={loading || !selectedTeam}
                style={{ width: "100%", marginTop: 16, padding: 12, borderRadius: 12, border: "1px solid var(--border)", background: loading ? "var(--softBorder)" : "var(--btnBg)", color: loading ? "var(--text)" : "var(--btnText)", cursor: loading ? "not-allowed" : "pointer", fontWeight: 700 }}
              >
                {loading ? "Calcul..." : "Lancer la simulation"}
              </button>

              {result && (
                <div style={{ marginTop: 16, display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                  {["P50", "P70", "P90"].map((k) => (
                    <div
                      key={k}
                      style={{
                        border: "1px solid var(--border)",
                        borderRadius: 10,
                        padding: "10px 12px",
                        display: "flex",
                        alignItems: "baseline",
                        justifyContent: "space-between",
                        gap: 8,
                      }}
                    >
                      <span style={{ color: "var(--muted)", fontWeight: 700 }}>{k}</span>
                      <span style={{ fontSize: 20, fontWeight: 800, lineHeight: 1 }}>
                        {result?.result_percentiles?.[k]} {result?.result_kind === "items" ? "items" : "semaines"}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
              {result ? (
                <>
                  <div style={{ display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
                    <button
                      onClick={() => setActiveChartTab("throughput")}
                      style={{
                        padding: "8px 10px",
                        borderRadius: 10,
                        border: "1px solid var(--border)",
                        background: activeChartTab === "throughput" ? "var(--btnBg)" : "var(--panel)",
                        color: activeChartTab === "throughput" ? "var(--btnText)" : "var(--text)",
                        cursor: "pointer",
                        fontWeight: 700,
                      }}
                    >
                      Throughput
                    </button>
                    <button
                      onClick={() => setActiveChartTab("distribution")}
                      style={{
                        padding: "8px 10px",
                        borderRadius: 10,
                        border: "1px solid var(--border)",
                        background: activeChartTab === "distribution" ? "var(--btnBg)" : "var(--panel)",
                        color: activeChartTab === "distribution" ? "var(--btnText)" : "var(--text)",
                        cursor: "pointer",
                        fontWeight: 700,
                      }}
                    >
                      Distribution
                    </button>
                    <button
                      onClick={() => setActiveChartTab("probability")}
                      style={{
                        padding: "8px 10px",
                        borderRadius: 10,
                        border: "1px solid var(--border)",
                        background: activeChartTab === "probability" ? "var(--btnBg)" : "var(--panel)",
                        color: activeChartTab === "probability" ? "var(--btnText)" : "var(--text)",
                        cursor: "pointer",
                        fontWeight: 700,
                      }}
                    >
                      Courbe de probabilité
                    </button>
                  </div>

                  {activeChartTab === "throughput" && (
                    <>
                      <h4 style={{ marginTop: 0 }}>Throughput hebdomadaire</h4>
                      <div style={{ width: "100%", flex: 1, minHeight: 0 }}>
                        <ResponsiveContainer>
                          <LineChart data={throughputData}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="week" />
                            <YAxis allowDecimals={false} />
                            <Tooltip
                              {...tooltipBaseProps}
                              formatter={(v) => [Number(v).toFixed(0), "Throughput"]}
                            />
                            <Line type="monotone" dataKey="throughput" dot={false} strokeWidth={2} />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </>
                  )}

                  {activeChartTab === "distribution" && (
                    <>
                      <h4 style={{ marginTop: 0 }}>Distribution Monte Carlo</h4>
                      <div style={{ width: "100%", flex: 1, minHeight: 0 }}>
                        <ResponsiveContainer>
                          <ComposedChart data={mcHistData}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="x" />
                            <YAxis allowDecimals={false} />
                            <Tooltip
                              {...tooltipBaseProps}
                              formatter={(v, name) => {
                                if (name === "count") return [Number(v).toFixed(0), "Fréquence"];
                                if (name === "gauss") return [Number(v).toFixed(1), "Courbe lissée"];
                                return [Number(v).toFixed(1), name];
                              }}
                            />
                            <Bar dataKey="count" />
                            <Line type="monotone" dataKey="gauss" dot={false} strokeWidth={2} />
                          </ComposedChart>
                        </ResponsiveContainer>
                      </div>
                    </>
                  )}

                  {activeChartTab === "probability" && (
                    <>
                      <h4 style={{ marginTop: 0 }}>Courbe de probabilité cumulée</h4>
                      <div style={{ width: "100%", flex: 1, minHeight: 0 }}>
                        <ResponsiveContainer>
                          <LineChart data={probabilityCurveData}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="x" />
                            <YAxis domain={[0, 100]} />
                            <Tooltip
                              {...tooltipBaseProps}
                              formatter={(v) => [`${Number(v).toFixed(1)}%`, "Probabilité cumulée"]}
                            />
                            <Line type="monotone" dataKey="probability" dot={false} strokeWidth={2} />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </>
                  )}
                </>
              ) : (
                <div style={{ border: "1px dashed var(--border)", borderRadius: 10, padding: 14, color: "var(--muted)" }}>
                  Lancez une simulation pour afficher les graphiques.
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
