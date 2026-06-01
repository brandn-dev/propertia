"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  Building2,
  CalendarClock,
  CircleDollarSign,
  FileSpreadsheet,
  Handshake,
  PencilLine,
  Repeat2,
  RotateCcw,
  TimerReset,
} from "lucide-react";
import { formatContractEndDate } from "@/lib/contracts/term";
import { formatCurrency, formatDate } from "@/lib/format";
import { DashboardEmptyState } from "@/components/dashboard/empty-state";
import { DashboardMetricCard } from "@/components/dashboard/metric-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

type ContractWorkspaceRow = {
  id: string;
  startDate: string;
  endDate: string;
  monthlyRent: number;
  status: string;
  property: {
    id: string;
    name: string;
    propertyCode: string;
    parent?: {
      id: string;
      name: string;
      propertyCode: string;
    } | null;
  };
  tenant: {
    firstName: string | null;
    lastName: string | null;
    businessName: string | null;
  };
  counts: {
    recurringCharges: number;
    rentAdjustments: number;
  };
};

type ContractScope =
  | "ALL"
  | "ACTIVE"
  | "DRAFT"
  | "EXPIRING"
  | "EXPIRED"
  | "ENDED"
  | "TERMINATED";

type ContractSort = "NEWEST" | "OLDEST";

const scopeChipClassName =
  "inline-flex h-9 items-center gap-2 rounded-full border px-3 text-xs transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50";

function formatTenantName(tenant: ContractWorkspaceRow["tenant"]) {
  return (
    tenant.businessName ||
    [tenant.firstName, tenant.lastName].filter(Boolean).join(" ") ||
    "Unassigned"
  );
}

function getStatusTone(status: string) {
  switch (status) {
    case "ACTIVE":
      return "border-emerald-500/30 bg-emerald-500/10 text-emerald-300";
    case "DRAFT":
      return "border-sky-500/30 bg-sky-500/10 text-sky-300";
    case "EXPIRED":
    case "ENDED":
      return "border-amber-500/30 bg-amber-500/10 text-amber-300";
    case "TERMINATED":
      return "border-rose-500/30 bg-rose-500/10 text-rose-300";
    default:
      return "border-border/60 bg-muted/20 text-muted-foreground";
  }
}

function isExpiringWithin(endDate: string, days: number) {
  const today = new Date();
  const end = new Date(endDate);
  const ms = end.getTime() - today.getTime();
  const dayDiff = Math.ceil(ms / (1000 * 60 * 60 * 24));

  return dayDiff >= 0 && dayDiff <= days;
}

