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
  test.setTimeout(90_000);
  let authCheckCalls = 0;
  let authOrgsCalls = 0;
  let projectsCalls = 0;
  let teamsCalls = 0;
  let teamOptionsCalls = 0;
  let forecastCalls = 0;

  await page.route("**/auth/check", async (route) => {
    authCheckCalls += 1;
    if (authCheckCalls === 1) {
      await route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({ detail: "PAT invalide ou non autorise sur Azure DevOps." }),
      });
      return;
    }
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
    authOrgsCalls += 1;
    if (authOrgsCalls >= 3) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          status: "ok",
          orgs: [
            { id: "o1", name: "org-demo", account_uri: "https://dev.azure.com/org-demo" },
            { id: "o2", name: "org-empty", account_uri: "https://dev.azure.com/org-empty" },
          ],
        }),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        status: "ok",
        orgs: [],
      }),
    });
  });

  await page.route("**/auth/projects", async (route) => {
    const body = route.request().postDataJSON();
    const org = body?.org;
    if (org === "org-empty") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          status: "ok",
          org: "org-empty",
          projects: [],
        }),
      });
      return;
    }

    projectsCalls += 1;
    if (projectsCalls === 1) {
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ detail: "Erreur temporaire projets" }),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        status: "ok",
        org: "org-demo",
        projects: [
          { id: "p1", name: "Projet A" },
          { id: "p2", name: "Projet Vide" },
        ],
      }),
    });
  });

  await page.route("**/auth/teams", async (route) => {
    const body = route.request().postDataJSON();
    if (body?.project === "Projet Vide") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          status: "ok",
          org: "org-demo",
          project: "Projet Vide",
          teams: [],
        }),
      });
      return;
    }

    teamsCalls += 1;
    if (teamsCalls === 1) {
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ detail: "Erreur temporaire equipes" }),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        status: "ok",
        org: "org-demo",
        project: "Projet A",
        teams: [
          { id: "t1", name: "Equipe Alpha" },
          { id: "t2", name: "Equipe Beta" },
        ],
      }),
    });
  });

  await page.route("**/auth/team-options", async (route) => {
    teamOptionsCalls += 1;
    if (teamOptionsCalls === 1) {
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ detail: "Erreur options equipe" }),
      });
      return;
    }
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
    forecastCalls += 1;
    if (forecastCalls === 1) {
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ detail: "Erreur forecast temporaire" }),
      });
      return;
    }

    const payload = route.request().postDataJSON();
    const isWeeksToItems = payload?.mode === "weeks_to_items";
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        team: "Equipe Alpha",
        area_path: "Projet A\\Equipe Alpha",
        mode: isWeeksToItems ? "weeks_to_items" : "backlog_to_weeks",
        result_kind: isWeeksToItems ? "items" : "weeks",
        result_percentiles: isWeeksToItems ? { P50: 38, P70: 44, P90: 52 } : { P50: 10, P70: 12, P90: 15 },
        result_distribution: isWeeksToItems ? [35, 38, 44, 52] : [9, 10, 12, 15],
        weekly_throughput: [
          { week: "2026-01-05", throughput: 3 },
          { week: "2026-01-12", throughput: 4 },
        ],
        backlog_size: isWeeksToItems ? undefined : 120,
      }),
    });
  });

  await page.coverage.startJSCoverage({
    resetOnNavigation: false,
    reportAnonymousScripts: true,
  });
  await page.goto("/");

  // Local validation: PAT vide.
  await page.getByRole("button", { name: "Se connecter" }).click();
  await expect(page.getByText("PAT requis pour continuer.")).toBeVisible();

  // API validation error then success.
  await page.locator('input[type="password"]').fill("bad-token");
  await page.getByRole("button", { name: "Se connecter" }).click();
  await expect(page.getByText(/PAT invalide/i)).toBeVisible();

  await page.locator('input[type="password"]').fill("token-value-at-least-20-chars");
  await page.getByRole("button", { name: "Se connecter" }).click();

  await expect(page.getByText("Bienvenue Garance Richard")).toBeVisible();
  await expect(page.getByText(/PAT non global/i)).toBeVisible();
  await page.getByPlaceholder("Nom de l'organisation").fill("org-demo");

  // Projects error branch then retry.
  await page.getByRole("button", { name: "Choisir cette organisation" }).click();
  await expect(page.getByText("Erreur temporaire projets")).toBeVisible();

  // Back to PAT then reconnect to cover back branch.
  await page.getByRole("button", { name: "Changer PAT" }).click();
  await expect(page.getByText("Connexion Azure DevOps")).toBeVisible();
  await page.locator('input[type="password"]').fill("token-value-at-least-20-chars");
  await page.getByRole("button", { name: "Se connecter" }).click();
  await page.getByPlaceholder("Nom de l'organisation").fill("org-demo");
  await page.getByRole("button", { name: "Choisir cette organisation" }).click();

  await expect(page.getByRole("heading", { name: /Choix du projet/i })).toBeVisible();
  await page.getByRole("button", { name: "Choisir ce Projet" }).click();
  await expect(page.getByText("Erreur temporaire equipes")).toBeVisible();

  // Back to org from project, then continue again.
  await page.getByRole("button", { name: "Changer ORG" }).click();
  await page.getByRole("button", { name: "Choisir cette organisation" }).click();
  await page.getByRole("button", { name: "Choisir ce Projet" }).click();

  await expect(page.getByRole("heading", { name: /Choix de/i })).toBeVisible();
  await page.locator("select").first().selectOption("Equipe Beta");
  await page.locator("select").first().selectOption("Equipe Alpha");
  await page.getByRole("button", { name: /Choisir cette/i }).click();

  await expect(page.getByText("Equipe: Equipe Alpha")).toBeVisible();

  // First simulation: forecast error branch.
  await page.getByRole("button", { name: "Lancer la simulation" }).click();
  await expect(page.getByText("Erreur forecast temporaire")).toBeVisible();

  // Toggle work item type on/off to hit both checkbox branches.
  await page.getByLabel("Bug").check();
  await page.getByLabel("Bug").uncheck();
  await page.locator("select").first().selectOption("weeks_to_items");
  await page.locator('input[type="number"]').first().fill("12");
  await page.getByLabel("Bug").check();
  await page.getByRole("button", { name: "Lancer la simulation" }).click();

  await expect(page.getByText("P50")).toBeVisible();
  await expect(page.getByText("38 items")).toBeVisible();
  await page.locator("svg").first().hover({ position: { x: 80, y: 80 } });
  await page.getByRole("button", { name: "Distribution" }).click();
  await page.locator("svg").first().hover({ position: { x: 80, y: 80 } });
  await page.getByRole("button", { name: /Courbe/i }).click();
  await page.locator("svg").first().hover({ position: { x: 80, y: 80 } });
  await page.getByRole("button", { name: "Throughput" }).click();
  await page.locator("svg").first().hover({ position: { x: 80, y: 80 } });

  // Re-enter simulation to trigger team-options success branch after initial failure.
  await page.getByRole("button", { name: /Changer equipe|Changer/i }).click();
  await expect(page.getByRole("heading", { name: /Choix de/i })).toBeVisible();
  await page.getByRole("button", { name: /Choisir cette/i }).click();
  await expect(page.getByText("Equipe: Equipe Alpha")).toBeVisible();

  // Second simulation mode to cover backlog_to_weeks branch.
  await page.locator("select").first().selectOption("backlog_to_weeks");
  await page.locator('input[type="number"]').first().fill("120");
  await page.getByLabel("Bug").check();
  await page.getByRole("button", { name: "Lancer la simulation" }).click();
  await expect(page.getByText("10 semaines")).toBeVisible();

  // Back from simulation and disconnect.
  await page.getByRole("button", { name: /Changer equipe|Changer/i }).click();
  await expect(page.getByRole("heading", { name: /Choix de/i })).toBeVisible();
  await page.getByRole("button", { name: /Se d.*connecter/i }).click();
  await expect(page.getByText("Connexion Azure DevOps")).toBeVisible();

  // Second pass: org list branch + PAT submit with Enter.
  await page.locator('input[type="password"]').fill("token-value-at-least-20-chars");
  await page.locator('input[type="password"]').press("Enter");
  await expect(page.getByText("Bienvenue Garance Richard")).toBeVisible();
  await expect(page.getByText(/Organisations accessibles/i)).toBeVisible();
  await page.locator("select").first().selectOption("org-empty");
  await page.getByRole("button", { name: "Choisir cette organisation" }).click();
  await expect(page.getByRole("button", { name: "Choisir ce Projet" })).toBeDisabled();
  await page.getByRole("button", { name: "Changer ORG" }).click();
  await page.locator("select").first().selectOption("org-demo");
  await page.getByRole("button", { name: "Choisir cette organisation" }).click();
  await page.locator("select").first().selectOption("Projet Vide");
  await page.getByRole("button", { name: "Choisir ce Projet" }).click();
  await expect(page.getByRole("button", { name: /Choisir cette/i })).toBeDisabled();
  await page.getByRole("button", { name: /Changer projet/i }).click();
  await page.locator("select").first().selectOption("Projet A");
  await page.getByRole("button", { name: "Choisir ce Projet" }).click();
  await page.locator("select").first().selectOption("Equipe Beta");
  await page.locator("select").first().selectOption("Equipe Alpha");
  await page.getByRole("button", { name: /Choisir cette/i }).click();
  await page.getByLabel("Bug").check();
  await page.getByLabel("User Story").check();
  await page.getByLabel("User Story").uncheck();
  await page.getByRole("button", { name: "Lancer la simulation" }).click();
  await expect(page.getByText("10 semaines")).toBeVisible();

  // Theme toggle branch.
  await page.locator("button[title*='Passer en mode']").click();

  const coverageEntries = await page.coverage.stopJSCoverage();
  const appEntries = coverageEntries.filter((e) => {
    if (!e?.url) return false;
    return e.url.includes("127.0.0.1:4173/src/");
  });
  const summary = await summarizeCoverageIstanbul(appEntries);

  console.log(
    `[E2E ISTANBUL] files=${summary.files} statements=${summary.statements.pct}% (${summary.statements.covered}/${summary.statements.total}) branches=${summary.branches.pct}% (${summary.branches.covered}/${summary.branches.total}) functions=${summary.functions.pct}% (${summary.functions.covered}/${summary.functions.total}) lines=${summary.lines.pct}% (${summary.lines.covered}/${summary.lines.total})`,
  );

  expect(summary.files).toBeGreaterThan(0);
  expect(summary.statements.total).toBeGreaterThan(0);
  expect(summary.statements.pct).toBeGreaterThanOrEqual(80);
  expect(summary.branches.pct).toBeGreaterThanOrEqual(80);
  expect(summary.functions.pct).toBeGreaterThanOrEqual(80);
  expect(summary.lines.pct).toBeGreaterThanOrEqual(80);
});
