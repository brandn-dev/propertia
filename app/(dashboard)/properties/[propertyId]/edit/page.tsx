import { notFound } from "next/navigation";
import { Building2, PencilLine } from "lucide-react";
import { updatePropertyAction } from "@/app/(dashboard)/properties/actions";
import { PropertyForm } from "@/components/properties/property-form";
import { DashboardMetricCard } from "@/components/dashboard/metric-card";
import { DashboardPageHero } from "@/components/dashboard/page-hero";
import { getPropertyForEdit, getPropertyParentOptions } from "@/lib/data/admin";
import { requireRole } from "@/lib/auth/user";

type EditPropertyPageProps = {
  params: Promise<{
    propertyId: string;
  }>;
};

export default async function EditPropertyPage({
  params,
}: EditPropertyPageProps) {
  await requireRole("ADMIN");
  const { propertyId } = await params;
  const [property, parentOptions] = await Promise.all([
    getPropertyForEdit(propertyId),
    getPropertyParentOptions(propertyId),
  ]);

  if (!property) {
    notFound();
  }

  const action = updatePropertyAction.bind(null, property.id);

  return (
    <div className="space-y-6">
      <DashboardPageHero
        eyebrow="Workspace / Properties"
        title={`Edit ${property.name}`}
        description="Update hierarchy, code, leaseability, and status for this property record. Relationship-safe validation prevents invalid parent cycles."
        icon={Building2}
        badges={[
          property.propertyCode,
          property.status.replaceAll("_", " "),
          property.ownershipType,
        ]}
        action={<PencilLine className="size-5 text-primary" />}
      />

      <section className="grid gap-4 md:grid-cols-3">
        <DashboardMetricCard
          label="Child properties"
          value={String(property._count.children)}
          detail="Direct descendants under this property."
          icon={Building2}
        />
        <DashboardMetricCard
          label="Linked contracts"
          value={String(property._count.contracts)}
          detail="Contracts currently tied to this property."
          icon={PencilLine}
        />
        <DashboardMetricCard
          label="Utility meters"
          value={String(property._count.utilityMeters)}
          detail="Meters assigned to this property."
          icon={Building2}
        />
      </section>

      <PropertyForm
        mode="edit"
        formAction={action}
        parentOptions={parentOptions}
        initialValues={{
          name: property.name,
          propertyCode: property.propertyCode,
          ownershipType: property.ownershipType,
          category: property.category,
          location: property.location,
          size: property.size?.toString() ?? "",
          isLeasable: property.isLeasable,
          parentPropertyId: property.parentPropertyId ?? "",
          status: property.status,
          description: property.description ?? "",
        }}
      />
    </div>
  );
}
