"use strict";

const TRANSIENT_HTTP_STATUSES = new Set([502, 503, 504]);

class CiWaitTimeoutError extends Error {}

function httpStatus(error) {
  return error?.status ?? error?.response?.status;
}

function retryAfterMilliseconds(error, now = Date.now) {
  const headers = error?.response?.headers ?? {};
  const entry = Object.entries(headers).find(
    ([name]) => name.toLowerCase() === "retry-after",
  );
  if (!entry) {
    return null;
  }

  const value = Array.isArray(entry[1]) ? entry[1][0] : entry[1];
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) {
    return Math.ceil(seconds * 1000);
  }

  const retryAt = Date.parse(String(value));
  if (Number.isNaN(retryAt)) {
    return null;
  }
  return Math.max(0, retryAt - now());
}

async function requestWithTransientRetry(
  operation,
  {
    label,
    core,
    sleep,
    now = Date.now,
    random = Math.random,
    maxAttempts = 4,
    baseDelayMs = 1000,
    maxDelayMs = 15000,
    jitterRatio = 0.25,
    deadlineMs = Number.POSITIVE_INFINITY,
  },
) {
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      const status = httpStatus(error);
      if (!TRANSIENT_HTTP_STATUSES.has(status)) {
        const statusLabel = status ?? "unknown";
        throw new Error(
          `GitHub API request failed with HTTP ${statusLabel} while ${label}; `
            + "the request was not retried.",
        );
      }
      if (attempt === maxAttempts) {
        throw new Error(
          `Transient GitHub API error HTTP ${status} persisted after ${maxAttempts} `
            + `attempts while ${label}.`,
        );
      }

      const exponentialDelay = Math.min(maxDelayMs, baseDelayMs * (2 ** (attempt - 1)));
      const jitter = Math.floor(exponentialDelay * jitterRatio * random());
      const backoffDelay = Math.min(maxDelayMs, exponentialDelay + jitter);
      const retryAfter = retryAfterMilliseconds(error, now);
      let delayMs = retryAfter === null
        ? backoffDelay
        : Math.max(backoffDelay, retryAfter);
      const remainingMs = deadlineMs - now();
      if (remainingMs <= 0) {
        throw new CiWaitTimeoutError();
      }
      delayMs = Math.min(delayMs, remainingMs);

      core.info(
        `Transient GitHub API error HTTP ${status} while ${label}; retry attempt `
          + `${attempt + 1}/${maxAttempts} in ${delayMs} ms.`,
      );
      await sleep(delayMs);
      if (now() >= deadlineMs) {
        throw new CiWaitTimeoutError();
      }
    }
  }
  throw new Error(`GitHub API retry loop ended unexpectedly while ${label}.`);
}

function requireArray(value, label) {
  if (!Array.isArray(value)) {
    throw new Error(`Invalid GitHub API response while ${label}: expected an array.`);
  }
  return value;
}

async function waitForCi({
  github,
  context,
  core,
  workflowName = "CI",
  requiredJobs = ["quality-gate"],
  timeoutMs = 15 * 60 * 1000,
  pollEveryMs = 15000,
  maxAttempts = 4,
  baseDelayMs = 1000,
  maxDelayMs = 15000,
  jitterRatio = 0.25,
  sleep = (delayMs) => new Promise((resolve) => setTimeout(resolve, delayMs)),
  now = Date.now,
  random = Math.random,
}) {
  const owner = context.repo.owner;
  const repo = context.repo.repo;
  const sha = context.sha;
  const startedAt = now();
  const deadlineMs = startedAt + timeoutMs;
  const retryOptions = {
    core,
    sleep,
    now,
    random,
    maxAttempts,
    baseDelayMs,
    maxDelayMs,
    jitterRatio,
    deadlineMs,
  };

  async function paginateWithRetry(endpoint, parameters, label) {
    const response = await requestWithTransientRetry(
      () => github.paginate(endpoint, parameters),
      { ...retryOptions, label },
    );
    return requireArray(response, label);
  }

  async function waitForNextPoll() {
    const remainingMs = deadlineMs - now();
    if (remainingMs <= 0) {
      return;
    }
    await sleep(Math.min(pollEveryMs, remainingMs));
  }

  try {
    while (now() < deadlineMs) {
      const runs = await paginateWithRetry(
        github.rest.actions.listWorkflowRunsForRepo,
        {
          owner,
          repo,
          event: "push",
          head_sha: sha,
          per_page: 100,
        },
        "listing CI workflow runs",
      );
      const run = runs.find((candidate) => candidate?.name === workflowName);
      if (!run) {
        core.info(`CI run not found yet for ${sha}.`);
        await waitForNextPoll();
        continue;
      }
      if (!Number.isInteger(run.id) || typeof run.status !== "string") {
        throw new Error("Invalid GitHub API response for the matching CI run.");
      }

      if (run.status !== "completed") {
        core.info(`CI run ${run.id} is still in progress (status=${run.status}).`);
        await waitForNextPoll();
        continue;
      }
      if (typeof run.conclusion !== "string" || run.conclusion.length === 0) {
        throw new Error("Invalid GitHub API response: completed CI run has no conclusion.");
      }

      core.info(`CI run ${run.id} completed with conclusion=${run.conclusion}.`);
      if (run.conclusion !== "success") {
        core.setFailed(`CI workflow concluded with ${run.conclusion}.`);
        return { outcome: "failure", conclusion: run.conclusion };
      }

      const jobs = await paginateWithRetry(
        github.rest.actions.listJobsForWorkflowRun,
        { owner, repo, run_id: run.id, per_page: 100 },
        `listing jobs for CI run ${run.id}`,
      );
      const missingOrFailed = requiredJobs.filter((jobName) => {
        const job = jobs.find((entry) => entry?.name === jobName);
        return !job || job.conclusion !== "success";
      });
      if (missingOrFailed.length > 0) {
        core.setFailed(`Required CI jobs not successful: ${missingOrFailed.join(", ")}`);
        return { outcome: "failure", conclusion: "required-jobs" };
      }

      core.info("Required CI jobs succeeded.");
      return { outcome: "success", conclusion: "success" };
    }
  } catch (error) {
    if (!(error instanceof CiWaitTimeoutError)) {
      throw error;
    }
  }

  const timeoutSeconds = Math.round(timeoutMs / 1000);
  core.setFailed(
    `Timed out after ${timeoutSeconds}s while waiting for CI workflow ${workflowName} `
      + `on ${sha}.`,
  );
  return { outcome: "timeout", conclusion: null };
}

module.exports = {
  TRANSIENT_HTTP_STATUSES,
  requestWithTransientRetry,
  retryAfterMilliseconds,
  waitForCi,
};
