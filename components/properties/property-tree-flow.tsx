"use client";

import { type ReactNode, useMemo, useState } from "react";
import Link from "next/link";
import {
  Background,
  BackgroundVariant,
  Handle,
  MarkerType,
  Panel,
  Position,
  ReactFlow,
  useReactFlow,
  type Edge,
  type Node,
  type NodeMouseHandler,
  type NodeProps,
} from "@xyflow/react";
import {
  Building2,
  DoorOpen,
  MapPin,
  Minus,
  PencilLine,
  Plus,
  Route,
  ScanSearch,
  Store,
  Users2,
  Zap,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  PROPERTY_OWNERSHIP_TYPE_LABELS,
  PROPERTY_STATUS_LABELS,
} from "@/lib/form-options";
import { cn } from "@/lib/utils";

export type PropertyTreeFlowDisplayType =
  | "building"
  | "commercial-building"
  | "commercial-space"
  | "other";

export type PropertyTreeFlowItem = {
  id: string;
  name: string;
  propertyCode: string;
  ownershipType: string;
  category: string;
  status: string;
  location: string;
  isLeasable: boolean;
  parentPropertyId: string | null;
  routeDisplayType: PropertyTreeFlowDisplayType;
  routeDisplayTypeLabel: string;
  contracts: {
    tenant: {
      businessName: string | null;
      firstName: string | null;
      lastName: string | null;
    };
  }[];
  _count: {
    children: number;
    contracts: number;
    utilityMeters: number;
  };
};

type PropertyFlowNodeData = {
  property: PropertyTreeFlowItem;
  childCount: number;
};

type PropertyFlowNode = Node<PropertyFlowNodeData, "property">;
type PropertyFlowEdge = Edge;

const NODE_WIDTH = 216;
const COLUMN_GAP = 262;
const LEVEL_GAP = 146;

const nodeTypes = {
  property: PropertyNode,
};

function getDisplayLabel(property: PropertyTreeFlowItem) {
  const tenant = property.contracts[0]?.tenant;
  const tenantLabel = tenant
    ? tenant.businessName ||
      [tenant.firstName, tenant.lastName].filter(Boolean).join(" ")
    : "";

  if (tenantLabel) {
    return tenantLabel;
  }

  if (property.isLeasable) {
    return "Vacant";
  }

  return property.name;
}

function RouteTypeIcon({
  routeDisplayType,
  className,
}: {
  routeDisplayType: PropertyTreeFlowDisplayType;
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
      return <Building2 {...iconProps} />;
  }
}

