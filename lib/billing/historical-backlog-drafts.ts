import {
  addMonthsClamped,
  cycleOverlapsRange,
  getBillingCycleIndex,
} from "@/lib/billing/cycles";
import { calculateAdjustedMonthlyRent } from "@/lib/billing/rent-adjustments";
import {
  buildAdvanceApplicationCycleIndexes,
  deriveWholeMonths,
} from "@/lib/contracts/advance-rent";
import {
  BACKLOG_ADJUSTMENT_TYPES,
  BACKLOG_PAYMENT_STATUSES,
  RECURRING_CHARGE_TYPE_LABELS,
  UTILITY_TYPE_LABELS,
} from "@/lib/form-options";
import { APP_TIME_ZONE, toDateInputValue } from "@/lib/format";

export type HistoricalBacklogContractOption = {
  id: string;
  tenantId: string;
  status: string;
  paymentStartDate: string;
  endDate: string;
  monthlyRent: string;
  freeRentCycles: number;
  advanceRentMonths: number;
  advanceRentApplication:
    | "FIRST_BILLABLE_CYCLES"
    | "LAST_BILLABLE_CYCLES"
    | "SPLIT_FIRST_AND_LAST_CYCLES";
  advanceRentFirstMonths: number;
  advanceRentLastMonths: number;
  advanceRent: string;
  rentAdjustments: {
    effectiveDate: string;
    increaseType: "FIXED" | "PERCENTAGE";
    increaseValue: string;
    calculationType: "SIMPLE" | "COMPOUND";
    basedOn: "BASE_RENT" | "PREVIOUS_RENT";
  }[];
  property: {
    id: string;
    name: string;
    propertyCode: string;
  };
  tenant: {
    firstName: string | null;
    lastName: string | null;
    businessName: string | null;
  };
  recurringCharges: {
    id: string;
    chargeType: keyof typeof RECURRING_CHARGE_TYPE_LABELS;
    label: string;
    amount: string;
    effectiveStartDate: string;
    effectiveEndDate: string | null;
    isActive: boolean;
  }[];
  meters: {
    id: string;
    propertyId: string;
    tenantId: string | null;
    meterCode: string;
    utilityType: keyof typeof UTILITY_TYPE_LABELS;
    openingReading: string;
    readings: {
      id: string;
      readingDate: string;
      currentReading: string;
      ratePerUnit: string;
    }[];
  }[];
  pendingBacklogCycles: HistoricalBacklogCycleOption[];
};

export type HistoricalBacklogCycleOption = {
  key: string;
  start: string;
  end: string;
  label: string;
};

export type HistoricalBacklogRecurringChargeDraft = {
  recurringChargeId: string;
  chargeType: keyof typeof RECURRING_CHARGE_TYPE_LABELS;
  label: string;
  amount: string;
  effectiveStartDate: string;
  effectiveEndDate: string | null;
};

export type HistoricalBacklogUtilityReadingDraft = {
  id: string;
  meterId: string;
  readingDate: string;
  previousReading: string;
  currentReading: string;
  ratePerUnit: string;
  ratePerUnitMode: "auto" | "manual";
};

export type HistoricalBacklogUtilityChargeDraft = {
  id: string;
  utilityType: keyof typeof UTILITY_TYPE_LABELS;
  label: string;
  amount: string;
};

export type HistoricalBacklogAdjustmentDraft = {
  id: string;
  itemType: (typeof BACKLOG_ADJUSTMENT_TYPES)[number];
  label: string;
  amount: string;
};

export type HistoricalBacklogPaymentDraft = {
  status: (typeof BACKLOG_PAYMENT_STATUSES)[number];
  amount: string;
  paymentDate: string;
  referenceNumber: string;
  notes: string;
};

