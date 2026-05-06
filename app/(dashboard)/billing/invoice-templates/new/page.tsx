import { Palette, Plus } from "lucide-react";
import { createInvoiceBrandingTemplateAction } from "@/app/(dashboard)/billing/actions";
import { InvoiceBrandingTemplateForm } from "@/components/billing/invoice-branding-template-form";
import { DashboardPageHero } from "@/components/dashboard/page-hero";
import { requireRole } from "@/lib/auth/user";
import { getPropertyParentOptions } from "@/lib/data/admin";

export default async function NewInvoiceBrandingTemplatePage() {
  await requireRole("ADMIN");
  const propertyOptions = await getPropertyParentOptions();

  return (
    <div className="space-y-6">
      <DashboardPageHero
        eyebrow="Operations / Billing"
        title="New invoice template"
        description="Build a reusable invoice branding preset, then choose exactly which properties should use it."
        icon={Palette}
        badges={["Reusable branding", "Property assignment", "Admin only"]}
        action={<Plus className="size-5 text-primary" />}
      />

      <InvoiceBrandingTemplateForm
        mode="create"
        formAction={createInvoiceBrandingTemplateAction}
        propertyOptions={propertyOptions}
      />
    </div>
  );
}
