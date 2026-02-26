import { test, expect } from "@playwright/test";
import { summarizeCoverageIstanbul } from "./helpers/coverage";
import { setupAppRoutes } from "./helpers/mocks";

test.describe("e2e istanbul coverage", () => {
  test.describe.configure({ mode: "serial" });

  const allCoverageEntries = [];

  const openIfCollapsed = async (section) => {
    const button = section.getByRole("button", { name: /D[ée]velopper/i });
    if (await button.isVisible().catch(() => false)) {
      await button.click();
    }
  };

  const closeIfExpanded = async (section) => {
    const button = section.getByRole("button", { name: /R[ée]duire/i });
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
    await expect(page.getByText(/Organisation "org-demo" inaccessible/i)).toBeVisible();

    await page.getByRole("button", { name: /1\.\s+Connexion/i }).click();
    await expect(page.getByText("Connexion Azure DevOps")).toBeVisible();
    await page.locator('input[type="password"]').fill("token-value-at-least-20-chars");
    await page.getByRole("button", { name: "Se connecter" }).click();
    await page.getByPlaceholder("Nom de l'organisation").fill("org-demo");
    await page.getByRole("button", { name: "Choisir cette organisation" }).click();

    await expect(page.getByRole("heading", { name: /Choix du projet/i })).toBeVisible();
    await page.getByRole("button", { name: "Choisir ce Projet" }).click();
    await expect(page.getByText(/Impossible de lister les [ée]quipes/i)).toBeVisible();
    await page.getByRole("button", { name: "Choisir ce Projet" }).click();

    await page.locator("select").first().selectOption("Equipe Alpha");
    await page.getByRole("button", { name: /Choisir cette/i }).click();
    await expect(page.getByTestId("selected-team-name")).toHaveText("Equipe Alpha");

    const periodSection = page.locator("section.sim-control-section", { hasText: /P[ée]riode historique/i });
    const modeSection = page.locator("section.sim-control-section", { hasText: "Mode de simulation" });
    const filtersSection = page.locator("section.sim-control-section", { hasText: "Filtres de tickets" });

    await openIfCollapsed(periodSection);
    await page.locator('input[type="date"]').first().fill(closedDates[closedDates.length - 1].slice(0, 10));
    await page.locator('input[type="date"]').nth(1).fill(closedDates[0].slice(0, 10));
    await openIfCollapsed(filtersSection);
    await page.getByLabel("Bug").check();
    await page.getByLabel("Done").check();

    await page.getByRole("button", { name: "Lancer la simulation" }).click();
    await expect(page.getByText(/Historique insuffisant/i)).toBeVisible();

    await openIfCollapsed(modeSection);
    await page.getByLabel(/Inclure les semaines [àa] 0/i).check();
    await expect(page.getByText("Erreur simulation temporaire")).toBeVisible({ timeout: 10_000 });

    await openIfCollapsed(filtersSection);
    await page.getByLabel("Bug").check();
    await page.getByLabel("Done").check();
    await openIfCollapsed(modeSection);
    await page.locator("select").first().selectOption("weeks_to_items");
    await page.locator('input[type="number"]').first().fill("12");
    await closeIfExpanded(modeSection);
    await expect(page.getByText("38 items")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/Mode:\s*0\s*incluses/i)).toBeVisible();

    await openIfCollapsed(modeSection);
    await page.getByLabel(/Inclure les semaines [àa] 0/i).uncheck();
    await page.getByRole("tab", { name: "Distribution" }).click();
    await page.getByRole("tab", { name: /Probabilit/i }).click();
    await page.getByRole("tab", { name: "Throughput" }).click();

    await openIfCollapsed(modeSection);
    await page.locator("select").first().selectOption("backlog_to_weeks");
    await page.locator('input[type="number"]').first().fill("120");
    await closeIfExpanded(modeSection);
    await expect(page.getByText("10 semaines")).toBeVisible({ timeout: 10_000 });

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

    const filtersToggle = filtersSection.getByRole("button", { name: /D[ée]velopper/i });
    if (await filtersToggle.isVisible().catch(() => false)) {
      await filtersToggle.click();
    }
    await page.getByLabel("Bug").check();
    await page.getByLabel("Done").check();
    await page.getByLabel("User Story").check();
    await page.getByLabel("User Story").uncheck();
    await page.getByRole("button", { name: /Changer [ée]quipe/i }).click();
    await page.locator("select").first().selectOption("Equipe Beta");
    await page.getByRole("button", { name: /Choisir cette/i }).click();
    await expect(page.getByTestId("selected-team-name")).toHaveText("Equipe Beta");

    await openIfCollapsed(filtersSection);
    await page.getByLabel("Bug").check();
    await page.getByLabel("Done").check();
    await page.getByRole("button", { name: "Lancer la simulation" }).click();
    await expect(page.getByText("10 semaines")).toBeVisible({ timeout: 10_000 });

    await toggleThemeRoundTrip(page);

    await page.evaluate(async () => {
      const mod = await import("/src/hooks/probability.ts");
      mod.buildProbabilityCurve([], "weeks");
      mod.buildProbabilityCurve([{ x: 1, count: 0 }], "items");
      mod.buildAtLeastPercentiles([], [50, 70, 90]);
      mod.buildAtLeastPercentiles([{ x: 1, count: 0 }], [50, 70, 90]);
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
