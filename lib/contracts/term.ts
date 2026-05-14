import { formatDate, toDateInputValue } from "@/lib/format";

export const OPEN_ENDED_CONTRACT_END_DATE_INPUT = "2099-12-31";

function parseDateInput(value: string) {
  const [year, month, day] = value.split("-").map(Number);

  return new Date(year, month - 1, day, 12, 0, 0, 0);
}

function toComparableDateInput(value: Date | string | null | undefined) {
  if (!value) {
    return "";
  }

  if (typeof value === "string") {
    const trimmed = value.trim();

    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      return trimmed;
    }

    return toDateInputValue(trimmed);
  }

  return toDateInputValue(value);
}

export function getOpenEndedContractEndDate() {
  return parseDateInput(OPEN_ENDED_CONTRACT_END_DATE_INPUT);
}

export function isOpenEndedContractEndDate(
  value: Date | string | null | undefined
) {
  return toComparableDateInput(value) === OPEN_ENDED_CONTRACT_END_DATE_INPUT;
}

export function resolveContractEndDateInput(
  endDate: string,
  isOpenEnded: boolean
) {
  return isOpenEnded ? OPEN_ENDED_CONTRACT_END_DATE_INPUT : endDate.trim();
}

export function getContractEndDateInputValue(
  value: Date | string | null | undefined
) {
  return isOpenEndedContractEndDate(value) ? "" : toComparableDateInput(value);
}

export function formatContractEndDate(
  value: Date | string | null | undefined,
  openEndedLabel = "Month-to-month"
) {
  return isOpenEndedContractEndDate(value)
    ? openEndedLabel
    : formatDate(value ?? null);
}
