import assert from "node:assert/strict";
import test from "node:test";
import { normalizePercentageWeights } from "@/lib/billing/cosa";

test("normalizes retained percentage weights after an inactive tenant is removed", () => {
  const percentages = normalizePercentageWeights([10, 15, 10, 15, 10]);

  assert.deepEqual(percentages, ["16.67", "25.00", "16.67", "25.00", "16.66"]);
  assert.equal(
    percentages.reduce((sum, percentage) => sum + Number(percentage), 0),
    100
  );
});

test("keeps an already exact percentage allocation unchanged", () => {
  assert.deepEqual(normalizePercentageWeights([33.33, 33.33, 33.34]), [
    "33.33",
    "33.33",
    "33.34",
  ]);
});
