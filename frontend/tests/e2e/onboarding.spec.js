import { test, expect } from "@playwright/test";
import { setupAppRoutes } from "./helpers/mocks";

test("onboarding: validation PAT + navigation retour", async ({ page }) => {
  await setupAppRoutes(page, {
    profileFirstUnauthorized: true,
    emptyAccountsBefore: 2,
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
  await expect(page.getByRole("heading", { name: /Choix du projet/i })).toBeVisible();

  await page.getByRole("button", { name: /2\.\s+Organisation/i }).click();
  await expect(page.getByRole("heading", { name: /^Bienvenue/ })).toBeVisible();
  await page.getByRole("button", { name: /1\.\s+Connexion/i }).click();
  await expect(page.getByText("Connexion Azure DevOps")).toBeVisible();
});
