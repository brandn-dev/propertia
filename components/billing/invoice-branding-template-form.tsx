"use client";

import { useActionState, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, LoaderCircle, Search, Save, X } from "lucide-react";
import type { InvoiceBrandingTemplateFormState } from "@/app/(dashboard)/billing/actions";
import { InvoiceDocument } from "@/components/billing/invoice-document";
import { InvoiceBrandingLogoField } from "@/components/billing/invoice-branding-logo-field";
import { Button } from "@/components/ui/button";
import { ColorPickerField } from "@/components/ui/color-picker-field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { buildInvoicePreviewModel } from "@/lib/billing/invoice-presenter";
import {
  DEFAULT_INVOICE_FONT_FAMILY,
  INVOICE_FONT_OPTIONS,
} from "@/lib/billing/invoice-fonts";
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
    activeTenants: {
      id: string;
      name: string;
    }[];
  }[];
  initialValues?: {
    name: string;
    brandName: string;
    brandSubtitle: string;
    fontFamily: string;
    showBrandName: boolean;
    showBrandSubtitle: boolean;
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

type PropertyPickerProperty = {
  id: string;
  name: string;
  propertyCode: string;
  activeTenants: { id: string; name: string }[];
};

function PropertyPickerColumn({
  title,
  emptyMessage,
  properties,
  actionLabel,
  onPropertyClick,
  remove = false,
}: {
  title: string;
  emptyMessage: string;
  properties: PropertyPickerProperty[];
  actionLabel: string;
  onPropertyClick: (propertyId: string) => void;
  remove?: boolean;
}) {
  return (
    <div className="space-y-2 rounded-xl border border-border/70 bg-background/45 p-3">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        {title}
      </p>
      <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
        {properties.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border/70 px-3 py-6 text-center text-sm text-muted-foreground">
            {emptyMessage}
          </p>
        ) : (
          properties.map((property) => (
            <button
              key={property.id}
              type="button"
              onClick={() => onPropertyClick(property.id)}
              className="group flex w-full items-center justify-between gap-3 rounded-lg border border-border/60 bg-card px-3 py-2.5 text-left transition-colors hover:border-primary/50 hover:bg-muted/60"
            >
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium text-foreground">
                  {property.name}
                </span>
                <span className="block truncate text-xs text-muted-foreground">
                  {property.activeTenants.length > 0
                    ? property.activeTenants.map((tenant) => tenant.name).join(" · ")
                    : "No active tenant"}
                </span>
              </span>
              {remove ? (
                <X className="size-4 shrink-0 text-muted-foreground group-hover:text-destructive" />
              ) : (
                <ArrowRight className="size-4 shrink-0 text-muted-foreground group-hover:text-primary" />
              )}
              <span className="sr-only">{actionLabel} {property.name}</span>
            </button>
          ))
        )}
      </div>
    </div>
  );
}

