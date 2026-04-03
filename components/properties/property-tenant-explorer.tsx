"use client";

import { useMemo, useState } from "react";
import {
  hotkeysCoreFeature,
  syncDataLoaderFeature,
} from "@headless-tree/core";
import { useTree } from "@headless-tree/react";
import Link from "next/link";
import {
  Building2,
  CalendarDays,
  ChevronRight,
  CircleDashed,
  DoorOpen,
  FileText,
  Search,
  Users2,
} from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/format";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type ContractSnapshot = {
  id: string;
  startDate: string;
  endDate: string;
  monthlyRent: string;
  status: string;
  tenant: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    businessName: string | null;
  };
} | null;

type SpaceRow = {
  id: string;
  name: string;
  propertyCode: string;
  status: string;
  contract: ContractSnapshot;
};

type PropertyTenantExplorerProps = {
  property: {
    id: string;
    name: string;
    propertyCode: string;
    location: string;
  };
  rows: SpaceRow[];
};

type ExplorerNode = {
  id: string;
  label: string;
  kind: "building" | "floor" | "space";
  childrenIds: string[];
  row?: SpaceRow;
};

function formatTenantName(tenant: NonNullable<NonNullable<SpaceRow["contract"]>["tenant"]>) {
  return (
    tenant.businessName ||
    [tenant.firstName, tenant.lastName].filter(Boolean).join(" ") ||
    "Vacant"
  );
}

function getFloorLabel(spaceName: string) {
  const match = spaceName.match(/^([^-]+)-/);
  return match?.[1]?.trim() ?? "Spaces";
}

function formatContractDuration(startDate: string, endDate: string) {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const months =
    (end.getFullYear() - start.getFullYear()) * 12 +
    (end.getMonth() - start.getMonth()) +
    (end.getDate() >= start.getDate() ? 0 : -1);
  const safeMonths = Math.max(1, months);
  const years = Math.floor(safeMonths / 12);
  const remainingMonths = safeMonths % 12;

  if (years > 0 && remainingMonths === 0) {
    return `${years} ${years === 1 ? "Year" : "Years"}`;
  }

  if (years > 0) {
    return `${years}y ${remainingMonths}m`;
  }

  return `${safeMonths} ${safeMonths === 1 ? "Month" : "Months"}`;
}

function buildExplorerNodes(property: PropertyTenantExplorerProps["property"], rows: SpaceRow[]) {
  const byId: Record<string, ExplorerNode> = {};
  const rootId = `building:${property.id}`;
  const grouped = new Map<string, SpaceRow[]>();

  for (const row of rows) {
    const floor = getFloorLabel(row.name);
    const bucket = grouped.get(floor);

    if (bucket) {
      bucket.push(row);
    } else {
      grouped.set(floor, [row]);
    }
  }

  const floorEntries = [...grouped.entries()].sort((left, right) =>
    left[0].localeCompare(right[0], undefined, { numeric: true })
  );

  byId[rootId] = {
    id: rootId,
    label: property.name,
    kind: "building",
    childrenIds: floorEntries.map(([floor]) => `floor:${floor}`),
  };

  for (const [floor, floorRows] of floorEntries) {
    const floorId = `floor:${floor}`;
    byId[floorId] = {
      id: floorId,
      label: floor,
      kind: "floor",
      childrenIds: floorRows.map((row) => `space:${row.id}`),
    };

    for (const row of floorRows) {
      byId[`space:${row.id}`] = {
        id: `space:${row.id}`,
        label: row.name,
        kind: "space",
        childrenIds: [],
        row,
      };
    }
  }

  return {
    rootId,
    byId,
    initialExpanded: [rootId, ...floorEntries.map(([floor]) => `floor:${floor}`)],
  };
}

function NodeBadge({
  count,
  label,
}: {
  count: string;
  label: string;
}) {
  return (
    <div className="rounded-xl border border-border/60 bg-muted/30 px-3 py-2">
      <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-lg font-semibold tracking-[-0.04em]">{count}</p>
    </div>
  );
}

