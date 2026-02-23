import { expect } from "@playwright/test";

export function makeClosedDates(weeks = 30) {
  const dates = [];
  const now = new Date();
  const mondayUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 12, 0, 0, 0));
  const offsetToMonday = (mondayUtc.getUTCDay() + 6) % 7;
  mondayUtc.setUTCDate(mondayUtc.getUTCDate() - offsetToMonday);
  for (let i = 0; i < weeks; i += 1) {
    const d = new Date(mondayUtc);
    d.setUTCDate(mondayUtc.getUTCDate() - i * 7);
    dates.push(d.toISOString());
  }
  return dates;
}

export async function setupAppRoutes(page, options = {}) {
  const cfg = {
    profileFirstUnauthorized: true,
    emptyAccountsBefore: 2,
    projectsFirstError: false,
    teamsFirstError: false,
    teamOptionsFirstError: false,
    simulateFirstError: false,
    ...options,
  };

  const counters = {
    profileCalls: 0,
    accountsCalls: 0,
    projectsCalls: 0,
    teamsCalls: 0,
    teamOptionsCalls: 0,
    wiqlCalls: 0,
    workItemsCalls: 0,
    simulateCalls: 0,
  };

  const closedDates = makeClosedDates(30);

  await page.route("**/app.vssps.visualstudio.com/_apis/profile/profiles/me?*", async (route) => {
    counters.profileCalls += 1;
    if (cfg.profileFirstUnauthorized && counters.profileCalls === 1) {
      await route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({ message: "Unauthorized" }),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ displayName: "Garance Richard", id: "member-1" }),
    });
  });

  await page.route("**/app.vssps.visualstudio.com/_apis/accounts?*", async (route) => {
    counters.accountsCalls += 1;
    if (counters.accountsCalls <= cfg.emptyAccountsBefore) {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ value: [] }) });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        value: [
          { accountName: "org-demo" },
          { accountName: "org-empty" },
        ],
      }),
    });
  });

  await page.route("**/dev.azure.com/*/_apis/projects?*", async (route) => {
    const url = new URL(route.request().url());
    const parts = url.pathname.split("/").filter(Boolean);
    const org = parts[0] || "";

    if (org === "org-empty") {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ value: [] }) });
      return;
    }

    counters.projectsCalls += 1;
    if (cfg.projectsFirstError && counters.projectsCalls === 1) {
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ message: "Erreur temporaire projets" }),
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        value: [
          { id: "p1", name: "Projet A" },
          { id: "p2", name: "Projet Vide" },
        ],
      }),
    });
  });

  await page.route("**/dev.azure.com/*/_apis/projects/*/teams?*", async (route) => {
    const url = new URL(route.request().url());
    const parts = url.pathname.split("/").filter(Boolean);
    const projectId = parts[3] || "";

    if (projectId === "p2") {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ value: [] }) });
      return;
    }

    counters.teamsCalls += 1;
    if (cfg.teamsFirstError && counters.teamsCalls === 1) {
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ message: "Erreur temporaire equipes" }),
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        value: [
          { id: "t1", name: "Equipe Alpha" },
          { id: "t2", name: "Equipe Beta" },
        ],
      }),
    });
  });

  await page.route(/https:\/\/dev\.azure\.com\/.*\/_apis\/wit\/workitemtypes\?.*/, async (route) => {
    counters.teamOptionsCalls += 1;
    if (cfg.teamOptionsFirstError && counters.teamOptionsCalls === 1) {
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ message: "Erreur options equipe" }),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ value: [{ name: "Bug" }, { name: "User Story" }] }),
    });
  });

  await page.route(/https:\/\/dev\.azure\.com\/.*\/_apis\/wit\/workitemtypes\/.*\/states\?.*/, async (route) => {
    const decoded = decodeURIComponent(route.request().url());
    const type = decoded.includes("User Story") ? "User Story" : "Bug";
    const states = type === "Bug" ? [{ name: "Done" }] : [{ name: "Closed" }, { name: "Done" }];
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ value: states }) });
  });

  await page.route(/https:\/\/dev\.azure\.com\/.*\/_apis\/wit\/wiql\?.*/, async (route) => {
    counters.wiqlCalls += 1;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ workItems: closedDates.map((_, i) => ({ id: i + 1 })) }),
    });
  });

  await page.route(/https:\/\/dev\.azure\.com\/.*\/_apis\/wit\/workitems\?.*/, async (route) => {
    counters.workItemsCalls += 1;
    const url = new URL(route.request().url());
    const idsRaw = (url.searchParams.get("ids") || "").split(",").map((x) => Number(x.trim())).filter(Boolean);
    const ids = idsRaw.length > 0 ? idsRaw : closedDates.map((_, i) => i + 1);
    const value = ids.map((id) => ({
      id,
      fields: { "Microsoft.VSTS.Common.ClosedDate": closedDates[id - 1] || closedDates[0] },
    }));
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ value }) });
  });

  await page.route("**/simulate", async (route) => {
    counters.simulateCalls += 1;
    if (cfg.simulateFirstError && counters.simulateCalls === 1) {
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ detail: "Erreur simulation temporaire" }),
      });
      return;
    }

    const payload = route.request().postDataJSON();
    const isWeeksToItems = payload?.mode === "weeks_to_items";
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        result_kind: isWeeksToItems ? "items" : "weeks",
        result_percentiles: isWeeksToItems ? { P50: 38, P70: 44, P90: 52 } : { P50: 10, P70: 12, P90: 15 },
        result_distribution: isWeeksToItems
          ? [
              { x: 35, count: 1 },
              { x: 38, count: 1 },
              { x: 44, count: 1 },
              { x: 52, count: 1 },
            ]
          : [
              { x: 9, count: 1 },
              { x: 10, count: 1 },
              { x: 12, count: 1 },
              { x: 15, count: 1 },
            ],
        samples_count: 30,
      }),
    });
  });

  return { counters, closedDates };
}

export async function completeOnboardingToSimulation(page, { org = "org-demo", project = "Projet A", team = "Equipe Alpha" } = {}) {
  await page.locator('input[type="password"]').fill("token-value-at-least-20-chars");
  await page.getByRole("button", { name: "Se connecter" }).click();

  const hasOrgInput = await page.getByPlaceholder("Nom de l'organisation").isVisible().catch(() => false);
  if (hasOrgInput) {
    await page.getByPlaceholder("Nom de l'organisation").fill(org);
  } else {
    await page.locator("select").first().selectOption(org);
  }

  await page.getByRole("button", { name: "Choisir cette organisation" }).click();
  await page.locator("select").first().selectOption(project);
  await page.getByRole("button", { name: "Choisir ce Projet" }).click();
  await page.locator("select").first().selectOption(team);
  await page.getByRole("button", { name: /Choisir cette/i }).click();
  await expect(page.getByText(`Equipe: ${team}`)).toBeVisible();
}
