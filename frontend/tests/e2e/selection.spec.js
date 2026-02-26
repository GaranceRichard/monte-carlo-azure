import { test, expect } from "@playwright/test";
import { setupAppRoutes } from "./helpers/mocks";

test("selection: erreurs projets/Ã©quipes + listes vides", async ({ page }) => {
  await setupAppRoutes(page, {
    profileFirstUnauthorized: false,
    emptyAccountsBefore: 0,
    projectsFirstError: true,
    teamsFirstError: true,
  });

  await page.goto("/");

  await page.locator('input[type="password"]').fill("token-value-at-least-20-chars");
  await page.getByRole("button", { name: "Se connecter" }).click();
  await page.locator("select").first().selectOption("org-demo");
  await page.getByRole("button", { name: "Choisir cette organisation" }).click();
  await expect(page.getByText(/(HTTP 500|chargement des projets|Organisation "org-demo" inaccessible)/i)).toBeVisible();

  await page.getByRole("button", { name: "Choisir cette organisation" }).click();
  await expect(page.getByRole("heading", { name: /Choix du projet/i })).toBeVisible();
  await page.getByRole("button", { name: "Choisir ce Projet" }).click();
  await expect(page.getByText(/(HTTP 500|chargement des equipes|Impossible de lister les [Ã©e]quipes)/i)).toBeVisible();

  await page.getByRole("button", { name: "Choisir ce Projet" }).click();
  await expect(page.getByRole("heading", { name: /Choix de/i })).toBeVisible();

  await page.getByRole("button", { name: /3\.\s+Projet/i }).click();
  await page.locator("select").first().selectOption("Projet Vide");
  await page.getByRole("button", { name: "Choisir ce Projet" }).click();
  await expect(page.getByRole("button", { name: /Choisir cette/i })).toBeDisabled();
});

