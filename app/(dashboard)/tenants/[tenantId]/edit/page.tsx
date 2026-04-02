import { notFound } from "next/navigation";
import { FileText, PencilLine, ReceiptText, ShieldCheck, Users2 } from "lucide-react";
import { updateTenantAction } from "@/app/(dashboard)/tenants/actions";
import { TenantForm } from "@/components/tenants/tenant-form";
import { DashboardMetricCard } from "@/components/dashboard/metric-card";
import { DashboardPageHero } from "@/components/dashboard/page-hero";
import { getTenantForEdit } from "@/lib/data/admin";
import { requireRole } from "@/lib/auth/user";

type EditTenantPageProps = {
  params: Promise<{
    tenantId: string;
  }>;
};

function getTenantLabel(tenant: {
  firstName: string | null;
  lastName: string | null;
  businessName: string | null;
}) {
  return (
    tenant.businessName ||
    [tenant.firstName, tenant.lastName].filter(Boolean).join(" ") ||
    "Tenant"
  );
}

export default async function EditTenantPage({ params }: EditTenantPageProps) {
  await requireRole("ADMIN");
  const { tenantId } = await params;
  const tenant = await getTenantForEdit(tenantId);

  if (!tenant) {
    notFound();
  }

  const action = updateTenantAction.bind(null, tenant.id);

  return (
    <div className="space-y-6">
      <DashboardPageHero
        eyebrow="Workspace / Tenants"
        title={`Edit ${getTenantLabel(tenant)}`}
        description="Update tenant identity, contacts, and ID information while preserving all linked contracts and invoice records."
        icon={Users2}
        badges={[tenant.type, `${tenant._count.contracts} contracts`, `${tenant._count.invoices} invoices`]}
        action={<PencilLine className="size-5 text-primary" />}
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <DashboardMetricCard
          label="Contract links"
          value={String(tenant._count.contracts)}
          detail="Contracts currently attached to this tenant."
          icon={FileText}
        />
        <DashboardMetricCard
          label="Invoice links"
          value={String(tenant._count.invoices)}
          detail="Invoices currently tied to this tenant."
          icon={ReceiptText}
        />
        <DashboardMetricCard
          label="Representatives"
          value={String(tenant._count.representatives)}
          detail="Named people currently attached to this tenant record."
          icon={ShieldCheck}
        />
        <DashboardMetricCard
          label="Tenant type"
          value={tenant.type}
          detail="Identity mode used by validation and future workflow rules."
          icon={Users2}
        />
      </section>

      <TenantForm
        mode="edit"
        formAction={action}
        initialValues={{
          type: tenant.type,
          firstName: tenant.firstName ?? "",
          lastName: tenant.lastName ?? "",
          businessName: tenant.businessName ?? "",
          contactNumber: tenant.contactNumber ?? "",
          email: tenant.email ?? "",
          address: tenant.address ?? "",
          validIdType: tenant.validIdType ?? "",
          validIdNumber: tenant.validIdNumber ?? "",
          representatives: tenant.representatives.map((representative) => ({
            firstName: representative.firstName,
            lastName: representative.lastName,
            positionTitle: representative.positionTitle ?? "",
            contactNumber: representative.contactNumber ?? "",
            email: representative.email ?? "",
            isPrimary: representative.isPrimary,
          })),
        }}
      />
    </div>
  );
}
