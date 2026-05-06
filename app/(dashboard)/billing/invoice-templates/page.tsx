import Link from "next/link";
import { BrushCleaning, Eye, Palette, PencilLine, Plus } from "lucide-react";
import { requireRole } from "@/lib/auth/user";
import { getInvoiceBrandingTemplatesOverview } from "@/lib/data/billing";
import { DashboardEmptyState } from "@/components/dashboard/empty-state";
import { DashboardMetricCard } from "@/components/dashboard/metric-card";
import { DashboardPageHero } from "@/components/dashboard/page-hero";
import { Badge } from "@/components/ui/badge";
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

export default async function InvoiceBrandingTemplatesPage() {
  await requireRole("ADMIN");
  const templates = await getInvoiceBrandingTemplatesOverview();
  const defaultTemplates = templates.filter((template) => template.isDefault).length;
  const propertyAssignments = templates.reduce(
    (sum, template) => sum + template._count.properties,
    0
  );

  return (
    <div className="space-y-6">
      <DashboardPageHero
        eyebrow="Operations / Billing"
        title="Invoice templates"
        description="Create reusable invoice branding templates, then assign which properties should inherit each logo, subtitle, color set, and title style."
        icon={Palette}
        badges={["Branding", "Reusable", "Admin only"]}
        action={
          <Button
            render={<Link href="/billing/invoice-templates/new" />}
            className="rounded-full"
          >
            <Plus />
            New template
          </Button>
        }
      />

      <section className="grid gap-4 md:grid-cols-3">
        <DashboardMetricCard
          label="Visible templates"
          value={String(templates.length)}
          detail="Invoice branding presets available now."
          icon={Palette}
        />
        <DashboardMetricCard
          label="Default templates"
          value={String(defaultTemplates)}
          detail="Templates marked as fallback defaults."
          icon={BrushCleaning}
        />
        <DashboardMetricCard
          label="Property assignments"
          value={String(propertyAssignments)}
          detail="Properties currently linked to an invoice template."
          icon={Eye}
        />
      </section>

      <Card className="rounded-xl border-border/60 bg-card shadow-sm">
        <CardHeader>
          <div className="flex flex-row items-start justify-between gap-4">
            <div>
              <CardTitle>Template table</CardTitle>
              <CardDescription>
                Logo, wordmark, palette, and property assignment in one place.
              </CardDescription>
            </div>
            <Button
              render={<Link href="/billing/invoice-templates/new" />}
              variant="outline"
              className="button-blank rounded-full"
            >
              <Plus />
              Add template
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {templates.length === 0 ? (
            <DashboardEmptyState
              icon={Palette}
              title="No invoice templates yet"
              description="Create the first template here, then assign it only to the properties that should use that invoice branding."
              action={
                <Button
                  render={<Link href="/billing/invoice-templates/new" />}
                  className="rounded-full"
                >
                  <Plus />
                  Create first template
                </Button>
              }
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Template</TableHead>
                  <TableHead>Branding</TableHead>
                  <TableHead>Colors</TableHead>
                  <TableHead>Properties</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {templates.map((template) => (
                  <TableRow key={template.id}>
                    <TableCell className="font-medium">
                      {template.name}
                      <p className="text-xs text-muted-foreground">
                        {template.invoiceTitlePrefix} ...
                      </p>
                    </TableCell>
                    <TableCell>
                      {template.brandName}
                      <p className="text-xs text-muted-foreground">
                        {template.brandSubtitle}
                      </p>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span
                          className="size-4 rounded-full border"
                          style={{ backgroundColor: template.accentColor }}
                        />
                        <span
                          className="size-4 rounded-full border"
                          style={{ backgroundColor: template.panelBackground }}
                        />
                        <span className="text-xs text-muted-foreground">
                          {template.titleScale.toLowerCase()} · {template.logoScalePercent}%
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {template.properties.length > 0 ? (
                        <>
                          {template.properties[0]?.name}
                          <p className="text-xs text-muted-foreground">
                            {template.properties.length > 1
                              ? `+${template.properties.length - 1} more`
                              : template.properties[0]?.propertyCode}
                          </p>
                        </>
                      ) : (
                        <span className="text-sm text-muted-foreground">
                          No properties assigned
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        {template.isDefault ? (
                          <Badge variant="outline">Default</Badge>
                        ) : null}
                        <Badge variant="outline">
                          {template.usePropertyLogo ? "Property logo ok" : "Template logo only"}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        render={
                          <Link href={`/billing/invoice-templates/${template.id}/edit`} />
                        }
                        variant="outline"
                        size="sm"
                        className="button-blank rounded-full"
                      >
                        <PencilLine />
                        Edit
                      </Button>
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
