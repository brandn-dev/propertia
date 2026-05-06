"use client";

import Link from "next/link";
import { useDeferredValue, useMemo, useState } from "react";
import { Copy, ExternalLink, PencilLine } from "lucide-react";
import { METER_READING_ORIGIN_LABELS, UTILITY_TYPE_LABELS } from "@/lib/form-options";
import { formatCompactNumber, formatCurrency, formatDate } from "@/lib/format";
import { formatUtilityQuantity } from "@/lib/utility-units";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const selectClassName = "select-blank";

type ReadingRow = {
  id: string;
  meterId: string;
  readingDate: string;
  previousReading: number;
  currentReading: number;
  consumption: number;
  ratePerUnit: number;
  totalAmount: number;
  origin: "OPERATIONAL" | "BACKLOG";
  canEdit: boolean;
  tenant: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    businessName: string | null;
  } | null;
  meter: {
    id: string;
    meterCode: string;
    utilityType: keyof typeof UTILITY_TYPE_LABELS;
    isShared: boolean;
    property: {
      id: string;
      name: string;
      propertyCode: string;
    };
  };
  recordedBy: {
    displayName: string;
  } | null;
  invoiceItem: {
    id: string;
    invoice: {
      id: string;
      invoiceNumber: string;
    };
  } | null;
};

type SortKey =
  | "readingDate"
  | "property"
  | "meter"
  | "usage"
  | "amount";

type ReadingsTableWorkspaceProps = {
  readings: ReadingRow[];
};

function formatTenantName(tenant: ReadingRow["tenant"]) {
  if (!tenant) {
    return "Shared / Property-level";
  }

  return (
    tenant.businessName ||
    [tenant.firstName, tenant.lastName].filter(Boolean).join(" ") ||
    "Tenant"
  );
}

function buildExportRows(rows: ReadingRow[]) {
  const header = [
    "Business",
    "Property",
    "Meter",
    "Date",
    "Origin",
    "Billed",
    "Previous",
    "Current",
    "Usage",
    "Amount",
  ].join("\t");
  const body = rows.map((row) =>
    [
      formatTenantName(row.tenant),
      `${row.meter.property.propertyCode} ${row.meter.property.name}`,
      row.meter.meterCode,
      formatDate(row.readingDate),
      METER_READING_ORIGIN_LABELS[row.origin],
      row.invoiceItem ? "Yes" : "No",
      row.previousReading.toFixed(2),
      row.currentReading.toFixed(2),
      row.consumption.toFixed(2),
      row.totalAmount.toFixed(2),
    ].join("\t")
  );

  return [header, ...body].join("\n");
}

