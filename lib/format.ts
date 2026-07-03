export const APP_TIME_ZONE = process.env.APP_TIME_ZONE || "Asia/Manila";

const APP_TIME_ZONE_DATE_TIME_FORMATTER = new Intl.DateTimeFormat("en-US", {
  timeZone: APP_TIME_ZONE,
  hourCycle: "h23",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

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

export function formatLongDate(value: Date | string | null) {
  if (!value) {
    return "Not set";
  }

  const date = normalizeDate(value);

  if (!date) {
    return "Not set";
  }

  return new Intl.DateTimeFormat("en-US", {
    timeZone: APP_TIME_ZONE,
    month: "long",
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

function getTimePartsInAppTimeZone(value: Date) {
  const parts = APP_TIME_ZONE_DATE_TIME_FORMATTER.formatToParts(value);
  const year = Number(parts.find((part) => part.type === "year")?.value);
  const month = Number(parts.find((part) => part.type === "month")?.value);
  const day = Number(parts.find((part) => part.type === "day")?.value);
  const hour = Number(parts.find((part) => part.type === "hour")?.value);
  const minute = Number(parts.find((part) => part.type === "minute")?.value);
  const second = Number(parts.find((part) => part.type === "second")?.value);

  if (
    !Number.isFinite(year) ||
    !Number.isFinite(month) ||
    !Number.isFinite(day) ||
    !Number.isFinite(hour) ||
    !Number.isFinite(minute) ||
    !Number.isFinite(second)
  ) {
    return null;
  }

  return { year, month, day, hour, minute, second };
}

function getAppTimeZoneOffsetMs(value: Date) {
  const parts = getTimePartsInAppTimeZone(value);

  if (!parts) {
    return 0;
  }

  const valueWithoutMilliseconds = value.getTime() - value.getMilliseconds();

  return (
    Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      parts.hour,
      parts.minute,
      parts.second
    ) - valueWithoutMilliseconds
  );
}

function parseDateInputParts(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);

  if (!match) {
    return null;
  }

  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
  };
}

function dateFromAppTimeZoneParts(params: {
  year: number;
  month: number;
  day: number;
  hour?: number;
  minute?: number;
  second?: number;
  millisecond?: number;
}) {
  const utcGuess = new Date(
    Date.UTC(
      params.year,
      params.month - 1,
      params.day,
      params.hour ?? 0,
      params.minute ?? 0,
      params.second ?? 0,
      params.millisecond ?? 0
    )
  );
  const firstOffset = getAppTimeZoneOffsetMs(utcGuess);
  const firstResult = new Date(utcGuess.getTime() - firstOffset);
  const secondOffset = getAppTimeZoneOffsetMs(firstResult);

  if (secondOffset === firstOffset) {
    return firstResult;
  }

  return new Date(utcGuess.getTime() - secondOffset);
}

export function dateInputToAppStartOfDay(value: string) {
  const parts = parseDateInputParts(value);

  if (!parts) {
    return new Date(value);
  }

  return dateFromAppTimeZoneParts(parts);
}

export function dateInputToAppEndOfDay(value: string) {
  const parts = parseDateInputParts(value);

  if (!parts) {
    const date = new Date(value);
    date.setHours(23, 59, 59, 999);
    return date;
  }

  return dateFromAppTimeZoneParts({
    ...parts,
    hour: 23,
    minute: 59,
    second: 59,
    millisecond: 999,
  });
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
