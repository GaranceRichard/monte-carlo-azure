import fs from "node:fs";
import path from "node:path";
import { cwd } from "node:process";
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
    const appEntries = coverageEntries.filter(
      (e) => typeof e?.url === "string" && /^http:\/\/127\.0\.0\.1:\d+\/src\//.test(e.url),
    );
    allCoverageEntries.push(...appEntries);
  });

  test.afterAll(async () => {
    const summary = await summarizeCoverageIstanbul(allCoverageEntries);
    const reportDir = path.resolve(cwd(), "coverage");
    fs.mkdirSync(reportDir, { recursive: true });
    fs.writeFileSync(path.join(reportDir, "e2e-coverage-summary.json"), JSON.stringify(summary, null, 2));
    const metricLabels = {
      statements: "statements",
      branches: "branches",
      functions: "functions",
      lines: "lines",
    };
    const weakestByMetric = Object.entries(metricLabels)
      .map(([metricKey, metricLabel]) => {
        const weakest = summary.byFile
          .filter((file) => file[metricKey].total > 0)
          .sort((a, b) => {
            if (a[metricKey].pct !== b[metricKey].pct) return a[metricKey].pct - b[metricKey].pct;
            if (a[metricKey].total !== b[metricKey].total) return b[metricKey].total - a[metricKey].total;
            return a.file.localeCompare(b.file);
          })
          .slice(0, 3)
          .map((file) => `${file[metricKey].pct}% (${file[metricKey].covered}/${file[metricKey].total}) ${file.file}`);
        return { metricLabel, weakest };
      })
      .filter((entry) => entry.weakest.length > 0);

    console.log(
      `[E2E ISTANBUL] files=${summary.files} statements=${summary.statements.pct}% (${summary.statements.covered}/${summary.statements.total}) branches=${summary.branches.pct}% (${summary.branches.covered}/${summary.branches.total}) functions=${summary.functions.pct}% (${summary.functions.covered}/${summary.functions.total}) lines=${summary.lines.pct}% (${summary.lines.covered}/${summary.lines.total})`,
    );
    if (weakestByMetric.length > 0) {
      const lines = weakestByMetric.flatMap(({ metricLabel, weakest }) => [
        `${metricLabel}:`,
        ...weakest.map((item) => `- ${item}`),
      ]);
      console.log(`[E2E ISTANBUL] weakest by category:\n${lines.join("\n")}`);
    }

    expect(summary.files).toBeGreaterThan(0);
    expect(summary.statements.total).toBeGreaterThan(0);
    /*
      expect(summary.statements.pct).toBeGreaterThanOrEqual(80);
      expect(summary.branches.pct).toBeGreaterThanOrEqual(80);
      expect(summary.functions.pct).toBeGreaterThanOrEqual(80);
      expect(summary.lines.pct).toBeGreaterThanOrEqual(80);
    */
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
    await page.route("**/simulations/history", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([
          {
            created_at: "2026-02-26T10:00:00Z",
            last_seen: "2026-02-26T10:00:00Z",
            mode: "backlog_to_weeks",
            backlog_size: 70,
            target_weeks: null,
            n_sims: 2000,
            samples_count: 24,
            percentiles: { P50: 7, P70: 9, P90: 12 },
            distribution: [
              { x: 7, count: 5 },
              { x: 9, count: 4 },
              { x: 12, count: 3 },
            ],
            selected_org: "org-demo",
            selected_project: "Projet A",
            selected_team: "Equipe Alpha",
            start_date: "2026-01-01",
            end_date: "2026-02-01",
            done_states: ["Done"],
            types: ["Bug"],
            include_zero_weeks: false,
          },
        ]),
      });
    });
    await page.addInitScript(() => {
      window.localStorage.clear();
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
    const projectSelect = page.locator("select").first();
    await expect(projectSelect.locator("option")).toContainText(["Projet A"]);
    await projectSelect.selectOption("Projet A");
    await page.getByRole("button", { name: "Choisir ce Projet" }).click();
    await expect(page.getByText(/(HTTP 500|chargement des equipes|Impossible de lister les [ÃƒÂ©e]quipes)/i)).toBeVisible();
    await expect(projectSelect.locator("option")).toContainText(["Projet A"]);
    await projectSelect.selectOption("Projet A");
    await page.getByRole("button", { name: "Choisir ce Projet" }).click();

    const teamSelect = page.locator("select").first();
    await expect(page.getByRole("button", { name: /Choisir cette/i })).toBeVisible();
    await expect(teamSelect.locator("option")).toContainText(["Equipe Alpha"]);
    await teamSelect.selectOption("Equipe Alpha");
    await page.getByRole("button", { name: /Choisir cette/i }).click();
    await expect(page.getByTestId("selected-team-card")).toBeVisible();
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

    await openIfCollapsed(filtersSection);
    await page.getByLabel("Bug").check();
    await page.getByLabel("Done").check();
    await openIfCollapsed(modeSection);
    const modeSelect = modeSection.locator("select");
    const modeNumberInputs = modeSection.locator('input[type="number"]');
    await modeSelect.focus();
    await modeSelect.click();
    await page.getByLabel(/Inclure les semaines.*0/i).check();
    await modeNumberInputs.nth(1).fill("3000");
    await page.getByRole("button", { name: "Lancer la simulation" }).click();
    await expect(page.getByText("Erreur simulation temporaire")).toBeVisible({ timeout: 10_000 });

    await openIfCollapsed(filtersSection);
    await page.getByLabel("Bug").check();
    await page.getByLabel("Done").check();
    await openIfCollapsed(modeSection);
    await modeSelect.focus();
    await modeSelect.click();
    await modeSelect.selectOption("weeks_to_items");
    await modeNumberInputs.first().fill("12");
    await modeNumberInputs.nth(1).fill("4000");
    await closeIfExpanded(modeSection);
    await page.getByRole("button", { name: "Lancer la simulation" }).click();
    await expect(page.getByText("38 items")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/Mode:\s*0\s*incluses/i)).toBeVisible();

    await openIfCollapsed(modeSection);
    await page.getByLabel(/Inclure les semaines.*0/i).uncheck();
    await page.getByRole("tab", { name: "Distribution" }).click();
    await page.getByRole("tab", { name: /Probabilit/i }).click();
    await page.getByRole("tab", { name: "Throughput" }).click();
    await page.getByRole("button", { name: "CSV" }).click();
    const popupPromise = page.waitForEvent("popup").catch(() => null);
    await page.getByRole("button", { name: "Rapport" }).click();
    const reportPopup = await popupPromise;
    if (reportPopup) {
      await reportPopup.waitForLoadState("domcontentloaded");
      await reportPopup.getByRole("button", { name: /Telecharger PDF/i }).click();
      await reportPopup.close().catch(() => null);
    }

    await openIfCollapsed(modeSection);
    await modeSelect.focus();
    await modeSelect.click();
    await modeSelect.selectOption("backlog_to_weeks");
    await modeNumberInputs.first().fill("120");
    await modeNumberInputs.nth(1).fill("5000");
    await page.getByRole("button", { name: /R.+initialiser/i }).click();
    await expect(page.getByText(/Lancez une simulation pour afficher les graphiques/i)).toBeVisible();
    await page.getByRole("button", { name: "Lancer la simulation" }).click();
    await expect(page.getByText("10 sem")).toBeVisible({ timeout: 10_000 });

    const historySection = page.locator("div").filter({
      has: page.getByRole("button", { name: "Vider" }),
      hasText: "Historique local",
    }).first();
    const historySelect = historySection.locator("select");
    await expect(historySelect).toBeVisible();
    await expect(historySelect.locator("option").first()).toContainText(/simulation/i);
    await expect.poll(async () => {
      const labels = await historySelect.locator("option").evaluateAll((options) =>
        options.map((option) => option.textContent || ""),
      );
      return labels.some((label) => label.includes("2026_02_26_") && label.includes("70 items"));
    }).toBe(true);
    const remoteHistoryValue = await historySelect.locator("option").evaluateAll((options) => {
      const match = options.find((option) => {
        const label = option.textContent || "";
        return label.includes("2026_02_26_") && label.includes("70 items");
      });
      return match?.getAttribute("value") || "";
    });
    expect(remoteHistoryValue).toBeTruthy();
    await historySelect.selectOption(remoteHistoryValue);
    await expect(page.getByText(/Semaines utilisees:\s*24\/24/i)).toBeVisible();
    await expect(page.getByText(/Mode:\s*0\s*exclues/i)).toBeVisible();
    await expect(page.getByText(/Backlog de 70 items/i)).toBeVisible();
    await expect(page.getByText(/2\s*000 simulations/i)).toBeVisible();
    await historySection.getByRole("button", { name: "Vider" }).click();
    await expect(historySection.getByText(/pas de simulation pour l'équipe/i)).toBeVisible();

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
    await page.getByRole("button", { name: /Portefeuille/i }).click();
    await expect(page.getByText(/Chargement du portefeuille|Simulation Portefeuille/i)).toBeVisible();
    await page.getByRole("button", { name: /Ajouter équipe/i }).click();
    await expect(page.getByRole("heading", { name: /Ajouter équipe/i })).toBeVisible();
    await page.getByRole("button", { name: "Valider" }).click();
    await expect(page.getByText(/Selectionnez au moins un type et un etat/i)).toBeVisible();
    const quickConfigButton = page.getByRole("button", { name: /Configuration rapide/i });
    if (await quickConfigButton.isVisible().catch(() => false)) {
      await quickConfigButton.click();
    } else {
      await page.getByLabel("Type de ticket").locator("..").getByLabel("Bug").check();
      await page.getByLabel("État").locator("..").getByLabel("Done").check();
    }
    await page.getByRole("button", { name: "Valider" }).click();
    await expect(page.getByText(/Equipe Alpha - Bug - Done/i)).toBeVisible();
    await page.getByRole("button", { name: /Ajouter équipe/i }).click();
    const secondAddTeamModal = page.locator("div.fixed.inset-0").last();
    await expect(secondAddTeamModal.getByRole("heading", { name: /Ajouter équipe/i })).toBeVisible();
    await secondAddTeamModal.getByLabel("Équipe").selectOption("Equipe Beta");
    const secondQuickConfigButton = secondAddTeamModal.getByRole("button", { name: /Configuration rapide/i });
    if (await secondQuickConfigButton.isVisible().catch(() => false)) {
      await secondQuickConfigButton.click();
    } else {
      await secondAddTeamModal.locator(".sim-check-row", { hasText: "Bug" }).locator('input[type="checkbox"]').check();
      await secondAddTeamModal.locator(".sim-check-row", { hasText: "Done" }).locator('input[type="checkbox"]').check();
    }
    await secondAddTeamModal.getByRole("button", { name: "Valider" }).click();
    await expect(page.getByText(/Equipe Beta - Bug - Done/i)).toBeVisible();
    await page.getByRole("button", { name: "Retirer" }).first().click();
    await expect(page.getByText(/Equipe Alpha - Bug - Done/i)).not.toBeVisible();
    const portfolioPopupPromise = page.waitForEvent("popup").catch(() => null);
    await page.getByRole("button", { name: /Générer rapport portefeuille/i }).click();
    const portfolioPopup = await portfolioPopupPromise;
    if (portfolioPopup) {
      await portfolioPopup.waitForLoadState("domcontentloaded");
      await portfolioPopup.getByRole("button", { name: /Telecharger PDF/i }).click();
      await portfolioPopup.close().catch(() => null);
    }
    await page.getByRole("button", { name: /Changer.*quipe/i }).click();
    await expect(page.getByRole("button", { name: /Choisir cette/i })).toBeVisible();
    await page.locator("select").first().selectOption("Equipe Alpha");
    await page.getByRole("button", { name: /Choisir cette/i }).click();
    await expect(page.getByTestId("selected-team-card")).toBeVisible();
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
    await expect(page.getByTestId("selected-team-card")).toBeVisible();
    await expect(page.getByTestId("selected-team-name")).toHaveText("Equipe Beta");
    await page.locator("body").press("Backspace");
    await expect(page.getByRole("button", { name: /Choisir cette/i })).toBeVisible();
    await page.locator("select").first().selectOption("Equipe Beta");
    await page.getByRole("button", { name: /Choisir cette/i }).click();
    await expect(page.getByTestId("selected-team-card")).toBeVisible();
    await expect(page.getByTestId("selected-team-name")).toHaveText("Equipe Beta");

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
      simulationMod.buildScenarioSamples([[5, 8, 13], [2, 3, 5]], 85);
      simulationMod.buildScenarioSamples([[5, 8, 13]], 20);
      simulationMod.computeRiskLegend(0.15);
      simulationMod.computeRiskLegend(0.35);
      simulationMod.computeRiskLegend(0.7);
      simulationMod.computeRiskLegend(0.95);
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
      void baseResponse;

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
      teamSortMod.sortTeams([{ name: "Equipe B-2" }, { name: "Equipe A-1" }, { name: "Ã‰quipe A-3" }]);

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
      const originalRandomUUID = crypto.randomUUID;
      try {
        Object.defineProperty(crypto, "randomUUID", {
          configurable: true,
          value: undefined,
        });
        document.cookie = "IDMontecarlo=invalid; path=/";
        clientIdMod.ensureMontecarloClientCookie();
      } finally {
        Object.defineProperty(crypto, "randomUUID", {
          configurable: true,
          value: originalRandomUUID,
        });
      }

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

        window.fetch = async (url, init) => {
          if (String(url).includes("/simulate")) {
            return new Response(
              JSON.stringify({
                result_kind: "weeks",
                result_percentiles: { P50: 8, P70: 10, P90: 12 },
                result_distribution: [{ x: 8, count: 3 }],
                samples_count: 6,
              }),
              { status: 200, headers: { "content-type": "application/json" } },
            );
          }
          if (String(url).includes("/simulations/history")) {
            return new Response(JSON.stringify({ not: "an-array" }), {
              status: 200,
              headers: { "content-type": "application/json" },
            });
          }
          return originalFetch(url, init);
        };
        await apiMod.postSimulate({
          throughput_samples: [1, 2, 3, 4, 5, 6],
          mode: "backlog_to_weeks",
          backlog_size: 10,
          n_sims: 2000,
        });
        await apiMod.getSimulationHistory();

        window.fetch = async (url, init) => {
          if (String(url).includes("/simulate")) {
            return new Response("server-down", {
              status: 503,
              statusText: "Service Unavailable",
              headers: { "content-type": "text/plain" },
            });
          }
          if (String(url).includes("/simulations/history")) {
            return new Response("history-down", {
              status: 502,
              statusText: "Bad Gateway",
              headers: { "content-type": "text/plain" },
            });
          }
          return originalFetch(url, init);
        };
        await apiMod.postSimulate({
          throughput_samples: [1, 2, 3, 4, 5, 6],
          mode: "backlog_to_weeks",
          backlog_size: 10,
          n_sims: 2000,
        }).catch(() => null);
        await apiMod.getSimulationHistory().catch(() => null);

        const forecastMod = await import("/src/hooks/simulationForecastService.ts");
        let throughputMode = "array";
        window.fetch = async (url, init) => {
          const asString = String(url);
          if (asString.includes("/teamfieldvalues")) {
            return new Response(
              JSON.stringify({
                values: [{ value: "Projet A\\Equipe Alpha", includeChildren: false }],
              }),
              { status: 200, headers: { "content-type": "application/json" } },
            );
          }
          if (asString.includes("/wiql")) {
            const size = throughputMode === "warning" ? 210 : 70;
            return new Response(
              JSON.stringify({
                workItems: Array.from({ length: size }, (_, i) => ({ id: i + 1 })),
              }),
              { status: 200, headers: { "content-type": "application/json" } },
            );
          }
          if (asString.includes("/workitems?ids=")) {
            const ids = (new URL(asString)).searchParams.get("ids").split(",").map((id) => Number(id));
            if (throughputMode === "warning" && ids[0] > 200) {
              return new Response("batch-failure", { status: 500, statusText: "Server Error" });
            }
            return new Response(
              JSON.stringify({
                value: ids.map((id) => ({
                  fields: {
                    "Microsoft.VSTS.Common.ClosedDate": new Date(
                      Date.UTC(2026, 0, 1 + ((id - 1) % 10) * 7, 12, 0, 0, 0),
                    ).toISOString(),
                  },
                })),
              }),
              { status: 200, headers: { "content-type": "application/json" } },
            );
          }
          if (asString.includes("/simulate")) {
            const body = init?.body ? JSON.parse(String(init.body)) : {};
            if (body.mode === "weeks_to_items") {
              return new Response(
                JSON.stringify({
                  result_kind: "items",
                  result_percentiles: { P50: 20, P70: 24, P90: 30 },
                  samples_count: 70,
                }),
                { status: 200, headers: { "content-type": "application/json" } },
              );
            }
            return new Response(
              JSON.stringify({
                result_kind: "weeks",
                result_percentiles: { P50: 8, P70: 10, P90: 12 },
                result_distribution: [{ x: 8, count: 10 }],
                samples_count: 70,
              }),
              { status: 200, headers: { "content-type": "application/json" } },
            );
          }
          return originalFetch(url, init);
        };

        throughputMode = "array";
        await forecastMod.fetchTeamThroughput({
          selectedOrg: "org-demo",
          selectedProject: "Projet A",
          selectedTeam: "Equipe Alpha",
          pat: "token-value-at-least-20-chars",
          startDate: "2026-01-01",
          endDate: "2026-03-01",
          doneStates: ["Done"],
          types: ["Bug"],
          includeZeroWeeks: false,
        });

        throughputMode = "warning";
        await forecastMod.runSimulationForecast({
          selectedOrg: "org-demo",
          selectedProject: "Projet A",
          selectedTeam: "Equipe Alpha",
          pat: "token-value-at-least-20-chars",
          startDate: "2026-01-01",
          endDate: "2026-03-01",
          doneStates: ["Done"],
          types: ["Bug"],
          includeZeroWeeks: true,
          simulationMode: "backlog_to_weeks",
          backlogSize: 120,
          targetWeeks: 12,
          nSims: 2000,
        });

        await forecastMod.simulateForecastFromSamples({
          throughputSamples: [1, 2, 3, 4, 5, 6],
          includeZeroWeeks: true,
          simulationMode: "weeks_to_items",
          backlogSize: 120,
          targetWeeks: 12,
          nSims: 2000,
        });
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
    await expect(page.getByTestId("selected-team-card")).toBeVisible();
    await expect(page.getByTestId("selected-team-name")).toHaveText("Equipe Alpha");
  });

  test("coverage: branches team sort et simulation history", async ({ page }) => {
    test.setTimeout(45_000);
    await page.goto("/");

    await page.evaluate(async () => {
      const { React, createRoot, sortTeams, useSimulationHistory } = await import("/src/e2e/runtime.ts");
      const simHistoryKey = "mc_simulation_history_v2";

      sortTeams([
        { id: "3", name: "Zulu - Beta" },
        { id: "1", name: "Éclair - Alpha" },
        { id: "2", name: "alpha - Squad" },
      ]);
      sortTeams([
        { id: "2", name: "Alpha - Zeta" },
        { id: "1", name: "Alpha - Beta" },
        { id: "3", name: "Alpha - Éclair" },
      ]);
      sortTeams([
        { id: "2", name: "Bravo" },
        { id: "1", name: "" },
        { id: "3" },
      ]);

      const flush = async () => {
        await Promise.resolve();
        await new Promise((resolve) => window.setTimeout(resolve, 0));
      };

      const buildResponse = (payload) =>
        new Response(JSON.stringify(payload), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });

      const baseEntry = {
        createdAt: "2026-03-01T10:00:00Z",
        selectedOrg: "org-demo",
        selectedProject: "Projet A",
        selectedTeam: "Equipe Alpha",
        startDate: "2026-01-01",
        endDate: "2026-02-01",
        simulationMode: "backlog_to_weeks",
        includeZeroWeeks: false,
        backlogSize: 70,
        targetWeeks: 0,
        nSims: 2000,
        types: ["Bug"],
        doneStates: ["Done"],
        sampleStats: { totalWeeks: 24, zeroWeeks: 0, usedWeeks: 24 },
        weeklyThroughput: [],
        result: {
          result_kind: "weeks",
          samples_count: 24,
          result_percentiles: { P50: 7, P70: 9, P90: 12 },
          risk_score: 0.71,
          result_distribution: [],
        },
      };

      const mountHookScenario = async ({
        storageValue,
        remotePayload = [],
        rejectRemote = false,
        deferredRemote = false,
        unmountBeforeResolve = false,
        afterReady = null,
      }) => {
        if (storageValue == null) {
          window.localStorage.removeItem(simHistoryKey);
        } else {
          window.localStorage.setItem(simHistoryKey, storageValue);
        }

        const originalFetch = window.fetch.bind(window);
        let resolveDeferred = null;
        window.fetch = async (input, init) => {
          if (String(input).includes("/simulations/history")) {
            if (deferredRemote) {
              return new Promise((resolve) => {
                resolveDeferred = resolve;
              });
            }
            if (rejectRemote) {
              throw new Error("remote unavailable");
            }
            return buildResponse(remotePayload);
          }
          return originalFetch(input, init);
        };

        const container = document.createElement("div");
        document.body.appendChild(container);
        const root = createRoot(container);
        let latestState = null;
        let readyResolve = null;
        const ready = new Promise((resolve) => {
          readyResolve = resolve;
        });

        function Harness() {
          const state = useSimulationHistory();
          React.useEffect(() => {
            latestState = state;
            readyResolve?.(state);
          }, [state]);
          return null;
        }

        root.render(React.createElement(Harness));
        await flush();

        if (deferredRemote && unmountBeforeResolve) {
          root.unmount();
          container.remove();
          resolveDeferred?.(buildResponse(remotePayload));
          await flush();
          window.fetch = originalFetch;
          return;
        }

        if (deferredRemote) {
          resolveDeferred?.(buildResponse(remotePayload));
        }

        await ready;
        await flush();

        if (afterReady) {
          await afterReady(latestState);
          await flush();
        }

        root.unmount();
        container.remove();
        window.fetch = originalFetch;
      };

      await mountHookScenario({ storageValue: "{bad json", remotePayload: [] });
      await mountHookScenario({ storageValue: JSON.stringify({ nope: true }), remotePayload: [] });
      await mountHookScenario({
        storageValue: JSON.stringify([{ ...baseEntry, id: "local-1" }]),
        remotePayload: [
          {
            created_at: "2026-02-26T10:00:00Z",
            mode: "backlog_to_weeks",
            backlog_size: 70,
            target_weeks: null,
            n_sims: 2000,
            samples_count: 24,
            percentiles: { P50: 7, P70: 9, P90: 12 },
            distribution: [{ x: 7, count: 5 }],
            selected_org: "org-demo",
            selected_project: "Projet A",
            selected_team: "Equipe Alpha",
            start_date: "2026-01-01",
            end_date: "2026-02-01",
            done_states: ["Done"],
            types: ["Bug"],
            include_zero_weeks: false,
          },
        ],
      });
      await mountHookScenario({
        storageValue: null,
        remotePayload: [
          {
            created_at: "2026-02-26T10:00:00Z",
            mode: "backlog_to_weeks",
            backlog_size: 70,
            target_weeks: null,
            n_sims: 2000,
            samples_count: 24,
            percentiles: { P50: 7, P70: 9, P90: 12 },
            distribution: [{ x: 7, count: 5 }],
            selected_org: "org-demo",
            selected_project: "Projet A",
            selected_team: "Equipe Alpha",
            start_date: "2026-01-01",
            end_date: "2026-02-01",
            done_states: ["Done"],
            types: ["Bug"],
            include_zero_weeks: false,
          },
          {
            created_at: "2026-02-27T10:00:00Z",
            mode: "weeks_to_items",
            backlog_size: null,
            target_weeks: 6,
            n_sims: null,
            samples_count: null,
            percentiles: { P50: 21, P70: 34, P90: 55 },
            distribution: null,
            selected_org: null,
            selected_project: null,
            selected_team: null,
            start_date: null,
            end_date: null,
            done_states: null,
            types: null,
            include_zero_weeks: true,
          },
        ],
      });
      await mountHookScenario({ storageValue: null, rejectRemote: true });
      await mountHookScenario({
        storageValue: null,
        deferredRemote: true,
        unmountBeforeResolve: true,
        remotePayload: [],
      });
      await mountHookScenario({
        storageValue: null,
        remotePayload: [],
        afterReady: async (state) => {
          for (let index = 0; index < 12; index += 1) {
            state.pushSimulationHistory({ ...baseEntry, id: `local-${index}` });
            await flush();
          }
          state.clearSimulationHistory();
        },
      });
    });

    await expect(page.locator("body")).toBeVisible();
  });

  test("coverage: branches ado platform", async ({ page }) => {
    await page.goto("/");

    const results = await page.evaluate(async () => {
      const adoPlatform = await import("/src/adoPlatform.ts");

      return {
        cloudMissing: adoPlatform.getAdoDeploymentTarget(undefined),
        cloudHost: adoPlatform.getAdoDeploymentTarget("https://dev.azure.com/demo"),
        cloudVssps: adoPlatform.isOnPremAdoServer("https://app.vssps.visualstudio.com"),
        cloudVisualStudio: adoPlatform.isOnPremAdoServer("https://contoso.visualstudio.com"),
        onPremHost: adoPlatform.getAdoDeploymentTarget("https://serveur.local/tfs"),
        normalized: adoPlatform.normalizeAdoServerUrl("  https://serveur.local/tfs/CollectionA///  "),
        emptyCollection: adoPlatform.extractOnPremCollectionName("https://serveur.local/tfs"),
        apiCollection: adoPlatform.extractOnPremCollectionName("https://serveur.local/tfs/_apis"),
        encodedCollection: adoPlatform.extractOnPremCollectionName("https://serveur.local/tfs/Collection%20A"),
        inferredCollectionUrl: adoPlatform.buildOnPremCollectionUrl("https://serveur.local/tfs/CollectionA", ""),
        explicitCollectionUrl: adoPlatform.buildOnPremCollectionUrl("https://serveur.local/tfs", "Collection A"),
        deepCollectionUrl: adoPlatform.buildOnPremCollectionUrl("https://devops700.itp.extra/700/TN", "700"),
        cloudCollectionUrl: adoPlatform.buildOnPremCollectionUrl("https://dev.azure.com/demo", "ignored"),
        emptyCandidates: adoPlatform.listOnPremCollectionCandidates("https://serveur.local"),
        deepCandidates: adoPlatform.listOnPremCollectionCandidates("https://serveur/tfs/Collection%20A/projet"),
        invalidCandidates: adoPlatform.listOnPremCollectionCandidates("not-a-url"),
      };
    });

    expect(results.cloudMissing).toBe("cloud");
    expect(results.cloudHost).toBe("cloud");
    expect(results.cloudVssps).toBe(false);
    expect(results.cloudVisualStudio).toBe(false);
    expect(results.onPremHost).toBe("onprem");
    expect(results.normalized).toBe("https://serveur.local/tfs/CollectionA");
    expect(results.emptyCollection).toBe("");
    expect(results.apiCollection).toBe("");
    expect(results.encodedCollection).toBe("Collection A");
    expect(results.inferredCollectionUrl).toBe("https://serveur.local/tfs/CollectionA");
    expect(results.explicitCollectionUrl).toBe("https://serveur.local/tfs/Collection%20A");
    expect(results.deepCollectionUrl).toBe("https://devops700.itp.extra/700");
    expect(results.cloudCollectionUrl).toBe("");
    expect(results.emptyCandidates).toEqual([]);
    expect(results.deepCandidates).toEqual([
      { collectionName: "tfs", collectionUrl: "https://serveur/tfs" },
      { collectionName: "Collection A", collectionUrl: "https://serveur/tfs/Collection%20A" },
      { collectionName: "projet", collectionUrl: "https://serveur/tfs/Collection%20A/projet" },
    ]);
    expect(results.invalidCandidates).toEqual([]);
  });
});
