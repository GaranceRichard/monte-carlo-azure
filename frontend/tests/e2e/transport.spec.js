import { expect, test } from "@playwright/test";

test("transport: Vite reaches the current backend API", async ({ request }) => {
  const schemaResponse = await request.get("/openapi.json");
  expect(schemaResponse.status()).toBe(200);

  const schema = await schemaResponse.json();
  expect(schema.info.version).toBe("2.0");
  expect(schema.paths["/simulate"]?.post).toBeTruthy();

  const simulateResponse = await request.post("/simulate", {
    data: {
      throughput_samples: [2, 3, 4, 2, 5, 3],
      mode: "backlog_to_weeks",
      backlog_size: 20,
      n_sims: 1000,
    },
  });

  expect(simulateResponse.status()).toBe(200);
  const result = await simulateResponse.json();
  expect(result.result_kind).toBe("weeks");
  expect(result.result_percentiles).toEqual(
    expect.objectContaining({
      P50: expect.any(Number),
      P70: expect.any(Number),
      P90: expect.any(Number),
    }),
  );
});
