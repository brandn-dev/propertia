import { Building2, Plus } from "lucide-react";
import { createPropertyAction } from "@/app/(dashboard)/properties/actions";
import { PropertyForm } from "@/components/properties/property-form";
import { DashboardPageHero } from "@/components/dashboard/page-hero";
import { getPropertyParentOptions } from "@/lib/data/admin";
import { requireRole } from "@/lib/auth/user";

export default async function NewPropertyPage() {
  await requireRole("ADMIN");
  const parentOptions = await getPropertyParentOptions();

  return (
    <div className="space-y-6">
      <DashboardPageHero
        eyebrow="Workspace / Properties"
        title="Create property"
        description="Add a new property record to the portfolio hierarchy. You can set its ownership, parent relationship, leasability, and operating status from the start."
        icon={Building2}
        badges={["Portfolio setup", "Hierarchy-ready", "Admin only"]}
        action={<Plus className="size-5 text-primary" />}
      />
      <PropertyForm
        mode="create"
        formAction={createPropertyAction}
        parentOptions={parentOptions}
      />
    </div>
  );
}
