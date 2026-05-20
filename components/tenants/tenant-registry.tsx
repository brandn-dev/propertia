"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Building2,
  Eye,
  Mail,
  PencilLine,
  Phone,
} from "lucide-react";
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
import { cn } from "@/lib/utils";

type TenantRegistryGroupKind = "building" | "standalone" | "unassigned";

type TenantRegistryItem = {
  id: string;
  displayName: string;
  peopleCount: number;
  tenantTypeLabel: string;
  subjectPropertyName: string | null;
  subjectPropertyCode: string | null;
  contactNumber: string | null;
  email: string | null;
  contractsCount: number;
  invoicesCount: number;
};

type TenantRegistryGroup = {
  id: string;
  label: string;
  meta: string;
  kind: TenantRegistryGroupKind;
  items: TenantRegistryItem[];
};

export function TenantRegistry({ groups }: { groups: TenantRegistryGroup[] }) {
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>("all");
  const selectedGroup =
    selectedGroupId === "all"
      ? {
          id: "all",
          label: "All tenants",
          meta: "All",
          kind: "building" as const,
          items: groups.flatMap((group) => group.items),
        }
      : groups.find((group) => group.id === selectedGroupId) ?? null;

  return (
    <div className="space-y-4">
      <div className="-mx-1 overflow-x-auto px-1 pb-1">
        <div className="flex min-w-max gap-2">
          <button
            type="button"
            onClick={() => setSelectedGroupId("all")}
            className={cn(
              "inline-flex h-9 items-center gap-2 rounded-full border px-3 text-xs transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
              selectedGroupId === "all"
                ? "border-chart-4/40 bg-chart-4/12 text-chart-4"
                : "border-border/60 bg-background/70 text-muted-foreground hover:bg-muted/60 hover:text-foreground"
            )}
          >
            <Building2 className="size-3.5" />
            <span className="font-medium">All</span>
            <Badge variant="outline" className="h-5 rounded-full px-1.5">
              {groups.reduce((sum, group) => sum + group.items.length, 0)}
            </Badge>
          </button>

          {groups.map((group) => {
            const isActive = group.id === selectedGroupId;

            return (
              <button
                key={group.id}
                type="button"
                onClick={() => setSelectedGroupId(group.id)}
                className={cn(
                  "inline-flex h-9 items-center gap-2 rounded-full border px-3 text-xs transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                  isActive
                    ? "border-chart-4/40 bg-chart-4/12 text-chart-4"
                    : "border-border/60 bg-background/70 text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                )}
              >
                {group.kind === "building" ? (
                <Building2 className="size-3.5" />
                ) : (
                  <Building2 className="size-3.5" />
                )}
                <span className="max-w-40 truncate">{group.label}</span>
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
              <p className="text-sm font-medium leading-none">{selectedGroup.label}</p>
            </div>
            <Badge variant="outline" className="rounded-full">
              {selectedGroup.items.length}
            </Badge>
          </div>

          <Table>
            <TableHeader>
              <TableRow className="border-border/60">
                <TableHead className="h-9 px-3 text-xs uppercase tracking-[0.12em] text-muted-foreground">
                  Tenant
                </TableHead>
                <TableHead className="h-9 px-3 text-xs uppercase tracking-[0.12em] text-muted-foreground">
                  Type
                </TableHead>
                <TableHead className="h-9 min-w-[220px] px-3 text-xs uppercase tracking-[0.12em] text-muted-foreground">
                  Space
                </TableHead>
                <TableHead className="h-9 px-3 text-xs uppercase tracking-[0.12em] text-muted-foreground">
                  Contact
                </TableHead>
                <TableHead className="h-9 px-3 text-xs uppercase tracking-[0.12em] text-muted-foreground">
                  Email
                </TableHead>
                <TableHead className="h-9 px-3 text-right text-xs uppercase tracking-[0.12em] text-muted-foreground">
                  Contracts
                </TableHead>
                <TableHead className="h-9 px-3 text-right text-xs uppercase tracking-[0.12em] text-muted-foreground">
                  Invoices
                </TableHead>
                <TableHead className="h-9 px-3 text-right text-xs uppercase tracking-[0.12em] text-muted-foreground">
                  Action
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {selectedGroup.items.map((tenant) => (
                <TableRow key={tenant.id} className="border-border/60">
                  <TableCell className="px-3 py-3 align-top">
                    <Link
                      href={`/tenants/${tenant.id}`}
                      className="font-medium hover:text-primary hover:underline"
                    >
                      {tenant.displayName}
                    </Link>
                    {tenant.peopleCount > 0 ? (
                      <p className="text-xs text-muted-foreground">
                        {tenant.peopleCount} people linked
                      </p>
                    ) : null}
                  </TableCell>
                  <TableCell className="px-3 py-3 align-top">
                    {tenant.tenantTypeLabel}
                  </TableCell>
                  <TableCell className="px-3 py-3 align-top">
                    {tenant.subjectPropertyName ? (
                      <div className="space-y-0.5">
                        <p className="font-medium leading-5">
                          {tenant.subjectPropertyName}
                        </p>
                        {tenant.subjectPropertyCode ? (
                          <p className="text-xs text-muted-foreground">
                            {tenant.subjectPropertyCode}
                          </p>
                        ) : null}
                      </div>
                    ) : (
                      <span className="text-muted-foreground">Not assigned</span>
                    )}
                  </TableCell>
                  <TableCell className="px-3 py-3 align-top">
                    <div className="flex items-start gap-2 text-muted-foreground">
                      <Phone className="mt-0.5 size-3.5 shrink-0" />
                      <span className="leading-5 text-foreground">
                        {tenant.contactNumber ?? "Not set"}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="px-3 py-3 align-top">
                    <div className="flex items-start gap-2 text-muted-foreground">
                      <Mail className="mt-0.5 size-3.5 shrink-0" />
                      <span className="leading-5 text-foreground">
                        {tenant.email ?? "Not set"}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="px-3 py-3 text-right align-top tabular-nums">
                    {tenant.contractsCount}
                  </TableCell>
                  <TableCell className="px-3 py-3 text-right align-top tabular-nums">
                    {tenant.invoicesCount}
                  </TableCell>
                  <TableCell className="px-3 py-3 text-right align-top">
                    <div className="flex justify-end gap-2">
                      <Button
                        render={<Link href={`/tenants/${tenant.id}`} />}
                        variant="outline"
                        size="icon-sm"
                        className="rounded-full"
                        aria-label="View tenant"
                        title="View tenant"
                      >
                        <Eye />
                      </Button>
                      <Button
                        render={<Link href={`/tenants/${tenant.id}/edit`} />}
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
          Pick a building or property to show tenants.
        </div>
      )}
    </div>
  );
}
