import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { SimulationViewModel } from "../../hooks/useSimulation";

type SimulationStepProps = {
  selectedTeam: string;
  simulation: SimulationViewModel;
};

export default function SimulationStep({ selectedTeam, simulation }: SimulationStepProps) {
  const {
    err,
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
    runForecast,
    result,
    activeChartTab,
    setActiveChartTab,
    throughputData,
    mcHistData,
    probabilityCurveData,
    tooltipBaseProps,
  } = simulation;

  return (
    <>
      <div className="sim-title">Equipe: {selectedTeam}</div>

      {err && (
        <div className="sim-error">
          <b>Erreur :</b> {err}
        </div>
      )}

      <div className="sim-layout">
        <div className="sim-controls">
          <div className="sim-grid-2">
            <div>
              <label className="sim-label">Debut historique</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="sim-input"
              />
            </div>
            <div>
              <label className="sim-label">Fin historique</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="sim-input"
              />
            </div>
          </div>

          <label className="sim-label sim-mt-10">Type de simulation</label>
          <select
            value={simulationMode}
            onChange={(e) => {
              setSimulationMode(e.target.value as "backlog_to_weeks" | "weeks_to_items");
              setActiveChartTab("throughput");
            }}
            className="sim-input"
          >
            <option value="backlog_to_weeks">Nombre d&apos;items de backlog vers semaines</option>
            <option value="weeks_to_items">Nombre de semaines vers items livres</option>
          </select>

          <div className="sim-grid-2 sim-mt-10">
            <div>
              <label className="sim-label">
                {simulationMode === "backlog_to_weeks" ? "Backlog (items)" : "Semaines ciblees"}
              </label>
              {simulationMode === "backlog_to_weeks" ? (
                <input
                  type="number"
                  min="1"
                  value={backlogSize}
                  onChange={(e) => setBacklogSize(e.target.value)}
                  className="sim-input"
                />
              ) : (
                <input
                  type="number"
                  min="1"
                  value={targetWeeks}
                  onChange={(e) => setTargetWeeks(e.target.value)}
                  className="sim-input"
                />
              )}
            </div>
            <div>
              <label className="sim-label">Simulations</label>
              <input
                type="number"
                min="1000"
                step="1000"
                value={nSims}
                onChange={(e) => setNSims(e.target.value)}
                className="sim-input"
              />
            </div>
          </div>

          <label className="sim-label sim-mt-10">Types de tickets pris en compte</label>
          <div className="sim-checklist">
            {workItemTypeOptions.map((ticketType) => (
              <label key={ticketType} className="sim-check-row">
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

          <label className="sim-label sim-mt-10">Etats de resolution</label>
          <div className="sim-checklist sim-checklist--states">
            {filteredDoneStateOptions.map((state) => (
              <label key={state} className="sim-check-row">
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
              <div className="sim-empty-tip">
                Selectionnez d&apos;abord un ou plusieurs tickets.
              </div>
            )}
          </div>

          <button
            onClick={() => void runForecast()}
            disabled={loading || !selectedTeam}
            className={`sim-primary-btn ${loading || !selectedTeam ? "sim-primary-btn--disabled" : ""}`}
          >
            {loading ? "Calcul..." : "Lancer la simulation"}
          </button>

          {result && (
            <div className="sim-kpis">
              {["P50", "P70", "P90"].map((k) => (
                <div key={k} className="sim-kpi-card">
                  <span className="sim-kpi-label">{k}</span>
                  <span className="sim-kpi-value">
                    {result?.result_percentiles?.[k]} {result?.result_kind === "items" ? "items" : "semaines"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="sim-charts">
          {result ? (
            <>
              <div className="sim-tabs">
                <button
                  onClick={() => setActiveChartTab("throughput")}
                  className={`sim-tab-btn ${activeChartTab === "throughput" ? "sim-tab-btn--active" : ""}`}
                >
                  Throughput
                </button>
                <button
                  onClick={() => setActiveChartTab("distribution")}
                  className={`sim-tab-btn ${activeChartTab === "distribution" ? "sim-tab-btn--active" : ""}`}
                >
                  Distribution
                </button>
                <button
                  onClick={() => setActiveChartTab("probability")}
                  className={`sim-tab-btn ${activeChartTab === "probability" ? "sim-tab-btn--active" : ""}`}
                >
                  Courbe de probabilite
                </button>
              </div>

              {activeChartTab === "throughput" && (
                <>
                  <h4 className="sim-chart-title">Throughput hebdomadaire</h4>
                  <div className="sim-chart-wrap">
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
                  <h4 className="sim-chart-title">Distribution Monte Carlo</h4>
                  <div className="sim-chart-wrap">
                    <ResponsiveContainer>
                      <ComposedChart data={mcHistData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="x" />
                        <YAxis allowDecimals={false} />
                        <Tooltip
                          {...tooltipBaseProps}
                          formatter={(v, name) => {
                            if (name === "count") return [Number(v).toFixed(0), "Frequence"];
                            if (name === "gauss") return [Number(v).toFixed(1), "Courbe lissee"];
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
                  <h4 className="sim-chart-title">Courbe de probabilite cumulee</h4>
                  <div className="sim-chart-wrap">
                    <ResponsiveContainer>
                      <LineChart data={probabilityCurveData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="x" />
                        <YAxis domain={[0, 100]} />
                        <Tooltip {...tooltipBaseProps} formatter={(v) => [`${Number(v).toFixed(1)}%`, "Probabilite cumulee"]} />
                        <Line type="monotone" dataKey="probability" dot={false} strokeWidth={2} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </>
              )}
            </>
          ) : (
            <div className="sim-empty-panel">
              Lancez une simulation pour afficher les graphiques.
            </div>
          )}
        </div>
      </div>
    </>
  );
}
