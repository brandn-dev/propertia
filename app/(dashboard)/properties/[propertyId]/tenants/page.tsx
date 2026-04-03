import Link from "next/link";
import { notFound } from "next/navigation";
import {
  Building2,
  CalendarDays,
  PencilLine,
  Plus,
  Users2,
} from "lucide-react";
import { requireRole } from "@/lib/auth/user";
import { getPropertyTenantBoard } from "@/lib/data/dashboard";
import { DashboardMetricCard } from "@/components/dashboard/metric-card";
import { DashboardPageHero } from "@/components/dashboard/page-hero";
import { Button } from "@/components/ui/button";
import { PropertyTenantExplorer } from "@/components/properties/property-tenant-explorer";
import { toDateInputValue } from "@/lib/format";

export default async function PropertyTenantsPage({
  params,
}: {
  params: Promise<{
    propertyId: string;
  }>;
}) {
  await requireRole("ADMIN");
  const { propertyId } = await params;
  const board = await getPropertyTenantBoard(propertyId);

  if (!board) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <DashboardPageHero
        eyebrow="Workspace / Properties / Tenants"
        title={`${board.property.name} Tenants`}
        description={`Occupancy explorer for ${board.property.name}. Navigate the building tree on the left, then manage each space from a dedicated detail pane instead of forcing all units into one table.`}
        icon={Building2}
        badges={[
          board.property.propertyCode,
          `${board.totalSpaces} spaces`,
          `${board.activeRows} occupied`,
        ]}
        action={
          <div className="flex flex-wrap gap-2">
            <Button
              render={<Link href={`/properties/${board.property.id}/edit`} />}
              variant="outline"
              className="button-blank rounded-full"
            >
              <PencilLine />
              Edit property
            </Button>
            <Button
              render={<Link href="/contracts/new" />}
              className="rounded-full"
            >
              <Plus />
              New contract
            </Button>
          </div>
        }
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <DashboardMetricCard
          label="Tracked spaces"
          value={String(board.totalSpaces)}
          detail="Leasable child spaces currently included in this tenant board."
          icon={Building2}
        />
        <DashboardMetricCard
          label="Occupied spaces"
          value={String(board.activeRows)}
          detail="Spaces with active contracts right now."
          icon={Users2}
        />
        <DashboardMetricCard
          label="Vacant spaces"
          value={String(board.vacantRows)}
          detail="Spaces without an active tenant contract."
          icon={Plus}
        />
        <DashboardMetricCard
          label="Property"
          value={board.property.propertyCode}
          detail={board.property.location}
          icon={CalendarDays}
        />
      </section>

      <PropertyTenantExplorer
        property={{
          id: board.property.id,
          name: board.property.name,
          propertyCode: board.property.propertyCode,
          location: board.property.location,
        }}
        rows={board.rows.map((row) => ({
          id: row.id,
          name: row.name,
          propertyCode: row.propertyCode,
          status: row.status,
          contract: row.contract
            ? {
                id: row.contract.id,
                startDate: toDateInputValue(row.contract.startDate),
                endDate: toDateInputValue(row.contract.endDate),
                monthlyRent: row.contract.monthlyRent.toString(),
                status: row.contract.status,
                tenant: row.contract.tenant,
              }
            : null,
        }))}
      />
    </div>
  );
}
