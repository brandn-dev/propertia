"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { ArrowLeft, LoaderCircle, Save } from "lucide-react";
import type { InvoiceBrandingTemplateFormState } from "@/app/(dashboard)/billing/actions";
import { InvoiceDocument } from "@/components/billing/invoice-document";
import { InvoiceBrandingLogoField } from "@/components/billing/invoice-branding-logo-field";
import { Button } from "@/components/ui/button";
import { ColorPickerField } from "@/components/ui/color-picker-field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { buildInvoicePreviewModel } from "@/lib/billing/invoice-presenter";
import {
  INVOICE_FONT_WEIGHTS,
  INVOICE_TITLE_SCALES,
} from "@/lib/validations/invoice-branding-template";

const initialState: InvoiceBrandingTemplateFormState = {};
const selectClassName = "select-blank";

const TITLE_SCALE_LABELS = {
  COMPACT: "Compact",
  STANDARD: "Standard",
  PROMINENT: "Prominent",
} as const;

const FONT_WEIGHT_LABELS = {
  500: "Medium",
  600: "Semibold",
  700: "Bold",
  800: "Extra bold",
} as const;

type InvoiceBrandingTemplateFormProps = {
  mode: "create" | "edit";
  formAction: (
    state: InvoiceBrandingTemplateFormState,
    formData: FormData
  ) => Promise<InvoiceBrandingTemplateFormState>;
  propertyOptions: {
    id: string;
    name: string;
    propertyCode: string;
  }[];
  initialValues?: {
    name: string;
    brandName: string;
    brandSubtitle: string;
    invoiceTitlePrefix: string;
    usePropertyLogo: boolean;
    titleScale: (typeof INVOICE_TITLE_SCALES)[number];
    logoScalePercent: number;
    brandNameSizePercent: number;
    brandSubtitleSizePercent: number;
    tenantNameSizePercent: number;
    titleSizePercent: number;
    brandNameWeight: number;
    tenantNameWeight: number;
    titleWeight: number;
    accentColor: string;
    labelColor: string;
    valueColor: string;
    mutedColor: string;
    panelBackground: string;
    isDefault: boolean;
    logoUrl: string;
    propertyIds: string[];
  };
};

function FieldError({ message }: { message?: string }) {
  if (!message) {
    return null;
  }

  return <p className="text-sm text-destructive">{message}</p>;
}

