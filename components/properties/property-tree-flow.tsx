"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Background,
  BackgroundVariant,
  Controls,
  Handle,
  MarkerType,
  Panel,
  Position,
  ReactFlow,
  type Edge,
  type Node,
  type NodeMouseHandler,
  type NodeProps,
} from "@xyflow/react";
import {
  Building2,
  DoorOpen,
  MapPin,
  PencilLine,
  Route,
  Users2,
  Zap,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

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
  contracts: {
    tenant: {
      businessName: string;
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
  depth: number;
  childCount: number;
};

type PropertyFlowNode = Node<PropertyFlowNodeData, "property">;
type PropertyFlowEdge = Edge;

const NODE_WIDTH = 184;
const COLUMN_GAP = 230;
const LEVEL_GAP = 130;

const nodeTypes = {
  property: PropertyNode,
};

function getBusinessLabel(property: PropertyTreeFlowItem) {
  const tenant = property.contracts[0]?.tenant;

  if (!tenant) {
    return property.name;
  }

  return (
    tenant.businessName ||
    [tenant.firstName, tenant.lastName].filter(Boolean).join(" ") ||
    property.name
  );
}

function formatEnum(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function getStatusClasses(status: string) {
  switch (status) {
    case "ACTIVE":
      return "border-primary/45 bg-background shadow-primary/10";
    case "UNDER_MAINTENANCE":
      return "border-chart-4/70 bg-chart-4/10 shadow-chart-4/10";
    case "ARCHIVED":
      return "border-border/70 bg-muted/45 opacity-75";
    default:
      return "border-border/70 bg-background";
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
    default:
      return "bg-chart-5";
  }
}

function PropertyNode({ data, selected }: NodeProps<PropertyFlowNode>) {
  const { property } = data;
  const isParent = data.childCount > 0;
  const businessLabel = getBusinessLabel(property);

  return (
    <div
      title={`${property.propertyCode} · ${businessLabel}`}
      className={cn(
        "w-[184px] rounded-xl border px-3 py-2 shadow-sm transition-shadow",
        getStatusClasses(property.status),
        selected && "ring-3 ring-ring/45"
      )}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!size-2.5 !border-2 !border-background !bg-primary"
      />
      <div className="flex items-center gap-2.5">
        <div className="relative flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          {isParent ? (
            <Building2 className="size-4.5" />
          ) : (
            <DoorOpen className="size-4.5" />
          )}
          <span
            className={cn(
              "absolute -right-0.5 -bottom-0.5 size-2.5 rounded-full ring-2 ring-background",
              getStatusDotClasses(property.status)
            )}
          />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
            {property.propertyCode}
          </p>
          <p className="truncate text-sm font-semibold">{businessLabel}</p>
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
      left.name.localeCompare(right.name, undefined, { numeric: true })
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
        depth: isParent ? 0 : 1,
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
    <div className="rounded-lg border border-border/60 bg-muted/25 px-3 py-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 font-semibold">{value}</p>
    </div>
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
      properties.filter(
        (property) => (childrenByParentId.get(property.id)?.length ?? 0) > 0
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
    <Card className="rounded-xl border-border/60 bg-card shadow-sm">
      <CardHeader>
        <div>
          <CardTitle>Portfolio tree</CardTitle>
          <CardDescription>
            Property hierarchy, operating status, contracts, and meters.
          </CardDescription>
        </div>
        <CardAction className="flex flex-col items-end gap-2">
          <label htmlFor="property-parent-picker" className="sr-only">
            Parent property
          </label>
          <select
            id="property-parent-picker"
            value={effectiveParentId}
            disabled={parentOptions.length === 0}
            onChange={(event) => {
              setSelectedParentId(event.target.value);
              setSelectedPropertyId(event.target.value);
            }}
            className="select-blank h-9 w-56 rounded-full text-xs"
          >
            {parentOptions.length === 0 ? (
              <option value="">No parents yet</option>
            ) : null}
            {parentOptions.map((property) => (
              <option key={property.id} value={property.id}>
                {property.propertyCode} · {property.name}
              </option>
            ))}
          </select>
          <div className="hidden gap-2 md:flex">
            <Badge variant="outline" className="rounded-full">
              {activeCount} active
            </Badge>
            <Badge variant="outline" className="rounded-full">
              {leasableCount} leasable
            </Badge>
          </div>
        </CardAction>
      </CardHeader>
      <CardContent className="px-0 pb-0">
        {properties.length === 0 ? (
          <div className="border-t border-border/60 px-4 py-5">
            <div className="rounded-xl border border-dashed border-border/60 bg-muted/25 p-5">
              <div className="flex max-w-xl flex-col gap-3">
                <div className="flex size-10 items-center justify-center rounded-lg bg-background text-primary">
                  <Route className="size-4.5" />
                </div>
                <div className="space-y-1.5">
                  <p className="text-base font-medium">No hierarchy yet</p>
                  <p className="text-sm leading-6 text-muted-foreground">
                    Create a parent property, then attach units or commercial spaces to it.
                  </p>
                </div>
              </div>
            </div>
          </div>
        ) : parentOptions.length === 0 ? (
          <div className="border-t border-border/60 px-4 py-5">
            <div className="rounded-xl border border-dashed border-border/60 bg-muted/25 p-5">
              <div className="flex max-w-xl flex-col gap-3">
                <div className="flex size-10 items-center justify-center rounded-lg bg-background text-primary">
                  <Building2 className="size-4.5" />
                </div>
                <div className="space-y-1.5">
                  <p className="text-base font-medium">No parent properties yet</p>
                  <p className="text-sm leading-6 text-muted-foreground">
                    Add child properties under a parent to enable this focused tree view.
                  </p>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="grid border-t border-border/60 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div className="min-w-0">
              <div
                className="h-[min(72svh,720px)] min-h-[460px] overflow-hidden bg-muted/20"
              >
                <ReactFlow<PropertyFlowNode, PropertyFlowEdge>
                  key={effectiveParentId}
                  nodes={graph.nodes}
                  edges={graph.edges}
                  nodeTypes={nodeTypes}
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
                  <Controls
                    position="bottom-right"
                    showInteractive={false}
                    fitViewOptions={{ padding: 0.16 }}
                  />
                  <Panel position="bottom-right" className="mb-28">
                    <div className="rounded-full border border-border/60 bg-background/95 px-3 py-1.5 text-xs text-muted-foreground shadow-sm">
                      Zoom controls · target = auto fit
                    </div>
                  </Panel>
                  <Panel position="top-left">
                    <div className="flex flex-wrap gap-2 rounded-xl border border-border/60 bg-background/95 p-2 shadow-sm">
                      <Badge variant="outline" className="gap-1 rounded-full">
                        <span className="size-2 rounded-full bg-chart-3" />
                        Active
                      </Badge>
                      <Badge variant="outline" className="gap-1 rounded-full">
                        <span className="size-2 rounded-full bg-chart-4" />
                        Maintenance
                      </Badge>
                      <Badge variant="outline" className="gap-1 rounded-full">
                        <span className="size-2 rounded-full bg-chart-5" />
                        Inactive
                      </Badge>
                    </div>
                  </Panel>
                </ReactFlow>
              </div>
            </div>

            <aside className="border-t border-border/60 p-4 lg:border-t-0 lg:border-l">
              {selectedProperty ? (
                <div className="space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-muted-foreground">
                        {selectedProperty.propertyCode}
                      </p>
                      <h3 className="mt-1 truncate text-lg font-semibold">
                        {selectedProperty.name}
                      </h3>
                    </div>
                    <Badge variant="outline" className="rounded-full">
                      {formatEnum(selectedProperty.status)}
                    </Badge>
                  </div>

                  <div className="flex items-start gap-2 text-sm text-muted-foreground">
                    <MapPin className="mt-0.5 size-4 shrink-0" />
                    <span>{selectedProperty.location}</span>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <DetailMetric
                      label="Category"
                      value={formatEnum(selectedProperty.category)}
                    />
                    <DetailMetric
                      label="Ownership"
                      value={formatEnum(selectedProperty.ownershipType)}
                    />
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
      </CardContent>
    </Card>
  );
}
