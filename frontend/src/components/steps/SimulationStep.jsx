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

export default function SimulationStep({
  err,
  selectedTeam,
  startDate,
  setStartDate,
  endDate,
  setEndDate,
  simulationMode,
  setSimulationMode,
  backlogSize,
  setBacklogSize,
  targetWeeks,
  setTargetWeeks,
  nSims,
  setNSims,
  workItemTypeOptions,
  types,
  setTypes,
  filteredDoneStateOptions,
  doneStates,
  setDoneStates,
  loading,
  onRunForecast,
  result,
  activeChartTab,
  setActiveChartTab,
  throughputData,
  mcHistData,
  probabilityCurveData,
  tooltipBaseProps,
}) {
  return (
    <>
      <div style={{ fontSize: 24, fontWeight: 800, marginTop: 6 }}>Equipe: {selectedTeam}</div>

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
              setActiveChartTab("throughput");
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
                      const next = e.target.checked ? [...prev, ticketType] : prev.filter((t) => t !== ticketType);
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
                    setDoneStates((prev) => (e.target.checked ? [...prev, state] : prev.filter((s) => s !== state)));
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
            onClick={onRunForecast}
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
                    padding: "7px 10px",
                    display: "flex",
                    alignItems: "baseline",
                    justifyContent: "space-between",
                    gap: 8,
                  }}
                >
                  <span style={{ color: "var(--muted)", fontWeight: 700, fontSize: 13 }}>{k}</span>
                  <span style={{ fontSize: 17, fontWeight: 800, lineHeight: 1 }}>
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
                        <Tooltip {...tooltipBaseProps} formatter={(v) => [Number(v).toFixed(0), "Throughput"]} />
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
                        <Tooltip {...tooltipBaseProps} formatter={(v) => [`${Number(v).toFixed(1)}%`, "Probabilité cumulée"]} />
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
  );
}