export function InvoiceBrandingTemplateForm({
  mode,
  formAction,
  propertyOptions,
  initialValues = {
    name: "",
    brandName: "Propertia",
    brandSubtitle: "Operations invoice",
    invoiceTitlePrefix: "Invoice for",
    usePropertyLogo: true,
    titleScale: "STANDARD",
    logoScalePercent: 100,
    brandNameSizePercent: 100,
    brandSubtitleSizePercent: 100,
    tenantNameSizePercent: 100,
    titleSizePercent: 100,
    brandNameWeight: 600,
    tenantNameWeight: 700,
    titleWeight: 700,
    accentColor: "#0284c7",
    labelColor: "#6f82a3",
    valueColor: "#081225",
    mutedColor: "#53657f",
    panelBackground: "#f8fbff",
    isDefault: false,
    logoUrl: "",
    propertyIds: [],
  },
}: InvoiceBrandingTemplateFormProps) {
  const [state, action, pending] = useActionState(formAction, initialState);
  const [brandName, setBrandName] = useState(initialValues.brandName);
  const [brandSubtitle, setBrandSubtitle] = useState(initialValues.brandSubtitle);
  const [invoiceTitlePrefix, setInvoiceTitlePrefix] = useState(
    initialValues.invoiceTitlePrefix
  );
  const [titleScale, setTitleScale] = useState(initialValues.titleScale);
  const [logoScalePercent, setLogoScalePercent] = useState(
    initialValues.logoScalePercent
  );
  const [brandNameSizePercent, setBrandNameSizePercent] = useState(
    initialValues.brandNameSizePercent
  );
  const [brandSubtitleSizePercent, setBrandSubtitleSizePercent] = useState(
    initialValues.brandSubtitleSizePercent
  );
  const [tenantNameSizePercent, setTenantNameSizePercent] = useState(
    initialValues.tenantNameSizePercent
  );
  const [titleSizePercent, setTitleSizePercent] = useState(
    initialValues.titleSizePercent
  );
  const [brandNameWeight, setBrandNameWeight] = useState(
    initialValues.brandNameWeight
  );
  const [tenantNameWeight, setTenantNameWeight] = useState(
    initialValues.tenantNameWeight
  );
  const [titleWeight, setTitleWeight] = useState(initialValues.titleWeight);
  const [accentColor, setAccentColor] = useState(initialValues.accentColor);
  const [labelColor, setLabelColor] = useState(initialValues.labelColor);
  const [valueColor, setValueColor] = useState(initialValues.valueColor);
  const [mutedColor, setMutedColor] = useState(initialValues.mutedColor);
  const [panelBackground, setPanelBackground] = useState(
    initialValues.panelBackground
  );
  const [logoPreviewUrl, setLogoPreviewUrl] = useState(initialValues.logoUrl);
  const previewModel = {
    ...buildInvoicePreviewModel(),
    title: `${invoiceTitlePrefix || "Invoice for"} May 2026`,
    propertyLogoUrl: logoPreviewUrl || null,
    branding: {
      brandName: brandName || "Propertia",
      brandSubtitle: brandSubtitle || "Operations invoice",
      invoiceTitlePrefix: invoiceTitlePrefix || "Invoice for",
      logoUrl: logoPreviewUrl || null,
      titleScale,
      logoScalePercent,
      brandNameSizePercent,
      brandSubtitleSizePercent,
      tenantNameSizePercent,
      titleSizePercent,
      brandNameWeight,
      tenantNameWeight,
      titleWeight,
      accentColor,
      labelColor,
      valueColor,
      mutedColor,
      panelBackground,
    },
  };

  return (
    <form action={action} className="space-y-6">
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(34rem,44rem)]">
        <div className="space-y-6">
          <div className="border-blank space-y-6 rounded-xl p-6">
            <div className="grid gap-5 md:grid-cols-2">
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="name">Template name</Label>
                <Input
                  id="name"
                  name="name"
                  defaultValue={initialValues.name}
                  placeholder="Premium mall invoice"
                  className="field-blank h-11"
                />
                <FieldError message={state.errors?.name?.[0]} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="brandName">Brand name</Label>
                <Input
                  id="brandName"
                  name="brandName"
                  defaultValue={initialValues.brandName}
                  onChange={(event) => setBrandName(event.target.value)}
                  className="field-blank h-11"
                />
                <FieldError message={state.errors?.brandName?.[0]} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="brandSubtitle">Brand subtitle</Label>
                <Input
                  id="brandSubtitle"
                  name="brandSubtitle"
                  defaultValue={initialValues.brandSubtitle}
                  onChange={(event) => setBrandSubtitle(event.target.value)}
                  className="field-blank h-11"
                />
                <FieldError message={state.errors?.brandSubtitle?.[0]} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="invoiceTitlePrefix">Invoice title prefix</Label>
                <Input
                  id="invoiceTitlePrefix"
                  name="invoiceTitlePrefix"
                  defaultValue={initialValues.invoiceTitlePrefix}
                  onChange={(event) => setInvoiceTitlePrefix(event.target.value)}
                  className="field-blank h-11"
                />
                <FieldError message={state.errors?.invoiceTitlePrefix?.[0]} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="titleScale">Title scale</Label>
                <select
                  id="titleScale"
                  name="titleScale"
                  defaultValue={initialValues.titleScale}
                  onChange={(event) =>
                    setTitleScale(
                      event.target.value as (typeof INVOICE_TITLE_SCALES)[number]
                    )
                  }
                  className={selectClassName}
                >
                  {INVOICE_TITLE_SCALES.map((scale) => (
                    <option key={scale} value={scale}>
                      {TITLE_SCALE_LABELS[scale]}
                    </option>
                  ))}
                </select>
                <FieldError message={state.errors?.titleScale?.[0]} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="logoScalePercent">Logo size</Label>
                <div className="space-y-3">
                  <Input
                    id="logoScalePercent"
                    name="logoScalePercent"
                    type="range"
                    min="60"
                    max="160"
                    step="5"
                    defaultValue={String(initialValues.logoScalePercent)}
                    onChange={(event) =>
                      setLogoScalePercent(Number(event.target.value))
                    }
                    className="field-blank h-11 px-0"
                  />
                  <div className="text-xs text-muted-foreground">
                    {logoScalePercent}%
                  </div>
                </div>
                <FieldError message={state.errors?.logoScalePercent?.[0]} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="brandNameSizePercent">Brand size</Label>
                <div className="space-y-3">
                  <Input
                    id="brandNameSizePercent"
                    name="brandNameSizePercent"
                    type="range"
                    min="80"
                    max="140"
                    step="5"
                    defaultValue={String(initialValues.brandNameSizePercent)}
                    onChange={(event) =>
                      setBrandNameSizePercent(Number(event.target.value))
                    }
                    className="field-blank h-11 px-0"
                  />
                  <div className="text-xs text-muted-foreground">
                    {brandNameSizePercent}%
                  </div>
                </div>
                <FieldError message={state.errors?.brandNameSizePercent?.[0]} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="brandSubtitleSizePercent">Subtitle size</Label>
                <div className="space-y-3">
                  <Input
                    id="brandSubtitleSizePercent"
                    name="brandSubtitleSizePercent"
                    type="range"
                    min="80"
                    max="140"
                    step="5"
                    defaultValue={String(initialValues.brandSubtitleSizePercent)}
                    onChange={(event) =>
                      setBrandSubtitleSizePercent(Number(event.target.value))
                    }
                    className="field-blank h-11 px-0"
                  />
                  <div className="text-xs text-muted-foreground">
                    {brandSubtitleSizePercent}%
                  </div>
                </div>
                <FieldError message={state.errors?.brandSubtitleSizePercent?.[0]} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="tenantNameSizePercent">Tenant size</Label>
                <div className="space-y-3">
                  <Input
                    id="tenantNameSizePercent"
                    name="tenantNameSizePercent"
                    type="range"
                    min="80"
                    max="140"
                    step="5"
                    defaultValue={String(initialValues.tenantNameSizePercent)}
                    onChange={(event) =>
                      setTenantNameSizePercent(Number(event.target.value))
                    }
                    className="field-blank h-11 px-0"
                  />
                  <div className="text-xs text-muted-foreground">
                    {tenantNameSizePercent}%
                  </div>
                </div>
                <FieldError message={state.errors?.tenantNameSizePercent?.[0]} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="titleSizePercent">Invoice title size</Label>
                <div className="space-y-3">
                  <Input
                    id="titleSizePercent"
                    name="titleSizePercent"
                    type="range"
                    min="80"
                    max="140"
                    step="5"
                    defaultValue={String(initialValues.titleSizePercent)}
                    onChange={(event) =>
                      setTitleSizePercent(Number(event.target.value))
                    }
                    className="field-blank h-11 px-0"
                  />
                  <div className="text-xs text-muted-foreground">
                    {titleSizePercent}%
                  </div>
                </div>
                <FieldError message={state.errors?.titleSizePercent?.[0]} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="brandNameWeight">Brand weight</Label>
                <select
                  id="brandNameWeight"
                  name="brandNameWeight"
                  defaultValue={String(initialValues.brandNameWeight)}
                  onChange={(event) =>
                    setBrandNameWeight(Number(event.target.value))
                  }
                  className={selectClassName}
                >
                  {INVOICE_FONT_WEIGHTS.map((weight) => (
                    <option key={weight} value={weight}>
                      {FONT_WEIGHT_LABELS[Number(weight) as keyof typeof FONT_WEIGHT_LABELS]}
                    </option>
                  ))}
                </select>
                <FieldError message={state.errors?.brandNameWeight?.[0]} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="tenantNameWeight">Tenant weight</Label>
                <select
                  id="tenantNameWeight"
                  name="tenantNameWeight"
                  defaultValue={String(initialValues.tenantNameWeight)}
                  onChange={(event) =>
                    setTenantNameWeight(Number(event.target.value))
                  }
                  className={selectClassName}
                >
                  {INVOICE_FONT_WEIGHTS.map((weight) => (
                    <option key={weight} value={weight}>
                      {FONT_WEIGHT_LABELS[Number(weight) as keyof typeof FONT_WEIGHT_LABELS]}
                    </option>
                  ))}
                </select>
                <FieldError message={state.errors?.tenantNameWeight?.[0]} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="titleWeight">Title weight</Label>
                <select
                  id="titleWeight"
                  name="titleWeight"
                  defaultValue={String(initialValues.titleWeight)}
                  onChange={(event) => setTitleWeight(Number(event.target.value))}
                  className={selectClassName}
                >
                  {INVOICE_FONT_WEIGHTS.map((weight) => (
                    <option key={weight} value={weight}>
                      {FONT_WEIGHT_LABELS[Number(weight) as keyof typeof FONT_WEIGHT_LABELS]}
                    </option>
                  ))}
                </select>
                <FieldError message={state.errors?.titleWeight?.[0]} />
              </div>

              <ColorPickerField
                id="accentColor"
                name="accentColor"
                label="Accent color"
                value={accentColor}
                onChange={setAccentColor}
                errorMessage={state.errors?.accentColor?.[0]}
              />

              <ColorPickerField
                id="labelColor"
                name="labelColor"
                label="Label color"
                value={labelColor}
                onChange={setLabelColor}
                errorMessage={state.errors?.labelColor?.[0]}
              />

              <ColorPickerField
                id="valueColor"
                name="valueColor"
                label="Value color"
                value={valueColor}
                onChange={setValueColor}
                errorMessage={state.errors?.valueColor?.[0]}
              />

              <ColorPickerField
                id="mutedColor"
                name="mutedColor"
                label="Muted color"
                value={mutedColor}
                onChange={setMutedColor}
                errorMessage={state.errors?.mutedColor?.[0]}
              />

              <ColorPickerField
                id="panelBackground"
                name="panelBackground"
                label="Panel background"
                value={panelBackground}
                onChange={setPanelBackground}
                errorMessage={state.errors?.panelBackground?.[0]}
              />

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="propertyIds">Properties using this template</Label>
                <select
                  id="propertyIds"
                  name="propertyIds"
                  multiple
                  defaultValue={initialValues.propertyIds}
                  className="field-blank min-h-44 rounded-xl border px-4 py-3 text-sm"
                >
                  {propertyOptions.map((property) => (
                    <option key={property.id} value={property.id}>
                      {property.name} ({property.propertyCode})
                    </option>
                  ))}
                </select>
                <p className="text-xs leading-5 text-muted-foreground">
                  Hold command/control to select multiple properties.
                </p>
                <FieldError message={state.errors?.propertyIds?.[0]} />
              </div>

              <div className="md:col-span-2">
                <label className="field-blank flex items-start gap-3 rounded-[1.2rem] border bg-background/60 px-4 py-3">
                  <input
                    type="checkbox"
                    name="usePropertyLogo"
                    defaultChecked={initialValues.usePropertyLogo}
                    className="mt-1 size-4 rounded border-border text-primary focus-visible:ring-2 focus-visible:ring-ring"
                  />
                  <div className="space-y-1">
                    <span className="text-sm font-medium">
                      Allow property logo override
                    </span>
                    <p className="text-sm leading-6 text-muted-foreground">
                      If template logo is empty, each assigned property can use
                      its own uploaded logo in invoices and PDFs.
                    </p>
                  </div>
                </label>
              </div>

              <div className="md:col-span-2">
                <label className="field-blank flex items-start gap-3 rounded-[1.2rem] border bg-background/60 px-4 py-3">
                  <input
                    type="checkbox"
                    name="isDefault"
                    defaultChecked={initialValues.isDefault}
                    className="mt-1 size-4 rounded border-border text-primary focus-visible:ring-2 focus-visible:ring-ring"
                  />
                  <div className="space-y-1">
                    <span className="text-sm font-medium">Default template</span>
                    <p className="text-sm leading-6 text-muted-foreground">
                      New invoices without a property assignment can fall back to
                      this style.
                    </p>
                  </div>
                </label>
              </div>
            </div>

            {state.message ? (
              <div className="rounded-[1.2rem] border border-border/60 bg-muted/55 px-4 py-3 text-sm text-muted-foreground">
                {state.message}
              </div>
            ) : null}
          </div>

          <InvoiceBrandingLogoField
            initialLogoUrl={initialValues.logoUrl || undefined}
            errorMessage={state.errors?.logoFile?.[0]}
            onPreviewUrlChange={setLogoPreviewUrl}
          />
        </div>

        <aside className="space-y-4">
          <div className="border-blank rounded-xl p-5">
            <p className="text-[0.72rem] uppercase tracking-[0.26em] text-muted-foreground">
              {mode === "create" ? "New template" : "Update template"}
            </p>
            <h2 className="mt-3 text-xl font-semibold tracking-[-0.04em]">
              {mode === "create"
                ? "Create invoice template"
                : "Save template changes"}
            </h2>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              Change logo, invoice text, colors, and which properties inherit
              this branding.
            </p>

            <div className="mt-5 flex flex-col gap-2">
              <Button
                type="submit"
                size="lg"
                className="h-11 rounded-xl shadow-sm"
                disabled={pending}
              >
                {pending ? (
                  <LoaderCircle className="animate-spin" />
                ) : (
                  <Save />
                )}
                {mode === "create" ? "Create template" : "Save changes"}
              </Button>
              <Button
                render={<Link href="/billing/invoice-templates" />}
                variant="outline"
                size="lg"
                className="button-blank h-11 rounded-xl"
                disabled={pending}
              >
                <ArrowLeft />
                Back to templates
              </Button>
            </div>
          </div>

          <div
            className="rounded-[1.6rem] border px-3 py-3 shadow-sm"
            style={{
              backgroundColor: initialValues.panelBackground,
              borderColor: `${initialValues.labelColor}22`,
            }}
          >
            <p
              className="text-[0.72rem] uppercase tracking-[0.26em]"
              style={{ color: initialValues.labelColor }}
            >
              Preview
            </p>
            <div className="mt-4 overflow-hidden rounded-[1.35rem] bg-white">
              <InvoiceDocument
                model={previewModel}
                renderMode="print"
                paperSize="letter"
                layoutMode="paper"
                frameless
              />
            </div>
          </div>
        </aside>
      </div>
    </form>
  );
}
