import { test, expect } from "@playwright/test";
import { setupAppRoutes } from "./helpers/mocks";

test("selection: erreurs projets/equipes + listes vides", async ({ page }) => {
  test.setTimeout(60_000);
  await setupAppRoutes(page, {
    profileFirstUnauthorized: false,
    emptyAccountsBefore: 0,
    projectsFirstError: true,
    teamsFirstError: true,
  });

  await page.goto("/", { waitUntil: "domcontentloaded" });

  await page.locator('input[type="password"]').fill("token-value-at-least-20-chars");
  await page.getByRole("button", { name: "Se connecter" }).click();
  await page.locator("select").first().selectOption("org-demo");
  await page.getByRole("button", { name: "Choisir cette organisation" }).click();
  await expect(page.getByText(/(HTTP 500|chargement des projets|Organisation "org-demo" inaccessible)/i)).toBeVisible();

  await page.getByRole("button", { name: "Choisir cette organisation" }).click();
  await expect(page.getByRole("heading", { name: /Choix du projet/i })).toBeVisible();
  await page.getByRole("button", { name: "Choisir ce Projet" }).click();
  await expect(page.getByText(/(HTTP 500|chargement des equipes|Impossible de lister les .quipes)/i)).toBeVisible();

  await page.getByRole("button", { name: "Choisir ce Projet" }).click();
  await expect(page.getByRole("button", { name: /Choisir cette/i })).toBeVisible();
  await expect(page.locator("select").first().locator("option")).toContainText(["Equipe Alpha", "Equipe Beta"]);

  await page.getByRole("button", { name: /3\.\s+Projet/i }).click();
  await page.locator("select").first().selectOption("Projet Vide");
  await page.getByRole("button", { name: "Choisir ce Projet" }).click();
  await expect(page.getByRole("button", { name: /Choisir cette/i })).toBeDisabled();
});

