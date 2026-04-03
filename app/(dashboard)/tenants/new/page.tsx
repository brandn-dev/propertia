import { Plus, Users2 } from "lucide-react";
import { createTenantAction } from "@/app/(dashboard)/tenants/actions";
import { TenantForm } from "@/components/tenants/tenant-form";
import { DashboardPageHero } from "@/components/dashboard/page-hero";
import { requireRole } from "@/lib/auth/user";

export default async function NewTenantPage() {
  await requireRole("ADMIN");

  return (
    <div className="space-y-6">
      <DashboardPageHero
        eyebrow="Workspace / Tenants"
        title="Create tenant"
        description="Add a reusable tenant account for an individual or business, then attach one or more linked people that become reusable person records."
        icon={Users2}
        badges={["Reusable identity", "Contract-ready", "Admin only"]}
        action={<Plus className="size-5 text-primary" />}
      />
      <TenantForm mode="create" formAction={createTenantAction} />
    </div>
  );
}
