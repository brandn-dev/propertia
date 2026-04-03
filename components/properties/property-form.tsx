"use client";

import { useActionState } from "react";
import Link from "next/link";
import { ArrowLeft, LoaderCircle, Save } from "lucide-react";
import type { PropertyFormState } from "@/app/(dashboard)/properties/actions";
import {
  PROPERTY_CATEGORIES,
  PROPERTY_CATEGORY_LABELS,
  PROPERTY_OWNERSHIP_TYPES,
  PROPERTY_OWNERSHIP_TYPE_LABELS,
  PROPERTY_STATUSES,
  PROPERTY_STATUS_LABELS,
} from "@/lib/form-options";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const selectClassName =
  "select-blank";

const initialState: PropertyFormState = {};

type PropertyFormProps = {
  mode: "create" | "edit";
  formAction: (
    state: PropertyFormState,
    formData: FormData
  ) => Promise<PropertyFormState>;
  parentOptions: {
    id: string;
    name: string;
    propertyCode: string;
  }[];
  initialValues?: {
    name: string;
    propertyCode: string;
    ownershipType: (typeof PROPERTY_OWNERSHIP_TYPES)[number];
    category: (typeof PROPERTY_CATEGORIES)[number];
    location: string;
    size: string;
    isLeasable: boolean;
    parentPropertyId: string;
    status: (typeof PROPERTY_STATUSES)[number];
    description: string;
  };
};

function FieldError({ message }: { message?: string }) {
  if (!message) {
    return null;
  }

  return <p className="text-sm text-destructive">{message}</p>;
}

export function PropertyForm({
  mode,
  formAction,
  parentOptions,
  initialValues = {
    name: "",
    propertyCode: "",
    ownershipType: "OWNED",
    category: "BUILDING",
    location: "",
    size: "",
    isLeasable: false,
    parentPropertyId: "",
    status: "ACTIVE",
    description: "",
  },
}: PropertyFormProps) {
  const [state, action, pending] = useActionState(formAction, initialState);

  return (
    <form action={action} className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="border-blank space-y-6 rounded-xl p-6">
          <div className="grid gap-5 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="name">Property name</Label>
              <Input
                id="name"
                name="name"
                defaultValue={initialValues.name}
                placeholder="North Tower"
                className="field-blank h-11"
              />
              <FieldError message={state.errors?.name?.[0]} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="propertyCode">Property code</Label>
              <Input
                id="propertyCode"
                name="propertyCode"
                defaultValue={initialValues.propertyCode}
                placeholder="NT-001"
                className="field-blank h-11 uppercase"
              />
              <FieldError message={state.errors?.propertyCode?.[0]} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <select
                id="status"
                name="status"
                defaultValue={initialValues.status}
                className={selectClassName}
              >
                {PROPERTY_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {PROPERTY_STATUS_LABELS[status]}
                  </option>
                ))}
              </select>
              <FieldError message={state.errors?.status?.[0]} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="ownershipType">Ownership</Label>
              <select
                id="ownershipType"
                name="ownershipType"
                defaultValue={initialValues.ownershipType}
                className={selectClassName}
              >
                {PROPERTY_OWNERSHIP_TYPES.map((ownershipType) => (
                  <option key={ownershipType} value={ownershipType}>
                    {PROPERTY_OWNERSHIP_TYPE_LABELS[ownershipType]}
                  </option>
                ))}
              </select>
              <FieldError message={state.errors?.ownershipType?.[0]} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="category">Category</Label>
              <select
                id="category"
                name="category"
                defaultValue={initialValues.category}
                className={selectClassName}
              >
                {PROPERTY_CATEGORIES.map((category) => (
                  <option key={category} value={category}>
                    {PROPERTY_CATEGORY_LABELS[category]}
                  </option>
                ))}
              </select>
              <FieldError message={state.errors?.category?.[0]} />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="location">Location</Label>
              <Input
                id="location"
                name="location"
                defaultValue={initialValues.location}
                placeholder="Makati City"
                className="field-blank h-11"
              />
              <FieldError message={state.errors?.location?.[0]} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="size">Size</Label>
              <Input
                id="size"
                name="size"
                type="number"
                min="0"
                step="0.01"
                defaultValue={initialValues.size}
                placeholder="120.00"
                className="field-blank h-11"
              />
              <FieldError message={state.errors?.size?.[0]} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="parentPropertyId">Parent property</Label>
              <select
                id="parentPropertyId"
                name="parentPropertyId"
                defaultValue={initialValues.parentPropertyId}
                className={selectClassName}
              >
                <option value="">No parent</option>
                {parentOptions.map((property) => (
                  <option key={property.id} value={property.id}>
                    {property.name} ({property.propertyCode})
                  </option>
                ))}
              </select>
              <FieldError message={state.errors?.parentPropertyId?.[0]} />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                name="description"
                defaultValue={initialValues.description}
                placeholder="Notes about the property, leaseability, or operational context."
                className="field-blank"
              />
              <FieldError message={state.errors?.description?.[0]} />
            </div>

            <div className="md:col-span-2">
              <label className="field-blank flex items-start gap-3 rounded-[1.2rem] border bg-background/60 px-4 py-3">
                <input
                  type="checkbox"
                  name="isLeasable"
                  defaultChecked={initialValues.isLeasable}
                  className="mt-1 size-4 rounded border-border text-primary focus-visible:ring-2 focus-visible:ring-ring"
                />
                <div className="space-y-1">
                  <span className="text-sm font-medium">Leasable property</span>
                  <p className="text-sm leading-6 text-muted-foreground">
                    Enable this when the property can participate in contracts
                    and tenant occupancy workflows.
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

        <aside className="space-y-4">
          <div className="border-blank rounded-xl p-5">
            <p className="text-[0.72rem] uppercase tracking-[0.26em] text-muted-foreground">
              {mode === "create" ? "New record" : "Update record"}
            </p>
            <h2 className="mt-3 text-xl font-semibold tracking-[-0.04em]">
              {mode === "create" ? "Create property" : "Save property changes"}
            </h2>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              {mode === "create"
                ? "Create a property record that can later be linked to contracts, meters, and portfolio structure."
                : "Update hierarchy, status, and operational settings without breaking downstream billing relationships."}
            </p>

            <div className="mt-5 flex flex-col gap-2">
              <Button
                type="submit"
                size="lg"
                className="h-11 rounded-xl shadow-sm"
                disabled={pending}
              >
                {pending ? <LoaderCircle className="animate-spin" /> : <Save />}
                {mode === "create" ? "Create property" : "Save changes"}
              </Button>
              <Button
                render={<Link href="/properties" />}
                variant="outline"
                size="lg"
                className="button-blank h-11 rounded-xl"
              >
                <ArrowLeft />
                Back to properties
              </Button>
            </div>
          </div>
        </aside>
      </div>
    </form>
  );
}
