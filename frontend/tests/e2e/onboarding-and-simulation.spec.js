import { test, expect } from "@playwright/test";
import istanbulCoverage from "istanbul-lib-coverage";
import v8toIstanbul from "v8-to-istanbul";

let inlineScriptCounter = 0;

async function summarizeCoverageIstanbul(entries) {
  const { createCoverageMap } = istanbulCoverage;
  const map = createCoverageMap({});
  const toStart = (r) => (typeof r.start === "number" ? r.start : r.startOffset);
  const toEnd = (r) => (typeof r.end === "number" ? r.end : r.endOffset);

  for (const entry of entries) {
    let sourceText = typeof entry?.text === "string" ? entry.text : "";
    if (!sourceText && typeof entry?.url === "string" && entry.url.startsWith("http")) {
      try {
        const resp = await fetch(entry.url);
        if (resp.ok) {
          sourceText = await resp.text();
        }
      } catch {
        // Ignore scripts that cannot be fetched.
      }
    }
    if (!sourceText) continue;

    const v8Functions = Array.isArray(entry?.functions) && entry.functions.length > 0
      ? entry.functions
      : [
          {
            functionName: "(root)",
            ranges: Array.isArray(entry?.ranges)
              ? entry.ranges
                  .map((r) => ({
                    startOffset: toStart(r),
                    endOffset: toEnd(r),
                    count: typeof r.count === "number" ? r.count : 0,
                  }))
                  .filter((r) => Number.isFinite(r.startOffset) && Number.isFinite(r.endOffset))
              : [],
            isBlockCoverage: true,
          },
        ];

    if (!v8Functions[0].ranges.length) continue;
    try {
      const syntheticScriptPath = `inline-script-${inlineScriptCounter++}.js`;
      const converter = v8toIstanbul(syntheticScriptPath, 0, {
        source: sourceText,
      });
      await converter.load();
      converter.applyCoverage(v8Functions);
      map.merge(converter.toIstanbul());
    } catch {
      // Ignore malformed/anonymous scripts that cannot be converted.
    }
  }

  const summary = map.getCoverageSummary().toJSON();
  return {
    files: map.files().length,
    statements: summary.statements,
    branches: summary.branches,
    functions: summary.functions,
    lines: summary.lines,
  };
}

test("E2E flow avec couverture JS front", async ({ page }) => {
  await page.route("**/auth/check", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        status: "ok",
        message: "PAT valide (non sauvegarde).",
        user_name: "Garance Richard",
      }),
    });
  });

  await page.route("**/auth/orgs", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        status: "ok",
        orgs: [{ id: "o1", name: "org-demo", account_uri: "https://dev.azure.com/org-demo" }],
      }),
    });
  });

  await page.route("**/auth/projects", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        status: "ok",
        org: "org-demo",
        projects: [{ id: "p1", name: "Projet A" }],
      }),
    });
  });

  await page.route("**/auth/teams", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        status: "ok",
        org: "org-demo",
        project: "Projet A",
        teams: [{ id: "t1", name: "Equipe Alpha" }],
      }),
    });
  });

  await page.route("**/auth/team-options", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        status: "ok",
        done_states: ["Done", "Closed"],
        work_item_types: ["Bug", "User Story"],
        states_by_type: {
          Bug: ["Done"],
          "User Story": ["Closed", "Done"],
        },
      }),
    });
  });

  await page.route("**/forecast", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        team: "Equipe Alpha",
        area_path: "Projet A\\Equipe Alpha",
        mode: "backlog_to_weeks",
        result_kind: "weeks",
        result_percentiles: { P50: 10, P70: 12, P90: 15 },
        result_distribution: [9, 10, 12, 15],
        weekly_throughput: [
          { week: "2026-01-05", throughput: 3 },
          { week: "2026-01-12", throughput: 4 },
        ],
        backlog_size: 120,
        weeks_percentiles: { P50: 10, P70: 12, P90: 15 },
        weeks_distribution: [9, 10, 12, 15],
      }),
    });
  });

  await page.coverage.startJSCoverage({
    resetOnNavigation: false,
    reportAnonymousScripts: true,
  });
  await page.goto("/");

  await page.locator('input[type="password"]').fill("token-value-at-least-20-chars");
  await page.getByRole("button", { name: "Se connecter" }).click();

  await expect(page.getByText("Bienvenue Garance Richard")).toBeVisible();
  await page.getByRole("button", { name: "Choisir cette organisation" }).click();

  await expect(page.getByText("Choix du projet")).toBeVisible();
  await page.getByRole("button", { name: "Choisir ce Projet" }).click();

  await expect(page.getByText("Choix de l'équipe")).toBeVisible();
  await page.getByRole("button", { name: "Choisir cette équipe" }).click();

  await expect(page.getByText("Equipe: Equipe Alpha")).toBeVisible();
  await page.getByLabel("Bug").check();
  await page.getByLabel("Done").check();
  await page.getByRole("button", { name: "Lancer la simulation" }).click();

  await expect(page.getByText("P50")).toBeVisible();
  await expect(page.getByText("10 semaines")).toBeVisible();

  const coverageEntries = await page.coverage.stopJSCoverage();
  const appEntries = coverageEntries.filter((e) => e.url.includes("127.0.0.1:4173"));
  const summary = await summarizeCoverageIstanbul(appEntries);

  console.log(
    `[E2E ISTANBUL] files=${summary.files} statements=${summary.statements.pct}% (${summary.statements.covered}/${summary.statements.total}) branches=${summary.branches.pct}% (${summary.branches.covered}/${summary.branches.total}) functions=${summary.functions.pct}% (${summary.functions.covered}/${summary.functions.total}) lines=${summary.lines.pct}% (${summary.lines.covered}/${summary.lines.total})`,
  );

  expect(summary.files).toBeGreaterThan(0);
  expect(summary.statements.total).toBeGreaterThan(0);
});
