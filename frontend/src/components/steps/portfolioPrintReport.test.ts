import { describe, expect, it, vi } from "vitest";
import { exportPortfolioPrintReport } from "./portfolioPrintReport";
import { buildAtLeastPercentiles } from "../../hooks/probability";
import { computeRiskScoreFromPercentiles } from "../../utils/simulation";

function baseArgs() {
  return {
    selectedProject: "Projet A",
    startDate: "2026-01-01",
    endDate: "2026-03-01",
    arrimageRate: 80,
    includedTeams: ["Team A", "Team B"],
    scenarios: [
      {
        label: "Optimiste" as const,
        hypothese: "hyp optimiste",
        samples: [3, 4, 5],
        weeklyData: [
          { week: "2026-01-01", throughput: 3 },
          { week: "2026-01-08", throughput: 4 },
        ],
        percentiles: { P50: 10, P70: 12, P90: 15 },
        riskScore: 0.2,
        riskLegend: "fiable" as const,
        distribution: [{ x: 10, count: 10 }],
      },
      {
        label: "Arrime (80%)" as const,
        hypothese: "hyp arrime",
        samples: [2, 3, 4],
        weeklyData: [
          { week: "2026-01-01", throughput: 2 },
          { week: "2026-01-08", throughput: 3 },
        ],
        percentiles: { P50: 8, P70: 10, P90: 12 },
        riskScore: 0.25,
        riskLegend: "incertain" as const,
        distribution: [{ x: 8, count: 10 }],
      },
      {
        label: "Conservateur" as const,
        hypothese: "hyp conservateur",
        samples: [1, 2, 3],
        weeklyData: [
          { week: "2026-01-01", throughput: 1 },
          { week: "2026-01-08", throughput: 2 },
        ],
        percentiles: { P50: 6, P70: 7, P90: 9 },
        riskScore: 0.3,
        riskLegend: "incertain" as const,
        distribution: [{ x: 6, count: 10 }],
      },
    ],
    sections: [
      {
        selectedTeam: "Team A",
        simulationMode: "backlog_to_weeks" as const,
        includeZeroWeeks: true,
        backlogSize: 120,
        targetWeeks: 12,
        nSims: 20000,
        resultKind: "weeks" as const,
        riskScore: 0.3,
        distribution: [{ x: 10, count: 20 }],
        weeklyThroughput: [{ week: "2026-01-01", throughput: 3 }],
        displayPercentiles: { P50: 10, P70: 12, P90: 15 },
      },
    ],
  };
}

