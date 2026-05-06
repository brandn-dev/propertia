import Link from "next/link";
import {
  Activity,
  Blocks,
  Building2,
  Eye,
  MapPin,
  Network,
  PencilLine,
  Plus,
  Radar,
} from "lucide-react";
import { requireRole } from "@/lib/auth/user";
import { getPropertiesOverview } from "@/lib/data/dashboard";
import { Badge } from "@/components/ui/badge";
import { DashboardEmptyState } from "@/components/dashboard/empty-state";
import { DashboardMetricCard } from "@/components/dashboard/metric-card";
import { DashboardPageHero } from "@/components/dashboard/page-hero";
import { PropertyTreeFlow } from "@/components/properties/property-tree-flow";
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

export default async function PropertiesPage() {
  await requireRole("ADMIN");
  const properties = await getPropertiesOverview();
  const activeProperties = properties.filter((property) => property.status === "ACTIVE").length;
  const totalMeters = properties.reduce(
    (sum, property) => sum + property._count.utilityMeters,
    0
  );
  const totalContracts = properties.reduce(
    (sum, property) => sum + property._count.contracts,
    0
  );

  return (
    <div className="space-y-6">
      <DashboardPageHero
        eyebrow="Workspace / Properties"
        title="Property registry"
        description="The schema already supports owned and leased properties, parent-child structures, and direct links to contracts and utility meters. This page is now shaped as the operational control layer for that hierarchy."
        icon={Building2}
        action={
          <Button
            render={<Link href="/properties/new" />}
            className="rounded-full"
          >
            <Plus />
            New property
          </Button>
        }
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <DashboardMetricCard
          label="Visible records"
          value={String(properties.length)}
          detail="Properties currently surfaced in the live registry."
          icon={Blocks}
        />
        <DashboardMetricCard
          label="Active properties"
          value={String(activeProperties)}
          detail="Portfolio spaces marked active and ready for operations."
          icon={Activity}
        />
        <DashboardMetricCard
          label="Linked contracts"
          value={String(totalContracts)}
          detail="Contracts already attached to shown properties."
          icon={Network}
        />
        <DashboardMetricCard
          label="Utility meters"
          value={String(totalMeters)}
          detail="Meters currently assigned across visible properties."
          icon={Radar}
        />
      </section>

      <PropertyTreeFlow properties={properties} />

      <Card className="rounded-xl border-border/60 bg-card shadow-sm">
        <CardHeader>
          <CardTitle>Registry table</CardTitle>
          <CardDescription>
            Parent-child property relationships, status, occupancy context, and
            utility footprint in one scan.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {properties.length === 0 ? (
            <DashboardEmptyState
              icon={Building2}
              title="No properties yet"
              description="This workspace is ready for the property CRUD flow. Once records exist, this table becomes the portfolio map for billing, contracts, and utilities."
              action={
                <Button
                  render={<Link href="/properties/new" />}
                  className="rounded-full"
                >
                  <Plus />
                  Create first property
                </Button>
              }
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Units</TableHead>
                  <TableHead className="text-right">Contracts</TableHead>
                  <TableHead className="text-right">Meters</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {properties.map((property) => (
                  <TableRow key={property.id}>
                    <TableCell className="font-medium">{property.propertyCode}</TableCell>
                    <TableCell>
                      <div>
                        <p>{property.name}</p>
                        {property.parent ? (
                          <p className="text-xs text-muted-foreground">
                            Parent: {property.parent.name}
                          </p>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell>{property.category.replaceAll("_", " ")}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <MapPin className="size-3.5 text-muted-foreground" />
                        <span>{property.location}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{property.status.replaceAll("_", " ")}</Badge>
                    </TableCell>
                    <TableCell className="text-right">{property._count.children}</TableCell>
                    <TableCell className="text-right">{property._count.contracts}</TableCell>
                    <TableCell className="text-right">{property._count.utilityMeters}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          render={<Link href={`/properties/${property.id}/tenants`} />}
                          variant="outline"
                          size="sm"
                          className="button-blank rounded-full"
                        >
                          <Eye />
                          Tenants
                        </Button>
                        <Button
                          render={<Link href={`/properties/${property.id}/edit`} />}
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
          )}
        </CardContent>
      </Card>
    </div>
  );
}