export function InvoiceBrandingTemplateForm({
  mode,
  formAction,
  propertyOptions,
  initialValues = {
    name: "",
    brandName: "Propertia",
    brandSubtitle: "Operations invoice",
    fontFamily: DEFAULT_INVOICE_FONT_FAMILY,
    showBrandName: true,
    showBrandSubtitle: true,
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
  const [fontFamily, setFontFamily] = useState(initialValues.fontFamily);
  const [showBrandName, setShowBrandName] = useState(initialValues.showBrandName);
  const [showBrandSubtitle, setShowBrandSubtitle] = useState(
    initialValues.showBrandSubtitle
  );
  const [fontPickerOpen, setFontPickerOpen] = useState(false);
  const [showLayoutGuides, setShowLayoutGuides] = useState(true);
  const [propertySearch, setPropertySearch] = useState("");
  const [selectedPropertyIds, setSelectedPropertyIds] = useState(
    initialValues.propertyIds
  );
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
  useEffect(() => {
    void document.fonts?.load(`400 16px "${fontFamily}"`);
  }, [fontFamily]);

  const selectedPropertySet = new Set(selectedPropertyIds);
  const normalizedPropertySearch = propertySearch.trim().toLowerCase();
  const matchesProperty = (property: (typeof propertyOptions)[number]) => {
    if (!normalizedPropertySearch) {
      return true;
    }

    return [
      property.name,
      property.propertyCode,
      ...property.activeTenants.map((tenant) => tenant.name),
    ]
      .join(" ")
      .toLowerCase()
      .includes(normalizedPropertySearch);
  };
  const availableProperties = propertyOptions.filter(
    (property) => !selectedPropertySet.has(property.id) && matchesProperty(property)
  );
  const selectedProperties = selectedPropertyIds
    .map((id) => propertyOptions.find((property) => property.id === id))
    .filter((property): property is (typeof propertyOptions)[number] => Boolean(property))
    .filter(matchesProperty);
  const addProperty = (propertyId: string) =>
    setSelectedPropertyIds((current) =>
      current.includes(propertyId) ? current : [...current, propertyId]
    );
  const removeProperty = (propertyId: string) =>
    setSelectedPropertyIds((current) => current.filter((id) => id !== propertyId));
  const previewModel = {
    ...buildInvoicePreviewModel(),
    title: `${invoiceTitlePrefix || "Invoice for"} May 2026`,
    propertyLogoUrl: logoPreviewUrl || null,
    branding: {
      brandName: brandName || "Propertia",
      brandSubtitle: brandSubtitle || "Operations invoice",
      fontFamily,
      showBrandName,
      showBrandSubtitle,
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
                <Label htmlFor="fontFamily">Invoice font</Label>
                <input type="hidden" name="fontFamily" value={fontFamily} />
                <div className="relative">
                  <button
                    type="button"
                    aria-expanded={fontPickerOpen}
                    onClick={() => setFontPickerOpen((open) => !open)}
                    className={`${selectClassName} flex w-full items-center justify-between text-left`}
                    style={{ fontFamily: `'${fontFamily}', sans-serif` }}
                  >
                    <span>{fontFamily}</span>
                    <span aria-hidden="true">⌄</span>
                  </button>
                  {fontPickerOpen ? (
                    <div className="absolute inset-x-0 top-[calc(100%+0.35rem)] z-30 max-h-64 overflow-y-auto rounded-xl border border-border bg-popover p-1 shadow-xl">
                      {INVOICE_FONT_OPTIONS.map((font) => (
                        <button
                          key={font.value}
                          type="button"
                          onClick={() => {
                            setFontFamily(font.value);
                            setFontPickerOpen(false);
                          }}
                          className="w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-muted"
                          style={{ fontFamily: `'${font.value}', sans-serif` }}
                        >
                          {font.label}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
                <FieldError message={state.errors?.fontFamily?.[0]} />
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

              <div className="space-y-3 md:col-span-2">
                <div className="flex items-center justify-between gap-3">
                  <Label htmlFor="propertySearch">Properties using this template</Label>
                  <span className="text-xs text-muted-foreground">
                    {selectedPropertyIds.length} picked
                  </span>
                </div>
                <div className="relative">
                  <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="propertySearch"
                    value={propertySearch}
                    onChange={(event) => setPropertySearch(event.target.value)}
                    placeholder="Search property or active tenant"
                    className="field-blank h-11 pl-9"
                  />
                </div>
                {selectedPropertyIds.map((propertyId) => (
                  <input key={propertyId} type="hidden" name="propertyIds" value={propertyId} />
                ))}
                <div className="grid gap-4 md:grid-cols-2">
                  <PropertyPickerColumn
                    title="Available"
                    emptyMessage="No matching properties."
                    properties={availableProperties}
                    actionLabel="Pick"
                    onPropertyClick={addProperty}
                  />
                  <PropertyPickerColumn
                    title="Picked"
                    emptyMessage="No properties picked."
                    properties={selectedProperties}
                    actionLabel="Remove"
                    onPropertyClick={removeProperty}
                    remove
                  />
                </div>
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
            showBrandName={showBrandName}
            showBrandSubtitle={showBrandSubtitle}
            onShowBrandNameChange={setShowBrandName}
            onShowBrandSubtitleChange={setShowBrandSubtitle}
          />
        </div>

        <aside className="space-y-4 xl:sticky xl:top-20 xl:self-start">
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
              <label className="flex items-center gap-2 border-b border-border/60 bg-background px-4 py-3 text-xs font-medium text-muted-foreground">
                <input
                  type="checkbox"
                  checked={showLayoutGuides}
                  onChange={(event) => setShowLayoutGuides(event.target.checked)}
                  className="size-4 rounded border-border text-primary focus-visible:ring-2 focus-visible:ring-ring"
                />
                Show layout guides
              </label>
              <InvoiceDocument
                model={previewModel}
                renderMode="print"
                paperSize="a4"
                layoutMode="paper"
                showLayoutGuides={showLayoutGuides}
                frameless
              />
            </div>
          </div>
        </aside>
      </div>
    </form>
  );
}
