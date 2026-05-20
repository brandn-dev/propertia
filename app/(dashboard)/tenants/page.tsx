import Link from "next/link";
import {
  BriefcaseBusiness,
  FileText,
  Plus,
  ShieldCheck,
  type LucideIcon,
  Users2,
} from "lucide-react";
import { requireCapability } from "@/lib/auth/user";
import { getTenantsOverview } from "@/lib/data/dashboard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TenantRegistry } from "@/components/tenants/tenant-registry";
import { TENANT_TYPE_LABELS } from "@/lib/form-options";

type TenantOverviewItem = Awaited<ReturnType<typeof getTenantsOverview>>[number];

type TenantGroupKind = "building" | "standalone" | "unassigned";

type TenantPageItem = TenantOverviewItem & {
  displayName: string;
  peopleCount: number;
  preferredContract:
    | (TenantOverviewItem["contracts"][number] & {
        group: {
          id: string;
          label: string;
          meta: string;
          kind: Exclude<TenantGroupKind, "unassigned">;
        };
        subjectProperty: {
          id: string;
          name: string;
          propertyCode: string;
        };
      })
    | null;
};

type TenantGroup = {
  id: string;
  label: string;
  meta: string;
  kind: TenantGroupKind;
  items: TenantPageItem[];
};

function formatTenantName(tenant: {
  firstName: string | null;
  lastName: string | null;
  businessName: string | null;
}) {
  return (
    tenant.businessName ||
    [tenant.firstName, tenant.lastName].filter(Boolean).join(" ") ||
    "Unnamed tenant"
  );
}

function getPeopleCount(tenant: {
  firstName: string | null;
  lastName: string | null;
  _count: {
    tenantPeople: number;
    representatives: number;
  };
}) {
  if (tenant._count.tenantPeople > 0) {
    return tenant._count.tenantPeople;
  }

  if (tenant._count.representatives > 0) {
    return tenant._count.representatives;
  }

  return tenant.firstName || tenant.lastName ? 1 : 0;
}

function getContractPriority(status: string) {
  switch (status) {
    case "ACTIVE":
      return 0;
    case "DRAFT":
      return 1;
    case "EXPIRED":
      return 2;
    case "ENDED":
      return 3;
    case "TERMINATED":
      return 4;
    default:
      return 5;
  }
}

function enrichTenants(tenants: TenantOverviewItem[]): TenantPageItem[] {
  return tenants.map((tenant) => {
    const preferredContract =
      [...tenant.contracts].sort((left, right) => {
        const priorityDelta =
          getContractPriority(left.status) - getContractPriority(right.status);

        if (priorityDelta !== 0) {
          return priorityDelta;
        }

        return right.startDate.getTime() - left.startDate.getTime();
      })[0] ?? null;

    const property = preferredContract?.property;
    const parent = property?.parent;

    return {
      ...tenant,
      displayName: formatTenantName(tenant),
      peopleCount: getPeopleCount(tenant),
      preferredContract: preferredContract
        ? {
            ...preferredContract,
            group: parent
              ? {
                  id: parent.id,
                  label: parent.name,
                  meta: parent.propertyCode,
                  kind: "building" as const,
                }
              : {
                  id: property.id,
                  label: property.name,
                  meta: property.propertyCode,
                  kind: "standalone" as const,
                },
            subjectProperty: {
              id: property.id,
              name: property.name,
              propertyCode: property.propertyCode,
            },
          }
        : null,
    };
  });
}

