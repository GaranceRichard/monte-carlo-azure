export type AdoErrorContext = {
  operation: string;
  org?: string;
  project?: string;
  team?: string;
  requiredScopes?: string[];
};

export class AdoHttpError extends Error {
  status: number;
  operation: string;

  constructor(message: string, status: number, operation: string) {
    super(message);
    this.name = "AdoHttpError";
    this.status = status;
    this.operation = operation;
  }
}

function formatAdoResourceHint(context: AdoErrorContext): string {
  if (context.org && context.project && context.team) {
    return `Organisation "${context.org}", projet "${context.project}", equipe "${context.team}".`;
  }
  if (context.org && context.project) {
    return `Organisation "${context.org}", projet "${context.project}".`;
  }
  if (context.org) {
    return `Organisation "${context.org}".`;
  }
  return "Verifiez l'organisation, le projet et l'equipe saisis.";
}

export function formatAdoHttpErrorMessage(
  status: number,
  context: AdoErrorContext,
  statusText = "",
): string {
  const statusLabel = statusText ? ` (${statusText})` : "";

  if (status === 401) {
    return `Azure DevOps a refuse l'authentification [HTTP 401] pendant "${context.operation}". Votre PAT est invalide ou expire. Regenerez un PAT dans Azure DevOps (User settings > Personal access tokens), puis reconnectez-vous.`;
  }

  if (status === 403) {
    const scopes = context.requiredScopes?.length
      ? context.requiredScopes
      : ["Work Items (Read)", "Project and Team (Read)"];
    return `Azure DevOps a refuse l'acces [HTTP 403] pendant "${context.operation}". Votre PAT ne couvre pas les permissions requises. Ajoutez les scopes: ${scopes.join(", ")}.`;
  }

  if (status === 404) {
    return `Azure DevOps ne trouve pas la ressource demandee [HTTP 404] pendant "${context.operation}". ${formatAdoResourceHint(context)}`;
  }

  if (status === 429) {
    return `Azure DevOps limite temporairement les requetes [HTTP 429] pendant "${context.operation}". Patientez quelques instants puis relancez la simulation.`;
  }

  if (status >= 500) {
    return `Azure DevOps est indisponible [HTTP ${status}${statusLabel}] pendant "${context.operation}". Reessayez plus tard.`;
  }

  return `Echec Azure DevOps [HTTP ${status}${statusLabel}] pendant "${context.operation}".`;
}

export function toAdoHttpError(response: Response, context: AdoErrorContext): AdoHttpError {
  return new AdoHttpError(
    formatAdoHttpErrorMessage(response.status, context, response.statusText),
    response.status,
    context.operation,
  );
}

export function toAdoNetworkError(cause: unknown, context: AdoErrorContext): Error {
  if (cause instanceof Error) {
    return new Error(`Impossible de joindre Azure DevOps pendant "${context.operation}". Verifiez votre connexion puis reessayez.`);
  }
  return new Error(`Erreur reseau Azure DevOps pendant "${context.operation}".`);
}
