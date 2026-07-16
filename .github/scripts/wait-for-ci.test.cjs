"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const {
  requestWithTransientRetry,
  waitForCi,
} = require("./wait-for-ci.cjs");

const LIST_RUNS = Symbol("list-runs");
const LIST_JOBS = Symbol("list-jobs");

function transientError(status, headers = {}) {
  const error = new Error("<html>GitHub Unicorn response body must stay private</html>");
  error.status = status;
  error.response = { status, headers };
  return error;
}

function fakeCore() {
  return {
    failures: [],
    infos: [],
    info(message) {
      this.infos.push(message);
    },
    setFailed(message) {
      this.failures.push(message);
    },
  };
}

function fakeClock() {
  let current = 0;
  const delays = [];
  return {
    delays,
    now: () => current,
    sleep: async (delayMs) => {
      delays.push(delayMs);
      current += delayMs;
    },
  };
}

function completedRun(conclusion = "success") {
  return { id: 42, name: "CI", status: "completed", conclusion };
}

function inProgressRun() {
  return { id: 42, name: "CI", status: "in_progress", conclusion: null };
}

function successfulJobs() {
  return [{ name: "quality-gate", conclusion: "success" }];
}

function fakeGithub({ runResults, jobResults = [successfulJobs()] }) {
  const queues = {
    [LIST_RUNS]: [...runResults],
    [LIST_JOBS]: [...jobResults],
  };
  const calls = { runs: 0, jobs: 0 };
  return {
    calls,
    github: {
      rest: {
        actions: {
          listWorkflowRunsForRepo: LIST_RUNS,
          listJobsForWorkflowRun: LIST_JOBS,
        },
      },
      async paginate(endpoint) {
        const queue = queues[endpoint];
        if (!queue || queue.length === 0) {
          throw new Error(`No fake response left for ${String(endpoint)}.`);
        }
        if (endpoint === LIST_RUNS) {
          calls.runs += 1;
        } else {
          calls.jobs += 1;
        }
        const result = queue.length === 1 ? queue[0] : queue.shift();
        if (result instanceof Error) {
          throw result;
        }
        return result;
      },
    },
  };
}

function waitOptions(github, core, clock, overrides = {}) {
  return {
    github,
    context: { repo: { owner: "owner", repo: "repository" }, sha: "abc123" },
    core,
    now: clock.now,
    sleep: clock.sleep,
    random: () => 0,
    timeoutMs: 60000,
    pollEveryMs: 100,
    baseDelayMs: 10,
    maxDelayMs: 100,
    ...overrides,
  };
}

test("retries one HTTP 503 and then succeeds without logging its HTML body", async () => {
  const api = fakeGithub({
    runResults: [transientError(503), [completedRun()]],
  });
  const core = fakeCore();
  const clock = fakeClock();

  const result = await waitForCi(waitOptions(api.github, core, clock));

  assert.equal(result.outcome, "success");
  assert.equal(api.calls.runs, 2);
  assert.match(core.infos.join("\n"), /HTTP 503.*attempt 2\/4/);
  assert.doesNotMatch(core.infos.join("\n"), /Unicorn|<html>/);
});

test("retries several HTTP 502 and 503 responses before success", async () => {
  const api = fakeGithub({
    runResults: [transientError(502), transientError(503), [completedRun()]],
  });
  const core = fakeCore();
  const clock = fakeClock();

  const result = await waitForCi(waitOptions(api.github, core, clock));

  assert.equal(result.outcome, "success");
  assert.equal(api.calls.runs, 3);
  assert.deepEqual(clock.delays, [10, 20]);
});

test("respects Retry-After when it exceeds the exponential backoff", async () => {
  const core = fakeCore();
  const clock = fakeClock();
  let calls = 0;

  const result = await requestWithTransientRetry(
    async () => {
      calls += 1;
      if (calls === 1) {
        throw transientError(503, { "retry-after": "3" });
      }
      return "ok";
    },
    {
      label: "testing Retry-After",
      core,
      sleep: clock.sleep,
      now: clock.now,
      random: () => 0,
      baseDelayMs: 100,
      maxDelayMs: 1000,
    },
  );

  assert.equal(result, "ok");
  assert.deepEqual(clock.delays, [3000]);
});

