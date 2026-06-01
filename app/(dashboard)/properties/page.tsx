import Link from "next/link";
import {
  Activity,
  Blocks,
  Building2,
  DoorOpen,
  Eye,
  MapPin,
  Network,
  PencilLine,
  Plus,
  Radar,
  Store,
  type LucideIcon,
} from "lucide-react";
import { requireCapability } from "@/lib/auth/user";
import { getPropertiesOverview } from "@/lib/data/dashboard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CommercialSpaceRegistry } from "@/components/properties/commercial-space-registry";
import { PropertyTreeFlow } from "@/components/properties/property-tree-flow";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  PROPERTY_CATEGORY_LABELS,
  PROPERTY_STATUS_LABELS,
} from "@/lib/form-options";
import { cn } from "@/lib/utils";

type PropertiesOverviewItem = Awaited<ReturnType<typeof getPropertiesOverview>>[number];
type RouteDisplayType =
  | "building"
  | "commercial-building"
  | "commercial-space"
  | "other";

type PropertiesRouteItem = PropertiesOverviewItem & {
  routeDisplayType: RouteDisplayType;
  routeDisplayTypeLabel: string;
};

type SpaceParentGroup = {
  id: string;
  label: string;
  meta: string;
  items: PropertiesRouteItem[];
};

const REGISTRY_GROUP_ORDER: RouteDisplayType[] = [
  "commercial-building",
  "building",
  "commercial-space",
  "other",
];

function formatEnum(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function getRouteDisplayType(
  property: PropertiesOverviewItem,
  children: PropertiesOverviewItem[]
): RouteDisplayType {
  if (property.category === "COMMERCIAL_SPACE") {
    return "commercial-space";
  }

  if (property.category === "BUILDING") {
    const hasCommercialSignal =
      property.isLeasable ||
      property.contracts.length > 0 ||
      children.some((child) => child.category === "COMMERCIAL_SPACE");

    return hasCommercialSignal ? "commercial-building" : "building";
  }

  return "other";
}

function getRouteDisplayTypeLabel(
  routeDisplayType: RouteDisplayType,
  category: string
) {
  switch (routeDisplayType) {
    case "building":
      return "Building";
    case "commercial-building":
      return "Commercial Building";
    case "commercial-space":
      return "Commercial Space";
    default:
      return (
        PROPERTY_CATEGORY_LABELS[
          category as keyof typeof PROPERTY_CATEGORY_LABELS
        ] ?? formatEnum(category)
      );
  }
}

function enrichProperties(properties: PropertiesOverviewItem[]): PropertiesRouteItem[] {
  const childrenByParentId = new Map<string, PropertiesOverviewItem[]>();

  for (const property of properties) {
    if (!property.parentPropertyId) {
      continue;
    }

    const siblings = childrenByParentId.get(property.parentPropertyId) ?? [];
    siblings.push(property);
    childrenByParentId.set(property.parentPropertyId, siblings);
  }

  return properties.map((property) => {
    const routeDisplayType = getRouteDisplayType(
      property,
      childrenByParentId.get(property.id) ?? []
    );

    return {
      ...property,
      routeDisplayType,
      routeDisplayTypeLabel: getRouteDisplayTypeLabel(
        routeDisplayType,
        property.category
      ),
    };
  });
}

function RouteTypeIcon({
  routeDisplayType,
  className,
}: {
  routeDisplayType: RouteDisplayType;
  className?: string;
}) {
  const iconProps = { className };

  switch (routeDisplayType) {
    case "building":
      return <Building2 {...iconProps} />;
    case "commercial-building":
      return <Store {...iconProps} />;
    case "commercial-space":
      return <DoorOpen {...iconProps} />;
    default:
      return <Blocks {...iconProps} />;
  }
}

function getTypeBadgeClasses(routeDisplayType: RouteDisplayType) {
  switch (routeDisplayType) {
    case "building":
      return "border-border/70 bg-muted/35 text-muted-foreground";
    case "commercial-building":
      return "border-chart-4/40 bg-chart-4/12 text-chart-4";
    case "commercial-space":
      return "border-primary/35 bg-primary/12 text-primary";
    default:
      return "border-border/70 bg-background text-foreground";
  }
}

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
    <div className="rounded-2xl border border-border/60 bg-card/95 px-4 py-4 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-border/60 bg-background/80 text-primary shadow-sm">
          <Icon className="size-4" />
        </div>
        <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
          {label}
        </p>
      </div>

      <div className="my-4 border-t border-dashed border-border/60" />

      <div className="text-[2.15rem] leading-none font-semibold tracking-[-0.07em]">
        {value}
      </div>
    </div>
  );
}

