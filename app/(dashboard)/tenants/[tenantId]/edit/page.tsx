import Link from "next/link";
import { notFound } from "next/navigation";
import {
  Eye,
  FileText,
  ReceiptText,
  ShieldCheck,
  Users2,
} from "lucide-react";
import { updateTenantAction } from "@/app/(dashboard)/tenants/actions";
import { TenantForm } from "@/components/tenants/tenant-form";
import { DashboardMetricCard } from "@/components/dashboard/metric-card";
import { DashboardPageHero } from "@/components/dashboard/page-hero";
import { Button } from "@/components/ui/button";
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

export default async function EditTenantPage({ params }: EditTenantPageProps) {
  await requireRole("ADMIN");
  const { tenantId } = await params;
  const tenant = await getTenantForEdit(tenantId);

  if (!tenant) {
    notFound();
  }

  const action = updateTenantAction.bind(null, tenant.id);
  const peopleCount = getPeopleCount(tenant);

  return (
    <div className="space-y-6">
      <DashboardPageHero
        eyebrow="Workspace / Tenants"
        title={`Edit ${getTenantLabel(tenant)}`}
        description="Update tenant identity, contacts, and ID information while preserving all linked contracts and invoice records."
        icon={Users2}
        badges={[tenant.type, `${tenant._count.contracts} contracts`, `${tenant._count.invoices} invoices`]}
        action={
          <Button
            render={<Link href={`/tenants/${tenant.id}`} />}
            variant="outline"
            className="button-blank rounded-full"
          >
            <Eye />
            View profile
          </Button>
        }
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
          label="People"
          value={String(peopleCount)}
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
          businessName: tenant.businessName ?? "",
          contactNumber: tenant.contactNumber ?? "",
          email: tenant.email ?? "",
          address: tenant.address ?? "",
          validIdType: tenant.validIdType ?? "",
          validIdNumber: tenant.validIdNumber ?? "",
          people: tenant.people.map((person) => ({
            personId: person.personId,
            firstName: person.firstName,
            lastName: person.lastName,
            middleName: person.middleName ?? "",
            positionTitle: person.positionTitle ?? "",
            contactNumber: person.contactNumber ?? "",
            email: person.email ?? "",
            address: person.address ?? "",
            validIdType: person.validIdType ?? "",
            validIdNumber: person.validIdNumber ?? "",
            notes: person.notes ?? "",
            isPrimary: person.isPrimary,
          })),
        }}
      />
    </div>
  );
}
