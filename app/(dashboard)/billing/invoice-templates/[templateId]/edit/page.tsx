import { notFound } from "next/navigation";
import { Palette, PencilLine } from "lucide-react";
import { updateInvoiceBrandingTemplateAction } from "@/app/(dashboard)/billing/actions";
import { InvoiceBrandingTemplateForm } from "@/components/billing/invoice-branding-template-form";
import { DashboardMetricCard } from "@/components/dashboard/metric-card";
import { DashboardPageHero } from "@/components/dashboard/page-hero";
import { requireRole } from "@/lib/auth/user";
import { getPropertyParentOptions } from "@/lib/data/admin";
import { getInvoiceBrandingTemplateForEdit } from "@/lib/data/billing";

type EditInvoiceBrandingTemplatePageProps = {
  params: Promise<{
    templateId: string;
  }>;
};

export default async function EditInvoiceBrandingTemplatePage({
  params,
}: EditInvoiceBrandingTemplatePageProps) {
  await requireRole("ADMIN");
  const { templateId } = await params;
  const [template, propertyOptions] = await Promise.all([
    getInvoiceBrandingTemplateForEdit(templateId),
    getPropertyParentOptions(),
  ]);

  if (!template) {
    notFound();
  }

  const action = updateInvoiceBrandingTemplateAction.bind(null, template.id);

  return (
    <div className="space-y-6">
      <DashboardPageHero
        eyebrow="Operations / Billing"
        title={`Edit ${template.name}`}
        description="Adjust branding once, then every assigned property invoice follows the same template."
        icon={Palette}
        badges={[
          template.isDefault ? "Default" : "Template",
          template.titleScale,
          `${template._count.properties} assigned`,
        ]}
        action={<PencilLine className="size-5 text-primary" />}
      />

      <section className="grid gap-4 md:grid-cols-3">
        <DashboardMetricCard
          label="Assigned properties"
          value={String(template._count.properties)}
          detail="Properties currently using this template."
          icon={Palette}
        />
        <DashboardMetricCard
          label="Logo mode"
          value={template.usePropertyLogo ? "Hybrid" : "Template"}
          detail={
            template.usePropertyLogo
              ? "Property logos can override when template logo is empty."
              : "Template logo and branding stay fixed."
          }
          icon={PencilLine}
        />
        <DashboardMetricCard
          label="Title scale"
          value={template.titleScale}
          detail="Invoice title presentation for this template."
          icon={Palette}
        />
      </section>

      <InvoiceBrandingTemplateForm
        mode="edit"
        formAction={action}
        propertyOptions={propertyOptions}
        initialValues={{
          name: template.name,
          brandName: template.brandName,
          brandSubtitle: template.brandSubtitle,
          invoiceTitlePrefix: template.invoiceTitlePrefix,
          usePropertyLogo: template.usePropertyLogo,
          titleScale: template.titleScale,
          logoScalePercent: template.logoScalePercent,
          brandNameSizePercent: template.brandNameSizePercent,
          brandSubtitleSizePercent: template.brandSubtitleSizePercent,
          tenantNameSizePercent: template.tenantNameSizePercent,
          titleSizePercent: template.titleSizePercent,
          brandNameWeight: template.brandNameWeight,
          tenantNameWeight: template.tenantNameWeight,
          titleWeight: template.titleWeight,
          accentColor: template.accentColor,
          labelColor: template.labelColor,
          valueColor: template.valueColor,
          mutedColor: template.mutedColor,
          panelBackground: template.panelBackground,
          isDefault: template.isDefault,
          logoUrl: template.logoUrl ?? "",
          propertyIds: template.properties.map((property) => property.id),
        }}
      />
    </div>
  );
}