export function PropertyTenantExplorer({
  property,
  rows,
}: PropertyTenantExplorerProps) {
  const [query, setQuery] = useState("");

  const filteredRows = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    if (!normalizedQuery) {
      return rows;
    }

    return rows.filter((row) => {
      const tenantName = row.contract ? formatTenantName(row.contract.tenant).toLowerCase() : "";

      return (
        row.name.toLowerCase().includes(normalizedQuery) ||
        row.propertyCode.toLowerCase().includes(normalizedQuery) ||
        tenantName.includes(normalizedQuery)
      );
    });
  }, [query, rows]);

  const explorer = useMemo(
    () => buildExplorerNodes(property, filteredRows),
    [filteredRows, property]
  );

  const [selectedNodeId, setSelectedNodeId] = useState(explorer.rootId);

  const selectedNode = explorer.byId[selectedNodeId] ?? explorer.byId[explorer.rootId];

  const tree = useTree<ExplorerNode>({
    rootItemId: explorer.rootId,
    initialState: {
      expandedItems: explorer.initialExpanded,
    },
    getItemName: (item) => item.getItemData().label,
    isItemFolder: (item) => item.getItemData().childrenIds.length > 0,
    dataLoader: {
      getItem: (itemId) => explorer.byId[itemId],
      getChildren: (itemId) => explorer.byId[itemId]?.childrenIds ?? [],
    },
    indent: 14,
    features: [syncDataLoaderFeature, hotkeysCoreFeature],
  });

  const occupiedCount = filteredRows.filter((row) => row.contract?.status === "ACTIVE").length;
  const vacantCount = filteredRows.length - occupiedCount;

  const selectedSpaceRow = selectedNode.kind === "space" ? selectedNode.row ?? null : null;
  const floorRows =
    selectedNode.kind === "floor"
      ? selectedNode.childrenIds
          .map((childId) => explorer.byId[childId]?.row)
          .filter((row): row is SpaceRow => Boolean(row))
      : [];

  return (
    <div className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
      <Card className="rounded-2xl border-border/60 bg-card shadow-sm">
        <CardHeader className="space-y-4">
          <div>
            <CardTitle>Property explorer</CardTitle>
            <CardDescription>
              Navigate the building, floors, and spaces without forcing every tenant into one long table.
            </CardDescription>
          </div>
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search space or tenant"
              className="field-blank h-11 pl-9"
            />
          </div>
        </CardHeader>
        <CardContent>
          <div
            {...tree.getContainerProps("Property occupancy tree")}
            className="space-y-1"
          >
            {tree.getItems().map((item) => {
              const data = item.getItemData();
              const itemProps = item.getProps();
              const level = item.getItemMeta().level;
              const isSelected = selectedNodeId === item.getId();
              const itemPadding = level === 0 ? 0 : level * 14;

              return (
                <button
                  key={item.getId()}
                  {...itemProps}
                  onClick={(event) => {
                    itemProps.onClick?.(event);
                    setSelectedNodeId(item.getId());
                  }}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left transition-colors",
                    isSelected ? "bg-primary/10 text-foreground" : "hover:bg-muted/45"
                  )}
                  style={{ paddingLeft: `${12 + itemPadding}px` }}
                >
                  <span className="flex size-5 shrink-0 items-center justify-center text-muted-foreground">
                    {data.childrenIds.length > 0 ? (
                      <ChevronRight
                        className={cn(
                          "size-4 transition-transform",
                          item.isExpanded() && "rotate-90"
                        )}
                      />
                    ) : (
                      <CircleDashed className="size-3.5" />
                    )}
                  </span>
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-muted/45">
                    {data.kind === "building" ? (
                      <Building2 className="size-4" />
                    ) : data.kind === "floor" ? (
                      <DoorOpen className="size-4" />
                    ) : (
                      <FileText className="size-4" />
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{data.label}</span>
                    {data.kind === "space" && data.row?.contract ? (
                      <span className="block truncate text-xs text-muted-foreground">
                        {formatTenantName(data.row.contract.tenant)}
                      </span>
                    ) : null}
                  </span>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <div className="space-y-6">
        <section className="grid gap-4 md:grid-cols-3">
          <NodeBadge count={String(filteredRows.length)} label="Spaces" />
          <NodeBadge count={String(occupiedCount)} label="Occupied" />
          <NodeBadge count={String(vacantCount)} label="Vacant" />
        </section>

        {selectedNode.kind === "building" ? (
          <Card className="rounded-2xl border-border/60 bg-card shadow-sm">
            <CardHeader>
              <CardTitle>{property.name}</CardTitle>
              <CardDescription>
                Building-level overview. Use the tree to drill into floors and individual spaces.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              {filteredRows.map((row) => (
                <div
                  key={row.id}
                  className="rounded-xl border border-border/60 bg-muted/20 p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium">{row.name}</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {row.contract
                          ? formatTenantName(row.contract.tenant)
                          : "Vacant"}
                      </p>
                    </div>
                    <Badge variant="outline" className="rounded-full">
                      {row.contract?.status === "ACTIVE" ? "Occupied" : "Vacant"}
                    </Badge>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        ) : null}

        {selectedNode.kind === "floor" ? (
          <Card className="rounded-2xl border-border/60 bg-card shadow-sm">
            <CardHeader>
              <CardTitle>{selectedNode.label}</CardTitle>
              <CardDescription>
                Floor-level occupancy snapshot.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {floorRows.map((row) => (
                <div
                  key={row.id}
                  className="flex flex-col justify-between gap-3 rounded-xl border border-border/60 bg-muted/20 p-4 md:flex-row md:items-center"
                >
                  <div>
                    <p className="font-medium">{row.name}</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {row.contract ? formatTenantName(row.contract.tenant) : "Vacant"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="rounded-full">
                      {row.contract?.status === "ACTIVE" ? "Occupied" : "Vacant"}
                    </Badge>
                    {row.contract ? (
                      <Button
                        size="sm"
                        variant="outline"
                        className="button-blank rounded-full"
                        onClick={() => setSelectedNodeId(`space:${row.id}`)}
                      >
                        Open
                      </Button>
                    ) : null}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        ) : null}

        {selectedSpaceRow ? (
          <Card className="rounded-2xl border-border/60 bg-card shadow-sm">
            <CardHeader>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <CardTitle>{selectedSpaceRow.name}</CardTitle>
                  <CardDescription>{selectedSpaceRow.propertyCode}</CardDescription>
                </div>
                <Badge variant="outline" className="rounded-full">
                  {selectedSpaceRow.contract?.status === "ACTIVE" ? "Occupied" : "Vacant"}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-5">
              {selectedSpaceRow.contract ? (
                <>
                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                    <NodeBadge
                      count={formatTenantName(selectedSpaceRow.contract.tenant)}
                      label="Tenant"
                    />
                    <NodeBadge
                      count={formatContractDuration(
                        selectedSpaceRow.contract.startDate,
                        selectedSpaceRow.contract.endDate
                      )}
                      label="Duration"
                    />
                    <NodeBadge
                      count={formatDate(selectedSpaceRow.contract.startDate)}
                      label="Start"
                    />
                    <NodeBadge
                      count={formatDate(selectedSpaceRow.contract.endDate)}
                      label="End"
                    />
                  </div>

                  <div className="rounded-xl border border-border/60 bg-muted/20 p-5">
                    <p className="text-sm uppercase tracking-[0.18em] text-muted-foreground">
                      Monthly rent
                    </p>
                    <p className="mt-2 text-3xl font-semibold tracking-[-0.05em]">
                      {formatCurrency(Number(selectedSpaceRow.contract.monthlyRent))}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button
                      render={<Link href={`/contracts/${selectedSpaceRow.contract.id}/edit`} />}
                      className="rounded-full"
                    >
                      <CalendarDays />
                      Edit contract
                    </Button>
                    <Button
                      render={<Link href={`/tenants/${selectedSpaceRow.contract.tenant.id}`} />}
                      variant="outline"
                      className="button-blank rounded-full"
                    >
                      <Users2 />
                      Open tenant
                    </Button>
                  </div>
                </>
              ) : (
                <div className="rounded-xl border border-dashed border-border/70 bg-muted/20 p-5">
                  <p className="font-medium">No active contract on this space yet.</p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Create a contract for this unit when it becomes occupied.
                  </p>
                  <Button
                    render={<Link href="/contracts/new" />}
                    className="mt-4 rounded-full"
                  >
                    <CalendarDays />
                    New contract
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        ) : null}
      </div>
    </div>
  );
}
