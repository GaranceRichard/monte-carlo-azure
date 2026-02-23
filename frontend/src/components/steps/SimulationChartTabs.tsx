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
  } = simulation;

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
              <h4 className="sim-chart-title">
                {result?.result_kind === "items"
                  ? "Probabilite d'atteindre au moins X items"
                  : "Probabilite de terminer en au plus X semaines"}
              </h4>
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