export function ContractsWorkspace({
  contracts,
}: {
  contracts: ContractWorkspaceRow[];
}) {
  const [scope, setScope] = useState<ContractScope>("ALL");
  const [propertyFilter, setPropertyFilter] = useState("ALL");
  const [sort, setSort] = useState<ContractSort>("NEWEST");

  const scopeCounts = useMemo(
    () => ({
      ALL: contracts.length,
      ACTIVE: contracts.filter((contract) => contract.status === "ACTIVE").length,
      DRAFT: contracts.filter((contract) => contract.status === "DRAFT").length,
      EXPIRING: contracts.filter(
        (contract) =>
          contract.status === "ACTIVE" && isExpiringWithin(contract.endDate, 90)
      ).length,
      EXPIRED: contracts.filter((contract) => contract.status === "EXPIRED").length,
      ENDED: contracts.filter((contract) => contract.status === "ENDED").length,
      TERMINATED: contracts.filter((contract) => contract.status === "TERMINATED")
        .length,
    }),
    [contracts]
  );

  const scopedContracts = useMemo(() => {
    return contracts.filter((contract) => {
      switch (scope) {
        case "ALL":
          return true;
        case "EXPIRING":
          return contract.status === "ACTIVE" && isExpiringWithin(contract.endDate, 90);
        default:
          return contract.status === scope;
      }
    });
  }, [contracts, scope]);

  const propertyChips = useMemo(() => {
    const propertyMap = new Map<
      string,
      { value: string; label: string; propertyCode: string; count: number }
    >();

    for (const contract of scopedContracts) {
      const group = contract.property.parent
        ? {
            id: contract.property.parent.id,
            label: contract.property.parent.name,
            propertyCode: contract.property.parent.propertyCode,
          }
        : {
            id: contract.property.id,
            label: contract.property.name,
            propertyCode: contract.property.propertyCode,
          };

      const existing = propertyMap.get(group.id);

      if (existing) {
        existing.count += 1;
        continue;
      }

      propertyMap.set(group.id, {
        value: group.id,
        label: group.label,
        propertyCode: group.propertyCode,
        count: 1,
      });
    }

    return [
      {
        value: "ALL",
        label: "All",
        propertyCode: "",
        count: scopedContracts.length,
      },
      ...Array.from(propertyMap.values()).sort((left, right) =>
        left.label.localeCompare(right.label)
      ),
    ];
  }, [scopedContracts]);

  const effectivePropertyFilter = useMemo(() => {
    if (propertyFilter === "ALL") {
      return "ALL";
    }

    return propertyChips.some((chip) => chip.value === propertyFilter)
      ? propertyFilter
      : "ALL";
  }, [propertyChips, propertyFilter]);

  const filteredContracts = useMemo(() => {
    const propertyScoped = scopedContracts.filter((contract) =>
      effectivePropertyFilter === "ALL"
        ? true
        : (contract.property.parent?.id ?? contract.property.id) ===
          effectivePropertyFilter
    );

    return [...propertyScoped].sort((left, right) => {
      const leftValue = new Date(left.startDate).getTime();
      const rightValue = new Date(right.startDate).getTime();

      return sort === "NEWEST" ? rightValue - leftValue : leftValue - rightValue;
    });
  }, [effectivePropertyFilter, scopedContracts, sort]);

  const activeContracts = filteredContracts.filter(
    (contract) => contract.status === "ACTIVE"
  ).length;
  const expiringThirty = filteredContracts.filter(
    (contract) => contract.status === "ACTIVE" && isExpiringWithin(contract.endDate, 30)
  ).length;
  const expiringNinety = filteredContracts.filter(
    (contract) => contract.status === "ACTIVE" && isExpiringWithin(contract.endDate, 90)
  ).length;
  const totalMonthlyRent = filteredContracts.reduce(
    (sum, contract) => sum + contract.monthlyRent,
    0
  );

  const scopes: Array<{
    value: ContractScope;
    label: string;
    icon: typeof FileSpreadsheet;
  }> = [
    { value: "ALL", label: "All", icon: FileSpreadsheet },
    { value: "ACTIVE", label: "Active", icon: Handshake },
    { value: "DRAFT", label: "Draft", icon: FileSpreadsheet },
    { value: "EXPIRING", label: "Expiring", icon: CalendarClock },
    { value: "EXPIRED", label: "Expired", icon: TimerReset },
    { value: "ENDED", label: "Ended", icon: TimerReset },
    { value: "TERMINATED", label: "Terminated", icon: TimerReset },
  ];

  return (
    <div className="space-y-5">
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <DashboardMetricCard
          label="Visible contracts"
          value={String(filteredContracts.length)}
          detail="Contracts currently in this view."
          icon={FileSpreadsheet}
        />
        <DashboardMetricCard
          label="Active now"
          value={String(activeContracts)}
          detail="Agreements currently billable."
          icon={Handshake}
        />
        <DashboardMetricCard
          label="Expiring 30d"
          value={String(expiringThirty)}
          detail="Contracts ending in the next month."
          icon={CalendarClock}
        />
        <DashboardMetricCard
          label="Monthly rent"
          value={formatCurrency(totalMonthlyRent)}
          detail="Rent exposure from filtered contracts."
          icon={CircleDollarSign}
        />
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(320px,0.9fr)]">
        <Card className="rounded-2xl border-border/60 bg-card/95 shadow-sm">
          <CardHeader className="space-y-3">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
              <div>
                <CardTitle>Contract registry</CardTitle>
                <CardDescription>
                  Filter by agreement state, review the newest contracts first, and jump into rates or edits.
                </CardDescription>
              </div>

              <div className="flex items-center gap-2">
                <label className="text-xs text-muted-foreground">Sort</label>
                <select
                  value={sort}
                  onChange={(event) => setSort(event.target.value as ContractSort)}
                  className="h-9 rounded-full border border-border/60 bg-background/70 px-3 text-xs font-medium text-foreground outline-none"
                >
                  <option value="NEWEST">Newest first</option>
                  <option value="OLDEST">Oldest first</option>
                </select>
              </div>
            </div>

            <div className="-mx-1 overflow-x-auto px-1 pb-1">
              <div className="flex min-w-max gap-2">
                {scopes.map((chip) => {
                  const Icon = chip.icon;
                  const isActive = chip.value === scope;

                  return (
                    <button
                      key={chip.value}
                      type="button"
                      onClick={() => setScope(chip.value)}
                      className={cn(
                        scopeChipClassName,
                        isActive
                          ? "border-chart-4/40 bg-chart-4/12 text-chart-4"
                          : "border-border/60 bg-background/70 text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                      )}
                    >
                      <Icon className="size-3.5" />
                      <span className="font-medium">{chip.label}</span>
                      <Badge variant="outline" className="h-5 rounded-full px-1.5">
                        {scopeCounts[chip.value]}
                      </Badge>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="-mx-1 overflow-x-auto px-1 pb-1">
              <div className="flex min-w-max gap-2">
                {propertyChips.map((chip) => {
                  const isActive = chip.value === effectivePropertyFilter;

                  return (
                    <button
                      key={chip.value}
                      type="button"
                      onClick={() => setPropertyFilter(chip.value)}
                      className={cn(
                        scopeChipClassName,
                        isActive
                          ? "border-chart-2/40 bg-chart-2/12 text-chart-2"
                          : "border-border/60 bg-background/70 text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                      )}
                      title={chip.propertyCode || chip.label}
                    >
                      <Building2 className="size-3.5" />
                      <span className="font-medium">{chip.label}</span>
                      <Badge variant="outline" className="h-5 rounded-full px-1.5">
                        {chip.count}
                      </Badge>
                    </button>
                  );
                })}
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-4">
            {filteredContracts.length === 0 ? (
              <DashboardEmptyState
                icon={TimerReset}
                title="No contracts in this view"
                description="Try another chip or create a new agreement to populate this registry."
              />
            ) : (
              <div className="overflow-hidden rounded-2xl border border-border/60">
                <div className="flex items-center justify-between gap-3 border-b border-border/60 bg-muted/15 px-3 py-2.5">
                  <div className="min-w-0">
                    <p className="text-sm font-medium leading-none">Contracts</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="rounded-full">
                      {filteredContracts.length} visible
                    </Badge>
                    <Button
                      render={<Link href="/billing/charges" />}
                      variant="outline"
                      className="button-blank rounded-full"
                      size="sm"
                    >
                      <Repeat2 />
                      Recurring charges
                    </Button>
                  </div>
                </div>

                <Table>
                  <TableHeader>
                    <TableRow className="border-border/60">
                      <TableHead className="h-9 px-3 text-xs uppercase tracking-[0.12em] text-muted-foreground">
                        Property
                      </TableHead>
                      <TableHead className="h-9 px-3 text-xs uppercase tracking-[0.12em] text-muted-foreground">
                        Tenant
                      </TableHead>
                      <TableHead className="h-9 px-3 text-xs uppercase tracking-[0.12em] text-muted-foreground">
                        Start
                      </TableHead>
                      <TableHead className="h-9 px-3 text-xs uppercase tracking-[0.12em] text-muted-foreground">
                        End
                      </TableHead>
                      <TableHead className="h-9 px-3 text-xs uppercase tracking-[0.12em] text-muted-foreground">
                        Status
                      </TableHead>
                      <TableHead className="h-9 px-3 text-right text-xs uppercase tracking-[0.12em] text-muted-foreground">
                        Charges
                      </TableHead>
                      <TableHead className="h-9 px-3 text-right text-xs uppercase tracking-[0.12em] text-muted-foreground">
                        Rates
                      </TableHead>
                      <TableHead className="h-9 px-3 text-right text-xs uppercase tracking-[0.12em] text-muted-foreground">
                        Rent
                      </TableHead>
                      <TableHead className="h-9 px-3 text-right text-xs uppercase tracking-[0.12em] text-muted-foreground">
                        Action
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredContracts.map((contract) => (
                      <TableRow key={contract.id} className="border-border/60">
                        <TableCell className="px-3 py-3 align-top">
                          <div className="font-medium">{contract.property.name}</div>
                          <p className="text-xs text-muted-foreground">
                            {contract.property.propertyCode}
                          </p>
                        </TableCell>
                        <TableCell className="px-3 py-3">
                          {formatTenantName(contract.tenant)}
                        </TableCell>
                        <TableCell className="px-3 py-3">
                          {formatDate(contract.startDate)}
                        </TableCell>
                        <TableCell className="px-3 py-3">
                          {formatContractEndDate(contract.endDate)}
                        </TableCell>
                        <TableCell className="px-3 py-3">
                          <Badge
                            variant="outline"
                            className={cn("rounded-full", getStatusTone(contract.status))}
                          >
                            {contract.status.replaceAll("_", " ")}
                          </Badge>
                        </TableCell>
                        <TableCell className="px-3 py-3 text-right">
                          {contract.counts.recurringCharges}
                        </TableCell>
                        <TableCell className="px-3 py-3 text-right">
                          {contract.counts.rentAdjustments}
                        </TableCell>
                        <TableCell className="px-3 py-3 text-right">
                          {formatCurrency(contract.monthlyRent)}
                        </TableCell>
                        <TableCell className="px-3 py-3 text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              render={<Link href={`/contracts/${contract.id}/adjustments`} />}
                              variant="outline"
                              size="sm"
                              className="button-blank rounded-full"
                            >
                              <RotateCcw />
                              Rates
                            </Button>
                            <Button
                              render={<Link href={`/contracts/${contract.id}/edit`} />}
                              variant="outline"
                              size="sm"
                              className="button-blank rounded-full"
                            >
                              <PencilLine />
                              Edit
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-border/60 bg-card/95 shadow-sm">
          <CardHeader>
            <div className="flex items-start justify-between gap-3">
              <CardTitle>Renewal watch</CardTitle>
              <Badge variant="outline" className="rounded-full">
                {expiringNinety} in 90d
              </Badge>
            </div>
            <CardDescription>
              Contracts closest to expiry so ops can act before they slip.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {filteredContracts
              .filter((contract) => contract.status === "ACTIVE")
              .sort(
                (left, right) =>
                  new Date(left.endDate).getTime() - new Date(right.endDate).getTime()
              )
              .slice(0, 5).length === 0 ? (
              <DashboardEmptyState
                icon={CalendarClock}
                title="No active renewals to watch"
                description="This filtered view has no active contracts approaching expiry."
              />
            ) : (
              filteredContracts
                .filter((contract) => contract.status === "ACTIVE")
                .sort(
                  (left, right) =>
                    new Date(left.endDate).getTime() - new Date(right.endDate).getTime()
                )
                .slice(0, 5)
                .map((contract) => (
                  <Link
                    key={contract.id}
                    href={`/contracts/${contract.id}/edit`}
                    className="block rounded-2xl border border-border/60 bg-muted/15 px-4 py-3 transition-colors hover:bg-muted/30"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-medium">{formatTenantName(contract.tenant)}</div>
                        <div className="text-sm text-muted-foreground">
                          {contract.property.propertyCode} · {contract.property.name}
                        </div>
                      </div>
                      <Badge variant="outline" className="rounded-full">
                        {isExpiringWithin(contract.endDate, 30) ? "30d" : "90d"}
                      </Badge>
                    </div>
                    <div className="mt-2 flex items-center justify-between gap-3 text-sm">
                      <span className="text-muted-foreground">
                        Ends {formatContractEndDate(contract.endDate)}
                      </span>
                      <span className="font-medium">
                        {formatCurrency(contract.monthlyRent)}
                      </span>
                    </div>
                  </Link>
                ))
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