function TypeBadge({
  routeDisplayType,
  label,
  className,
}: {
  routeDisplayType: RouteDisplayType;
  label: string;
  className?: string;
}) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "h-6 gap-1.5 rounded-full px-2.5",
        getTypeBadgeClasses(routeDisplayType),
        className
      )}
    >
      <RouteTypeIcon routeDisplayType={routeDisplayType} className="size-3.5" />
      {label}
    </Badge>
  );
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function groupPropertiesByType(properties: PropertiesRouteItem[]) {
  const grouped = new Map<RouteDisplayType, PropertiesRouteItem[]>();

  for (const type of REGISTRY_GROUP_ORDER) {
    grouped.set(type, []);
  }

  for (const property of properties) {
    const bucket = grouped.get(property.routeDisplayType);

    if (bucket) {
      bucket.push(property);
    } else {
      grouped.set(property.routeDisplayType, [property]);
    }
  }

  return REGISTRY_GROUP_ORDER.map((routeDisplayType) => ({
    routeDisplayType,
    label: getRouteDisplayTypeLabel(routeDisplayType, "OTHER"),
    items: grouped.get(routeDisplayType) ?? [],
  })).filter((group) => group.items.length > 0);
}

function groupCommercialSpacesByParent(items: PropertiesRouteItem[]): SpaceParentGroup[] {
  const grouped = new Map<string, SpaceParentGroup>();

  for (const item of items) {
    const parentCode = item.parent?.propertyCode ?? "NO-PARENT";
    const parentName = item.parent?.name ?? "Unassigned";
    const key = `${parentCode}:${parentName}`;
    const existing = grouped.get(key);

    if (existing) {
      existing.items.push(item);
      continue;
    }

    grouped.set(key, {
      id: `registry-commercial-space-${slugify(parentCode)}-${slugify(parentName)}`,
      label: parentName,
      meta: parentCode === "NO-PARENT" ? "" : parentCode,
      items: [item],
    });
  }

  return [...grouped.values()].sort((left, right) =>
    left.meta.localeCompare(right.meta, undefined, { numeric: true })
  );
}

function RegistryRows({ items }: { items: PropertiesRouteItem[] }) {
  return (
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
        {items.map((property) => (
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
  );
}

export default async function PropertiesPage() {
  await requireCapability("MANAGE_PROPERTIES");

  const properties = enrichProperties(await getPropertiesOverview());
  const activeProperties = properties.filter((property) => property.status === "ACTIVE").length;
  const totalMeters = properties.reduce(
    (sum, property) => sum + property._count.utilityMeters,
    0
  );
  const totalContracts = properties.reduce(
    (sum, property) => sum + property._count.contracts,
    0
  );
  const registryGroups = groupPropertiesByType(properties);

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-[-0.05em] sm:text-[2rem]">
          Property registry
        </h1>
        <Button render={<Link href="/properties/new" />} className="rounded-full">
          <Plus />
          New property
        </Button>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricPill
          label="Records"
          value={String(properties.length)}
          icon={Blocks}
        />
        <MetricPill
          label="Active"
          value={String(activeProperties)}
          icon={Activity}
        />
        <MetricPill
          label="Contracts"
          value={String(totalContracts)}
          icon={Network}
        />
        <MetricPill
          label="Meters"
          value={String(totalMeters)}
          icon={Radar}
        />
      </section>

      <PropertyTreeFlow properties={properties} />

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3 px-1">
          <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Registry
          </h2>
          <Badge variant="outline" className="rounded-full">
            {properties.length} records
          </Badge>
        </div>

        <div className="overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm">
          {properties.length === 0 ? (
            <div className="flex flex-wrap items-center justify-between gap-4 p-6">
              <p className="text-sm text-muted-foreground">No properties yet.</p>
              <Button render={<Link href="/properties/new" />} className="rounded-full">
                <Plus />
                Create first property
              </Button>
            </div>
          ) : (
            <div className="divide-y divide-border/60">
              {registryGroups.map((group) => {
                const spaceParentGroups =
                  group.routeDisplayType === "commercial-space"
                    ? groupCommercialSpacesByParent(group.items)
                    : [];

                return (
                  <div key={group.routeDisplayType} className="p-3 sm:p-4">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <TypeBadge
                        routeDisplayType={group.routeDisplayType}
                        label={group.label}
                      />
                      <Badge variant="outline" className="rounded-full">
                        {group.items.length}
                      </Badge>
                    </div>

                    {group.routeDisplayType === "commercial-space" ? (
                      <CommercialSpaceRegistry groups={spaceParentGroups} />
                    ) : (
                      <RegistryRows items={group.items} />
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
