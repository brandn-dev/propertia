import { toDateInputValue } from "@/lib/format";

export const HISTORICAL_BACKLOG_CUTOFF_DATE = "2026-05-01";

export function getHistoricalBacklogCutoffDate() {
  return new Date(`${HISTORICAL_BACKLOG_CUTOFF_DATE}T00:00:00`);
}

export function getHistoricalBacklogCutoffLabel() {
  return HISTORICAL_BACKLOG_CUTOFF_DATE;
}

export function getHistoricalBacklogFinalMonthStartDate() {
  return getHistoricalBacklogCutoffDate();
}

export function getHistoricalBacklogFinalMonthEndDate() {
  const finalMonthEnd = new Date(getHistoricalBacklogFinalMonthStartDate());
  finalMonthEnd.setMonth(finalMonthEnd.getMonth() + 1, 0);
  finalMonthEnd.setHours(23, 59, 59, 999);
  return finalMonthEnd;
}

export function getStrictBillingStartDate() {
  const strictStart = new Date(getHistoricalBacklogFinalMonthStartDate());
  strictStart.setMonth(strictStart.getMonth() + 1, 1);
  strictStart.setHours(0, 0, 0, 0);
  return strictStart;
}

export function getHistoricalBacklogLatestDate() {
  return getHistoricalBacklogFinalMonthEndDate();
}

export function isBeforeHistoricalBacklogCutoff(value: Date | string) {
  const date = typeof value === "string" ? new Date(value) : value;
  return date < getStrictBillingStartDate();
}

export function isAtOrAfterHistoricalBacklogCutoff(value: Date | string) {
  return !isBeforeHistoricalBacklogCutoff(value);
}

export function formatHistoricalBacklogCutoffForDisplay() {
  return toDateInputValue(getHistoricalBacklogCutoffDate());
}
