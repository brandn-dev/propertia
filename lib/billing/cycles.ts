import { toDateInputValue } from "@/lib/format";

export type BillingCycle = {
  start: Date;
  end: Date;
};

function startOfDay(date: Date) {
  const value = new Date(date);
  value.setHours(0, 0, 0, 0);
  return value;
}

function endOfDay(date: Date) {
  const value = new Date(date);
  value.setHours(23, 59, 59, 999);
  return value;
}

function getDaysInMonth(year: number, monthIndex: number) {
  return new Date(year, monthIndex + 1, 0).getDate();
}

export function addMonthsClamped(date: Date, months: number) {
  const year = date.getFullYear();
  const monthIndex = date.getMonth() + months;
  const targetYear = year + Math.floor(monthIndex / 12);
  const normalizedMonthIndex = ((monthIndex % 12) + 12) % 12;
  const targetDay = Math.min(
    date.getDate(),
    getDaysInMonth(targetYear, normalizedMonthIndex)
  );

  const result = new Date(date);
  result.setFullYear(targetYear, normalizedMonthIndex, targetDay);

  return result;
}

export function getBillingCycleAtIndex(anchorDate: Date, cycleIndex: number): BillingCycle {
  const start = startOfDay(addMonthsClamped(anchorDate, cycleIndex));
  const nextStart = startOfDay(addMonthsClamped(anchorDate, cycleIndex + 1));
  const end = new Date(nextStart);
  end.setDate(end.getDate() - 1);
  end.setHours(23, 59, 59, 999);

  return {
    start,
    end,
  };
}

export function getBillingCycleIndex(anchorDate: Date, cycleStart: Date) {
  for (let cycleIndex = 0; cycleIndex < 240; cycleIndex += 1) {
    const cycle = getBillingCycleAtIndex(anchorDate, cycleIndex);

    if (cycle.start.getTime() === cycleStart.getTime()) {
      return cycleIndex;
    }

    if (cycle.start > cycleStart) {
      break;
    }
  }

  return -1;
}

export function findNextCompletedBillingCycles(params: {
  anchorDate: Date;
  contractEndDate: Date;
  issueDate: Date;
  existingPeriods: Set<string>;
  includeCurrentCycle?: boolean;
  includeNextCycleInIssueMonth?: boolean;
}) {
  const {
    anchorDate,
    contractEndDate,
    issueDate,
    existingPeriods,
    includeCurrentCycle = false,
    includeNextCycleInIssueMonth = false,
  } = params;
  const cycles: BillingCycle[] = [];
  let cycleIndex = 0;

  while (cycleIndex < 240) {
    const cycle = getBillingCycleAtIndex(anchorDate, cycleIndex);

    if (cycle.start > contractEndDate) {
      break;
    }

    const key = `${toDateInputValue(cycle.start)}:${toDateInputValue(cycle.end)}`;

    if (cycle.start > issueDate) {
      const sameIssueMonth =
        cycle.start.getFullYear() === issueDate.getFullYear() &&
        cycle.start.getMonth() === issueDate.getMonth();

      if (
        includeNextCycleInIssueMonth &&
        sameIssueMonth &&
        !existingPeriods.has(key)
      ) {
        cycles.push(cycle);
      }

      break;
    }

    const isCurrentIncompleteCycle = cycle.end > issueDate;

    if (isCurrentIncompleteCycle && !includeCurrentCycle) {
      break;
    }

    if (!existingPeriods.has(key)) {
      cycles.push(cycle);
    }

    if (isCurrentIncompleteCycle && !includeNextCycleInIssueMonth) {
      break;
    }

    cycleIndex += 1;
  }

  return cycles;
}

export function getBillingCycleKey(start: Date, end: Date) {
  return `${toDateInputValue(start)}:${toDateInputValue(end)}`;
}

export function getInvoiceGenerationSelectionKey(
  contractId: string,
  start: Date,
  end: Date
) {
  return `${contractId}::${getBillingCycleKey(start, end)}`;
}

export function getBillingMonthKey(date: Date | string) {
  const value = typeof date === "string" ? new Date(date) : date;
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");

  return `${year}-${month}`;
}

export function filterCyclesWithoutInvoicedMonths(
  cycles: BillingCycle[],
  existingMonthKeys: Set<string>
) {
  const seenMonthKeys = new Set<string>();

  return cycles.filter((cycle) => {
    const monthKey = getBillingMonthKey(cycle.start);

    if (existingMonthKeys.has(monthKey) || seenMonthKeys.has(monthKey)) {
      return false;
    }

    seenMonthKeys.add(monthKey);
    return true;
  });
}

export function formatBillingCycleMonthLabel(date: Date | string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
  }).format(typeof date === "string" ? new Date(date) : date);
}

export function formatBillingCycleLabel(cycle: BillingCycle) {
  return formatBillingCycleMonthLabel(cycle.start);
}

export function cycleOverlapsRange(
  cycle: BillingCycle,
  rangeStart: Date,
  rangeEnd?: Date | null
) {
  const normalizedStart = startOfDay(rangeStart);
  const normalizedEnd = rangeEnd ? endOfDay(rangeEnd) : null;

  if (cycle.end < normalizedStart) {
    return false;
  }

  if (normalizedEnd && cycle.start > normalizedEnd) {
    return false;
  }

  return true;
}
