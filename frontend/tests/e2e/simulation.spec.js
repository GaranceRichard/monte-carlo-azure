import { test, expect } from "@playwright/test";
import { completeOnboardingToSimulation, setupAppRoutes } from "./helpers/mocks";

test("simulation: erreur puis succes sur les 2 modes", async ({ page }) => {
  const { closedDates } = await setupAppRoutes(page, {
    profileFirstUnauthorized: false,
    emptyAccountsBefore: 0,
    simulateFirstError: true,
    teamOptionsFirstError: true,
  });

  await page.goto("/");
  await completeOnboardingToSimulation(page);
  const periodSection = page.locator("section.sim-control-section", { hasText: /P[ée]riode historique/i });
  const modeSection = page.locator("section.sim-control-section", { hasText: "Mode de simulation" });
  const filtersSection = page.locator("section.sim-control-section", { hasText: "Filtres de tickets" });

  await periodSection.getByRole("button", { name: /D[ée]velopper/i }).click();
  await page.locator('input[type="date"]').first().fill(closedDates[closedDates.length - 1].slice(0, 10));
  await page.locator('input[type="date"]').nth(1).fill(closedDates[0].slice(0, 10));
  await filtersSection.getByRole("button", { name: /D[ée]velopper/i }).click();
  await page.getByLabel("Bug").check();
  await page.getByLabel("Done").check();

  await page.getByRole("button", { name: "Lancer la simulation" }).click();
  await expect(page.getByText("Erreur simulation temporaire")).toBeVisible();

  await filtersSection.getByRole("button", { name: /D[ée]velopper/i }).click();
  await page.getByLabel("Bug").check();
  await page.getByLabel("Done").check();
  await modeSection.getByRole("button", { name: /D[ée]velopper/i }).click();
  await page.locator("select").first().selectOption("weeks_to_items");
  await page.locator('input[type="number"]').first().fill("12");
  await page.getByRole("button", { name: "Lancer la simulation" }).click();
  await expect(page.getByText("P50")).toBeVisible();
  await expect(page.getByText("38 items")).toBeVisible();

  await page.getByRole("button", { name: "Distribution" }).click();
  await page.getByRole("button", { name: /Courbe/i }).click();
  await page.getByRole("button", { name: "Throughput" }).click();

  await modeSection.getByRole("button", { name: /D[ée]velopper/i }).click();
  await page.locator("select").first().selectOption("backlog_to_weeks");
  await page.locator('input[type="number"]').first().fill("120");
  await page.getByRole("button", { name: "Lancer la simulation" }).click();
  await expect(page.getByText("10 semaines")).toBeVisible();
});
