import { describe, expect, it } from "vitest";
import { formatAdoHttpErrorMessage, toAdoHttpError, toAdoNetworkError } from "./adoErrors";

describe("formatAdoHttpErrorMessage", () => {
  const context = {
    operation: "chargement des projets",
    org: "demo-org",
  };

  it("maps 401 to PAT regeneration guidance", () => {
    const message = formatAdoHttpErrorMessage(401, context);
    expect(message).toContain("HTTP 401");
    expect(message).toContain("PAT");
    expect(message).toContain("Regenerez");
  });

  it("maps 403 to missing scope guidance", () => {
    const message = formatAdoHttpErrorMessage(403, context, "Forbidden");
    expect(message).toContain("HTTP 403");
    expect(message).toContain("Work Items (Read)");
  });

  it("maps 404 to resource hint", () => {
    const message = formatAdoHttpErrorMessage(404, {
      operation: "chargement des equipes",
      org: "demo-org",
      project: "demo-project",
      team: "demo-team",
    });
    expect(message).toContain("HTTP 404");
    expect(message).toContain("demo-org");
    expect(message).toContain("demo-project");
    expect(message).toContain("demo-team");
  });

  it("maps 429 to retry guidance", () => {
    const message = formatAdoHttpErrorMessage(429, context);
    expect(message).toContain("HTTP 429");
    expect(message).toContain("Patientez");
  });

  it("maps 5xx with status text", () => {
    const message = formatAdoHttpErrorMessage(503, context, "Service Unavailable");
    expect(message).toContain("HTTP 503 (Service Unavailable)");
    expect(message).toContain("indisponible");
  });

  it("maps unknown status to generic message", () => {
    const message = formatAdoHttpErrorMessage(418, context, "Teapot");
    expect(message).toContain("HTTP 418 (Teapot)");
    expect(message).toContain("Echec Azure DevOps");
  });

  it("404 includes org+project hint when team is missing", () => {
    const message = formatAdoHttpErrorMessage(404, {
      operation: "chargement des equipes",
      org: "demo-org",
      project: "demo-project",
    });
    expect(message).toContain('Organisation "demo-org", projet "demo-project".');
  });

  it("404 includes org-only hint", () => {
    const message = formatAdoHttpErrorMessage(404, {
      operation: "chargement des projets",
      org: "demo-org",
    });
    expect(message).toContain('Organisation "demo-org".');
  });

  it("404 includes generic hint when no resource is provided", () => {
    const message = formatAdoHttpErrorMessage(404, {
      operation: "chargement",
    });
    expect(message).toContain("Verifiez l'organisation");
  });
});

describe("typed ADO errors", () => {
  it("builds AdoHttpError with status and operation", () => {
    const response = new Response("{}", {
      status: 403,
      statusText: "Forbidden",
      headers: { "Content-Type": "application/json" },
    });
    const err = toAdoHttpError(response, {
      operation: "chargement des projets",
      org: "demo-org",
    });
    expect(err.name).toBe("AdoHttpError");
    expect(err.status).toBe(403);
    expect(err.operation).toBe("chargement des projets");
    expect(err.message).toContain("HTTP 403");
  });

  it("maps network Error cause to actionable message", () => {
    const err = toAdoNetworkError(new Error("boom"), { operation: "requete WIQL" });
    expect(err.message).toContain("Impossible de joindre Azure DevOps");
    expect(err.message).toContain("requete WIQL");
  });

  it("maps non-Error cause to generic network message", () => {
    const err = toAdoNetworkError("boom", { operation: "requete WIQL" });
    expect(err.message).toContain("Erreur reseau Azure DevOps");
  });
});