function getTypeIconBoxClasses(routeDisplayType: PropertyTreeFlowDisplayType) {
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

function getTypeBadgeClasses(routeDisplayType: PropertyTreeFlowDisplayType) {
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

function getStatusDotClasses(status: string) {
  switch (status) {
    case "ACTIVE":
      return "bg-chart-3";
    case "UNDER_MAINTENANCE":
      return "bg-chart-4";
    case "ARCHIVED":
      return "bg-muted-foreground";
    case "INACTIVE":
      return "bg-chart-5";
    default:
      return "bg-chart-5";
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

function PropertyNode({ data, selected }: NodeProps<PropertyFlowNode>) {
  const { property } = data;
  const displayLabel = getDisplayLabel(property);

  return (
    <div
      title={`${property.propertyCode} · ${displayLabel}`}
      className={cn(
        "relative w-[216px] rounded-2xl border border-border/60 bg-background/95 px-3 py-3 shadow-sm transition-[box-shadow,border-color]",
        selected && "ring-3 ring-ring/45"
      )}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!size-2.5 !border-2 !border-background !bg-primary"
      />
      <div className="flex items-center gap-2.5">
        <div
          className={cn(
            "relative flex size-10 shrink-0 items-center justify-center rounded-2xl border",
            getTypeIconBoxClasses(property.routeDisplayType)
          )}
        >
          <RouteTypeIcon
            routeDisplayType={property.routeDisplayType}
            className="size-5"
          />
          <span
            className={cn(
              "absolute -right-1 -bottom-1 size-3 rounded-full ring-2 ring-background",
              getStatusDotClasses(property.status)
            )}
          />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
            {property.propertyCode}
          </p>
          <p className="line-clamp-2 text-sm font-semibold leading-4.5">
            {displayLabel}
          </p>
        </div>
      </div>
      <Handle
        type="source"
        position={Position.Bottom}
        className="!size-2.5 !border-2 !border-background !bg-primary"
      />
    </div>
  );
}

function sortPropertyIds(ids: string[], byId: Map<string, PropertyTreeFlowItem>) {
  return [...ids].sort((leftId, rightId) => {
    const left = byId.get(leftId);
    const right = byId.get(rightId);

    if (!left || !right) {
      return leftId.localeCompare(rightId);
    }

    return (
      left.propertyCode.localeCompare(right.propertyCode, undefined, { numeric: true }) ||
      getDisplayLabel(left).localeCompare(getDisplayLabel(right), undefined, {
        numeric: true,
      })
    );
  });
}

function buildChildrenByParentId(properties: PropertyTreeFlowItem[]) {
  const byId = new Map(properties.map((property) => [property.id, property]));
  const childrenByParentId = new Map<string | null, string[]>();

  for (const property of properties) {
    const parentId =
      property.parentPropertyId && byId.has(property.parentPropertyId)
        ? property.parentPropertyId
        : null;
    const siblings = childrenByParentId.get(parentId) ?? [];
    siblings.push(property.id);
    childrenByParentId.set(parentId, siblings);
  }

  for (const [parentId, childIds] of childrenByParentId.entries()) {
    childrenByParentId.set(parentId, sortPropertyIds(childIds, byId));
  }

  return childrenByParentId;
}

function buildPropertyGraph(
  properties: PropertyTreeFlowItem[],
  selectedParentId: string,
  selectedPropertyId: string,
  childrenByParentId: Map<string | null, string[]>
) {
  const byId = new Map(properties.map((property) => [property.id, property]));
  const directChildIds = childrenByParentId.get(selectedParentId) ?? [];
  const visibleIds = selectedParentId ? [selectedParentId, ...directChildIds] : [];
  const childrenStartX = -((directChildIds.length - 1) * COLUMN_GAP) / 2;

  const nodes: PropertyFlowNode[] = visibleIds.flatMap((propertyId, index) => {
    const property = byId.get(propertyId);

    if (!property) {
      return [];
    }

    const isParent = property.id === selectedParentId;
    const childCount = childrenByParentId.get(property.id)?.length ?? 0;

    return {
      id: property.id,
      type: "property",
      position: {
        x: isParent ? 0 : childrenStartX + (index - 1) * COLUMN_GAP,
        y: isParent ? 0 : LEVEL_GAP,
      },
      data: {
        property,
        childCount,
      },
      selected: property.id === selectedPropertyId,
      sourcePosition: Position.Bottom,
      targetPosition: Position.Top,
      style: {
        width: NODE_WIDTH,
      },
    };
  });

  const edges: PropertyFlowEdge[] = directChildIds.map((childId) => ({
    id: `${selectedParentId}:${childId}`,
    source: selectedParentId,
    target: childId,
    type: "smoothstep",
    markerEnd: {
      type: MarkerType.ArrowClosed,
      color: "var(--muted-foreground)",
    },
    style: {
      stroke: "var(--muted-foreground)",
      strokeWidth: 1.6,
    },
  }));

  return {
    nodes,
    edges,
  };
}

function DetailMetric({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded-xl border border-border/60 bg-muted/25 px-3 py-2.5">
      <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 font-semibold">{value}</p>
    </div>
  );
}

function FlowControlButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="flex size-9 items-center justify-center text-muted-foreground transition-colors hover:bg-muted/80 hover:text-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      {children}
    </button>
  );
}

function FlowControls() {
  const { fitView, zoomIn, zoomOut } =
    useReactFlow<PropertyFlowNode, PropertyFlowEdge>();

  return (
    <Panel position="bottom-right" className="mb-4 mr-4">
      <div className="overflow-hidden rounded-2xl border border-border/60 bg-background/95 shadow-lg backdrop-blur">
        <div className="flex flex-col divide-y divide-border/60">
          <FlowControlButton
            label="Zoom in"
            onClick={() => {
              void zoomIn({ duration: 180 });
            }}
          >
            <Plus className="size-4" />
          </FlowControlButton>
          <FlowControlButton
            label="Zoom out"
            onClick={() => {
              void zoomOut({ duration: 180 });
            }}
          >
            <Minus className="size-4" />
          </FlowControlButton>
          <FlowControlButton
            label="Reset flow"
            onClick={() => {
              void fitView({ padding: 0.16, duration: 220 });
            }}
          >
            <ScanSearch className="size-4" />
          </FlowControlButton>
        </div>
      </div>
    </Panel>
  );
}

function TypeLegendBadge({
  routeDisplayType,
  label,
}: {
  routeDisplayType: PropertyTreeFlowDisplayType;
  label: string;
}) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "h-6 gap-1.5 rounded-full px-2.5",
        getTypeBadgeClasses(routeDisplayType)
      )}
    >
      <RouteTypeIcon routeDisplayType={routeDisplayType} className="size-3.5" />
      {label}
    </Badge>
  );
}

