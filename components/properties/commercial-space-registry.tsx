"use client";

import { useState } from "react";
import Link from "next/link";
import { DoorOpen, Eye, MapPin, PencilLine } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PROPERTY_STATUS_LABELS } from "@/lib/form-options";
import { cn } from "@/lib/utils";

type RegistryItem = {
  id: string;
  name: string;
  propertyCode: string;
  status: string;
  location: string;
  parent?: {
    name: string;
  } | null;
  _count: {
    children: number;
    contracts: number;
    utilityMeters: number;
  };
};

type SpaceParentGroup = {
  id: string;
  label: string;
  meta: string;
  items: RegistryItem[];
};

function getStatusBadgeClasses(status: string) {
  switch (status) {
    case "ACTIVE":
      return "border-chart-3/35 bg-chart-3/12 text-chart-3";
    case "UNDER_MAINTENANCE":
      return "border-chart-4/40 bg-chart-4/12 text-chart-4";
    case "ARCHIVED":
      return "border-border/70 bg-muted/35 text-muted-foreground";
    case "INACTIVE":
      return "border-chart-5/35 bg-chart-5/10 text-chart-5";
    default:
      return "border-border/70 bg-background text-foreground";
  }
}

export function CommercialSpaceRegistry({
  groups,
}: {
  groups: SpaceParentGroup[];
}) {
  const [selectedParentId, setSelectedParentId] = useState<string | null>("all");
  const selectedGroup =
    selectedParentId === "all"
      ? {
          id: "all",
          label: "All commercial spaces",
          meta: "All",
          items: groups.flatMap((group) => group.items),
        }
      : groups.find((group) => group.id === selectedParentId) ?? null;

  return (
    <div className="space-y-4">
      <div className="-mx-1 overflow-x-auto px-1 pb-1">
        <div className="flex min-w-max gap-2">
          <button
            type="button"
            onClick={() => setSelectedParentId("all")}
            className={cn(
              "inline-flex h-9 items-center gap-2 rounded-full border px-3 text-xs transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
              selectedParentId === "all"
                ? "border-chart-4/40 bg-chart-4/12 text-chart-4"
                : "border-border/60 bg-background/70 text-muted-foreground hover:bg-muted/60 hover:text-foreground"
            )}
          >
            <DoorOpen className="size-3.5" />
            <span className="font-medium">All</span>
            <Badge variant="outline" className="h-5 rounded-full px-1.5">
              {groups.reduce((sum, group) => sum + group.items.length, 0)}
            </Badge>
          </button>

          {groups.map((group) => {
            const isActive = group.id === selectedParentId;

            return (
              <button
                key={group.id}
                type="button"
                onClick={() => setSelectedParentId(group.id)}
                className={cn(
                  "inline-flex h-9 items-center gap-2 rounded-full border px-3 text-xs transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                  isActive
                    ? "border-chart-4/40 bg-chart-4/12 text-chart-4"
                    : "border-border/60 bg-background/70 text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                )}
              >
                <DoorOpen className="size-3.5" />
                <span className="font-medium">{group.meta}</span>
                {group.label !== "Unassigned" ? (
                  <span className="max-w-40 truncate">{group.label}</span>
                ) : null}
                <Badge variant="outline" className="h-5 rounded-full px-1.5">
                  {group.items.length}
                </Badge>
              </button>
            );
          })}
        </div>
      </div>

      {selectedGroup ? (
        <div className="overflow-hidden rounded-2xl border border-border/60">
          <div className="flex items-center justify-between gap-3 border-b border-border/60 bg-muted/15 px-3 py-2.5">
            <div className="min-w-0">
              <p className="text-sm font-medium leading-none">
                {selectedGroup.label}
              </p>
              {selectedGroup.meta !== "All" && selectedGroup.label !== "Unassigned" ? (
                <p className="mt-1 text-xs uppercase tracking-[0.12em] text-muted-foreground">
                  {selectedGroup.meta}
                </p>
              ) : null}
            </div>
            <Badge variant="outline" className="rounded-full">
              {selectedGroup.items.length}
            </Badge>
          </div>

          <Table>
            <TableHeader>
              <TableRow className="border-border/60">
                <TableHead className="h-9 px-3 text-xs uppercase tracking-[0.12em] text-muted-foreground">
                  Code
                </TableHead>
                <TableHead className="h-9 min-w-[220px] px-3 text-xs uppercase tracking-[0.12em] text-muted-foreground">
                  Name
                </TableHead>
                <TableHead className="h-9 min-w-[260px] px-3 text-xs uppercase tracking-[0.12em] text-muted-foreground">
                  Location
                </TableHead>
                <TableHead className="h-9 px-3 text-xs uppercase tracking-[0.12em] text-muted-foreground">
                  Status
                </TableHead>
                <TableHead className="h-9 px-3 text-right text-xs uppercase tracking-[0.12em] text-muted-foreground">
                  Contracts
                </TableHead>
                <TableHead className="h-9 px-3 text-right text-xs uppercase tracking-[0.12em] text-muted-foreground">
                  Meters
                </TableHead>
                <TableHead className="h-9 px-3 text-right text-xs uppercase tracking-[0.12em] text-muted-foreground">
                  Action
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {selectedGroup.items.map((property) => (
                <TableRow key={property.id} className="border-border/60">
                  <TableCell className="px-3 py-3 font-medium align-top">
                    {property.propertyCode}
                  </TableCell>
                  <TableCell className="px-3 py-3">
                    <div className="space-y-0.5">
                      <p className="font-medium leading-5">{property.name}</p>
                      {property.parent ? (
                        <p className="text-xs text-muted-foreground">
                          Parent: {property.parent.name}
                        </p>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell className="px-3 py-3">
                    <div className="flex items-start gap-2 text-muted-foreground">
                      <MapPin className="mt-0.5 size-3.5 shrink-0" />
                      <span className="leading-5 text-foreground">
                        {property.location}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="px-3 py-3 align-top">
                    <Badge
                      variant="outline"
                      className={cn(
                        "h-6 rounded-full px-2.5",
                        getStatusBadgeClasses(property.status)
                      )}
                  >
                      {
                        PROPERTY_STATUS_LABELS[
                          property.status as keyof typeof PROPERTY_STATUS_LABELS
                        ]
                      }
                    </Badge>
                  </TableCell>
                  <TableCell className="px-3 py-3 text-right align-top tabular-nums">
                    {property._count.contracts}
                  </TableCell>
                  <TableCell className="px-3 py-3 text-right align-top tabular-nums">
                    {property._count.utilityMeters}
                  </TableCell>
                  <TableCell className="px-3 py-3 text-right align-top">
                    <div className="flex justify-end gap-2">
                      <Button
                        render={<Link href={`/properties/${property.id}/tenants`} />}
                        variant="outline"
                        size="icon-sm"
                        className="rounded-full"
                        aria-label="Tenants"
                        title="Tenants"
                      >
                        <Eye />
                      </Button>
                      <Button
                        render={<Link href={`/properties/${property.id}/edit`} />}
                        variant="outline"
                        size="sm"
                        className="rounded-full"
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
      ) : (
        <div className="rounded-2xl border border-dashed border-border/60 bg-muted/15 px-4 py-5 text-sm text-muted-foreground">
          Pick a commercial building to show its spaces.
        </div>
      )}
    </div>
  );
}