export type HistoricalBacklogMonthDraft = {
  rowKey: string;
  tenantId: string;
  contractId: string;
  cycleKey: string;
  contractLabel: string;
  billingMonthLabel: string;
  billingPeriodStart: string;
  billingPeriodEnd: string;
  issueDate: string;
  dueDate: string;
  rentAmount: string;
  recurringCharges: HistoricalBacklogRecurringChargeDraft[];
  utilityReadings: HistoricalBacklogUtilityReadingDraft[];
  utilityCharges: HistoricalBacklogUtilityChargeDraft[];
  adjustments: HistoricalBacklogAdjustmentDraft[];
  payment: HistoricalBacklogPaymentDraft;
  notes: string;
};

export type HistoricalBacklogDraftMap = Record<
  string,
  HistoricalBacklogMonthDraft | undefined
>;

export type HistoricalBacklogPropertyGroup = {
  groupKey: string;
  tenantId: string;
  contractId: string;
  contractLabel: string;
  tenantLabel: string;
  monthCount: number;
  months: Array<{
    rowKey: string;
    cycleKey: string;
    label: string;
    billingPeriodStart: string;
    billingPeriodEnd: string;
  }>;
  recurringSummary: string[];
  hasMeters: boolean;
};

type MeterSource = {
  readingDate: string;
  currentReading: string;
  ratePerUnit: string;
  order: number;
};

type MeterValidationContext = {
  meter: HistoricalBacklogContractOption["meters"][number];
  draft: HistoricalBacklogMonthDraft;
  row: HistoricalBacklogUtilityReadingDraft;
  order: number;
};

export function buildBacklogMonthRowKey(contractId: string, cycleKey: string) {
  return `${contractId}::${cycleKey}`;
}

export function buildLocalId() {
  return Math.random().toString(36).slice(2, 10);
}

export function formatTenantName(
  tenant: HistoricalBacklogContractOption["tenant"]
) {
  return (
    tenant.businessName ||
    [tenant.firstName, tenant.lastName].filter(Boolean).join(" ") ||
    "Tenant"
  );
}

export function addDays(value: string, days: number) {
  const date = new Date(`${value}T12:00:00`);
  date.setDate(date.getDate() + days);
  return toDateInputValue(date);
}

export function getDefaultIssueDate(cycleEnd: string) {
  return toDateInputValue(new Date(cycleEnd));
}

export function getDefaultDueDate(cycleEnd: string) {
  return addDays(toDateInputValue(new Date(cycleEnd)), 7);
}

export function formatMonthLabel(value: Date) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: APP_TIME_ZONE,
    month: "long",
    year: "numeric",
  }).format(value);
}

export function getUtilityServiceWindow(cycleStartValue: string) {
  const cycleStart = new Date(cycleStartValue);
  const serviceStart = addMonthsClamped(cycleStart, -1);
  const serviceEnd = new Date(cycleStart);
  serviceEnd.setDate(serviceEnd.getDate() - 1);
  serviceEnd.setHours(23, 59, 59, 999);

  return {
    label: formatMonthLabel(serviceStart),
    rangeLabel: `${toDateInputValue(serviceStart)} to ${toDateInputValue(serviceEnd)}`,
  };
}

export function getResolvedRentAmount(
  contract: HistoricalBacklogContractOption | null,
  cycle: HistoricalBacklogCycleOption | null
) {
  if (!contract || !cycle) {
    return "";
  }

  return String(
    calculateAdjustedMonthlyRent({
      baseMonthlyRent: Number(contract.monthlyRent),
      cycleStart: new Date(cycle.start),
      adjustments: contract.rentAdjustments.map((adjustment) => ({
        effectiveDate: new Date(adjustment.effectiveDate),
        increaseType: adjustment.increaseType,
        increaseValue: Number(adjustment.increaseValue),
        calculationType: adjustment.calculationType,
        basedOn: adjustment.basedOn,
      })),
    })
  );
}

function getCycleCount(paymentStartDate: string, endDate: string) {
  const anchorDate = new Date(paymentStartDate);
  const contractEndDate = new Date(endDate);
  let count = 0;

  while (count < 240) {
    const cycle = addMonthsClamped(anchorDate, count);

    if (new Date(cycle).getTime() > contractEndDate.getTime()) {
      break;
    }

    count += 1;
  }

  return count;
}