test("adds bounded jitter to the exponential retry backoff", async () => {
  const core = fakeCore();
  const clock = fakeClock();
  let calls = 0;

  const result = await requestWithTransientRetry(
    async () => {
      calls += 1;
      if (calls < 3) {
        throw transientError(502);
      }
      return "ok";
    },
    {
      label: "testing jitter",
      core,
      sleep: clock.sleep,
      now: clock.now,
      random: () => 0.5,
      baseDelayMs: 100,
      maxDelayMs: 1000,
      jitterRatio: 0.25,
    },
  );

  assert.equal(result, "ok");
  assert.deepEqual(clock.delays, [112, 225]);
});

test("fails explicitly after exhausting transient retry attempts", async () => {
  const core = fakeCore();
  const clock = fakeClock();
  let calls = 0;

  await assert.rejects(
    requestWithTransientRetry(
      async () => {
        calls += 1;
        throw transientError(504);
      },
      {
        label: "listing CI workflow runs",
        core,
        sleep: clock.sleep,
        now: clock.now,
        random: () => 0,
        baseDelayMs: 10,
        maxDelayMs: 100,
      },
    ),
    /HTTP 504 persisted after 4 attempts/,
  );
  assert.equal(calls, 4);
  assert.deepEqual(clock.delays, [10, 20, 40]);
});

for (const status of [401, 403, 404]) {
  test(`does not retry HTTP ${status}`, async () => {
    const core = fakeCore();
    const clock = fakeClock();
    let calls = 0;

    await assert.rejects(
      requestWithTransientRetry(
        async () => {
          calls += 1;
          throw transientError(status);
        },
        {
          label: "listing CI workflow runs",
          core,
          sleep: clock.sleep,
          now: clock.now,
        },
      ),
      new RegExp(`HTTP ${status}.*not retried`),
    );
    assert.equal(calls, 1);
    assert.deepEqual(clock.delays, []);
  });
}

test("waits for an in-progress run and reports its eventual success", async () => {
  const api = fakeGithub({
    runResults: [[inProgressRun()], [completedRun()]],
  });
  const core = fakeCore();
  const clock = fakeClock();

  const result = await waitForCi(waitOptions(api.github, core, clock));

  assert.equal(result.outcome, "success");
  assert.deepEqual(core.failures, []);
  assert.match(core.infos.join("\n"), /still in progress/);
  assert.match(core.infos.join("\n"), /completed with conclusion=success/);
});

test("waits for an in-progress run and reports its actual failure", async () => {
  const api = fakeGithub({
    runResults: [[inProgressRun()], [completedRun("failure")]],
  });
  const core = fakeCore();
  const clock = fakeClock();

  const result = await waitForCi(waitOptions(api.github, core, clock));

  assert.deepEqual(result, { outcome: "failure", conclusion: "failure" });
  assert.deepEqual(core.failures, ["CI workflow concluded with failure."]);
  assert.match(core.infos.join("\n"), /completed with conclusion=failure/);
});

test("reports the maximum wait timeout without inventing a CI conclusion", async () => {
  const api = fakeGithub({ runResults: [[inProgressRun()]] });
  const core = fakeCore();
  const clock = fakeClock();

  const result = await waitForCi(
    waitOptions(api.github, core, clock, { timeoutMs: 2000, pollEveryMs: 1000 }),
  );

  assert.deepEqual(result, { outcome: "timeout", conclusion: null });
  assert.equal(core.failures.length, 1);
  assert.match(core.failures[0], /Timed out after 2s/);
  assert.doesNotMatch(core.failures[0], /concluded/);
});

test("rejects functionally invalid API responses without retrying", async () => {
  const api = fakeGithub({ runResults: [{ total_count: 1, workflow_runs: [] }] });
  const core = fakeCore();
  const clock = fakeClock();

  await assert.rejects(
    waitForCi(waitOptions(api.github, core, clock)),
    /Invalid GitHub API response.*expected an array/,
  );
  assert.equal(api.calls.runs, 1);
  assert.deepEqual(clock.delays, []);
});
