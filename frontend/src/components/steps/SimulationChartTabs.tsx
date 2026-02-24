import { useMemo } from "react";
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

type SimulationChartTabsProps = {
  simulation: Pick<
    SimulationViewModel,
    | "result"
    | "activeChartTab"
    | "setActiveChartTab"
    | "throughputData"
    | "mcHistData"
    | "probabilityCurveData"
    | "tooltipBaseProps"
    | "resetForTeamSelection"
  >;
};

export default function SimulationChartTabs({ simulation }: SimulationChartTabsProps) {
  const {
    result,
    activeChartTab,
    setActiveChartTab,
    throughputData,
    mcHistData,
    probabilityCurveData,
    tooltipBaseProps,
    resetForTeamSelection,
  } = simulation;
  const throughputWithMovingAverage = useMemo(() => {
    const windowSize = 4;
    return throughputData.map((point, idx, arr) => {
      const start = Math.max(0, idx - windowSize + 1);
      const slice = arr.slice(start, idx + 1);
      const average = slice.reduce((sum, p) => sum + p.throughput, 0) / slice.length;
      return { ...point, movingAverage: Number(average.toFixed(2)) };
    });
  }, [throughputData]);
  const renderThroughputTooltip = ({ active, payload, label }: { active?: boolean; payload?: ReadonlyArray<{ dataKey?: string; value?: number }>; label?: string | number }) => {
    if (!active || !payload?.length) return null;
    const throughputPoint = payload.find((p) => p.dataKey === "throughput");
    const movingAvgPoint = payload.find((p) => p.dataKey === "movingAverage");
    return (
      <div style={{ background: "var(--panel)", border: "1px solid var(--border)", borderRadius: 10, padding: "8px 10px" }}>
        <div style={{ color: "var(--muted)", fontWeight: 700, marginBottom: 4 }}>{label}</div>
        <div style={{ color: "var(--text)", fontWeight: 700 }}>troughput: {Number(throughputPoint?.value ?? 0).toFixed(0)}</div>
        <div style={{ color: "var(--text)", fontWeight: 700 }}>moyenne mobile: {Number(movingAvgPoint?.value ?? 0).toFixed(2)}</div>
      </div>
    );
  };

  return (
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
            <button
              type="button"
              onClick={resetForTeamSelection}
              className="sim-tab-reset-btn"
              title="Revenir a l'etat initial (simulation non lancee)"
            >
              Reinitialiser
            </button>
          </div>

          {activeChartTab === "throughput" && (
            <>
              <h4 className="sim-chart-title">Throughput hebdomadaire</h4>
              <p className="sim-chart-subtitle">
                Chaque point represente le nombre d&apos;items termines sur une semaine historique.
              </p>
              <div className="sim-chart-wrap">
                <ResponsiveContainer>
                  <ComposedChart data={throughputWithMovingAverage}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="week" />
                    <YAxis allowDecimals={false} />
                    <Tooltip {...tooltipBaseProps} content={renderThroughputTooltip} />
                    <Bar dataKey="throughput" name="Throughput" />
                    <Line
                      type="monotone"
                      dataKey="throughput"
                      dot={false}
                      strokeWidth={2}
                      stroke="#2563eb"
                      name="Courbe"
                    />
                    <Line
                      type="monotone"
                      dataKey="movingAverage"
                      dot={false}
                      strokeWidth={2.5}
                      stroke="#f97316"
                      strokeDasharray="8 4"
                      name="Moyenne mobile"
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </>
          )}

          {activeChartTab === "distribution" && (
            <>
              <h4 className="sim-chart-title">Distribution Monte Carlo</h4>
              <p className="sim-chart-subtitle">
                Chaque barre represente la frequence d&apos;une duree simulee sur l&apos;ensemble des runs.
              </p>
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
              <h4 className="sim-chart-title">
                {result?.result_kind === "items"
                  ? "Probabilite d'atteindre au moins X items"
                  : "Probabilite de terminer en au plus X semaines"}
              </h4>
              <p className="sim-chart-subtitle">
                Cette courbe indique la probabilite cumulee pour chaque valeur possible.
              </p>
              <div className="sim-chart-wrap">
                <ResponsiveContainer>
                  <LineChart data={probabilityCurveData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="x" />
                    <YAxis domain={[0, 100]} />
                    <Tooltip
                      {...tooltipBaseProps}
                      formatter={(v) => [
                        `${Number(v).toFixed(1)}%`,
                        result?.result_kind === "items" ? "P(X >= valeur)" : "P(X <= valeur)",
                      ]}
                    />
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
  );
}