function groupTenants(tenants: TenantPageItem[]) {
  const grouped = new Map<string, TenantGroup>();

  for (const tenant of tenants) {
    const group = tenant.preferredContract?.group ?? {
      id: "unassigned",
      label: "Unassigned",
      meta: "No property",
      kind: "unassigned" as const,
    };

    const existing = grouped.get(group.id);

    if (existing) {
      existing.items.push(tenant);
      continue;
    }

    grouped.set(group.id, {
      ...group,
      items: [tenant],
    });
  }

  const groupOrder: Record<TenantGroupKind, number> = {
    building: 0,
    standalone: 1,
    unassigned: 2,
  };

  return [...grouped.values()]
    .map((group) => ({
      ...group,
      items: [...group.items].sort((left, right) =>
        left.displayName.localeCompare(right.displayName, undefined, {
          numeric: true,
        })
      ),
    }))
    .sort((left, right) => {
      const kindDelta = groupOrder[left.kind] - groupOrder[right.kind];

      if (kindDelta !== 0) {
        return kindDelta;
      }

      return left.label.localeCompare(right.label, undefined, {
        numeric: true,
      });
    });
}

function MetricPill({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: LucideIcon;
}) {
  return (
    <div className="rounded-2xl border border-border/60 bg-card px-4 py-3 shadow-sm">
      <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
        {label}
      </p>
      <div className="mt-2 flex items-center gap-2">
        <div className="flex size-8 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Icon className="size-4" />
        </div>
        <span className="text-xl font-semibold tracking-[-0.04em]">{value}</span>
      </div>
    </div>
  );
}

export default async function TenantsPage() {
  await requireCapability("MANAGE_TENANTS");

  const tenants = enrichTenants(await getTenantsOverview());
  const groupedTenants = groupTenants(tenants);
  const businessTenants = tenants.filter((tenant) => tenant.type === "BUSINESS").length;
  const totalPeople = tenants.reduce((sum, tenant) => sum + tenant.peopleCount, 0);
  const totalContracts = tenants.reduce((sum, tenant) => sum + tenant._count.contracts, 0);

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-[-0.05em] sm:text-[2rem]">
          Tenant registry
        </h1>
        <div className="flex flex-wrap gap-2">
          <Button
            render={<Link href="/people" />}
            variant="outline"
            className="rounded-full"
          >
            <ShieldCheck />
            People
          </Button>
          <Button render={<Link href="/tenants/new" />} className="rounded-full">
            <Plus />
            New tenant
          </Button>
        </div>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricPill label="Records" value={String(tenants.length)} icon={Users2} />
        <MetricPill
          label="Business"
          value={String(businessTenants)}
          icon={BriefcaseBusiness}
        />
        <MetricPill label="People" value={String(totalPeople)} icon={ShieldCheck} />
        <MetricPill label="Contracts" value={String(totalContracts)} icon={FileText} />
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3 px-1">
          <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Registry
          </h2>
          <Badge variant="outline" className="rounded-full">
            {tenants.length} tenants
          </Badge>
        </div>

        <div className="overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm">
          {tenants.length === 0 ? (
            <div className="flex flex-wrap items-center justify-between gap-4 p-6">
              <p className="text-sm text-muted-foreground">No tenants yet.</p>
              <Button render={<Link href="/tenants/new" />} className="rounded-full">
                <Plus />
                Create first tenant
              </Button>
            </div>
          ) : (
            <div className="p-3 sm:p-4">
              <TenantRegistry
                groups={groupedTenants.map((group) => ({
                  id: group.id,
                  label: group.label,
                  meta: group.meta,
                  kind: group.kind,
                  items: group.items.map((tenant) => ({
                    id: tenant.id,
                    displayName: tenant.displayName,
                    peopleCount: tenant.peopleCount,
                    tenantTypeLabel: TENANT_TYPE_LABELS[tenant.type],
                    subjectPropertyName:
                      tenant.preferredContract?.subjectProperty.name ?? null,
                    subjectPropertyCode:
                      tenant.preferredContract?.subjectProperty.propertyCode ?? null,
                    contactNumber: tenant.contactNumber,
                    email: tenant.email,
                    contractsCount: tenant._count.contracts,
                    invoicesCount: tenant._count.invoices,
                  })),
                }))}
              />
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