export function getAutoFreeRentConcessionAmount(params: {
  paymentStartDate: string;
  freeRentCycles: number;
  cycleStart?: string;
  rentAmount: string;
}) {
  const { paymentStartDate, freeRentCycles, cycleStart, rentAmount } = params;

  if (!cycleStart || freeRentCycles <= 0) {
    return 0;
  }

  const cycleIndex = getBillingCycleIndex(
    new Date(paymentStartDate),
    new Date(cycleStart)
  );

  if (cycleIndex < 0 || cycleIndex >= freeRentCycles) {
    return 0;
  }

  const parsedRentAmount = Number(rentAmount);
  return Number.isFinite(parsedRentAmount) && parsedRentAmount > 0
    ? parsedRentAmount
    : 0;
}

export function getAutoAdvanceRentEffects(params: {
  paymentStartDate: string;
  endDate: string;
  freeRentCycles: number;
  advanceRentMonths: number;
  advanceRentApplication:
    | "FIRST_BILLABLE_CYCLES"
    | "LAST_BILLABLE_CYCLES"
    | "SPLIT_FIRST_AND_LAST_CYCLES";
  advanceRentFirstMonths: number;
  advanceRentLastMonths: number;
  advanceRent: string;
  cycleStart?: string;
  rentAmount: string;
}) {
  const {
    paymentStartDate,
    endDate,
    freeRentCycles,
    advanceRentMonths,
    advanceRentApplication,
    advanceRent,
    cycleStart,
    rentAmount,
  } = params;

  if (!cycleStart) {
    return { chargeAmount: 0, creditAmount: 0 };
  }

  const parsedRentAmount = Number(rentAmount);
  const baseRent = Number.isFinite(parsedRentAmount) ? parsedRentAmount : 0;
  const parsedAdvanceRent = Number(advanceRent);
  const resolvedAdvanceRentMonths =
    advanceRentMonths > 0
      ? advanceRentMonths
      : deriveWholeMonths(parsedAdvanceRent, baseRent);

  if (resolvedAdvanceRentMonths <= 0) {
    return { chargeAmount: 0, creditAmount: 0 };
  }

  const cycleIndex = getBillingCycleIndex(
    new Date(paymentStartDate),
    new Date(cycleStart)
  );

  if (cycleIndex < 0) {
    return { chargeAmount: 0, creditAmount: 0 };
  }

  const totalCycles = getCycleCount(paymentStartDate, endDate);
  const advanceApplicationCycleIndexes = buildAdvanceApplicationCycleIndexes({
    totalCycles,
    freeRentCycles,
    advanceRentMonths: resolvedAdvanceRentMonths,
    advanceRentApplication,
    advanceRentFirstMonths: params.advanceRentFirstMonths,
    advanceRentLastMonths: params.advanceRentLastMonths,
  });
  const isFreeRentCycle = cycleIndex < freeRentCycles;
  const isAdvanceRentApplicationCycle =
    !isFreeRentCycle && advanceApplicationCycleIndexes.has(cycleIndex);

  return {
    chargeAmount: cycleIndex === 0 ? parsedAdvanceRent : 0,
    creditAmount: isAdvanceRentApplicationCycle ? Math.min(baseRent, parsedRentAmount) : 0,
  };
}

export function getApplicableRecurringChargeRows(
  contract: HistoricalBacklogContractOption | null,
  cycle: HistoricalBacklogCycleOption | null
) {
  if (!contract || !cycle) {
    return [];
  }

  const cycleRange = {
    start: new Date(cycle.start),
    end: new Date(cycle.end),
  };

  return contract.recurringCharges
    .filter(
      (charge) =>
        charge.isActive &&
        cycleOverlapsRange(
          cycleRange,
          new Date(charge.effectiveStartDate),
          charge.effectiveEndDate ? new Date(charge.effectiveEndDate) : null
        )
    )
    .map((charge) => ({
      recurringChargeId: charge.id,
      chargeType: charge.chargeType,
      label: charge.label,
      amount: charge.amount,
      effectiveStartDate: charge.effectiveStartDate,
      effectiveEndDate: charge.effectiveEndDate,
    }));
}

