import { useEffect, useMemo, useState } from "react";
import { getTeams, getTeamSettings, postForecast } from "./api";
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

function parseCsv(s) {
  return s.split(",").map((x) => x.trim()).filter(Boolean);
}

function normalPdf(x, mean, std) {
  if (!std || std <= 0) return 0;
  const z = (x - mean) / std;
  return (1 / (std * Math.sqrt(2 * Math.PI))) * Math.exp(-0.5 * z * z);
}

function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  localStorage.setItem("theme", theme);
}

function addDays(d, days) {
  const dt = new Date(d);
  dt.setDate(dt.getDate() + days);
  return dt;
}

function fmtDate(d) {
  try {
    return new Intl.DateTimeFormat("fr-CA", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(d);
  } catch {
    return d.toISOString().slice(0, 10);
  }
}

export default function App() {
  // Theme (light/dark)
  const [theme, setTheme] = useState("dark");

  useEffect(() => {
    const saved = localStorage.getItem("theme");
    const initial = saved === "light" || saved === "dark" ? saved : "dark";
    setTheme(initial);
    applyTheme(initial);
  }, []);

  function toggleTheme() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    applyTheme(next);
  }

  const [teams, setTeams] = useState([]);
  const [teamName, setTeamName] = useState("");
  const [settings, setSettings] = useState(null);
  const [areaPath, setAreaPath] = useState("");

  const [startDate, setStartDate] = useState("2025-10-01");
  const [endDate, setEndDate] = useState("2026-01-19");
  const [backlogSize, setBacklogSize] = useState(120);
  const [doneStates, setDoneStates] = useState("Done,Closed,Resolved");
  const [types, setTypes] = useState("User Story,Product Backlog Item,Bug");
  const [nSims, setNSims] = useState(20000);

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [result, setResult] = useState(null);

  // Dates P50/P80/P90 calculées à partir de la fin de l'historique
  const forecastStart = new Date(endDate + "T00:00:00");

  // Load teams
  useEffect(() => {
    (async () => {
      try {
        const t = await getTeams();
        setTeams(t);
        if (t?.length) setTeamName(t[0].name);
      } catch (e) {
        setErr(e.message || String(e));
      }
    })();
  }, []);

  // Load settings for selected team
  useEffect(() => {
    if (!teamName) return;
    (async () => {
      try {
        setErr("");
        setResult(null);
        const s = await getTeamSettings(teamName);
        setSettings(s);
        const defaultArea =
          s.default_area_path || (s.area_paths?.[0]?.value ?? "");
        setAreaPath(defaultArea);
      } catch (e) {
        setErr(e.message || String(e));
      }
    })();
  }, [teamName]);

  const throughputData = useMemo(() => {
    if (!result?.weekly_throughput) return [];
    return result.weekly_throughput.map((r) => ({
      week: String(r.week).slice(0, 10),
      throughput: r.throughput,
    }));
  }, [result]);

  const mcHistData = useMemo(() => {
    const dist = result?.weeks_distribution;
    if (!dist?.length) return [];

    const counts = new Map();
    for (const w of dist) counts.set(w, (counts.get(w) || 0) + 1);

    const xs = Array.from(counts.keys()).sort((a, b) => a - b);
    const N = dist.length;

    const mean = dist.reduce((a, b) => a + b, 0) / N;
    const variance = dist.reduce((a, b) => a + (b - mean) ** 2, 0) / N;
    const std = Math.sqrt(variance);

    const binWidth = 1;
    return xs.map((x) => {
      const pdf = normalPdf(x, mean, std);
      const gaussCountScale = pdf * N * binWidth;
      return {
        weeks: x,
        count: counts.get(x) || 0,
        gauss: gaussCountScale,
      };
    });
  }, [result]);

  async function runForecast() {
    setLoading(true);
    setErr("");
    setResult(null);
    try {
      const payload = {
        team_name: teamName,
        area_path: areaPath || null,
        start_date: startDate,
        end_date: endDate,
        backlog_size: Number(backlogSize),
        done_states: parseCsv(doneStates),
        work_item_types: parseCsv(types),
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

  const panelStyle = {
    border: "1px solid var(--border)",
    borderRadius: 14,
    padding: 16,
    minWidth: 0,
    height: "100%",
    background: "var(--panel)",
  };

  const labelStyle = {
    display: "block",
    marginTop: 10,
    color: "var(--muted)",
  };

  const inputStyle = { width: "100%", padding: 10, marginTop: 6 };

  const tooltipProps = {
    contentStyle: {
      background: "transparent",
      border: "none",
      boxShadow: "none",
    },
    labelStyle: { color: "dodgerblue", fontWeight: 700 },
    itemStyle: { color: "dodgerblue", fontWeight: 700 },
    wrapperStyle: { outline: "none" },
  };

  return (
    <div style={{ maxWidth: 1350, margin: "0 auto", padding: 24 }}>
      {/* Header with icon on the left */}
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

        <div>
          <h2 style={{ margin: 0 }}>Monte Carlo — Azure DevOps</h2>
          <p style={{ marginTop: 6, marginBottom: 0, color: "var(--muted)" }}>
            Choisissez une équipe, vérifiez le périmètre (Area Path), puis lancez
            la simulation.
          </p>
        </div>
      </div>

      {err && (
        <div
          style={{
            background: "var(--dangerBg)",
            border: "1px solid var(--dangerBorder)",
            padding: 12,
            borderRadius: 10,
            marginTop: 14,
          }}
        >
          <b>Erreur :</b> {err}
        </div>
      )}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "560px 1fr",
          gap: 16,
          alignItems: "stretch",
          marginTop: 16,
        }}
      >
        {/* Left panel */}
        <div style={panelStyle}>
          <h3 style={{ marginTop: 0 }}>Paramètres</h3>

          <label style={labelStyle}>Équipe</label>
          <select
            value={teamName}
            onChange={(e) => setTeamName(e.target.value)}
            style={inputStyle}
          >
            {teams.map((t) => (
              <option key={t.id} value={t.name}>
                {t.name}
              </option>
            ))}
          </select>

          <label style={labelStyle}>Area Path (périmètre)</label>
          <select
            value={areaPath}
            onChange={(e) => setAreaPath(e.target.value)}
            style={inputStyle}
          >
            {(settings?.area_paths || []).map((a) => (
              <option key={a.value} value={a.value}>
                {a.value}
              </option>
            ))}
          </select>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 12,
              marginTop: 10,
            }}
          >
            <div>
              <label style={labelStyle}>Début historique</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>Fin historique</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                style={inputStyle}
              />
            </div>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 12,
              marginTop: 10,
            }}
          >
            <div>
              <label style={labelStyle}>Backlog (items)</label>
              <input
                type="number"
                min="1"
                value={backlogSize}
                onChange={(e) => setBacklogSize(e.target.value)}
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>Simulations</label>
              <input
                type="number"
                min="1000"
                step="1000"
                value={nSims}
                onChange={(e) => setNSims(e.target.value)}
                style={inputStyle}
              />
            </div>
          </div>

          <label style={labelStyle}>États “Done” (CSV)</label>
          <input
            value={doneStates}
            onChange={(e) => setDoneStates(e.target.value)}
            style={inputStyle}
          />

          <label style={labelStyle}>Work Item Types (CSV)</label>
          <input
            value={types}
            onChange={(e) => setTypes(e.target.value)}
            style={inputStyle}
          />

          <button
            onClick={runForecast}
            disabled={loading || !teamName || !areaPath}
            style={{
              width: "100%",
              marginTop: 16,
              padding: 12,
              borderRadius: 12,
              border: "1px solid var(--border)",
              background: loading ? "var(--softBorder)" : "var(--btnBg)",
              color: loading ? "var(--text)" : "var(--btnText)",
              cursor: loading ? "not-allowed" : "pointer",
              fontWeight: 700,
            }}
          >
            {loading ? "Calcul en cours…" : "Lancer la simulation"}
          </button>

          <div style={{ marginTop: 10, color: "var(--muted)", fontSize: 13 }}>
            Périmètre : l’équipe est résolue via ses Team Settings (Area Path).
          </div>
        </div>

        {/* Right panel */}
        <div style={{ ...panelStyle, overflow: "auto" }}>
          {!result && (
            <div style={{ color: "var(--muted)" }}>
              Lancez une simulation pour afficher les résultats.
            </div>
          )}

          {result && (
            <>
              <h3 style={{ marginTop: 0 }}>Résultats</h3>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr 1fr",
                  gap: 12,
                }}
              >
                {["P50", "P80", "P90"].map((k) => {
                  const w = Number(result.weeks_percentiles[k] ?? 0);
                  const d = fmtDate(addDays(forecastStart, w * 7));
                  return (
                    <div
                      key={k}
                      style={{
                        border: "1px solid var(--softBorder)",
                        borderRadius: 14,
                        padding: 12,
                      }}
                    >
                      <div style={{ color: "var(--muted)" }}>{k}</div>
                      <div style={{ fontSize: 24, fontWeight: 800 }}>
                        {w} semaines
                      </div>
                      <div
                        style={{
                          marginTop: 6,
                          color: "var(--muted)",
                          fontWeight: 600,
                        }}
                      >
                        {d}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div style={{ marginTop: 14, color: "var(--muted)", fontSize: 13 }}>
                <div>
                  <b style={{ color: "var(--text)" }}>Départ des dates :</b>{" "}
                  {fmtDate(forecastStart)}
                </div>
                <div>
                  <b style={{ color: "var(--text)" }}>Équipe :</b>{" "}
                  {result.team}
                </div>
                <div style={{ wordBreak: "break-word" }}>
                  <b style={{ color: "var(--text)" }}>Area Path :</b>{" "}
                  {result.area_path}
                </div>
                <div>
                  <b style={{ color: "var(--text)" }}>Backlog :</b>{" "}
                  {result.backlog_size} items |{" "}
                  <b style={{ color: "var(--text)" }}>Semaines échantillon :</b>{" "}
                  {result.samples_count}
                </div>
              </div>

              <h4 style={{ marginTop: 18 }}>Throughput hebdomadaire</h4>
              <div style={{ width: "100%", height: 320 }}>
                <ResponsiveContainer>
                  <LineChart data={throughputData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="week" />
                    <YAxis allowDecimals={false} />
                    <Tooltip {...tooltipProps} />
                    <Line
                      type="monotone"
                      dataKey="throughput"
                      strokeWidth={2}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              <h4 style={{ marginTop: 18 }}>
                Distribution Monte Carlo (semaines nécessaires)
              </h4>
              <div style={{ width: "100%", height: 320 }}>
                <ResponsiveContainer>
                  <ComposedChart data={mcHistData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="weeks" />
                    <YAxis allowDecimals={false} />
                    <Tooltip {...tooltipProps} />
                    <Bar dataKey="count" />
                    <Line type="monotone" dataKey="gauss" dot={false} strokeWidth={2} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
