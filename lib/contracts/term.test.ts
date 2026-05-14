import test from "node:test";
import assert from "node:assert/strict";
import {
  OPEN_ENDED_CONTRACT_END_DATE_INPUT,
  formatContractEndDate,
  getContractEndDateInputValue,
  getOpenEndedContractEndDate,
  isOpenEndedContractEndDate,
  resolveContractEndDateInput,
} from "@/lib/contracts/term";

test("open-ended helpers normalize sentinel end date", () => {
  const openEndedDate = getOpenEndedContractEndDate();

  assert.equal(isOpenEndedContractEndDate(openEndedDate), true);
  assert.equal(
    isOpenEndedContractEndDate(OPEN_ENDED_CONTRACT_END_DATE_INPUT),
    true
  );
  assert.equal(getContractEndDateInputValue(openEndedDate), "");
  assert.equal(
    resolveContractEndDateInput("", true),
    OPEN_ENDED_CONTRACT_END_DATE_INPUT
  );
});

test("finite end date helpers preserve real dates", () => {
  assert.equal(isOpenEndedContractEndDate("2026-09-16"), false);
  assert.equal(getContractEndDateInputValue("2026-09-16"), "2026-09-16");
  assert.equal(resolveContractEndDateInput("2026-09-16", false), "2026-09-16");
  assert.equal(formatContractEndDate("2026-09-16"), "Sep 16, 2026");
});

test("open-ended formatter swaps fake far-future date for label", () => {
  assert.equal(
    formatContractEndDate(OPEN_ENDED_CONTRACT_END_DATE_INPUT),
    "Month-to-month"
  );
});