export function ReadingsTableWorkspace({
  readings,
}: ReadingsTableWorkspaceProps) {
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [tenantFilter, setTenantFilter] = useState("ALL");
  const [propertyFilter, setPropertyFilter] = useState("ALL");
  const [meterFilter, setMeterFilter] = useState("ALL");
  const [utilityTypeFilter, setUtilityTypeFilter] = useState("ALL");
  const [billedFilter, setBilledFilter] = useState("ALL");
  const [originFilter, setOriginFilter] = useState("ALL");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("readingDate");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

  const tenantOptions = useMemo(
    () =>
      Array.from(
        new Map(
          readings
            .filter((row) => row.tenant)
            .map((row) => [row.tenant!.id, formatTenantName(row.tenant)])
        ).entries()
      )
        .map(([id, label]) => ({ id, label }))
        .sort((left, right) => left.label.localeCompare(right.label)),
    [readings]
  );
  const propertyOptions = useMemo(
    () =>
      Array.from(
        new Map(
          readings.map((row) => [
            row.meter.property.id,
            `${row.meter.property.propertyCode} · ${row.meter.property.name}`,
          ])
        ).entries()
      )
        .map(([id, label]) => ({ id, label }))
        .sort((left, right) => left.label.localeCompare(right.label)),
    [readings]
  );
  const meterOptions = useMemo(
    () =>
      Array.from(
        new Map(
          readings.map((row) => [row.meter.id, row.meter.meterCode])
        ).entries()
      )
        .map(([id, label]) => ({ id, label }))
        .sort((left, right) => left.label.localeCompare(right.label)),
    [readings]
  );

  const filteredRows = useMemo(() => {
    const normalizedSearch = deferredSearch.trim().toLowerCase();

    return readings.filter((row) => {
      if (tenantFilter !== "ALL" && row.tenant?.id !== tenantFilter) {
        return false;
      }

      if (propertyFilter !== "ALL" && row.meter.property.id !== propertyFilter) {
        return false;
      }

      if (meterFilter !== "ALL" && row.meter.id !== meterFilter) {
        return false;
      }

      if (utilityTypeFilter !== "ALL" && row.meter.utilityType !== utilityTypeFilter) {
        return false;
      }

      if (
        billedFilter === "BILLED" &&
        !row.invoiceItem
      ) {
        return false;
      }

      if (
        billedFilter === "UNBILLED" &&
        row.invoiceItem
      ) {
        return false;
      }

      if (originFilter !== "ALL" && row.origin !== originFilter) {
        return false;
      }

      const readingDate = new Date(row.readingDate);

      if (dateFrom && readingDate < new Date(`${dateFrom}T00:00:00`)) {
        return false;
      }

      if (dateTo && readingDate > new Date(`${dateTo}T23:59:59.999`)) {
        return false;
      }

      if (!normalizedSearch) {
        return true;
      }

      return [
        formatTenantName(row.tenant),
        row.meter.property.name,
        row.meter.property.propertyCode,
        row.meter.meterCode,
      ]
        .join(" ")
        .toLowerCase()
        .includes(normalizedSearch);
    });
  }, [
    billedFilter,
    dateFrom,
    dateTo,
    deferredSearch,
    meterFilter,
    originFilter,
    propertyFilter,
    readings,
    tenantFilter,
    utilityTypeFilter,
  ]);

  const sortedRows = useMemo(() => {
    const multiplier = sortDirection === "asc" ? 1 : -1;

    return [...filteredRows].sort((left, right) => {
      const comparisons: Record<SortKey, number> = {
        readingDate:
          new Date(left.readingDate).getTime() -
          new Date(right.readingDate).getTime(),
        property: `${left.meter.property.propertyCode} ${left.meter.property.name}`.localeCompare(
          `${right.meter.property.propertyCode} ${right.meter.property.name}`
        ),
        meter: left.meter.meterCode.localeCompare(right.meter.meterCode),
        usage: left.consumption - right.consumption,
        amount: left.totalAmount - right.totalAmount,
      };

      const primary = comparisons[sortKey];

      if (primary !== 0) {
        return primary * multiplier;
      }

      return (
        (new Date(left.readingDate).getTime() -
          new Date(right.readingDate).getTime()) *
        (sortKey === "readingDate" ? multiplier : -1)
      );
    });
  }, [filteredRows, sortDirection, sortKey]);

  const selectedRows = useMemo(
    () => sortedRows.filter((row) => selectedIds.includes(row.id)),
    [selectedIds, sortedRows]
  );
  const allFilteredSelected =
    sortedRows.length > 0 && selectedRows.length === sortedRows.length;
  const selectedEditableRows = selectedRows.filter((row) => row.canEdit);
  const selectedBilledInvoices = Array.from(
    new Set(
      selectedRows
        .map((row) => row.invoiceItem?.invoice.id ?? null)
        .filter(Boolean)
    )
  );

  function toggleSort(nextKey: SortKey) {
    if (sortKey === nextKey) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }

    setSortKey(nextKey);
    setSortDirection(nextKey === "readingDate" ? "desc" : "asc");
  }

  function toggleSelected(readingId: string, checked: boolean) {
    setSelectedIds((current) =>
      checked ? [...current, readingId] : current.filter((id) => id !== readingId)
    );
  }

  function toggleAllSelected(checked: boolean) {
    setSelectedIds(checked ? sortedRows.map((row) => row.id) : []);
  }

  async function copySelectedRows() {
    if (selectedRows.length === 0) {
      return;
    }

    await navigator.clipboard.writeText(buildExportRows(selectedRows));
  }

  function openSelectedEditableRows() {
    for (const row of selectedEditableRows) {
      window.open(`/utilities/readings/${row.id}/edit`, "_blank", "noopener,noreferrer");
    }
  }

  function openSelectedBilledInvoices() {
    for (const invoiceId of selectedBilledInvoices) {
      window.open(`/billing/${invoiceId}`, "_blank", "noopener,noreferrer");
    }
  }

  return (
    <div className="space-y-6">
      <div className="border-blank rounded-xl p-6">
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          <div className="space-y-2 xl:col-span-2">
            <Label htmlFor="readingSearch">Search</Label>
            <Input
              id="readingSearch"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="field-blank h-11"
              placeholder="Search business, property, or meter"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="tenantFilter">Business</Label>
            <select
              id="tenantFilter"
              value={tenantFilter}
              onChange={(event) => setTenantFilter(event.target.value)}
              className={selectClassName}
            >
              <option value="ALL">All businesses</option>
              {tenantOptions.map((tenant) => (
                <option key={tenant.id} value={tenant.id}>
                  {tenant.label}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="propertyFilter">Property</Label>
            <select
              id="propertyFilter"
              value={propertyFilter}
              onChange={(event) => setPropertyFilter(event.target.value)}
              className={selectClassName}
            >
              <option value="ALL">All properties</option>
              {propertyOptions.map((property) => (
                <option key={property.id} value={property.id}>
                  {property.label}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="meterFilter">Meter</Label>
            <select
              id="meterFilter"
              value={meterFilter}
              onChange={(event) => setMeterFilter(event.target.value)}
              className={selectClassName}
            >
              <option value="ALL">All meters</option>
              {meterOptions.map((meter) => (
                <option key={meter.id} value={meter.id}>
                  {meter.label}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="utilityTypeFilter">Utility type</Label>
            <select
              id="utilityTypeFilter"
              value={utilityTypeFilter}
              onChange={(event) => setUtilityTypeFilter(event.target.value)}
              className={selectClassName}
            >
              <option value="ALL">All utility types</option>
              {Object.entries(UTILITY_TYPE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="billedFilter">Billed status</Label>
            <select
              id="billedFilter"
              value={billedFilter}
              onChange={(event) => setBilledFilter(event.target.value)}
              className={selectClassName}
            >
              <option value="ALL">All rows</option>
              <option value="UNBILLED">Unbilled only</option>
              <option value="BILLED">Billed only</option>
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="originFilter">Origin</Label>
            <select
              id="originFilter"
              value={originFilter}
              onChange={(event) => setOriginFilter(event.target.value)}
              className={selectClassName}
            >
              <option value="ALL">All origins</option>
              <option value="OPERATIONAL">Operational</option>
              <option value="BACKLOG">Backlog</option>
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="dateFrom">Date from</Label>
            <Input
              id="dateFrom"
              type="date"
              value={dateFrom}
              onChange={(event) => setDateFrom(event.target.value)}
              className="field-blank h-11"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="dateTo">Date to</Label>
            <Input
              id="dateTo"
              type="date"
              value={dateTo}
              onChange={(event) => setDateTo(event.target.value)}
              className="field-blank h-11"
            />
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-2">
          <Badge variant="outline">{sortedRows.length} visible</Badge>
          <Badge variant="outline">{selectedRows.length} selected</Badge>
          <Badge variant="outline">{selectedEditableRows.length} editable</Badge>
          <Button
            type="button"
            variant="outline"
            className="button-blank rounded-full"
            onClick={() => void copySelectedRows()}
            disabled={selectedRows.length === 0}
          >
            <Copy />
            Copy selected
          </Button>
          <Button
            type="button"
            variant="outline"
            className="button-blank rounded-full"
            onClick={openSelectedEditableRows}
            disabled={selectedEditableRows.length === 0}
          >
            <PencilLine />
            Open editable selected
          </Button>
          <Button
            type="button"
            variant="outline"
            className="button-blank rounded-full"
            onClick={openSelectedBilledInvoices}
            disabled={selectedBilledInvoices.length === 0}
          >
            <ExternalLink />
            Open billed invoices
          </Button>
        </div>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-14">
              <label className="flex items-center justify-center">
                <input
                  type="checkbox"
                  checked={allFilteredSelected}
                  onChange={(event) => toggleAllSelected(event.target.checked)}
                  className="size-4 rounded border-border text-primary"
                  aria-label="Select all visible readings"
                />
              </label>
            </TableHead>
            <TableHead>
              <button type="button" onClick={() => toggleSort("meter")}>
                Meter
              </button>
            </TableHead>
            <TableHead>
              <button type="button" onClick={() => toggleSort("property")}>
                Tenant / Scope
              </button>
            </TableHead>
            <TableHead>
              <button type="button" onClick={() => toggleSort("readingDate")}>
                Date
              </button>
            </TableHead>
            <TableHead>Recorder</TableHead>
            <TableHead className="text-right">Previous</TableHead>
            <TableHead className="text-right">Current</TableHead>
            <TableHead className="text-right">
              <button type="button" onClick={() => toggleSort("usage")}>
                Usage
              </button>
            </TableHead>
            <TableHead className="text-right">
              <button type="button" onClick={() => toggleSort("amount")}>
                Amount
              </button>
            </TableHead>
            <TableHead className="text-right">Action</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedRows.map((reading) => (
            <TableRow key={reading.id}>
              <TableCell>
                <label className="flex items-center justify-center">
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(reading.id)}
                    onChange={(event) =>
                      toggleSelected(reading.id, event.target.checked)
                    }
                    className="size-4 rounded border-border text-primary"
                    aria-label={`Select reading ${reading.id}`}
                  />
                </label>
              </TableCell>
              <TableCell className="font-medium">
                {reading.meter.meterCode}
                <p className="text-xs text-muted-foreground">
                  {reading.meter.property.name} ·{" "}
                  {METER_READING_ORIGIN_LABELS[reading.origin]}
                </p>
              </TableCell>
              <TableCell>
                {formatTenantName(reading.tenant)}
                <p className="text-xs text-muted-foreground">
                  {reading.meter.isShared ? "Shared meter" : "Dedicated meter"}
                </p>
              </TableCell>
              <TableCell>{formatDate(reading.readingDate)}</TableCell>
              <TableCell>{reading.recordedBy?.displayName ?? "System"}</TableCell>
              <TableCell className="text-right">
                {formatUtilityQuantity(
                  reading.meter.utilityType,
                  formatCompactNumber(reading.previousReading)
                )}
              </TableCell>
              <TableCell className="text-right">
                {formatUtilityQuantity(
                  reading.meter.utilityType,
                  formatCompactNumber(reading.currentReading)
                )}
              </TableCell>
              <TableCell className="text-right">
                {formatUtilityQuantity(
                  reading.meter.utilityType,
                  formatCompactNumber(reading.consumption)
                )}
              </TableCell>
              <TableCell className="text-right">
                {formatCurrency(reading.totalAmount)}
              </TableCell>
              <TableCell className="text-right">
                {reading.invoiceItem ? (
                  <div className="flex justify-end gap-2">
                    <Badge variant="outline">Billed</Badge>
                    <Button
                      render={<Link href={`/billing/${reading.invoiceItem.invoice.id}`} />}
                      variant="outline"
                      size="sm"
                      className="button-blank rounded-full"
                    >
                      <ExternalLink />
                      Invoice
                    </Button>
                  </div>
                ) : reading.canEdit ? (
                  <Button
                    render={<Link href={`/utilities/readings/${reading.id}/edit`} />}
                    variant="outline"
                    size="sm"
                    className="button-blank rounded-full"
                  >
                    <PencilLine />
                    Edit
                  </Button>
                ) : (
                  <Badge variant="outline">Locked</Badge>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