export function createHistoricalBacklogMonthDraft(
  contract: HistoricalBacklogContractOption,
  cycle: HistoricalBacklogCycleOption
): HistoricalBacklogMonthDraft {
  return {
    rowKey: buildBacklogMonthRowKey(contract.id, cycle.key),
    tenantId: contract.tenantId,
    contractId: contract.id,
    cycleKey: cycle.key,
    contractLabel: `${contract.property.propertyCode} · ${contract.property.name}`,
    billingMonthLabel: cycle.label,
    billingPeriodStart: toDateInputValue(new Date(cycle.start)),
    billingPeriodEnd: toDateInputValue(new Date(cycle.end)),
    issueDate: getDefaultIssueDate(cycle.end),
    dueDate: getDefaultDueDate(cycle.end),
    rentAmount: getResolvedRentAmount(contract, cycle),
    recurringCharges: getApplicableRecurringChargeRows(contract, cycle),
    utilityReadings: [],
    utilityCharges: [],
    adjustments: [],
    payment: {
      status: "UNPAID",
      amount: "",
      paymentDate: "",
      referenceNumber: "",
      notes: "",
    },
    notes: "",
  };
}

export function getDraftForCycle(params: {
  drafts: HistoricalBacklogDraftMap;
  contract: HistoricalBacklogContractOption | null;
  cycle: HistoricalBacklogCycleOption | null;
}) {
  const { drafts, contract, cycle } = params;

  if (!contract || !cycle) {
    return null;
  }

  return (
    drafts[buildBacklogMonthRowKey(contract.id, cycle.key)] ??
    createHistoricalBacklogMonthDraft(contract, cycle)
  );
}

export function createUtilityReadingDraft(
  contract: HistoricalBacklogContractOption | null,
  cycle: HistoricalBacklogCycleOption | null
): HistoricalBacklogUtilityReadingDraft {
  return {
    id: buildLocalId(),
    meterId: contract?.meters[0]?.id ?? "",
    readingDate: cycle ? toDateInputValue(new Date(cycle.end)) : "",
    previousReading: "",
    currentReading: "",
    ratePerUnit: "",
    ratePerUnitMode: "auto",
  };
}

function getPersistedSourcesForMeter(
  meter: HistoricalBacklogContractOption["meters"][number]
) {
  return meter.readings
    .map((reading, index) => ({
      readingDate: toDateInputValue(new Date(reading.readingDate)),
      currentReading: reading.currentReading,
      ratePerUnit: reading.ratePerUnit,
      order: index,
    }))
    .sort(compareMeterSource);
}

function compareMeterSource(left: MeterSource, right: MeterSource) {
  const timestampDiff =
    new Date(left.readingDate).getTime() - new Date(right.readingDate).getTime();

  if (timestampDiff !== 0) {
    return timestampDiff;
  }

  return left.order - right.order;
}

function compareDraftMonths(
  left: HistoricalBacklogMonthDraft,
  right: HistoricalBacklogMonthDraft
) {
  const startDiff =
    new Date(left.billingPeriodStart).getTime() -
    new Date(right.billingPeriodStart).getTime();

  if (startDiff !== 0) {
    return startDiff;
  }

  return left.rowKey.localeCompare(right.rowKey);
}

function getContractDrafts(
  drafts: HistoricalBacklogDraftMap,
  contractId: string
) {
  return Object.values(drafts)
    .filter(
      (draft): draft is HistoricalBacklogMonthDraft =>
        Boolean(draft && draft.contractId === contractId)
    )
    .sort(compareDraftMonths);
}

