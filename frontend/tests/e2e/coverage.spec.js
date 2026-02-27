import { test, expect } from "@playwright/test";
import { summarizeCoverageIstanbul } from "./helpers/coverage";
import { setupAppRoutes } from "./helpers/mocks";

test.describe("e2e istanbul coverage", () => {
  test.describe.configure({ mode: "serial" });

  const allCoverageEntries = [];

  const openIfCollapsed = async (section) => {
    const button = section.getByRole("button", { name: /D.+velopper/i });
    if (await button.isVisible().catch(() => false)) {
      await button.click();
    }
  };

  const closeIfExpanded = async (section) => {
    const button = section.getByRole("button", { name: /R.+duire/i });
    if (await button.isVisible().catch(() => false)) {
      await button.click();
    }
  };

  const toggleThemeRoundTrip = async (page) => {
    const toggle = page.locator("button[title*='Passer en mode']");
    await toggle.click();
    await toggle.click();
  };

  test.beforeEach(async ({ page }) => {
    await page.coverage.startJSCoverage({
      resetOnNavigation: false,
      reportAnonymousScripts: true,
    });
  });

  test.afterEach(async ({ page }) => {
    const coverageEntries = await page.coverage.stopJSCoverage();
    const appEntries = coverageEntries.filter((e) => e?.url && e.url.includes("127.0.0.1:4173/src/"));
    allCoverageEntries.push(...appEntries);
  });

  test.afterAll(async () => {
    const summary = await summarizeCoverageIstanbul(allCoverageEntries);

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

  test("coverage: flux complet front", async ({ page }) => {
    test.setTimeout(90_000);
    const { closedDates } = await setupAppRoutes(page, {
      profileFirstUnauthorized: true,
      emptyAccountsBefore: 2,
      projectsFirstError: true,
      teamsFirstError: true,
      teamOptionsFirstError: true,
      teamFieldValuesFirstError: true,
      wiqlFirstEmpty: true,
      simulateFirstError: true,
    });

    await page.goto("/");

    await page.getByRole("button", { name: "Se connecter" }).click();
    await expect(page.getByText("PAT requis pour continuer.")).toBeVisible();

    await page.locator('input[type="password"]').fill("bad-token");
    await page.getByRole("button", { name: "Se connecter" }).click();
    await expect(page.getByText(/PAT invalide/i)).toBeVisible();

    await page.locator('input[type="password"]').fill("token-value-at-least-20-chars");
    await page.getByRole("button", { name: "Se connecter" }).click();
    await expect(page.getByRole("heading", { name: /^Bienvenue/ })).toBeVisible();
    await expect(page.getByPlaceholder("Nom de l'organisation")).toBeVisible();
    await expect(page.getByText(/PAT local|Verification automatique impossible/i)).toBeVisible();
    await page.getByPlaceholder("Nom de l'organisation").fill("org-demo");

    await page.getByRole("button", { name: "Choisir cette organisation" }).click();
    await expect(page.getByText(/(HTTP 500|chargement des projets|Organisation "org-demo" inaccessible)/i)).toBeVisible();

    await page.getByRole("button", { name: /1\.\s+Connexion/i }).click();
    await expect(page.getByText("Connexion Azure DevOps")).toBeVisible();
    await page.locator('input[type="password"]').fill("token-value-at-least-20-chars");
    await page.getByRole("button", { name: "Se connecter" }).click();
    await page.getByPlaceholder("Nom de l'organisation").fill("org-demo");
    await page.getByRole("button", { name: "Choisir cette organisation" }).click();

    await expect(page.getByRole("heading", { name: /Choix du projet/i })).toBeVisible();
    await page.getByRole("button", { name: "Choisir ce Projet" }).click();
    await expect(page.getByText(/(HTTP 500|chargement des equipes|Impossible de lister les [Ã©e]quipes)/i)).toBeVisible();
    await page.getByRole("button", { name: "Choisir ce Projet" }).click();

    await page.locator("select").first().selectOption("Equipe Alpha");
    await page.getByRole("button", { name: /Choisir cette/i }).click();
    await expect(page.getByTestId("selected-team-name")).toHaveText("Equipe Alpha");

    const periodSection = page.locator("section.sim-control-section").nth(0);
    const modeSection = page.locator("section.sim-control-section").nth(1);
    const filtersSection = page.locator("section.sim-control-section").nth(2);

    await openIfCollapsed(periodSection);
    await page.locator('input[type="date"]').first().fill(closedDates[closedDates.length - 1].slice(0, 10));
    await page.locator('input[type="date"]').nth(1).fill(closedDates[0].slice(0, 10));
    await openIfCollapsed(filtersSection);
    await page.getByLabel("Bug").check();
    await page.getByLabel("Done").check();

    await page.getByRole("button", { name: "Lancer la simulation" }).click();
    await expect(page.getByText(/Historique insuffisant/i)).toBeVisible();

    await openIfCollapsed(modeSection);
    await page.getByLabel(/Inclure les semaines.*0/i).check();
    await expect(page.getByText("Erreur simulation temporaire")).toBeVisible({ timeout: 10_000 });

    await openIfCollapsed(filtersSection);
    await page.getByLabel("Bug").check();
    await page.getByLabel("Done").check();
    await openIfCollapsed(modeSection);
    await page.locator("select").first().selectOption("weeks_to_items");
    await page.locator('input[type="number"]').first().fill("12");
    await closeIfExpanded(modeSection);
    await page.getByRole("button", { name: "Lancer la simulation" }).click();
    await expect(page.getByText("38 items")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/Mode:\s*0\s*incluses/i)).toBeVisible();

    await openIfCollapsed(modeSection);
    await page.getByLabel(/Inclure les semaines.*0/i).uncheck();
    await page.getByRole("tab", { name: "Distribution" }).click();
    await page.getByRole("tab", { name: /Probabilit/i }).click();
    await page.getByRole("tab", { name: "Throughput" }).click();

    await openIfCollapsed(modeSection);
    await page.locator("select").first().selectOption("backlog_to_weeks");
    await page.locator('input[type="number"]').first().fill("120");
    await closeIfExpanded(modeSection);
    await expect(page.getByText("10 sem")).toBeVisible({ timeout: 10_000 });

    await page.getByRole("button", { name: /Se d.*connecter/i }).click();
    await expect(page.getByText("Connexion Azure DevOps")).toBeVisible();

    await page.locator('input[type="password"]').fill("token-value-at-least-20-chars");
    await page.locator('input[type="password"]').press("Enter");
    await expect(page.getByRole("heading", { name: /^Bienvenue/ })).toBeVisible();
    const hasOrgSelect = await page.getByText(/Organisations accessibles/i).isVisible().catch(() => false);
    if (!hasOrgSelect) {
      await page.getByRole("button", { name: /1\.\s+Connexion/i }).click();
      await page.locator('input[type="password"]').fill("token-value-at-least-20-chars");
      await page.getByRole("button", { name: "Se connecter" }).click();
      await expect(page.getByText(/Organisations accessibles/i)).toBeVisible();
    }

    await page.locator("select").first().selectOption("org-empty");
    await page.getByRole("button", { name: "Choisir cette organisation" }).click();
    await expect(page.getByRole("button", { name: "Choisir ce Projet" })).toBeDisabled();

    await page.getByRole("button", { name: /2\.\s+Organisation/i }).click();
    await page.locator("select").first().selectOption("org-demo");
    await page.getByRole("button", { name: "Choisir cette organisation" }).click();
    await page.locator("select").first().selectOption("Projet Vide");
    await page.getByRole("button", { name: "Choisir ce Projet" }).click();
    await expect(page.getByRole("button", { name: /Choisir cette/i })).toBeDisabled();

    await page.getByRole("button", { name: /3\.\s+Projet/i }).click();
    await page.locator("select").first().selectOption("Projet A");
    await page.getByRole("button", { name: "Choisir ce Projet" }).click();
    await page.locator("select").first().selectOption("Equipe Alpha");
    await page.getByRole("button", { name: /Choisir cette/i }).click();
    await expect(page.getByTestId("selected-team-name")).toHaveText("Equipe Alpha");

    const filtersToggle = filtersSection.getByRole("button", { name: /D.+velopper/i });
    if (await filtersToggle.isVisible().catch(() => false)) {
      await filtersToggle.click();
    }
    await page.getByLabel("Bug").check();
    await page.getByLabel("Done").check();
    await page.getByLabel("User Story").check();
    await page.getByLabel("User Story").uncheck();
    await page.getByRole("button", { name: /Changer.*quipe/i }).click();
    await page.locator("select").first().selectOption("Equipe Beta");
    await page.getByRole("button", { name: /Choisir cette/i }).click();
    await expect(page.getByTestId("selected-team-name")).toHaveText("Equipe Beta");

    await openIfCollapsed(filtersSection);
    await page.getByLabel("Bug").check();
    await page.getByLabel("Done").check();
    await page.getByRole("button", { name: "Lancer la simulation" }).click();
    await expect(page.getByText("10 sem")).toBeVisible({ timeout: 10_000 });

    await toggleThemeRoundTrip(page);

    await page.evaluate(async () => {
      const mod = await import("/src/hooks/probability.ts");
      mod.buildProbabilityCurve([], "weeks");
      mod.buildProbabilityCurve([{ x: 1, count: 0 }], "items");
      mod.buildAtLeastPercentiles([], [50, 70, 90]);
      mod.buildAtLeastPercentiles([{ x: 1, count: 0 }], [50, 70, 90]);

      const dateMod = await import("/src/date.ts");
      dateMod.formatDateLocal(new Date("2026-02-26T12:00:00.000Z"));
      dateMod.today();
      dateMod.nWeeksAgo(4);

      const simulationMod = await import("/src/utils/simulation.ts");
      simulationMod.computeRiskScoreFromPercentiles("backlog_to_weeks", { P50: 0, P90: 4 });
      simulationMod.computeRiskScoreFromPercentiles("backlog_to_weeks", { P50: 10, P90: 14 });
      simulationMod.computeRiskScoreFromPercentiles("weeks_to_items", { P50: 12, P90: 9 });
      const baseResponse = {
        result_kind: "weeks",
        result_percentiles: { P50: 8, P70: 10, P90: 14 },
        risk_score: 0.2,
        result_distribution: [{ x: 8, count: 10 }],
        samples_count: 6,
      };
      simulationMod.applyCapacityReductionToResult(baseResponse, "backlog_to_weeks", 0, 100, 0);
      simulationMod.applyCapacityReductionToResult(baseResponse, "backlog_to_weeks", 0, 70, 6);
      simulationMod.applyCapacityReductionToResult(
        {
          ...baseResponse,
          result_kind: "items",
          result_distribution: [{ x: 50, count: 8 }],
        },
        "weeks_to_items",
        12,
        70,
        6,
      );

      const adoErrorMod = await import("/src/adoErrors.ts");
      adoErrorMod.formatAdoHttpErrorMessage(401, { operation: "profile" });
      adoErrorMod.formatAdoHttpErrorMessage(403, { operation: "projects", requiredScopes: [] });
      adoErrorMod.formatAdoHttpErrorMessage(404, { operation: "teams", org: "org" });
      adoErrorMod.formatAdoHttpErrorMessage(404, { operation: "teams", org: "org", project: "proj" });
      adoErrorMod.formatAdoHttpErrorMessage(404, { operation: "teams", org: "org", project: "proj", team: "alpha" });
      adoErrorMod.formatAdoHttpErrorMessage(429, { operation: "wiql" });
      adoErrorMod.formatAdoHttpErrorMessage(500, { operation: "throughput" });
      adoErrorMod.formatAdoHttpErrorMessage(503, { operation: "throughput" }, "Service Unavailable");
      adoErrorMod.formatAdoHttpErrorMessage(418, { operation: "other" });
      adoErrorMod.toAdoHttpError(new Response("{}", { status: 401, statusText: "Unauthorized" }), { operation: "profile" });
      adoErrorMod.toAdoNetworkError(new Error("boom"), { operation: "fetch" });
      adoErrorMod.toAdoNetworkError("boom", { operation: "fetch" });

      const teamSortMod = await import("/src/utils/teamSort.ts");
      teamSortMod.sortTeams([{ name: "Equipe B-2" }, { name: "Equipe A-1" }, { name: "Équipe A-3" }]);

      const mathMod = await import("/src/utils/math.ts");
      mathMod.toSafeNumber("12.5", 0);
      mathMod.toSafeNumber("not-a-number", 7);
      mathMod.clamp(-5, 0, 10);
      mathMod.clamp(50, 0, 10);

      const storageMod = await import("/src/storage.ts");
      storageMod.storageSetItem("mc-e2e-key", "value");
      storageMod.storageGetItem("mc-e2e-key");
      storageMod.storageRemoveItem("mc-e2e-key");

      const storageProto = Object.getPrototypeOf(window.localStorage);
      const originalGetItem = storageProto.getItem;
      const originalSetItem = storageProto.setItem;
      const originalRemoveItem = storageProto.removeItem;
      try {
        storageProto.getItem = () => {
          throw new Error("forced getItem error");
        };
        storageProto.setItem = () => {
          throw new Error("forced setItem error");
        };
        storageProto.removeItem = () => {
          throw new Error("forced removeItem error");
        };
        storageMod.storageGetItem("mc-e2e-key");
        storageMod.storageSetItem("mc-e2e-key", "value");
        storageMod.storageRemoveItem("mc-e2e-key");
      } finally {
        storageProto.getItem = originalGetItem;
        storageProto.setItem = originalSetItem;
        storageProto.removeItem = originalRemoveItem;
      }

      const clientIdMod = await import("/src/clientId.ts");
      document.cookie = "IDMontecarlo=123e4567-e89b-42d3-a456-426614174000; path=/";
      clientIdMod.ensureMontecarloClientCookie();
      document.cookie = "IDMontecarlo=invalid; path=/";
      clientIdMod.ensureMontecarloClientCookie();

      const selectTopMod = await import("/src/utils/selectTopStart.ts");
      const selectEl = document.createElement("select");
      selectEl.scrollTop = 200;
      selectTopMod.keepSelectDropdownAtTop({ currentTarget: selectEl });

      const chartSvgMod = await import("/src/components/steps/simulationChartsSvg.ts");
      chartSvgMod.renderThroughputChart([]);
      chartSvgMod.renderThroughputChart([{ week: "2026-W01", throughput: 0, movingAverage: 0 }]);
      chartSvgMod.renderThroughputChart([
        { week: "<W1>", throughput: Number.NaN, movingAverage: 120 },
        { week: "W2", throughput: 18.456, movingAverage: 11.25 },
      ]);
      chartSvgMod.renderDistributionChart([]);
      chartSvgMod.renderDistributionChart([{ x: 1, count: 2, gauss: 1.5 }]);
      chartSvgMod.renderDistributionChart([
        { x: 1, count: 200, gauss: 180 },
        { x: 2, count: 10.52, gauss: 11.1 },
      ]);
      chartSvgMod.renderProbabilityChart([]);
      chartSvgMod.renderProbabilityChart([{ x: 1, probability: 120 }]);

      const originalFetch = window.fetch.bind(window);
      const calls = [];
      window.fetch = async (url, init) => {
        calls.push({ url: String(url), method: init?.method || "GET" });
        if (String(url).includes("/simulate")) {
          return new Response(
            JSON.stringify({ detail: "bad payload" }),
            { status: 400, headers: { "content-type": "application/json" } },
          );
        }
        if (calls.length % 2 === 0) {
          return new Response("not-json", { status: 200, headers: { "content-type": "text/plain" } });
        }
        return new Response(JSON.stringify({ hello: "world" }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      };

      try {
        const apiMod = await import("/src/api.ts");
        await apiMod.postSimulate({
          throughput_samples: [1, 2, 3, 4, 5, 6],
          mode: "backlog_to_weeks",
          backlog_size: 10,
          n_sims: 2000,
        }).catch(() => null);
        await apiMod.getSimulationHistory();
        await apiMod.getSimulationHistory();
      } finally {
        window.fetch = originalFetch;
      }
    });
  });

  test("coverage: org listee + stepper retour", async ({ page }) => {
    test.setTimeout(45_000);
    await setupAppRoutes(page, {
      profileFirstUnauthorized: false,
      emptyAccountsBefore: 0,
      projectsFirstError: false,
      teamsFirstError: false,
    });

    await page.goto("/");
    await toggleThemeRoundTrip(page);

    await page.locator('input[type="password"]').fill("token-value-at-least-20-chars");
    await page.getByRole("button", { name: "Se connecter" }).click();
    await expect(page.getByText(/Organisations accessibles/i)).toBeVisible();

    await page.locator("select").first().selectOption("org-demo");
    await page.getByRole("button", { name: "Choisir cette organisation" }).click();
    await expect(page.getByRole("heading", { name: /Choix du projet/i })).toBeVisible();

    await page.getByRole("button", { name: /2\.\s+Organisation/i }).click();
    await expect(page.getByText(/Organisations accessibles/i)).toBeVisible();

    await page.getByRole("button", { name: /1\.\s+Connexion/i }).click();
    await expect(page.getByText("Connexion Azure DevOps")).toBeVisible();

    await page.locator('input[type="password"]').fill("token-value-at-least-20-chars");
    await page.getByRole("button", { name: "Se connecter" }).click();
    await expect(page.getByText(/Organisations accessibles/i)).toBeVisible();

    await page.locator("select").first().selectOption("org-demo");
    await page.getByRole("button", { name: "Choisir cette organisation" }).click();
    await page.locator("select").first().selectOption("Projet A");
    await page.getByRole("button", { name: "Choisir ce Projet" }).click();
    await page.locator("select").first().selectOption("Equipe Alpha");
    await page.getByRole("button", { name: /Choisir cette/i }).click();
    await expect(page.getByTestId("selected-team-name")).toHaveText("Equipe Alpha");
  });
});