describe("exportPortfolioPrintReport", () => {
  it("renders synthesis page and scenario pages in expected order", () => {
    let writtenHtml = "";
    const fakeWindow = {
      document: {
        open: vi.fn(),
        write: vi.fn((html: string) => {
          writtenHtml = html;
        }),
        close: vi.fn(),
        getElementById: vi.fn(() => null),
      },
      onload: null as null | (() => void),
      addEventListener: vi.fn(),
    };
    vi.spyOn(window, "open").mockReturnValue(fakeWindow as unknown as Window);

    exportPortfolioPrintReport(baseArgs());

    expect(writtenHtml).toContain("Synthèse PI - Simulation Portefeuille");
    expect(writtenHtml).toContain("Taux d'arrimage:</b> 80%");
    expect(writtenHtml).toContain("Scenario PI - Optimiste");
    expect(writtenHtml).toContain("Scenario PI - Arrimé (80%)");
    expect(writtenHtml).toContain("Scenario PI - Conservateur");
    expect(writtenHtml).toContain("Simulation Portefeuille - Team A");

    const idxSynth = writtenHtml.indexOf("Synthèse PI - Simulation Portefeuille");
    const idxOpt = writtenHtml.indexOf("Scenario PI - Optimiste");
    const idxArr = writtenHtml.indexOf("Scenario PI - Arrimé (80%)");
    const idxCons = writtenHtml.indexOf("Scenario PI - Conservateur");
    const idxTeam = writtenHtml.indexOf("Simulation Portefeuille - Team A");
    expect(idxSynth).toBeLessThan(idxOpt);
    expect(idxOpt).toBeLessThan(idxArr);
    expect(idxArr).toBeLessThan(idxCons);
    expect(idxCons).toBeLessThan(idxTeam);
  });

  it("includes hypotheses and reconstructed throughput note", () => {
    let writtenHtml = "";
    const fakeWindow = {
      document: {
        open: vi.fn(),
        write: vi.fn((html: string) => {
          writtenHtml = html;
        }),
        close: vi.fn(),
        getElementById: vi.fn(() => null),
      },
      onload: null as null | (() => void),
      addEventListener: vi.fn(),
    };
    vi.spyOn(window, "open").mockReturnValue(fakeWindow as unknown as Window);

    exportPortfolioPrintReport(baseArgs());

    expect(writtenHtml).toContain("1. Optimiste");
    expect(writtenHtml).toContain("2. Arrimé : 80%");
    expect(writtenHtml).toContain("3. Conservateur");
    expect(writtenHtml).toContain("Débit reconstruit par simulation bootstrap - non issu de l&#39;historique réel.");
  });

  it("keeps accented labels and avoids mojibake in generated HTML", () => {
    let writtenHtml = "";
    const fakeWindow = {
      document: {
        open: vi.fn(),
        write: vi.fn((html: string) => {
          writtenHtml = html;
        }),
        close: vi.fn(),
        getElementById: vi.fn(() => null),
      },
      onload: null as null | (() => void),
      addEventListener: vi.fn(),
    };
    vi.spyOn(window, "open").mockReturnValue(fakeWindow as unknown as Window);

    exportPortfolioPrintReport(baseArgs());

    expect(writtenHtml).toContain("Synthèse décisionnelle");
    expect(writtenHtml).toContain("Hypothèses");
    expect(writtenHtml).toContain("Période");
    expect(writtenHtml).toContain("Équipes incluses");
    expect(writtenHtml).toContain("Scénario");
    expect(writtenHtml).toContain("Arrimé (80%)");
    expect(writtenHtml).not.toContain("Ã");
    expect(writtenHtml).not.toContain("Â");
    expect(writtenHtml).not.toContain("�");
  });
  it("uses weeks_to_items effective percentiles for summary risk score", () => {
    let writtenHtml = "";
    const fakeWindow = {
      document: {
        open: vi.fn(),
        write: vi.fn((html: string) => {
          writtenHtml = html;
        }),
        close: vi.fn(),
        getElementById: vi.fn(() => null),
      },
      onload: null as null | (() => void),
      addEventListener: vi.fn(),
    };
    vi.spyOn(window, "open").mockReturnValue(fakeWindow as unknown as Window);

    const args = baseArgs();
    args.sections[0].simulationMode = "weeks_to_items";
    args.scenarios = [
      {
      ...args.scenarios[0],
      percentiles: { P50: 100, P70: 110, P90: 120 },
      distribution: [
        { x: 10, count: 10 },
        { x: 20, count: 80 },
        { x: 30, count: 10 },
      ],
      },
    ];

    exportPortfolioPrintReport(args);

    const effectivePercentiles = buildAtLeastPercentiles(args.scenarios[0].distribution, [50, 70, 90]);
    const expectedRisk = computeRiskScoreFromPercentiles("weeks_to_items", effectivePercentiles);
    const expectedP50 = Number(effectivePercentiles.P50 ?? 0).toFixed(0);
    const expectedP70 = Number(effectivePercentiles.P70 ?? 0).toFixed(0);
    const expectedP90 = Number(effectivePercentiles.P90 ?? 0).toFixed(0);

    expect(writtenHtml).toMatch(
      new RegExp(
        `Optimiste[\\s\\S]*?<td>${expectedP50}</td>\\s*<td>${expectedP70}</td>\\s*<td>${expectedP90}</td>`,
      ),
    );
    expect(writtenHtml).not.toMatch(/Optimiste[\s\S]*?<td>100<\/td>\s*<td>110<\/td>\s*<td>120<\/td>/);
    expect(writtenHtml).toContain(expectedRisk.toFixed(2).replace(".", ","));
  });
});
