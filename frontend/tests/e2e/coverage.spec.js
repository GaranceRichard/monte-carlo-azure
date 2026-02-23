import { test, expect } from "@playwright/test";
import { summarizeCoverageIstanbul } from "./helpers/coverage";
import { setupAppRoutes } from "./helpers/mocks";

test("coverage: flux complet front", async ({ page }) => {
  test.setTimeout(90_000);
  const { closedDates } = await setupAppRoutes(page, {
    profileFirstUnauthorized: true,
    emptyAccountsBefore: 2,
    projectsFirstError: true,
    teamsFirstError: true,
    teamOptionsFirstError: true,
    simulateFirstError: true,
  });

  await page.coverage.startJSCoverage({
    resetOnNavigation: false,
    reportAnonymousScripts: true,
  });

  await page.goto("/");

  await page.getByRole("button", { name: "Se connecter" }).click();
  await expect(page.getByText("PAT requis pour continuer.")).toBeVisible();

  await page.locator('input[type="password"]').fill("bad-token");
  await page.getByRole("button", { name: "Se connecter" }).click();
  await expect(page.getByText(/PAT invalide/i)).toBeVisible();

  await page.locator('input[type="password"]').fill("token-value-at-least-20-chars");
  await page.getByRole("button", { name: "Se connecter" }).click();
  await expect(page.getByText("Bienvenue Garance Richard")).toBeVisible();
  await expect(page.getByText(/PAT non global/i)).toBeVisible();
  await page.getByPlaceholder("Nom de l'organisation").fill("org-demo");

  await page.getByRole("button", { name: "Choisir cette organisation" }).click();
  await expect(page.getByText(/Organisation "org-demo" inaccessible/i)).toBeVisible();

  await page.getByRole("button", { name: "Changer PAT" }).click();
  await expect(page.getByText("Connexion Azure DevOps")).toBeVisible();
  await page.locator('input[type="password"]').fill("token-value-at-least-20-chars");
  await page.getByRole("button", { name: "Se connecter" }).click();
  await page.getByPlaceholder("Nom de l'organisation").fill("org-demo");
  await page.getByRole("button", { name: "Choisir cette organisation" }).click();

  await expect(page.getByRole("heading", { name: /Choix du projet/i })).toBeVisible();
  await page.getByRole("button", { name: "Choisir ce Projet" }).click();
  await expect(page.getByText(/Impossible de lister les equipes/i)).toBeVisible();
  await page.getByRole("button", { name: "Choisir ce Projet" }).click();

  await page.locator("select").first().selectOption("Equipe Alpha");
  await page.getByRole("button", { name: /Choisir cette/i }).click();
  await expect(page.getByText("Equipe: Equipe Alpha")).toBeVisible();
  await page.locator('input[type="date"]').first().fill(closedDates[closedDates.length - 1].slice(0, 10));
  await page.locator('input[type="date"]').nth(1).fill(closedDates[0].slice(0, 10));

  await page.getByRole("button", { name: "Lancer la simulation" }).click();
  await expect(page.getByText("Erreur simulation temporaire")).toBeVisible();

  await page.getByLabel("Bug").check();
  await page.locator("select").first().selectOption("weeks_to_items");
  await page.locator('input[type="number"]').first().fill("12");
  await page.getByRole("button", { name: "Lancer la simulation" }).click();
  await expect(page.getByText("38 items")).toBeVisible();
  await page.getByRole("button", { name: "Distribution" }).click();
  await page.getByRole("button", { name: /Courbe/i }).click();
  await page.getByRole("button", { name: "Throughput" }).click();

  await page.locator("select").first().selectOption("backlog_to_weeks");
  await page.locator('input[type="number"]').first().fill("120");
  await page.getByRole("button", { name: "Lancer la simulation" }).click();
  await expect(page.getByText("10 semaines")).toBeVisible();

  await page.getByRole("button", { name: /Se d.*connecter/i }).click();
  await expect(page.getByText("Connexion Azure DevOps")).toBeVisible();

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
  await page.locator("select").first().selectOption("Equipe Alpha");
  await page.getByRole("button", { name: /Choisir cette/i }).click();
  await page.getByLabel("Bug").check();
  await page.getByLabel("User Story").check();
  await page.getByLabel("User Story").uncheck();
  await page.getByRole("button", { name: "Lancer la simulation" }).click();
  await expect(page.getByText("10 semaines")).toBeVisible();

  await page.locator("button[title*='Passer en mode']").click();

  const coverageEntries = await page.coverage.stopJSCoverage();
  const appEntries = coverageEntries.filter((e) => e?.url && e.url.includes("127.0.0.1:4173/src/"));
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