export function PropertyTreeFlow({
  properties,
}: {
  properties: PropertyTreeFlowItem[];
}) {
  const childrenByParentId = useMemo(
    () => buildChildrenByParentId(properties),
    [properties]
  );
  const parentOptions = useMemo(
    () =>
      [...properties]
        .filter(
          (property) => (childrenByParentId.get(property.id)?.length ?? 0) > 0
        )
        .sort((left, right) =>
          left.propertyCode.localeCompare(right.propertyCode, undefined, {
            numeric: true,
          })
        ),
    [childrenByParentId, properties]
  );
  const [selectedParentId, setSelectedParentId] = useState(
    parentOptions[0]?.id ?? ""
  );
  const effectiveParentId =
    parentOptions.some((property) => property.id === selectedParentId)
      ? selectedParentId
      : parentOptions[0]?.id ?? "";
  const [selectedPropertyId, setSelectedPropertyId] = useState(
    effectiveParentId
  );
  const effectiveSelectedPropertyId = properties.some(
    (property) => property.id === selectedPropertyId
  )
    ? selectedPropertyId
    : effectiveParentId;
  const selectedProperty =
    properties.find((property) => property.id === effectiveSelectedPropertyId) ??
    properties[0] ??
    null;
  const selectedDisplayLabel = selectedProperty
    ? getDisplayLabel(selectedProperty)
    : null;
  const graph = useMemo(
    () =>
      buildPropertyGraph(
        properties,
        effectiveParentId,
        effectiveSelectedPropertyId,
        childrenByParentId
      ),
    [childrenByParentId, effectiveParentId, effectiveSelectedPropertyId, properties]
  );
  const activeCount = properties.filter((property) => property.status === "ACTIVE").length;
  const leasableCount = properties.filter((property) => property.isLeasable).length;

  const onNodeClick: NodeMouseHandler<PropertyFlowNode> = (_, node) => {
    setSelectedPropertyId(node.data.property.id);
  };

  return (
    <Card className="rounded-2xl border-border/60 bg-card shadow-sm">
      <div className="border-b border-border/60 px-4 py-4">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <h2 className="text-lg font-semibold tracking-[-0.03em]">
            Portfolio tree
          </h2>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="rounded-full">
              {activeCount} active
            </Badge>
            <Badge variant="outline" className="rounded-full">
              {leasableCount} leasable
            </Badge>
          </div>
        </div>

        {parentOptions.length > 0 ? (
          <div className="mt-4 -mx-1 overflow-x-auto px-1 pb-1">
            <div className="flex min-w-max gap-2 md:min-w-0 md:flex-wrap">
              {parentOptions.map((property) => {
                const isActive = property.id === effectiveParentId;

                return (
                  <button
                    key={property.id}
                    type="button"
                    onClick={() => {
                      setSelectedParentId(property.id);
                      setSelectedPropertyId(property.id);
                    }}
                    className={cn(
                      "inline-flex h-10 items-center gap-2 rounded-full border px-3 text-left text-xs transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                      isActive
                        ? "border-primary/45 bg-primary/10 text-foreground"
                        : "border-border/60 bg-background/70 text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                    )}
                  >
                    <RouteTypeIcon
                      routeDisplayType={property.routeDisplayType}
                      className="size-3.5 shrink-0"
                    />
                    <span className="font-medium">{property.propertyCode}</span>
                    <span className="max-w-40 truncate text-muted-foreground">
                      {property.name}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}
      </div>

      {properties.length === 0 ? (
        <div className="px-4 py-6">
          <div className="rounded-2xl border border-dashed border-border/60 bg-muted/20 p-5">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-2xl bg-background text-primary">
                <Route className="size-4.5" />
              </div>
              <div>
                <p className="font-medium">No hierarchy yet</p>
                <p className="text-sm text-muted-foreground">
                  Add a parent property first.
                </p>
              </div>
            </div>
          </div>
        </div>
      ) : parentOptions.length === 0 ? (
        <div className="px-4 py-6">
          <div className="rounded-2xl border border-dashed border-border/60 bg-muted/20 p-5">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-2xl bg-background text-primary">
                <Building2 className="size-4.5" />
              </div>
              <div>
                <p className="font-medium">No parent properties yet</p>
                <p className="text-sm text-muted-foreground">
                  Add child spaces under a building.
                </p>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="grid lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="min-w-0">
            <div className="h-[min(72svh,720px)] min-h-[460px] overflow-hidden bg-muted/20">
              <ReactFlow<PropertyFlowNode, PropertyFlowEdge>
                key={effectiveParentId}
                nodes={graph.nodes}
                edges={graph.edges}
                nodeTypes={nodeTypes}
                proOptions={{ hideAttribution: true }}
                onNodeClick={onNodeClick}
                fitView
                fitViewOptions={{ padding: 0.12 }}
                minZoom={0.1}
                maxZoom={1.4}
                nodesDraggable={false}
                nodesConnectable={false}
                edgesFocusable={false}
                zoomOnScroll={false}
                className="property-tree-flow"
              >
                <Background
                  color="var(--border)"
                  gap={22}
                  size={1.2}
                  variant={BackgroundVariant.Dots}
                />
                <FlowControls />
                <Panel position="top-left">
                  <div className="flex flex-wrap gap-2 rounded-2xl border border-border/60 bg-background/95 p-2 shadow-sm">
                    <TypeLegendBadge
                      routeDisplayType="building"
                      label="Building"
                    />
                    <TypeLegendBadge
                      routeDisplayType="commercial-building"
                      label="Commercial Building"
                    />
                    <TypeLegendBadge
                      routeDisplayType="commercial-space"
                      label="Commercial Space"
                    />
                  </div>
                </Panel>
              </ReactFlow>
            </div>
          </div>

          <aside className="border-t border-border/60 p-5 lg:border-t-0 lg:border-l">
            {selectedProperty ? (
              <div className="space-y-5">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge
                    variant="outline"
                    className={cn(
                      "h-6 gap-1.5 rounded-full px-2.5",
                      getTypeBadgeClasses(selectedProperty.routeDisplayType)
                    )}
                  >
                    <RouteTypeIcon
                      routeDisplayType={selectedProperty.routeDisplayType}
                      className="size-3.5"
                    />
                    {selectedProperty.routeDisplayTypeLabel}
                  </Badge>
                  <Badge
                    variant="outline"
                    className={cn(
                      "h-6 rounded-full px-2.5",
                      getStatusBadgeClasses(selectedProperty.status)
                    )}
                  >
                    {
                      PROPERTY_STATUS_LABELS[
                        selectedProperty.status as keyof typeof PROPERTY_STATUS_LABELS
                      ]
                    }
                  </Badge>
                  <Badge variant="outline" className="h-6 rounded-full px-2.5">
                    {
                      PROPERTY_OWNERSHIP_TYPE_LABELS[
                        selectedProperty.ownershipType as keyof typeof PROPERTY_OWNERSHIP_TYPE_LABELS
                      ]
                    }
                  </Badge>
                </div>

                <div className="space-y-1.5">
                  <h3 className="text-[1.75rem] leading-none font-semibold tracking-[-0.04em]">
                    {selectedDisplayLabel}
                  </h3>
                  <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
                    {selectedProperty.propertyCode}
                  </p>
                </div>

                <div className="flex items-start gap-2 text-sm text-muted-foreground">
                  <MapPin className="mt-0.5 size-4 shrink-0" />
                  <span>{selectedProperty.location}</span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <DetailMetric
                    label="Children"
                    value={selectedProperty._count.children}
                  />
                  <DetailMetric
                    label="Contracts"
                    value={selectedProperty._count.contracts}
                  />
                  <DetailMetric
                    label="Meters"
                    value={selectedProperty._count.utilityMeters}
                  />
                  <DetailMetric
                    label="Leasable"
                    value={selectedProperty.isLeasable ? "Yes" : "No"}
                  />
                </div>

                <div className="grid gap-2">
                  <Link
                    href={`/properties/${selectedProperty.id}/edit`}
                    className="inline-flex h-9 items-center justify-center gap-2 rounded-full bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                  >
                    <PencilLine className="size-4" />
                    Edit property
                  </Link>
                  <Link
                    href={`/properties/${selectedProperty.id}/tenants`}
                    className="inline-flex h-9 items-center justify-center gap-2 rounded-full border border-border/60 bg-background px-3 text-sm font-medium hover:bg-muted"
                  >
                    <Users2 className="size-4" />
                    Tenants
                  </Link>
                  <Link
                    href="/utilities/meters"
                    className="inline-flex h-9 items-center justify-center gap-2 rounded-full border border-border/60 bg-background px-3 text-sm font-medium hover:bg-muted"
                  >
                    <Zap className="size-4" />
                    Meters
                  </Link>
                </div>
              </div>
            ) : null}
          </aside>
        </div>
      )}
    </Card>
  );
}