export function applyCarryForwardToContractDrafts(
  drafts: HistoricalBacklogDraftMap,
  contract: HistoricalBacklogContractOption
) {
  const contractDrafts = getContractDrafts(drafts, contract.id);

  if (contractDrafts.length === 0) {
    return drafts;
  }

  const nextDrafts: HistoricalBacklogDraftMap = { ...drafts };

  for (const meter of contract.meters) {
    const persistedSources = getPersistedSourcesForMeter(meter);
    const pendingRows: MeterValidationContext[] = contractDrafts
      .flatMap((draft) =>
        draft.utilityReadings
          .filter((row) => row.meterId === meter.id)
          .map((row, index) => ({
            meter,
            draft,
            row,
            order: index,
          }))
      )
      .sort((left, right) => {
        const timestampDiff =
          new Date(left.row.readingDate).getTime() -
          new Date(right.row.readingDate).getTime();

        if (timestampDiff !== 0) {
          return timestampDiff;
        }

        const draftDiff = compareDraftMonths(left.draft, right.draft);

        if (draftDiff !== 0) {
          return draftDiff;
        }

        return left.order - right.order;
      });
    const effectiveSources = [...persistedSources];

    for (const context of pendingRows) {
      const previousSource =
        [...effectiveSources]
          .reverse()
          .find(
            (source) =>
              new Date(source.readingDate).getTime() <
              new Date(context.row.readingDate).getTime()
          ) ?? null;
      const previousReading = previousSource?.currentReading ?? meter.openingReading;
      const nextRatePerUnit =
        context.row.ratePerUnitMode === "manual"
          ? context.row.ratePerUnit
          : (previousSource?.ratePerUnit ?? context.row.ratePerUnit);

      const nextDraft = nextDrafts[context.draft.rowKey];

      if (!nextDraft) {
        continue;
      }

      nextDrafts[context.draft.rowKey] = {
        ...nextDraft,
        utilityReadings: nextDraft.utilityReadings.map((row) =>
          row.id === context.row.id
            ? {
                ...row,
                previousReading,
                ratePerUnit: nextRatePerUnit,
              }
            : row
        ),
      };

      const updatedRow =
        nextDrafts[context.draft.rowKey]?.utilityReadings.find(
          (row) => row.id === context.row.id
        ) ?? context.row;

      effectiveSources.push({
        readingDate: updatedRow.readingDate,
        currentReading: updatedRow.currentReading,
        ratePerUnit: updatedRow.ratePerUnit,
        order: effectiveSources.length,
      });
      effectiveSources.sort(compareMeterSource);
    }
  }

  return nextDrafts;
}

export function updateDraftMapForCycle(
  drafts: HistoricalBacklogDraftMap,
  contract: HistoricalBacklogContractOption,
  cycle: HistoricalBacklogCycleOption,
  updater: (draft: HistoricalBacklogMonthDraft) => HistoricalBacklogMonthDraft
) {
  const rowKey = buildBacklogMonthRowKey(contract.id, cycle.key);
  const currentDraft =
    drafts[rowKey] ?? createHistoricalBacklogMonthDraft(contract, cycle);
  const nextDrafts: HistoricalBacklogDraftMap = {
    ...drafts,
    [rowKey]: updater(currentDraft),
  };

  return applyCarryForwardToContractDrafts(nextDrafts, contract);
}

export function serializeMonthDraft(
  draft: HistoricalBacklogMonthDraft
) {
  return {
    rowKey: draft.rowKey,
    contractId: draft.contractId,
    billingPeriodStart: draft.billingPeriodStart,
    billingPeriodEnd: draft.billingPeriodEnd,
    issueDate: draft.issueDate,
    dueDate: draft.dueDate,
    recurringChargeIds: draft.recurringCharges.map(
      (charge) => charge.recurringChargeId
    ),
    rentAmount: draft.rentAmount,
    utilityReadings: draft.utilityReadings.map((row) => ({
      meterId: row.meterId,
      readingDate: row.readingDate,
      previousReading: row.previousReading,
      currentReading: row.currentReading,
      ratePerUnit: row.ratePerUnit,
    })),
    utilityCharges: draft.utilityCharges.map((row) => ({
      utilityType: row.utilityType,
      label: row.label,
      amount: row.amount,
    })),
    adjustments: draft.adjustments.map((row) => ({
      itemType: row.itemType,
      label: row.label,
      amount: row.amount,
    })),
    payment: {
      status: draft.payment.status,
      amount: draft.payment.amount,
      paymentDate: draft.payment.paymentDate,
      referenceNumber: draft.payment.referenceNumber,
      notes: draft.payment.notes,
    },
    notes: draft.notes,
  };
}

