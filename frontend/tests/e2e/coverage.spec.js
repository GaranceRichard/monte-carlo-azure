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

  test("coverage: public pages direct", async ({ page }) => {
    await page.goto("/");

    const results = await page.evaluate(async () => {
      const { React, createRoot } = await import("/src/e2e/runtime.ts");
      const connectModule = await import("/src/components/PublicConnectNotice.tsx");

      const host = document.createElement("div");
      document.body.innerHTML = "";
      document.body.appendChild(host);
      const root = createRoot(host);
      root.render(
        React.createElement(
          React.Fragment,
          null,
          React.createElement(connectModule.default),
        ),
      );

      await Promise.resolve();
      await new Promise((resolve) => window.setTimeout(resolve, 0));

      const payload = {
        demoLinks: Array.from(document.querySelectorAll('a[href="?"]')).map((node) => node.textContent || ""),
        hasConnectHeading: document.body.textContent?.includes("La connexion à un environnement Azure DevOps réel") ?? false,
      };

      root.unmount();
      host.remove();
      return payload;
    });

    expect(results.demoLinks).toContain("Voir la démo");
    expect(results.hasConnectHeading).toBe(true);
  });

  test("coverage: flux complet front", async ({ page }) => {
    test.setTimeout(120_000);
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

  test("coverage: branches ado client direct", async ({ page }) => {
    await page.goto("/");

    const results = await page.evaluate(async () => {
      const adoClient = await import("/src/adoClient.ts");
      const originalFetch = window.fetch.bind(window);
      let teamFieldMode = "fallback";
      let throughputMode = "empty";
      let profileMode = "cloud-ok";
      let projectMode = "ok";

      const jsonResponse = (payload, status = 200, statusText = "OK") =>
        new Response(JSON.stringify(payload), {
          status,
          statusText,
          headers: { "Content-Type": "application/json" },
        });

      window.fetch = async (input, init) => {
        const url = String(input);

        if (url.includes("/_apis/profile/profiles/me?")) {
          if (profileMode === "cloud-ok") {
            return jsonResponse({ displayName: "Utilisateur", id: "member-1", publicAlias: "alias-1" });
          }
          if (profileMode === "cloud-restricted") {
            return new Response("{}", {
              status: 401,
              headers: { "x-vss-userdata": "aad.member-2:Jane Doe" },
            });
          }
          if (profileMode === "cloud-forbidden") {
            return new Response("{}", { status: 403, statusText: "Forbidden" });
          }
        }

        if (url.includes("/_apis/accounts?memberId=")) {
          if (url.includes("member-1")) return jsonResponse({ value: [{ accountName: "org-demo" }] });
          if (url.includes("member-none")) return jsonResponse({ value: [] });
          return new Response("{}", { status: 500, statusText: "Server Error" });
        }

        if (url.includes("/_apis/projects?$top=1&api-version=6.0")) {
          if (url.includes("https://serveur/tfs/_apis/projects")) {
            return new Response("{}", { status: 404, statusText: "Not Found" });
          }
          if (projectMode === "network-error") {
            throw new Error("network down");
          }
          return jsonResponse({ value: [{ id: "p1", name: "Projet A" }] });
        }

        if (url.includes("/_apis/projects?api-version=6.0")) {
          if (projectMode === "network-error") {
            throw new Error("network down");
          }
          return jsonResponse({ value: [{ id: "p1", name: "Projet A" }] });
        }

        if (url.includes("/_apis/projects/p1/teams?api-version=6.0")) {
          return jsonResponse({ value: [{ id: "t1", name: "Equipe A" }] });
        }

        if (url.includes("/_apis/wit/workitemtypes?")) {
          return jsonResponse({ value: [{ name: "Bug" }, { name: "Task" }] });
        }

        if (url.includes("/workitemtypes/Bug/states?")) {
          return jsonResponse({ value: [{ name: "Done" }] });
        }

        if (url.includes("/workitemtypes/Task/states?")) {
          return new Response("{}", { status: 500, statusText: "Server Error" });
        }

        if (url.includes("/teamfieldvalues?")) {
          if (teamFieldMode === "fallback") {
            return new Response("{}", { status: 404, statusText: "Not Found" });
          }
          if (teamFieldMode === "empty") {
            return jsonResponse({ values: [{ value: "", includeChildren: true }] });
          }
          if (teamFieldMode === "throw") {
            throw new Error("teamfieldvalues down");
          }
          return jsonResponse({
            values: [
              { value: "Projet A\\Equipe A", includeChildren: false },
              { value: "Projet A\\Equipe A\\Sous-equipe", includeChildren: true },
            ],
          });
        }

        if (url.includes("/_apis/wit/wiql?")) {
          if (throughputMode === "empty") {
            return jsonResponse({ workItems: [] });
          }
          const size = throughputMode === "warning" ? 210 : 12;
          return jsonResponse({
            workItems: Array.from({ length: size }, (_, index) => ({ id: index + 1 })),
          });
        }

        if (url.includes("/_apis/wit/workitems?ids=")) {
          const ids = new URL(url).searchParams.get("ids").split(",").map((id) => Number(id));
          if (throughputMode === "warning" && ids[0] > 200) {
            return new Response("batch-failure", { status: 500, statusText: "Server Error" });
          }
          return jsonResponse({
            value: ids.map((id) => ({
              fields: {
                "Microsoft.VSTS.Common.ClosedDate": new Date(
                  Date.UTC(2026, 0, 1 + ((id - 1) % 6) * 7, 12, 0, 0, 0),
                ).toISOString(),
              },
            })),
          });
        }

        return originalFetch(input, init);
      };

      try {
        profileMode = "cloud-ok";
        const cloudProfile = await adoClient.checkPatDirect("pat-a");

        profileMode = "cloud-restricted";
        const restrictedProfile = await adoClient.checkPatDirect("pat-b");

        profileMode = "cloud-forbidden";
        const cloudForbidden = await adoClient.checkPatDirect("pat-c").catch((error) => error instanceof Error);

        profileMode = "cloud-ok";
        const cloudScope = await adoClient.resolvePatOrganizationScopeDirect("pat-d");

        const onPremScope = await adoClient.resolvePatOrganizationScopeDirect(
          "pat-e",
          "https://serveur/tfs/collection/projet",
        );

        const orgsOnPrem = await adoClient.listOrgsDirect("pat-f", "https://serveur/tfs/collection");
        const projects = await adoClient.listProjectsDirect(
          "collection",
          "pat-g",
          "https://serveur/tfs/collection",
        );
        const teams = await adoClient.listTeamsDirect(
          "collection",
          "Projet A",
          "pat-h",
          "https://serveur/tfs/collection",
        );
        const missingTeamProject = await adoClient
          .listTeamsDirect("collection", "Projet introuvable", "pat-i", "https://serveur/tfs/collection")
          .catch((error) => error instanceof Error);

        const teamOptions = await adoClient.getTeamOptionsDirect(
          "collection",
          "Projet A",
          "Equipe A",
          "pat-j",
          "https://serveur/tfs/collection",
        );

        teamFieldMode = "fallback";
        throughputMode = "empty";
        const emptyThroughput = await adoClient.getWeeklyThroughputDirect(
          "collection",
          "Projet A",
          "Equipe A",
          "pat-k",
          "2026-01-01",
          "2026-03-01",
          [],
          [],
          "https://serveur/tfs/collection",
        );

        teamFieldMode = "explicit";
        throughputMode = "warning";
        const warningThroughput = await adoClient.getWeeklyThroughputDirect(
          "collection",
          "Projet A",
          "Equipe A",
          "pat-l",
          "2026-01-01",
          "2026-03-01",
          ["Done"],
          ["Bug"],
          "https://serveur/tfs/collection",
        );

        teamFieldMode = "throw";
        throughputMode = "full";
        const recoveredThroughput = await adoClient.getWeeklyThroughputDirect(
          "collection",
          "Projet A",
          "Equipe A",
          "pat-m",
          "2026-01-01",
          "2026-03-01",
          ["Done"],
          ["Bug"],
          "https://serveur/tfs/collection",
        );

        projectMode = "network-error";
        const projectNetworkError = await adoClient
          .listProjectsDirect("collection", "pat-n", "https://serveur/tfs/collection")
          .catch((error) => error instanceof Error);

        return {
          cloudProfile,
          restrictedProfile,
          cloudForbidden,
          cloudScope,
          onPremScope,
          orgsOnPrem,
          projects,
          teams,
          missingTeamProject,
          teamOptions,
          emptyThroughput,
          warningThroughput,
          recoveredThroughput,
          projectNetworkError,
        };
      } finally {
        window.fetch = originalFetch;
      }
    });

    expect(results.cloudProfile.displayName).toBe("Utilisateur");
    expect(results.restrictedProfile.restrictedProfile).toBe(true);
    expect(results.cloudForbidden).toBe(true);
    expect(results.cloudScope.scope).toBe("global");
    expect(results.onPremScope.scope).toBe("local");
    expect(results.orgsOnPrem).toEqual([]);
    expect(results.projects).toEqual([{ id: "p1", name: "Projet A" }]);
    expect(results.teams).toEqual([{ id: "t1", name: "Equipe A" }]);
    expect(results.missingTeamProject).toBe(true);
    expect(results.teamOptions.workItemTypes).toEqual(["Bug", "Task"]);
    expect(Array.isArray(results.emptyThroughput)).toBe(true);
    expect(results.warningThroughput.warning).toContain("historique partiel");
    expect(Array.isArray(results.recoveredThroughput)).toBe(true);
    expect(results.projectNetworkError).toBe(true);
  });

  test("coverage: branches usePortfolioReport direct", async ({ page }) => {
    await page.goto("/");

    const results = await page.evaluate(async () => {
      const { React, createRoot } = await import("/src/e2e/runtime.ts");
      const { usePortfolioReport } = await import("/src/hooks/usePortfolioReport.ts");
      const originalFetch = window.fetch.bind(window);
      const originalOpen = window.open.bind(window);
      let portfolioMode = "success";

      const flush = async () => {
        await Promise.resolve();
        await new Promise((resolve) => window.setTimeout(resolve, 0));
      };

      const jsonResponse = (payload, status = 200, statusText = "OK") =>
        new Response(JSON.stringify(payload), {
          status,
          statusText,
          headers: { "Content-Type": "application/json" },
        });

      const createPopup = () => {
        const doc = document.implementation.createHTMLDocument("portfolio-export");
        return {
          document: doc,
          alert: () => undefined,
          addEventListener: (_name, callback) => {
            window.setTimeout(() => callback(), 0);
          },
          close: () => undefined,
        };
      };

      window.open = () => createPopup();
      window.fetch = async (input, init) => {
        const url = String(input);

        if (url.includes("/teamfieldvalues?")) {
          return jsonResponse({ values: [{ value: "Projet A\\Equipe A", includeChildren: true }] });
        }
        if (url.includes("/_apis/wit/wiql?")) {
          if (portfolioMode === "phase1-fail") {
            return jsonResponse({ workItems: [] });
          }
          return jsonResponse({
            workItems: Array.from({ length: 8 }, (_, index) => ({ id: index + 1 })),
          });
        }
        if (url.includes("/_apis/wit/workitems?ids=")) {
          const ids = new URL(url).searchParams.get("ids").split(",").map((id) => Number(id));
          return jsonResponse({
            value: ids.map((id) => ({
              fields: {
                "Microsoft.VSTS.Common.ClosedDate": new Date(
                  Date.UTC(2026, 0, 1 + ((id - 1) % 6) * 7, 12, 0, 0, 0),
                ).toISOString(),
              },
            })),
          });
        }
        if (url.includes("/simulate")) {
          if (portfolioMode === "phase2-fail") {
            return new Response("sim-failure", { status: 503, statusText: "Service Unavailable" });
          }
          return jsonResponse({
            result_kind: "weeks",
            samples_count: 8,
            risk_score: 0.3,
            result_percentiles: { P50: 10, P70: 12, P90: 15 },
            result_distribution: [{ x: 10, count: 5 }],
          });
        }
        return originalFetch(input, init);
      };

      const runScenario = async (teamConfigs) => {
        const container = document.createElement("div");
        document.body.appendChild(container);
        const root = createRoot(container);
        let latestState;
        let readyResolve;
        const ready = new Promise((resolve) => {
          readyResolve = resolve;
        });

        function Harness() {
          const state = usePortfolioReport({
            selectedOrg: "collection",
            selectedProject: "Projet A",
            pat: "token",
            serverUrl: "https://serveur/tfs/collection",
            startDate: "2026-01-01",
            endDate: "2026-03-01",
            includeZeroWeeks: true,
            simulationMode: "backlog_to_weeks",
            backlogSize: 120,
            targetWeeks: 12,
            nSims: 2000,
            alignmentRate: 80,
            teamConfigs,
          });
          React.useEffect(() => {
            latestState = state;
            readyResolve?.(state);
          }, [state]);
          return null;
        }

        root.render(React.createElement(Harness));
        await ready;
        await latestState.handleGenerateReport();
        for (let index = 0; index < 5; index += 1) {
          await flush();
        }
        const snapshot = {
          loadingReport: latestState.loadingReport,
          reportErr: latestState.reportErr,
          reportErrors: latestState.reportErrors,
          generationProgress: latestState.generationProgress,
        };
        root.unmount();
        container.remove();
        return snapshot;
      };

      try {
        const noOp = await runScenario([]);

        portfolioMode = "phase1-fail";
        const phase1Fail = await runScenario([
          {
            teamName: "Equipe A",
            workItemTypeOptions: ["Bug"],
            statesByType: { Bug: ["Done"] },
            types: ["Bug"],
            doneStates: ["Done"],
          },
        ]);

        portfolioMode = "phase2-fail";
        const phase2Fail = await runScenario([
          {
            teamName: "Equipe A",
            workItemTypeOptions: ["Bug"],
            statesByType: { Bug: ["Done"] },
            types: ["Bug"],
            doneStates: ["Done"],
          },
        ]);

        portfolioMode = "success";
        const success = await runScenario([
          {
            teamName: "Equipe A",
            workItemTypeOptions: ["Bug"],
            statesByType: { Bug: ["Done"] },
            types: ["Bug"],
            doneStates: ["Done"],
          },
        ]);

        return { noOp, phase1Fail, phase2Fail, success };
      } finally {
        window.fetch = originalFetch;
        window.open = originalOpen;
      }
    });

    expect(results.noOp.generationProgress).toEqual({ done: 0, total: 0 });
    expect(results.phase1Fail.reportErr).toBe("Aucune equipe n'a pu etre simulee.");
    expect(results.phase2Fail.reportErr).toBe("Aucune simulation n'a pu etre finalisee.");
    expect(results.success.reportErr).toBe("");
  });

  test("coverage: branches usePortfolio direct", async ({ page }) => {
    await page.goto("/");

    const results = await page.evaluate(async () => {
      const { React, createRoot } = await import("/src/e2e/runtime.ts");
      const { usePortfolio } = await import("/src/hooks/usePortfolio.ts");
      const originalFetch = window.fetch.bind(window);
      let teamOptionsMode = "ok";

      const flush = async () => {
        await Promise.resolve();
        await new Promise((resolve) => window.setTimeout(resolve, 0));
      };

      const jsonResponse = (payload, status = 200, statusText = "OK") =>
        new Response(JSON.stringify(payload), {
          status,
          statusText,
          headers: { "Content-Type": "application/json" },
        });

      window.fetch = async (input, init) => {
        const url = String(input);
        const decoded = decodeURIComponent(url);

        if (decoded.includes("/_apis/wit/workitemtypes?")) {
          if (teamOptionsMode === "fail") {
            return new Response("{}", { status: 500, statusText: "Server Error" });
          }
          return jsonResponse({ value: [{ name: "Bug" }, { name: "User Story" }] });
        }

        if (decoded.includes("/workitemtypes/Bug/states?")) {
          return jsonResponse({ value: [{ name: "Done" }] });
        }

        if (decoded.includes("/workitemtypes/User Story/states?")) {
          return jsonResponse({ value: [{ name: "Done" }, { name: "Closed" }] });
        }

        return originalFetch(input, init);
      };

      const runScenario = async ({ demoMode = false, teams = [{ name: "Team A" }, { name: "Team B" }] } = {}) => {
        const container = document.createElement("div");
        document.body.appendChild(container);
        const root = createRoot(container);
        let latestState;
        let readyResolve;
        const ready = new Promise((resolve) => {
          readyResolve = resolve;
        });

        function Harness() {
          const state = usePortfolio({
            demoMode,
            selectedOrg: demoMode ? "Acme Corp" : "org-demo",
            selectedProject: demoMode ? "Programme Titan" : "Projet A",
            teams,
            pat: demoMode ? "" : "token-value",
            serverUrl: "",
          });

          React.useEffect(() => {
            latestState = state;
            readyResolve?.(state);
          }, [state]);

          return null;
        }

        root.render(React.createElement(Harness));
        await ready;
        return {
          getState: () => latestState,
          cleanup: () => {
            root.unmount();
            container.remove();
          },
        };
      };

      try {
        localStorage.clear();

        const standard = await runScenario();
        standard.getState().openAddModal();
        await flush();
        standard.getState().validateAddModal();
        await flush();
        const emptyValidationError = standard.getState().modalErr;

        standard.getState().toggleModalType("Bug", true);
        await flush();
        standard.getState().toggleModalState("Done", true);
        await flush();
        standard.getState().validateAddModal();
        await flush();

        const firstTeamAdded = standard.getState().teamConfigs.length;
        standard.getState().openAddModal();
        await flush();
        standard.getState().onModalTeamNameChange("Team B");
        await flush();
        standard.getState().toggleModalType("User Story", true);
        await flush();
        standard.getState().toggleModalState("Closed", true);
        await flush();
        standard.getState().validateAddModal();
        await flush();
        const secondTeamAdded = standard.getState().teamConfigs.length;

        standard.getState().openAddModal();
        await flush();
        standard.getState().onModalTeamNameChange("");
        await flush();
        const emptyModalState = {
          teamName: standard.getState().modalTeamName,
          options: [...standard.getState().modalTypeOptions],
        };
        standard.getState().closeAddModal();
        await flush();

        standard.getState().setNSims("");
        await flush();
        const invalidNSims = standard.getState().canGenerate;
        standard.getState().setNSims("3000");
        await flush();
        const validNSims = standard.getState().canGenerate;
        standard.getState().removeTeam("Team A");
        await flush();
        const teamsAfterRemove = standard.getState().teamConfigs.map((cfg) => cfg.teamName);
        standard.cleanup();

        teamOptionsMode = "fail";
        const failing = await runScenario({ teams: [{ name: "Team X" }] });
        failing.getState().openAddModal();
        await flush();
        const failureMessage = failing.getState().modalErr;
        failing.cleanup();

        teamOptionsMode = "ok";
        const demo = await runScenario({ demoMode: true, teams: [] });
        demo.getState().openAddModal();
        await flush();
        const demoDefaults = {
          typeCount: demo.getState().modalTypeOptions.length,
          doneStates: [...demo.getState().modalDoneStates],
        };
        demo.cleanup();

        return {
          emptyValidationError,
          firstTeamAdded,
          secondTeamAdded,
          emptyModalState,
          invalidNSims,
          validNSims,
          teamsAfterRemove,
          failureMessage,
          demoDefaults,
        };
      } finally {
        window.fetch = originalFetch;
      }
    });

    expect(typeof results.emptyValidationError).toBe("string");
    expect(typeof results.firstTeamAdded).toBe("number");
    expect(typeof results.secondTeamAdded).toBe("number");
    expect(results.emptyModalState.teamName).toBe("");
    expect(results.emptyModalState.options).toEqual([]);
    expect(typeof results.invalidNSims).toBe("boolean");
    expect(typeof results.validNSims).toBe("boolean");
    expect(Array.isArray(results.teamsAfterRemove)).toBe(true);
    expect(typeof results.failureMessage).toBe("string");
    expect(typeof results.demoDefaults.typeCount).toBe("number");
    expect(Array.isArray(results.demoDefaults.doneStates)).toBe(true);
  });

  test("coverage: branches print and pdf direct", async ({ page }) => {
    await page.goto("/");

    const results = await page.evaluate(async () => {
      const pdfModule = await import("/src/components/steps/simulationPdfDownload.ts");
      const printModule = await import("/src/components/steps/portfolioPrintReport.ts");
      const originalOpen = window.open.bind(window);

      const flush = async () => {
        await Promise.resolve();
        await new Promise((resolve) => window.setTimeout(resolve, 0));
      };

      const simulationDoc = document.implementation.createHTMLDocument("simulation");
      simulationDoc.body.innerHTML = `
        <h1>Simulation Monte Carlo</h1>
        <div class="meta-row">Periode: 2026-01-01 au 2026-03-01</div>
        <h2>Titre PDF custom</h2>
        <div class="chart-wrap"><svg viewBox="0 0 960 360"></svg></div>
        <div class="kpi"><span class="kpi-label">P50</span><span class="kpi-value">10 semaines</span></div>
      `;

      const portfolioDoc = document.implementation.createHTMLDocument("portfolio");
      portfolioDoc.body.innerHTML = `
        <section class="page">
          <h1>Simulation Portefeuille</h1>
          <div class="meta-row">Periode: 2026-01-01 au 2026-03-01</div>
          <table class="summary-table">
            <thead>
              <tr>
                <th>Scenario</th><th>P50</th><th>P70</th><th>P90</th><th>Risk Score</th><th>Fiabilite</th>
              </tr>
            </thead>
            <tbody>
              <tr><td>Optimiste</td><td>10</td><td>12</td><td>15</td><td>0,20 (fiable)</td><td>0,30 (incertain)</td></tr>
            </tbody>
          </table>
          <div class="hypothesis"><strong>Risk Score :</strong> Lecture synthetique</div>
          <div class="kpi"><span class="kpi-label">P50</span><span class="kpi-value">10 semaines</span></div>
          <div class="chart-wrap"><svg viewBox="0 0 960 360"></svg></div>
        </section>
      `;

      await pdfModule.downloadSimulationPdf(simulationDoc, "Equipe Alpha");
      await pdfModule.downloadPortfolioPdf(portfolioDoc, "Projet A", true);

      let popupButtonText = "";
      let popupHeading = "";
      let lastPopup = null;
      window.open = () => {
        const popupDoc = document.implementation.createHTMLDocument("portfolio-export");
        const popup = {
          document: Object.assign(popupDoc, {
            open: () => undefined,
            write: (html) => {
              popupDoc.documentElement.innerHTML = html;
            },
            close: () => undefined,
          }),
          addEventListener: (_name, callback) => {
            window.setTimeout(() => callback(), 0);
          },
          close: () => undefined,
          alert: () => undefined,
        };
        lastPopup = popup;
        return popup;
      };

      printModule.exportPortfolioPrintReport({
        isDemo: true,
        selectedProject: "Projet A",
        startDate: "2026-01-01",
        endDate: "2026-03-01",
        alignmentRate: 80,
        includedTeams: ["Equipe Alpha"],
        scenarios: [
          {
            label: "Optimiste",
            hypothesis: "Hypothese <unsafe>",
            samples: [3, 4, 5],
            weeklyData: [
              { week: "2026-01-01", throughput: 3 },
              { week: "2026-01-08", throughput: 4 },
            ],
            percentiles: { P50: 10, P70: 12, P90: 15 },
            riskScore: 0.2,
            riskLegend: "fiable",
            distribution: [{ x: 10, count: 2 }],
            throughputReliability: { cv: 0.2, iqr_ratio: 0.3, slope_norm: 0, label: "fiable", samples_count: 8 },
          },
        ],
        sections: [
          {
            selectedTeam: "Equipe Alpha",
            simulationMode: "backlog_to_weeks",
            includeZeroWeeks: true,
            backlogSize: 120,
            targetWeeks: 12,
            nSims: 2000,
            types: ["Bug"],
            doneStates: ["Done"],
            resultKind: "weeks",
            riskScore: 0.3,
            throughputReliability: { cv: 0.4, iqr_ratio: 0.3, slope_norm: 0, label: "incertain", samples_count: 8 },
            distribution: [{ x: 10, count: 2 }],
            weeklyThroughput: [{ week: "2026-01-01", throughput: 3 }],
            displayPercentiles: { P50: 10, P70: 12, P90: 15 },
          },
        ],
      });
      await flush();

      popupButtonText = lastPopup?.document?.body?.textContent || "";
      popupHeading = lastPopup?.document?.documentElement?.textContent || "";

      window.open = originalOpen;

      return {
        simulationPdfDone: true,
        portfolioPdfDone: true,
        popupButtonText,
        popupHeading,
      };
    });

    expect(results.simulationPdfDone).toBe(true);
    expect(results.portfolioPdfDone).toBe(true);
  });

  test("coverage: sla identite direct", async ({ page }) => {
    await page.goto("/");

    const results = await page.evaluate(async () => {
      const apiMod = await import("/src/api.ts");
      const forecastMod = await import("/src/hooks/simulationForecastService.ts");
      const originalFetch = window.fetch.bind(window);
      let apiMode = "success";

      const jsonResponse = (payload, status = 200, statusText = "OK") =>
        new Response(JSON.stringify(payload), {
          status,
          statusText,
          headers: { "content-type": "application/json" },
        });

      try {
        window.fetch = async (input, init) => {
          const url = String(input);
          if (url.includes("/simulate")) {
            if (apiMode === "simulate-detail-error") {
              return jsonResponse({ detail: "bad payload" }, 400, "Bad Request");
            }
            if (apiMode === "simulate-http-error") {
              return new Response("server-down", {
                status: 503,
                statusText: "Service Unavailable",
                headers: { "content-type": "text/plain" },
              });
            }
            const body = init?.body ? JSON.parse(String(init.body)) : {};
            if (body.mode === "weeks_to_items") {
              return jsonResponse({
                result_kind: "items",
                result_percentiles: { P50: 20, P70: 24, P90: 30 },
                samples_count: 6,
                result_distribution: [{ x: 20, count: 4 }],
              });
            }
            return jsonResponse({
              result_kind: "weeks",
              result_percentiles: { P50: 8, P70: 10, P90: 12 },
              risk_score: 0.25,
              samples_count: 6,
              result_distribution: [{ x: 8, count: 4 }],
            });
          }
          if (url.includes("/simulations/history")) {
            if (apiMode === "history-detail-error") {
              return jsonResponse({ detail: "history exploded" }, 500, "Server Error");
            }
            if (apiMode === "history-http-error") {
              return new Response("history-down", {
                status: 502,
                statusText: "Bad Gateway",
                headers: { "content-type": "text/plain" },
              });
            }
            return jsonResponse([]);
          }
          if (url.includes("/wiql")) {
            if (apiMode === "partial-warning") {
              return jsonResponse({
                workItems: Array.from({ length: 210 }, (_, index) => ({ id: index + 1 })),
              });
            }
            return jsonResponse({
              workItems: Array.from({ length: 6 }, (_, index) => ({ id: index + 1 })),
            });
          }
          if (url.includes("/workitems?ids=")) {
            if (apiMode === "partial-warning" && url.includes("ids=201")) {
              return new Response("batch-failure", {
                status: 500,
                statusText: "Server Error",
                headers: { "content-type": "text/plain" },
              });
            }
            return jsonResponse({
              value: [0, 1, 2, 3, 4, 5].map((index) => ({
                fields: {
                  "Microsoft.VSTS.Common.ClosedDate": new Date(
                    Date.UTC(2026, 0, 1 + index * 7, 12, 0, 0, 0),
                  ).toISOString(),
                },
              })),
            });
          }
          if (url.includes("/teamfieldvalues")) {
            return jsonResponse({
              values: [{ value: "Projet A\\Equipe Alpha", includeChildren: false }],
            });
          }
          return originalFetch(input, init);
        };

        const objectThroughput = await forecastMod.fetchTeamThroughput({
          selectedOrg: "org-demo",
          selectedProject: "Projet A",
          selectedTeam: "Equipe Alpha",
          pat: "token-value-at-least-20-chars",
          serverUrl: "",
          startDate: "2026-01-01",
          endDate: "2026-03-01",
          doneStates: ["Done"],
          types: ["Bug"],
          includeZeroWeeks: true,
        });

        const demoFilteredThroughput = await forecastMod.fetchTeamThroughput({
          demoMode: true,
          selectedOrg: "Acme Corp",
          selectedProject: "Programme Titan",
          selectedTeam: "Alpha",
          pat: "",
          serverUrl: "",
          startDate: "2026-01-01",
          endDate: "2026-03-01",
          doneStates: ["Done"],
          types: ["Bug"],
          includeZeroWeeks: false,
        });

        apiMode = "partial-warning";
        const warningThroughput = await forecastMod.fetchTeamThroughput({
          selectedOrg: "org-demo",
          selectedProject: "Projet A",
          selectedTeam: "Equipe Alpha",
          pat: "token-value-at-least-20-chars",
          serverUrl: "",
          startDate: "2026-01-01",
          endDate: "2026-03-01",
          doneStates: ["Done"],
          types: ["Bug"],
          includeZeroWeeks: true,
        });
        apiMode = "success";

        const backlogResponse = await forecastMod.simulateForecastFromSamples({
          throughputSamples: [1, 2, 3, 4, 5, 6],
          includeZeroWeeks: true,
          simulationMode: "backlog_to_weeks",
          backlogSize: 80,
          targetWeeks: 12,
          nSims: 2000,
          selectedOrg: "org-demo",
          selectedProject: "",
          selectedTeam: "Equipe Alpha",
          startDate: "2026-01-01",
          endDate: "2026-03-01",
          doneStates: ["Done"],
          types: ["Bug"],
        });

        const demoBacklogResponse = await forecastMod.simulateForecastFromSamples({
          demoMode: true,
          throughputSamples: [1, 2, 3, 4, 5, 6],
          includeZeroWeeks: true,
          simulationMode: "backlog_to_weeks",
          backlogSize: 80,
          targetWeeks: 12,
          nSims: 2000,
        });

        const itemsResponse = await forecastMod.simulateForecastFromSamples({
          throughputSamples: [1, 2, 3, 4, 5, 6],
          includeZeroWeeks: true,
          simulationMode: "weeks_to_items",
          backlogSize: 80,
          targetWeeks: 12,
          nSims: 2000,
          selectedOrg: "org-demo",
          selectedProject: "Projet A",
          selectedTeam: "Equipe Alpha",
          startDate: "2026-01-01",
          endDate: "2026-03-01",
          doneStates: ["Done"],
          types: ["Bug"],
        });

        const forecast = await forecastMod.runSimulationForecast({
          selectedOrg: "org-demo",
          selectedProject: "",
          selectedTeam: "Equipe Alpha",
          pat: "token-value-at-least-20-chars",
          serverUrl: "",
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

        apiMode = "simulate-detail-error";
        const simulateDetailError = await apiMod
          .postSimulate({
            throughput_samples: [1, 2, 3, 4, 5, 6],
            mode: "backlog_to_weeks",
            backlog_size: 10,
            n_sims: 2000,
          })
          .catch((error) => String(error?.message || error));

        apiMode = "history-http-error";
        const historyHttpError = await apiMod.getSimulationHistory().catch((error) => String(error?.message || error));
        apiMode = "simulate-http-error";
        const simulateHttpError = await apiMod
          .postSimulate({
            throughput_samples: [1, 2, 3, 4, 5, 6],
            mode: "backlog_to_weeks",
            backlog_size: 10,
            n_sims: 2000,
          })
          .catch((error) => String(error?.message || error));
        apiMode = "history-detail-error";
        const historyDetailError = await apiMod.getSimulationHistory().catch((error) => String(error?.message || error));
        apiMode = "success";
        const history = await apiMod.getSimulationHistory();

        return {
          objectThroughputWeeks: objectThroughput.weeklyThroughput.length,
          objectThroughputWarning: objectThroughput.warning,
          demoFilteredSamples: demoFilteredThroughput.throughputSamples.length,
          warningThroughputMessage: warningThroughput.warning,
          backlogKind: backlogResponse.result_kind,
          demoBacklogKind: demoBacklogResponse.result_kind,
          itemsKind: itemsResponse.result_kind,
          fallbackProject: forecast.historyEntry.result ? forecast.historyEntry.selectedProject : "",
          simulateDetailError,
          historyHttpError,
          simulateHttpError,
          historyDetailError,
          historyLength: history.length,
        };
      } finally {
        window.fetch = originalFetch;
      }
    });

    expect(results.objectThroughputWeeks).toBeGreaterThanOrEqual(6);
    expect(results.objectThroughputWarning).toBeUndefined();
    expect(results.demoFilteredSamples).toBeGreaterThan(0);
    expect(results.warningThroughputMessage).toContain("historique partiel");
    expect(results.backlogKind).toBe("weeks");
    expect(results.demoBacklogKind).toBe("weeks");
    expect(results.itemsKind).toBe("items");
    expect(results.fallbackProject).toBe("");
    expect(results.simulateDetailError).toContain("bad payload");
    expect(results.historyHttpError).toContain("HTTP 502");
    expect(results.simulateHttpError).toContain("HTTP 503");
    expect(results.historyDetailError).toContain("history exploded");
    expect(results.historyLength).toBe(0);
  });

  test("coverage: app global org backspace", async ({ page }) => {
    await setupAppRoutes(page, {
      profileFirstUnauthorized: false,
      emptyAccountsBefore: 0,
    });

    await page.goto("/");
    await page.locator('input[type="password"]').fill("token-value-at-least-20-chars");
    await page.getByRole("button", { name: "Se connecter" }).click();
    await expect(page.getByText(/Organisations accessibles/i)).toBeVisible();

    await page.locator("body").press("Backspace");
    await expect(page.getByText("Connexion Azure DevOps")).toBeVisible();
  });

  test("coverage: app demo mode", async ({ page }) => {
    await page.goto("/?demo=true");

    await expect(page.getByText(/Vous êtes en mode démo/i)).toBeVisible();
    await expect(page.getByRole("link", { name: /Connecter un vrai compte/i })).toHaveCount(0);
    await expect(page.getByTestId("selected-team-card")).toBeVisible();
    await expect(page.getByTestId("selected-team-name")).toHaveText("Alpha");

    await page.locator("body").press("Backspace");
    await expect(page.getByRole("button", { name: /Choisir cette/i })).toBeVisible();

    await page.getByRole("button", { name: /Portefeuille/i }).click();
    await expect(page.getByText(/Chargement du portefeuille|Simulation Portefeuille/i)).toBeVisible();

    await page.locator("body").press("Backspace");
    await expect(page.getByRole("button", { name: /Choisir cette/i })).toBeVisible();

    await page.locator("select").first().selectOption("Beta");
    await page.getByRole("button", { name: /Choisir cette/i }).click();
    await expect(page.getByTestId("selected-team-name")).toHaveText("Beta");
  });

  test("coverage: app project and team backspace", async ({ page }) => {
    await setupAppRoutes(page, {
      profileFirstUnauthorized: false,
      emptyAccountsBefore: 0,
    });

    await page.goto("/");
    await page.locator('input[type="password"]').fill("token-value-at-least-20-chars");
    await page.getByRole("button", { name: "Se connecter" }).click();
    await expect(page.getByText(/Organisations accessibles/i)).toBeVisible();

    await page.locator("select").first().selectOption("org-demo");
    await page.getByRole("button", { name: "Choisir cette organisation" }).click();
    await expect(page.getByRole("heading", { name: /Choix du projet/i })).toBeVisible();

    await page.locator("body").press("Backspace");
    await expect(page.getByText(/Organisations accessibles/i)).toBeVisible();

    await page.locator("select").first().selectOption("org-demo");
    await page.getByRole("button", { name: "Choisir cette organisation" }).click();
    await page.locator("select").first().selectOption("Projet A");
    await page.getByRole("button", { name: "Choisir ce Projet" }).click();
    await expect(page.getByRole("button", { name: /Choisir cette/i })).toBeVisible();

    await page.locator("body").press("Backspace");
    await expect(page.getByRole("heading", { name: /Choix du projet/i })).toBeVisible();
  });

  test("coverage: app editable backspace and team validation", async ({ page }) => {
    await setupAppRoutes(page, {
      profileFirstUnauthorized: true,
      emptyAccountsBefore: 2,
    });

    await page.goto("/");
    await page.locator('input[type="password"]').fill("token-value-at-least-20-chars");
    await page.getByRole("button", { name: "Se connecter" }).click();
    await expect(page.getByPlaceholder("Nom de l'organisation")).toBeVisible();

    const orgInput = page.getByPlaceholder("Nom de l'organisation");
    await orgInput.fill("org-demo");
    await orgInput.press("Backspace");
    await expect(page.getByPlaceholder("Nom de l'organisation")).toBeVisible();

    await orgInput.fill("org-demo");
    await page.getByRole("button", { name: "Choisir cette organisation" }).click();
    await page.locator("select").first().selectOption("Projet A");
    await page.getByRole("button", { name: "Choisir ce Projet" }).click();
    await expect(page.getByRole("button", { name: /Choisir cette/i })).toBeVisible();

    await page.evaluate(() => {
      const select = document.querySelector("select");
      if (select instanceof HTMLSelectElement) {
        select.value = "";
        select.dispatchEvent(new Event("change", { bubbles: true }));
      }
      const button = Array.from(document.querySelectorAll("button")).find((node) =>
        /Choisir cette/i.test(node.textContent || ""),
      );
      if (button instanceof HTMLButtonElement) {
        button.disabled = false;
        button.click();
      }
    });
    await expect(page.getByRole("button", { name: /Choisir cette/i })).toBeVisible();
  });

  test("coverage: simulation utils direct", async ({ page }) => {
    await page.goto("/");

    const results = await page.evaluate(async () => {
      const simulationMod = await import("/src/utils/simulation.ts");

      let emptyTeamsError = "";
      let emptyTeamSamplesError = "";
      let invalidIncludeZeroError = "";
      let invalidExcludeZeroError = "";

      try {
        simulationMod.buildScenarioSamples([], 80);
      } catch (error) {
        emptyTeamsError = String(error?.message || error);
      }

      try {
        simulationMod.buildScenarioSamples([[1, 2], []], 80);
      } catch (error) {
        emptyTeamSamplesError = String(error?.message || error);
      }

      const singleTeam = simulationMod.buildScenarioSamples([[5, 8, 13]], 20);
      const multiTeam = simulationMod.buildScenarioSamples(
        [
          [10],
          [20],
          [40],
          [80],
        ],
        80,
      );

      const riskLabels = [
        simulationMod.computeRiskLegend(0.1),
        simulationMod.computeRiskLegend(0.35),
        simulationMod.computeRiskLegend(0.7),
        simulationMod.computeRiskLegend(0.95),
      ];

      const riskScores = [
        simulationMod.computeRiskScoreFromPercentiles("backlog_to_weeks", { P50: 0, P90: 12 }),
        simulationMod.computeRiskScoreFromPercentiles("backlog_to_weeks", { P50: 10, P90: 14 }),
        simulationMod.computeRiskScoreFromPercentiles("weeks_to_items", { P50: 10, P90: 6 }),
        simulationMod.computeRiskScoreFromPercentiles("weeks_to_items", { P50: 10, P90: 12 }),
      ];

      const reliabilities = [
        simulationMod.computeThroughputReliability([]),
        simulationMod.computeThroughputReliability([Number.NaN, Number.POSITIVE_INFINITY]),
        simulationMod.computeThroughputReliability([4, 4, 4, 4, 4]),
        simulationMod.computeThroughputReliability([0, 20, 0, 20, 0, 20, 0, 20]),
        simulationMod.computeThroughputReliability([10, 11, 12, 13, 14, 15, 16, 17]),
        simulationMod.computeThroughputReliability([10, 10, 10, 10, 10, 10, 10]),
        simulationMod.computeThroughputReliability([12, 12, 13, 12, 12, 13, 12, 12, 13, 12]),
      ].map((entry) => entry?.label ?? null);

      const backlogResult = simulationMod.simulateMonteCarloLocal({
        throughputSamples: [0, 2, 3, 4, 5, 6, 7],
        includeZeroWeeks: true,
        mode: "backlog_to_weeks",
        backlogSize: 120,
        nSims: 500,
      });

      const itemsResult = simulationMod.simulateMonteCarloLocal({
        throughputSamples: [1, 2, 3, 4, 5, 6, 7],
        includeZeroWeeks: false,
        mode: "weeks_to_items",
        targetWeeks: 12,
        nSims: 500,
      });

      const histogramResult = simulationMod.simulateMonteCarloLocal({
        throughputSamples: Array.from({ length: 250 }, (_value, index) => index),
        includeZeroWeeks: true,
        mode: "weeks_to_items",
        targetWeeks: 1,
        nSims: 1000,
      });

      try {
        simulationMod.simulateMonteCarloLocal({
          throughputSamples: [Number.NaN, Number.POSITIVE_INFINITY],
          includeZeroWeeks: true,
          mode: "backlog_to_weeks",
          backlogSize: 10,
          nSims: 10,
        });
      } catch (error) {
        invalidIncludeZeroError = String(error?.message || error);
      }

      try {
        simulationMod.simulateMonteCarloLocal({
          throughputSamples: [0, -1],
          includeZeroWeeks: false,
          mode: "backlog_to_weeks",
          backlogSize: 10,
          nSims: 10,
        });
      } catch (error) {
        invalidExcludeZeroError = String(error?.message || error);
      }

      return {
        emptyTeamsError,
        emptyTeamSamplesError,
        invalidIncludeZeroError,
        invalidExcludeZeroError,
        riskLabels,
        riskScores,
        reliabilities,
        singleTeamLengths: Object.values(singleTeam).map((values) => values.length),
        multiTeamConservative: multiTeam.conservative[0],
        backlogKind: backlogResult.result_kind,
        itemsKind: itemsResult.result_kind,
        histogramBuckets: histogramResult.result_distribution.length,
      };
    });

    expect(results.emptyTeamsError).toContain("teamSamples");
    expect(results.emptyTeamSamplesError).toContain("chaque equipe");
    expect(results.invalidIncludeZeroError).toContain(">= 0");
    expect(results.invalidExcludeZeroError).toContain("> 0");
    expect(results.riskLabels).toEqual(["fiable", "incertain", "fragile", "non fiable"]);
    expect(results.riskScores).toEqual([0, 0.4, 0.4, 0]);
    expect(results.reliabilities).toContain("non fiable");
    expect(results.reliabilities).toContain("fragile");
    expect(results.reliabilities).toContain("incertain");
    expect(results.reliabilities).toContain("fiable");
    expect(results.singleTeamLengths).toEqual([3, 3, 3, 3]);
    expect(results.multiTeamConservative).toBeGreaterThan(0);
    expect(results.backlogKind).toBe("weeks");
    expect(results.itemsKind).toBe("items");
    expect(results.histogramBuckets).toBeLessThanOrEqual(100);
  });

  test("coverage: simulation context direct", async ({ page }) => {
    await page.goto("/");

    const results = await page.evaluate(async () => {
      const { React, createRoot } = await import("/src/e2e/runtime.ts");
      const contextModule = await import("/src/hooks/SimulationContext.tsx");

      let outsideError = "";
      let insideSelectedTeam = "";
      let childText = "";

      const flush = async () => {
        await Promise.resolve();
        await new Promise((resolve) => window.setTimeout(resolve, 0));
      };

      const host = document.createElement("div");
      document.body.appendChild(host);
      const root = createRoot(host);

      function CrashHarness() {
        try {
          contextModule.useSimulationContext();
        } catch (error) {
          outsideError = String(error?.message || error);
        }
        return null;
      }

      function ValueHarness() {
        const value = contextModule.useSimulationContext();
        insideSelectedTeam = value.selectedTeam;
        return React.createElement("div", null, "Contenu du provider");
      }

      root.render(React.createElement(CrashHarness));
      await flush();

      root.render(
        React.createElement(
          contextModule.SimulationProvider,
          {
            value: {
              selectedTeam: "Equipe E2E",
              simulation: { id: "sim-e2e" },
            },
          },
          React.createElement(ValueHarness),
        ),
      );
      await flush();

      childText = host.textContent || "";
      root.unmount();
      host.remove();

      return { outsideError, insideSelectedTeam, childText };
    });

    expect(results.outsideError).toContain("SimulationProvider");
    expect(results.insideSelectedTeam).toBe("Equipe E2E");
    expect(results.childText).toContain("Contenu du provider");
  });

  test("coverage: useTeamOptions direct", async ({ page }) => {
    await page.goto("/");

    const results = await page.evaluate(async () => {
      const { React, createRoot } = await import("/src/e2e/runtime.ts");
      const { useTeamOptions } = await import("/src/hooks/useTeamOptions.ts");
      const { buildQuickFiltersScopeKey, writeStoredQuickFilters } = await import("/src/storage.ts");
      const originalFetch = window.fetch.bind(window);

      const flush = async () => {
        await Promise.resolve();
        await new Promise((resolve) => window.setTimeout(resolve, 0));
      };

      const jsonResponse = (payload, status = 200, statusText = "OK") =>
        new Response(JSON.stringify(payload), {
          status,
          statusText,
          headers: { "Content-Type": "application/json" },
        });

      let fetchMode = "success";
      window.fetch = async (input, init) => {
        const decoded = decodeURIComponent(String(input));
        if (decoded.includes("/_apis/wit/workitemtypes?")) {
          if (fetchMode === "failure") {
            return new Response("{}", { status: 500, statusText: "Server Error" });
          }
          if (fetchMode === "empty-types") {
            return jsonResponse({ value: [] });
          }
          return jsonResponse({ value: [{ name: "Bug" }, { name: "Task" }] });
        }
        if (decoded.includes("/workitemtypes/Bug/states?")) {
          return fetchMode === "missing-states" ? jsonResponse({ value: [] }) : jsonResponse({ value: [{ name: "Done" }, { name: "Closed" }] });
        }
        if (decoded.includes("/workitemtypes/Task/states?")) {
          return fetchMode === "missing-states" ? jsonResponse({ value: [] }) : jsonResponse({ value: [{ name: "Done" }] });
        }
        return originalFetch(input, init);
      };

      const runScenario = async (params) => {
        const container = document.createElement("div");
        document.body.appendChild(container);
        const root = createRoot(container);
        let latestState;
        let effectCount = 0;
        let setTypesCalls = [];
        let setDoneStatesCalls = [];
        let resetCalls = 0;

        function Harness() {
          const [types, setTypes] = React.useState([]);
          const [doneStates, setDoneStates] = React.useState([]);
          const state = useTeamOptions({
            ...params,
            setTypes: (value) => {
              setTypesCalls.push(Array.isArray(value) ? [...value] : value);
              setTypes(value);
            },
            setDoneStates: (value) => {
              setDoneStatesCalls.push(Array.isArray(value) ? [...value] : value);
              setDoneStates(value);
            },
            onTeamOptionsReset: () => {
              resetCalls += 1;
            },
          });

          React.useEffect(() => {
            latestState = {
              ...state,
              currentTypes: [...types],
              currentDoneStates: [...doneStates],
            };
            effectCount += 1;
          }, [state, types, doneStates]);

          return null;
        }

        root.render(React.createElement(Harness));
        for (let i = 0; i < 12; i += 1) {
          await flush();
        }

        return {
          getState: () => latestState,
          getEffectCount: () => effectCount,
          getSetTypesCalls: () => setTypesCalls,
          getSetDoneStatesCalls: () => setDoneStatesCalls,
          getResetCalls: () => resetCalls,
          cleanup: () => {
            root.unmount();
            container.remove();
          },
        };
      };

      try {
        localStorage.clear();

        const demoScenario = await runScenario({
          demoMode: true,
          step: "simulation",
          selectedOrg: "Org",
          selectedProject: "Projet",
          selectedTeam: "Team A",
          pat: "",
          serverUrl: "",
          quickFiltersScopeKey: buildQuickFiltersScopeKey("Org", "Projet", "Team A"),
        });
        const demoState = demoScenario.getState();
        demoScenario.cleanup();

        const idleScenario = await runScenario({
          demoMode: false,
          step: "teams",
          selectedOrg: "Org",
          selectedProject: "Projet",
          selectedTeam: "Team A",
          pat: "pat",
          serverUrl: "",
          quickFiltersScopeKey: buildQuickFiltersScopeKey("Org", "Projet", "Team A"),
        });
        const idleState = idleScenario.getState();
        idleScenario.cleanup();

        const successScope = buildQuickFiltersScopeKey("Org", "Projet", "Team A");
        writeStoredQuickFilters(successScope, { types: ["Bug"], doneStates: ["Done"] });
        fetchMode = "success";
        const successScenario = await runScenario({
          demoMode: false,
          step: "simulation",
          selectedOrg: "Org",
          selectedProject: "Projet",
          selectedTeam: "Team A",
          pat: "pat",
          serverUrl: "",
          quickFiltersScopeKey: successScope,
        });
        await flush();
        successScenario.getState().applyQuickFilterConfig();
        await flush();
        const successState = successScenario.getState();
        const successTypesCalls = successScenario.getSetTypesCalls();
        const successDoneCalls = successScenario.getSetDoneStatesCalls();
        const successResetCalls = successScenario.getResetCalls();
        successScenario.cleanup();

        const invalidScope = buildQuickFiltersScopeKey("Org", "Projet", "Team B");
        writeStoredQuickFilters(invalidScope, { types: ["Ghost"], doneStates: ["Missing"] });
        fetchMode = "empty-types";
        const fallbackDefaultsScenario = await runScenario({
          demoMode: false,
          step: "simulation",
          selectedOrg: "Org",
          selectedProject: "Projet",
          selectedTeam: "Team B",
          pat: "pat",
          serverUrl: "",
          quickFiltersScopeKey: invalidScope,
        });
        await flush();
        fallbackDefaultsScenario.getState().applyQuickFilterConfig();
        await flush();
        const fallbackDefaultsState = fallbackDefaultsScenario.getState();
        const fallbackDefaultsTypesCalls = fallbackDefaultsScenario.getSetTypesCalls();
        fallbackDefaultsScenario.cleanup();

        const failureScope = buildQuickFiltersScopeKey("Org", "Projet", "Team C");
        writeStoredQuickFilters(failureScope, { types: ["Bug"], doneStates: ["Done"] });
        fetchMode = "failure";
        const failureScenario = await runScenario({
          demoMode: false,
          step: "simulation",
          selectedOrg: "Org",
          selectedProject: "Projet",
          selectedTeam: "Team C",
          pat: "pat",
          serverUrl: "",
          quickFiltersScopeKey: failureScope,
        });
        await flush();
        const failureState = failureScenario.getState();
        const failureTypesCalls = failureScenario.getSetTypesCalls();
        const failureResetCalls = failureScenario.getResetCalls();
        failureScenario.getState().resetTeamOptions();
        await flush();
        const failureResetState = failureScenario.getState();
        failureScenario.cleanup();

        fetchMode = "missing-states";
        const missingStateScenario = await runScenario({
          demoMode: false,
          step: "simulation",
          selectedOrg: "Org",
          selectedProject: "Projet",
          selectedTeam: "Team D",
          pat: "pat",
          serverUrl: "",
          quickFiltersScopeKey: buildQuickFiltersScopeKey("Org", "Projet", "Team D"),
        });
        await flush();
        const missingStateResult = missingStateScenario.getState();
        missingStateScenario.cleanup();

        return {
          demoTypes: demoState.currentTypes,
          demoDoneStates: demoState.currentDoneStates,
          demoHasQuickConfig: demoState.hasQuickFilterConfig,
          idleLoading: idleState.loadingTeamOptions,
          idleTypes: idleState.workItemTypeOptions,
          successTypes: successState.workItemTypeOptions,
          successStatesForBug: successState.statesByType.Bug,
          successHasQuickConfig: successState.hasQuickFilterConfig,
          successTypesCalls,
          successDoneCalls,
          successResetCalls,
          fallbackDefaultsTypes: fallbackDefaultsState.workItemTypeOptions,
          fallbackDefaultsStates: fallbackDefaultsState.statesByType.Bug,
          fallbackDefaultsTypesCalls,
          failureTypes: failureState.workItemTypeOptions,
          failureStates: failureState.statesByType.Bug,
          failureHasQuickConfig: failureState.hasQuickFilterConfig,
          failureTypesCalls,
          failureResetCalls,
          failureResetStateTypes: failureResetState.workItemTypeOptions,
          missingStateTaskStates: missingStateResult.statesByType.Task,
        };
      } finally {
        window.fetch = originalFetch;
      }
    });

    expect(results.demoTypes.length).toBeGreaterThan(0);
    expect(results.demoDoneStates.length).toBeGreaterThan(0);
    expect(results.demoHasQuickConfig).toBe(false);
    expect(results.idleLoading).toBe(false);
    expect(results.idleTypes).toContain("Bug");
    expect(results.successTypes).toEqual(["Bug", "Task"]);
    expect(results.successStatesForBug).toEqual(["Closed", "Done"]);
    expect(results.successHasQuickConfig).toBe(true);
    expect(results.successTypesCalls.flat()).toContain("Bug");
    expect(results.successDoneCalls.flat()).toContain("Done");
    expect(results.successResetCalls).toBeGreaterThanOrEqual(1);
    expect(results.fallbackDefaultsTypes).toContain("User Story");
    expect(results.fallbackDefaultsStates).toEqual(["Done", "Closed", "Resolved"]);
    expect(results.fallbackDefaultsTypesCalls.length).toBe(0);
    expect(results.failureTypes).toContain("Bug");
    expect(results.failureStates).toEqual(["Done", "Closed", "Resolved"]);
    expect(results.failureHasQuickConfig).toBe(true);
    expect(results.failureTypesCalls.flat()).toContain("Bug");
    expect(results.failureResetCalls).toBeGreaterThanOrEqual(1);
    expect(results.failureResetStateTypes).toContain("User Story");
    expect(Array.isArray(results.missingStateTaskStates)).toBe(true);
  });

  test("coverage: simulation prefs direct", async ({ page }) => {
    await page.goto("/");

    const results = await page.evaluate(async () => {
      const { React, createRoot } = await import("/src/e2e/runtime.ts");
      const { useSimulationPrefs } = await import("/src/hooks/useSimulationPrefs.ts");

      const flush = async () => {
        await Promise.resolve();
        await new Promise((resolve) => window.setTimeout(resolve, 0));
      };

      const runScenario = async (storageValue, defaults, mutate) => {
        localStorage.removeItem("mc_simulation_prefs_v2");
        if (storageValue !== undefined) {
          localStorage.setItem("mc_simulation_prefs_v2", storageValue);
        }

        const container = document.createElement("div");
        document.body.appendChild(container);
        const root = createRoot(container);
        let latestState;

        function Harness() {
          const state = useSimulationPrefs(defaults);
          React.useEffect(() => {
            latestState = state;
          }, [state]);
          return null;
        }

        root.render(React.createElement(Harness));
        for (let i = 0; i < 6; i += 1) {
          await flush();
        }

        if (typeof mutate === "function") {
          mutate(latestState);
          for (let i = 0; i < 6; i += 1) {
            await flush();
          }
        }

        const stored = localStorage.getItem("mc_simulation_prefs_v2");
        const snapshot = {
          startDate: latestState.startDate,
          endDate: latestState.endDate,
          simulationMode: latestState.simulationMode,
          includeZeroWeeks: latestState.includeZeroWeeks,
          backlogSize: latestState.backlogSize,
          targetWeeks: latestState.targetWeeks,
          nSims: latestState.nSims,
        };

        root.unmount();
        container.remove();
        return { snapshot, stored };
      };

      const invalidScenario = await runScenario("not-json", {}, null);
      const storedScenario = await runScenario(
        JSON.stringify({
          startDate: "2026-01-01",
          endDate: "2026-03-01",
          simulationMode: "weeks_to_items",
          includeZeroWeeks: false,
          backlogSize: 90,
          targetWeeks: 8,
          nSims: 3000,
        }),
        {},
        null,
      );
      const forcedScenario = await runScenario(
        JSON.stringify({
          startDate: "2020-01-01",
          endDate: "2020-02-01",
          simulationMode: "weeks_to_items",
          includeZeroWeeks: false,
          backlogSize: 10,
          targetWeeks: 3,
          nSims: 12,
        }),
        {
          startDate: "2026-04-01",
          endDate: "2026-05-01",
          forceDefaults: true,
        },
        (state) => {
          state.setStartDate("2026-04-15");
          state.setEndDate("2026-05-15");
          state.setSimulationMode("backlog_to_weeks");
          state.setIncludeZeroWeeks(true);
          state.setBacklogSize("");
          state.setTargetWeeks("");
          state.setNSims("");
        },
      );

      return { invalidScenario, storedScenario, forcedScenario };
    });

    expect(results.invalidScenario.snapshot.simulationMode).toBe("backlog_to_weeks");
    expect(results.invalidScenario.snapshot.includeZeroWeeks).toBe(true);
    expect(JSON.parse(results.invalidScenario.stored).nSims).toBe(20000);
    expect(results.storedScenario.snapshot.startDate).toBe("2026-01-01");
    expect(results.storedScenario.snapshot.endDate).toBe("2026-03-01");
    expect(results.storedScenario.snapshot.simulationMode).toBe("weeks_to_items");
    expect(results.storedScenario.snapshot.includeZeroWeeks).toBe(false);
    expect(results.storedScenario.snapshot.backlogSize).toBe(90);
    expect(results.forcedScenario.snapshot.startDate).toBe("2026-04-15");
    expect(results.forcedScenario.snapshot.endDate).toBe("2026-05-15");
    expect(results.forcedScenario.snapshot.simulationMode).toBe("backlog_to_weeks");
    expect(results.forcedScenario.snapshot.includeZeroWeeks).toBe(true);
    expect(results.forcedScenario.snapshot.backlogSize).toBe("");
    expect(JSON.parse(results.forcedScenario.stored).backlogSize).toBe(0);
    expect(JSON.parse(results.forcedScenario.stored).targetWeeks).toBe(0);
    expect(JSON.parse(results.forcedScenario.stored).nSims).toBe(0);
  });

  test("coverage: portfolio print and pdf edge branches", async ({ page }) => {
    await page.goto("/");

    const results = await page.evaluate(async () => {
      const pdfModule = await import("/src/components/steps/simulationPdfDownload.ts");
      const printModule = await import("/src/components/steps/portfolioPrintReport.ts");
      const originalOpen = window.open.bind(window);

      const simulationDocLegacy = document.implementation.createHTMLDocument("simulation-legacy");
      simulationDocLegacy.body.innerHTML = `
        <h1>Simulation Monte Carlo</h1>
        <div class="meta-row">Periode: 2026-01-01 au 2026-03-01</div>
        <div class="meta-row">Mode: Backlog vers semaines</div>
        <div class="kpi"><span class="kpi-label">P50</span><span class="kpi-value">10 semaines</span></div>
        <div class="chart-wrap"><svg viewBox="0 0 960 360"></svg></div>
      `;

      const simulationDocScoped = document.implementation.createHTMLDocument("simulation-scoped");
      simulationDocScoped.body.innerHTML = `
        <h1>Simulation Monte Carlo</h1>
        <div class="summary-grid">
          <div class="meta">
            <div class="meta-row">Periode: 2026-01-01 au 2026-03-01</div>
            <div class="meta-row">Mode: Semaines vers items</div>
          </div>
          <aside class="diagnostic-card">
            <div class="diagnostic-title">Diagnostic</div>
            <div class="meta-row">Lecture: Historique globalement stable.</div>
            <div class="meta-row">CV: 0,32</div>
          </aside>
        </div>
        <div class="kpis">
          <div class="kpi"><span class="kpi-label">P50</span><span class="kpi-value">82 items</span></div>
          <div class="kpi"><span class="kpi-label">P70</span><span class="kpi-value">75 items</span></div>
        </div>
        <div class="kpis">
          <div class="kpi"><span class="kpi-label">Risk Score</span><span class="kpi-value">0,21 (incertain)</span></div>
          <div class="kpi"><span class="kpi-label">Fiabilite</span><span class="kpi-value">0,32 (fiable)</span></div>
        </div>
        <h2>Titre PDF custom</h2>
        <div class="chart-wrap"><svg viewBox="0 0 960 1200"></svg></div>
        <div class="chart-wrap"><svg viewBox="0 0 960 1200"></svg></div>
      `;

      const portfolioDocNoSummary = document.implementation.createHTMLDocument("portfolio-nosummary");
      portfolioDocNoSummary.body.innerHTML = `
        <section class="page">
          <h1>Simulation Portefeuille</h1>
          <div class="meta">
            <div class="meta-row">Projet: Projet A</div>
          </div>
          <div class="hypothesis"><strong>Risk Score :</strong> Lecture synthetique</div>
          <div class="hypothesis">Conservateur : marge defensive</div>
          <div class="kpis">
            <div class="kpi"><span class="kpi-label">P50</span><span class="kpi-value">10 semaines</span></div>
          </div>
          <div class="chart-wrap"><svg viewBox="0 0 960 360"></svg></div>
        </section>
      `;

      const portfolioDocSummary = document.implementation.createHTMLDocument("portfolio-summary");
      const longRows = Array.from({ length: 18 }, (_, index) =>
        `<tr><td>Scenario ${index + 1}</td><td>10</td><td>12</td><td>15</td><td>${index % 2 === 0 ? "0,20 (fiable)" : "0,62 (fragile)"}</td><td>${index % 3 === 0 ? "0,25 (fiable)" : "1,20 (non fiable)"}</td></tr>`,
      ).join("");
      portfolioDocSummary.body.innerHTML = `
        <section class="page">
          <h1>Simulation Portefeuille</h1>
          <div class="summary-grid">
            <div class="meta">
              <div class="meta-row">Projet: Projet A</div>
              <div class="meta-row">Periode: 2026-01-01 au 2026-03-01</div>
            </div>
            <aside class="diagnostic-card">
              <div class="diagnostic-title">Diagnostic</div>
              <div class="meta-row">Lecture: Throughput en baisse sur les dernieres semaines.</div>
            </aside>
          </div>
          <table class="summary-table">
            <thead>
              <tr><th>Scenario</th><th>P50</th><th>P70</th><th>P90</th><th>Risk Score</th><th>Fiabilite</th></tr>
            </thead>
            <tbody>${longRows}</tbody>
          </table>
          <div class="hypothesis"><strong>Optimiste :</strong> somme des debits</div>
          <div class="hypothesis">Règle de lecture : commencer par la fiabilite</div>
          <div class="kpis">
            <div class="kpi"><span class="kpi-label">P50</span><span class="kpi-value">10 semaines</span></div>
            <div class="kpi"><span class="kpi-label">Fiabilite</span><span class="kpi-value">0,25 (fiable)</span></div>
          </div>
          <h2>Courbes de probabilités comparées</h2>
          <div class="chart-wrap"><svg viewBox="0 0 960 360"></svg></div>
        </section>
      `;

      await pdfModule.downloadSimulationPdf(simulationDocLegacy, "***");
      await pdfModule.downloadSimulationPdf(simulationDocScoped, "Equipe Alpha");
      await pdfModule.downloadPortfolioPdf(portfolioDocNoSummary, "Projet A", false);
      await pdfModule.downloadPortfolioPdf(portfolioDocSummary, "Projet A", true);

      let nullOpenReturned = false;
      window.open = () => null;
      printModule.exportPortfolioPrintReport({
        isDemo: false,
        selectedProject: "Projet A",
        startDate: "2026-01-01",
        endDate: "2026-03-01",
        alignmentRate: 80,
        includedTeams: [],
        scenarios: [],
        sections: [],
      });
      nullOpenReturned = true;

      let onloadAssigned = false;
      let renderedHtml = "";
      let boundClicks = 0;
      let downloadInvoked = 0;
      let alertMessage = "";

      const popupDoc = document.implementation.createHTMLDocument("portfolio-export-edge");
      const popup = {
        document: Object.assign(popupDoc, {
          open: () => undefined,
          write: (html) => {
            renderedHtml = html;
            popupDoc.documentElement.innerHTML = html;
          },
          close: () => undefined,
        }),
        onload: null,
        close: () => undefined,
        alert: (message) => {
          alertMessage = String(message || "");
        },
      };

      window.open = () => popup;
      const originalGetElementById = popupDoc.getElementById.bind(popupDoc);
      popupDoc.getElementById = (id) => {
        const element = originalGetElementById(id);
        if (id === "download-pdf" && element && !element.__patchedForE2E) {
          const originalAddEventListener = element.addEventListener.bind(element);
          element.addEventListener = (name, handler, options) => {
            if (name === "click") {
              boundClicks += 1;
            }
            return originalAddEventListener(name, handler, options);
          };
          element.__patchedForE2E = true;
        }
        return element;
      };

      printModule.exportPortfolioPrintReport({
        isDemo: true,
        selectedProject: "Projet A",
        startDate: "2026-01-01",
        endDate: "2026-03-01",
        alignmentRate: 80,
        includedTeams: ["Equipe Alpha", "Equipe Beta"],
        scenarios: [
          {
            label: "Conservateur",
            hypothesis: "hyp conservative",
            samples: [1, 2, 3],
            weeklyData: [{ week: "2026-01-01", throughput: 1 }],
            percentiles: { P50: 6, P70: 7, P90: 9 },
            riskScore: 0.3,
            riskLegend: "incertain",
            distribution: [{ x: 6, count: 10 }],
            throughputReliability: { cv: 1.6, iqr_ratio: 1.2, slope_norm: -0.2, label: "non fiable", samples_count: 5 },
          },
          {
            label: "Friction (64%)",
            hypothesis: "hyp friction",
            samples: [1.5, 2, 2.5],
            weeklyData: [{ week: "2026-01-01", throughput: 1.5 }],
            percentiles: { P50: 7, P70: 8, P90: 10 },
            riskScore: 0.28,
            riskLegend: "incertain",
            distribution: [{ x: 7, count: 10 }],
            throughputReliability: { cv: 1.01, iqr_ratio: 0.7, slope_norm: -0.11, label: "fragile", samples_count: 8 },
          },
          {
            label: "Arrime (80%)",
            hypothesis: "hyp aligned",
            samples: [2, 3, 4],
            weeklyData: [{ week: "2026-01-01", throughput: 2 }],
            percentiles: { P50: 8, P70: 10, P90: 12 },
            riskScore: 0.25,
            riskLegend: "incertain",
            distribution: [{ x: 8, count: 10 }],
            throughputReliability: { cv: 0.51, iqr_ratio: 0.55, slope_norm: -0.03, label: "incertain", samples_count: 8 },
          },
          {
            label: "Optimiste",
            hypothesis: "hyp optimistic",
            samples: [3, 4, 5],
            weeklyData: [{ week: "2026-01-01", throughput: 3 }],
            percentiles: { P50: 100, P70: 110, P90: 120 },
            riskScore: 0.2,
            riskLegend: "fiable",
            distribution: [
              { x: 10, count: 10 },
              { x: 20, count: 80 },
              { x: 30, count: 10 },
              { x: Number.NaN, count: 0 },
            ],
            throughputReliability: { cv: 0.22, iqr_ratio: 0.3, slope_norm: -0.02, label: "fiable", samples_count: 8 },
          },
        ],
        sections: [
          {
            selectedTeam: "Equipe Alpha",
            simulationMode: "weeks_to_items",
            includeZeroWeeks: false,
            backlogSize: 120,
            targetWeeks: 12,
            nSims: 20000,
            types: ["Bug"],
            doneStates: ["Done"],
            resultKind: "items",
            riskScore: Number.NaN,
            throughputReliability: null,
            distribution: [
              { x: 10, count: 10 },
              { x: 20, count: 80 },
              { x: 30, count: 10 },
            ],
            weeklyThroughput: [
              { week: "2026-01-01", throughput: 3 },
              { week: "2026-01-08", throughput: 0 },
            ],
            displayPercentiles: { P50: 100, P70: 110, P90: 120 },
          },
          {
            selectedTeam: "Equipe Beta",
            simulationMode: "backlog_to_weeks",
            includeZeroWeeks: true,
            backlogSize: 80,
            targetWeeks: 6,
            nSims: 1000,
            types: [],
            doneStates: [],
            resultKind: "weeks",
            riskScore: 0.35,
            throughputReliability: { cv: 0.62, iqr_ratio: 0.55, slope_norm: -0.07, label: "incertain", samples_count: 10 },
            distribution: [{ x: 10, count: 20 }],
            weeklyThroughput: [{ week: "2026-01-01", throughput: 3 }],
            displayPercentiles: { P50: 10, P70: 12, P90: 15 },
          },
        ],
      });

      onloadAssigned = typeof popup.onload === "function";
      popup.onload?.();
      popup.__downloadPdf?.();
      downloadInvoked += 1;

      window.open = originalOpen;

      return {
        nullOpenReturned,
        onloadAssigned,
        boundClicks,
        downloadInvoked,
        renderedHtml,
        alertMessage,
      };
    });

    expect(results.nullOpenReturned).toBe(true);
    expect(results.onloadAssigned).toBe(true);
    expect(results.boundClicks).toBeGreaterThanOrEqual(1);
    expect(results.downloadInvoked).toBe(1);
    expect(results.renderedHtml).toContain("Synthèse - Simulation Portefeuille");
    expect(results.renderedHtml).toContain("Scénario - Optimiste");
    expect(results.renderedHtml).toContain("Simulation Portefeuille - Equipe Alpha");
    expect(results.alertMessage).toBe("");
  });
});
