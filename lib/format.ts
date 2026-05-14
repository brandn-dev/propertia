export const APP_TIME_ZONE = process.env.APP_TIME_ZONE || "Asia/Manila";

function normalizeDate(value: Date | string) {
  const date = typeof value === "string" ? new Date(value) : value;

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date;
}

export function getDatePartsInAppTimeZone(value: Date | string) {
  const date = normalizeDate(value);

  if (!date) {
    return null;
  }

  const parts = new Intl.DateTimeFormat("en-PH", {
    timeZone: APP_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;

  if (!year || !month || !day) {
    return null;
  }

  return {
    year,
    month,
    day,
  };
}

export function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatCompactNumber(value: number) {
  return new Intl.NumberFormat("en-PH", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

export function formatDate(value: Date | string | null) {
  if (!value) {
    return "Not set";
  }

  const date = normalizeDate(value);

  if (!date) {
    return "Not set";
  }

  return new Intl.DateTimeFormat("en-PH", {
    timeZone: APP_TIME_ZONE,
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

export function toDateInputValue(value: Date | string | null | undefined) {
  if (!value) {
    return "";
  }

  const parts = getDatePartsInAppTimeZone(value);

  if (!parts) {
    return "";
  }

  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function toNumber(
  value: { toNumber(): number } | number | null | undefined
) {
  if (typeof value === "number") {
    return value;
  }

  if (!value) {
    return 0;
  }

  return value.toNumber();
}