export function buildPropertyGroups(
  contractOptions: HistoricalBacklogContractOption[],
  tenantId: string,
  contractFilter: string
) {
  return contractOptions
    .filter((contract) => contract.tenantId === tenantId)
    .filter((contract) => contractFilter === "ALL" || contract.id === contractFilter)
    .map<HistoricalBacklogPropertyGroup>((contract) => ({
      groupKey: `${contract.id}:${contract.property.id}`,
      tenantId: contract.tenantId,
      contractId: contract.id,
      contractLabel: `${contract.property.propertyCode} · ${contract.property.name}`,
      tenantLabel: formatTenantName(contract.tenant),
      monthCount: contract.pendingBacklogCycles.length,
      months: contract.pendingBacklogCycles.map((cycle) => ({
        rowKey: buildBacklogMonthRowKey(contract.id, cycle.key),
        cycleKey: cycle.key,
        label: cycle.label,
        billingPeriodStart: toDateInputValue(new Date(cycle.start)),
        billingPeriodEnd: toDateInputValue(new Date(cycle.end)),
      })),
      recurringSummary: Array.from(
        new Set(
          contract.recurringCharges
            .filter((charge) => charge.isActive)
            .map((charge) => charge.label)
        )
      ),
      hasMeters: contract.meters.length > 0,
    }));
}

export function getTenantOptions(
  contractOptions: HistoricalBacklogContractOption[]
) {
  return Array.from(
    new Map(
      contractOptions.map((contract) => [
        contract.tenantId,
        {
          id: contract.tenantId,
          label: formatTenantName(contract.tenant),
        },
      ])
    ).values()
  ).sort((left, right) => left.label.localeCompare(right.label));
}

function isValidDate(value: string) {
  return !Number.isNaN(new Date(value).getTime());
}

function asNumber(value: string) {
  return Number(value || "0");
}

export function getContractDraftValidationMap(
  contract: HistoricalBacklogContractOption,
  drafts: HistoricalBacklogDraftMap
) {
  const issuesByRowKey = new Map<string, string[]>();
  const draftMonths = getContractDrafts(drafts, contract.id);
  const meterMap = new Map(contract.meters.map((meter) => [meter.id, meter]));
  const seenDates = new Set<string>();

  for (const draft of draftMonths) {
    for (const row of draft.utilityReadings) {
      const issues = issuesByRowKey.get(draft.rowKey) ?? [];
      const meter = meterMap.get(row.meterId);

      if (!meter) {
        issues.push("Select valid dedicated meter.");
        issuesByRowKey.set(draft.rowKey, issues);
        continue;
      }

      if (!isValidDate(row.readingDate)) {
        issues.push(`Enter valid reading date for ${meter.meterCode}.`);
        issuesByRowKey.set(draft.rowKey, issues);
        continue;
      }

      const readingDate = new Date(row.readingDate);
      const cycleStart = new Date(draft.billingPeriodStart);
      const cycleEnd = new Date(draft.billingPeriodEnd);

      if (readingDate < cycleStart || readingDate > cycleEnd) {
        issues.push(
          `Reading date for ${meter.meterCode} must stay inside backlog month.`
        );
      }

      const dedupeKey = `${meter.id}:${row.readingDate}`;

      if (seenDates.has(dedupeKey)) {
        issues.push(`Duplicate reading date for ${meter.meterCode}.`);
      }

      if (
        meter.readings.some(
          (reading) => toDateInputValue(new Date(reading.readingDate)) === row.readingDate
        )
      ) {
        issues.push(`Reading date already exists for ${meter.meterCode}.`);
      }

      if (asNumber(row.currentReading) < asNumber(row.previousReading)) {
        issues.push(
          `Current reading for ${meter.meterCode} cannot be lower than previous.`
        );
      }

      seenDates.add(dedupeKey);
      issuesByRowKey.set(
        draft.rowKey,
        Array.from(new Set(issues))
      );
    }
  }

  return issuesByRowKey;
}
