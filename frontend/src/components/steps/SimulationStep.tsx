import SimulationChartTabs from "./SimulationChartTabs";
import SimulationControlPanel from "./SimulationControlPanel";
import { SimulationProvider } from "./SimulationContext";
import SimulationResultsPanel from "./SimulationResultsPanel";
import type { SimulationViewModel } from "../../hooks/useSimulation";

type SimulationStepProps = {
  selectedTeam: string;
  simulation: SimulationViewModel;
};

export default function SimulationStep({ selectedTeam, simulation }: SimulationStepProps) {
  const { err } = simulation;

  return (
    <SimulationProvider value={{ selectedTeam, simulation }}>
      <div className="flex h-full min-h-0 flex-col">
        <div
          className="mb-3 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-4 py-3"
          data-testid="selected-team-card"
        >
          <div className="text-xs font-bold uppercase tracking-[0.08em] text-[var(--muted)]">Equipe active</div>
          <div className="mt-1 text-xl font-extrabold text-[var(--brand)]" data-testid="selected-team-name">
            {selectedTeam}
          </div>
        </div>

        {err && (
          <div className="mb-3 rounded-xl border border-[var(--dangerBorder)] bg-[var(--dangerBg)] p-3 text-sm">
            <b>Erreur:</b> {err}
          </div>
        )}

        <div className="grid flex-1 min-h-0 grid-cols-1 gap-3 xl:grid-cols-12">
          <div className="min-h-0 space-y-3 xl:col-span-4 xl:grid xl:grid-rows-[auto_minmax(0,1fr)] xl:space-y-0 xl:gap-3">
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-1)] p-3">
              <SimulationControlPanel />
            </div>
            <div className="min-h-0 overflow-auto rounded-2xl border border-[var(--border)] bg-[var(--surface-1)] p-3">
              <SimulationResultsPanel />
            </div>
          </div>
          <div className="min-h-0 rounded-2xl border border-[var(--border)] bg-[var(--surface-1)] p-4 xl:col-span-8">
            <SimulationChartTabs />
          </div>
        </div>
      </div>
    </SimulationProvider>
  );
}
