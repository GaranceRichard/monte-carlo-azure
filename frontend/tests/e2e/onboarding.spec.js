import { test, expect } from "@playwright/test";
import { setupAppRoutes } from "./helpers/mocks";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });
});

test("onboarding: validation PAT + navigation retour", async ({ page }) => {
  test.setTimeout(60_000);
  await setupAppRoutes(page, {
    profileFirstUnauthorized: true,
    emptyAccountsBefore: 2,
  });

  await page.goto("/", { waitUntil: "domcontentloaded" });

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

test("onboarding: portfolio puis retour equipe puis simulation", async ({ page }) => {
  test.setTimeout(60_000);
  await setupAppRoutes(page, {
    profileFirstUnauthorized: false,
    emptyAccountsBefore: 0,
  });

  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.locator('input[type="password"]').fill("token-value-at-least-20-chars");
  await page.getByRole("button", { name: "Se connecter" }).click();
  await expect(page.getByText(/Organisations accessibles/i)).toBeVisible();

  await page.locator("select").first().selectOption("org-demo");
  await page.getByRole("button", { name: "Choisir cette organisation" }).click();
  await expect(page.getByRole("heading", { name: /Choix du projet/i })).toBeVisible();
  await expect(page.locator("select").first().locator("option")).toContainText(["Projet A"]);
  await page.locator("select").first().selectOption("Projet A");
  await page.getByRole("button", { name: "Choisir ce Projet" }).click();
  await expect(page.getByRole("button", { name: /Choisir cette/i })).toBeVisible();
  await expect(page.locator("select").first().locator("option")).toContainText(["Equipe Alpha", "Equipe Beta"]);
  await page.locator("select").first().selectOption("Equipe Alpha");
  await page.getByRole("button", { name: /Choisir cette .quipe/i }).click();
  await expect(page.getByTestId("selected-team-card")).toBeVisible();
  await expect(page.getByTestId("selected-team-name")).toHaveText("Equipe Alpha");
  await expect(page.getByRole("heading", { name: /Simulation Delivery Forecast/i })).toBeVisible();

  await page.getByRole("button", { name: /Changer.*quipe/i }).click();
  await expect(page.getByRole("button", { name: /Choisir cette/i })).toBeVisible();
  await page.getByRole("button", { name: /Portefeuille/i }).click();
  await expect(page.getByRole("heading", { name: /Simulation Portefeuille/i })).toBeVisible();

  await page.getByRole("button", { name: /Changer.*quipe/i }).click();
  await expect(page.getByRole("button", { name: /Choisir cette/i })).toBeVisible();

  await expect(page.locator("select").first().locator("option")).toContainText(["Equipe Alpha", "Equipe Beta"]);
  await page.locator("select").first().selectOption("Equipe Beta");
  await page.getByRole("button", { name: /Choisir cette .quipe/i }).click();
  await expect(page.getByTestId("selected-team-card")).toBeVisible();
  await expect(page.getByTestId("selected-team-name")).toHaveText("Equipe Beta");
});

test("onboarding: app header branches for disconnect and theme", async ({ page }) => {
  test.setTimeout(60_000);

  await setupAppRoutes(page, {
    profileFirstUnauthorized: false,
    emptyAccountsBefore: 0,
  });

  await page.goto("/");
  const themeToggle = page.locator("button[title*='Passer en mode']");
  await themeToggle.click();
  await themeToggle.click();

  await page.locator('input[type="password"]').fill("token-value-at-least-20-chars");
  await page.getByRole("button", { name: "Se connecter" }).click();
  await page.locator("select").first().selectOption("org-demo");
  await page.getByRole("button", { name: "Choisir cette organisation" }).click();
  await page.locator("select").first().selectOption("Projet A");
  await page.getByRole("button", { name: "Choisir ce Projet" }).click();
  await page.locator("select").first().selectOption("Equipe Alpha");
  await page.getByRole("button", { name: /Choisir cette/i }).click();
  await expect(page.getByRole("button", { name: /Se d.*connecter/i })).toBeVisible();
});

test("onboarding: demo entry hides disconnect and lets user choose a team", async ({ page }) => {
  test.setTimeout(60_000);
  await page.goto("/?demo=true");
  await expect(page.locator("h2").nth(1)).toContainText("Choix");
  await expect(page.getByRole("button", { name: /Se d.*connecter/i })).toHaveCount(0);
  await page.getByRole("button", { name: /Choisir cette/i }).click();
  await expect(page.getByTestId("selected-team-card")).toBeVisible();
});
