"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { ArrowLeft, LoaderCircle, Plus, Save, Trash2 } from "lucide-react";
import type { TenantFormState } from "@/app/(dashboard)/tenants/actions";
import { TENANT_TYPES, TENANT_TYPE_LABELS } from "@/lib/form-options";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const selectClassName =
  "field-blank flex h-11 w-full rounded-lg border px-3 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50";

const initialState: TenantFormState = {};

type RepresentativeDraft = {
  firstName: string;
  lastName: string;
  positionTitle: string;
  contactNumber: string;
  email: string;
  isPrimary: boolean;
};

type TenantFormProps = {
  mode: "create" | "edit";
  formAction: (
    state: TenantFormState,
    formData: FormData
  ) => Promise<TenantFormState>;
  initialValues?: {
    type: (typeof TENANT_TYPES)[number];
    firstName: string;
    lastName: string;
    businessName: string;
    contactNumber: string;
    email: string;
    address: string;
    validIdType: string;
    validIdNumber: string;
    representatives: RepresentativeDraft[];
  };
};

const emptyRepresentative = (): RepresentativeDraft => ({
  firstName: "",
  lastName: "",
  positionTitle: "",
  contactNumber: "",
  email: "",
  isPrimary: false,
});

function FieldError({ message }: { message?: string }) {
  if (!message) {
    return null;
  }

  return <p className="text-sm text-destructive">{message}</p>;
}

export function TenantForm({
  mode,
  formAction,
  initialValues = {
    type: "INDIVIDUAL",
    firstName: "",
    lastName: "",
    businessName: "",
    contactNumber: "",
    email: "",
    address: "",
    validIdType: "",
    validIdNumber: "",
    representatives: [],
  },
}: TenantFormProps) {
  const [state, action, pending] = useActionState(formAction, initialState);
  const [tenantType, setTenantType] = useState<(typeof TENANT_TYPES)[number]>(
    initialValues.type
  );
  const [representatives, setRepresentatives] = useState<RepresentativeDraft[]>(
    initialValues.representatives
  );

  function addRepresentative() {
    setRepresentatives((current) => {
      const nextRepresentative = emptyRepresentative();

      if (current.length === 0) {
        nextRepresentative.isPrimary = true;
      }

      return [...current, nextRepresentative];
    });
  }

  function updateRepresentative(
    index: number,
    field: keyof RepresentativeDraft,
    value: string | boolean
  ) {
    setRepresentatives((current) =>
      current.map((representative, representativeIndex) =>
        representativeIndex === index
          ? {
              ...representative,
              [field]: value,
            }
          : representative
      )
    );
  }

  function removeRepresentative(index: number) {
    setRepresentatives((current) => {
      const nextRepresentatives = current.filter(
        (_representative, representativeIndex) => representativeIndex !== index
      );

      if (
        nextRepresentatives.length > 0 &&
        !nextRepresentatives.some((representative) => representative.isPrimary)
      ) {
        nextRepresentatives[0] = {
          ...nextRepresentatives[0],
          isPrimary: true,
        };
      }

      return nextRepresentatives;
    });
  }

  function setPrimaryRepresentative(index: number) {
    setRepresentatives((current) =>
      current.map((representative, representativeIndex) => ({
        ...representative,
        isPrimary: representativeIndex === index,
      }))
    );
  }

  const serializedRepresentatives = JSON.stringify(
    tenantType === "BUSINESS" ? representatives : []
  );

  return (
    <form action={action} className="space-y-6">
      <input
        type="hidden"
        name="representatives"
        value={serializedRepresentatives}
        readOnly
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="border-blank space-y-6 rounded-[1.85rem] p-6">
          <div className="grid gap-5 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="type">Tenant type</Label>
              <select
                id="type"
                name="type"
                value={tenantType}
                onChange={(event) =>
                  setTenantType(event.target.value as (typeof TENANT_TYPES)[number])
                }
                className={selectClassName}
              >
                {TENANT_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {TENANT_TYPE_LABELS[type]}
                  </option>
                ))}
              </select>
              <FieldError message={state.errors?.type?.[0]} />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="businessName">Business name</Label>
              <Input
                id="businessName"
                name="businessName"
                defaultValue={initialValues.businessName}
                placeholder={
                  tenantType === "INDIVIDUAL"
                    ? "Juan Dela Cruz Enterprises"
                    : "Acme Trading Corporation"
                }
                className="field-blank h-11"
              />
              <FieldError message={state.errors?.businessName?.[0]} />
              <p className="text-sm text-muted-foreground">
                Required for every tenant record, including individual accounts.
              </p>
            </div>

            {tenantType === "INDIVIDUAL" ? (
              <>
                <div className="space-y-2">
                  <Label htmlFor="firstName">First name</Label>
                  <Input
                    id="firstName"
                    name="firstName"
                    defaultValue={initialValues.firstName}
                    placeholder="Juan"
                    className="field-blank h-11"
                  />
                  <FieldError message={state.errors?.firstName?.[0]} />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="lastName">Last name</Label>
                  <Input
                    id="lastName"
                    name="lastName"
                    defaultValue={initialValues.lastName}
                    placeholder="Dela Cruz"
                    className="field-blank h-11"
                  />
                  <FieldError message={state.errors?.lastName?.[0]} />
                </div>
              </>
            ) : null}

            <div className="space-y-2">
              <Label htmlFor="contactNumber">Contact number</Label>
              <Input
                id="contactNumber"
                name="contactNumber"
                defaultValue={initialValues.contactNumber}
                placeholder="+63 917 000 0000"
                className="field-blank h-11"
              />
              <FieldError message={state.errors?.contactNumber?.[0]} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                defaultValue={initialValues.email}
                placeholder="tenant@example.com"
                className="field-blank h-11"
              />
              <FieldError message={state.errors?.email?.[0]} />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="address">Address</Label>
              <Textarea
                id="address"
                name="address"
                defaultValue={initialValues.address}
                placeholder="Mailing address or registered business address."
                className="field-blank min-h-24"
              />
              <FieldError message={state.errors?.address?.[0]} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="validIdType">Valid ID type</Label>
              <Input
                id="validIdType"
                name="validIdType"
                defaultValue={initialValues.validIdType}
                placeholder="Passport"
                className="field-blank h-11"
              />
              <FieldError message={state.errors?.validIdType?.[0]} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="validIdNumber">Valid ID number</Label>
              <Input
                id="validIdNumber"
                name="validIdNumber"
                defaultValue={initialValues.validIdNumber}
                placeholder="P1234567A"
                className="field-blank h-11"
              />
              <FieldError message={state.errors?.validIdNumber?.[0]} />
            </div>
          </div>

          {tenantType === "BUSINESS" ? (
            <section className="space-y-4 rounded-[1.45rem] border border-border/70 bg-background/55 p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-base font-semibold tracking-[-0.03em]">
                    Business representatives
                  </h3>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">
                    Attach the people who act for this business tenant, such as
                    officers, partners, or authorized signatories.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="button-blank rounded-full"
                  onClick={addRepresentative}
                >
                  <Plus />
                  Add person
                </Button>
              </div>

              <FieldError message={state.errors?.representatives?.[0]} />

              {representatives.length === 0 ? (
                <div className="rounded-[1.2rem] border border-dashed border-border/80 bg-muted/40 px-4 py-4 text-sm leading-6 text-muted-foreground">
                  No representatives added yet. Add the people who can sign,
                  coordinate, or receive notices for this business tenant.
                </div>
              ) : (
                <div className="space-y-4">
                  {representatives.map((representative, index) => (
                    <div
                      key={`${index}-${representative.email}-${representative.lastName}`}
                      className="rounded-[1.35rem] border border-border/70 bg-background/75 p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium">
                            Representative {index + 1}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            Add the contact details and role for this person.
                          </p>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="button-blank rounded-full"
                          onClick={() => removeRepresentative(index)}
                        >
                          <Trash2 />
                          Remove
                        </Button>
                      </div>

                      <div className="mt-4 grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                          <Label>First name</Label>
                          <Input
                            value={representative.firstName}
                            onChange={(event) =>
                              updateRepresentative(index, "firstName", event.target.value)
                            }
                            placeholder="Juan"
                            className="field-blank h-11"
                          />
                        </div>

                        <div className="space-y-2">
                          <Label>Last name</Label>
                          <Input
                            value={representative.lastName}
                            onChange={(event) =>
                              updateRepresentative(index, "lastName", event.target.value)
                            }
                            placeholder="Dela Cruz"
                            className="field-blank h-11"
                          />
                        </div>

                        <div className="space-y-2">
                          <Label>Position title</Label>
                          <Input
                            value={representative.positionTitle}
                            onChange={(event) =>
                              updateRepresentative(
                                index,
                                "positionTitle",
                                event.target.value
                              )
                            }
                            placeholder="President"
                            className="field-blank h-11"
                          />
                        </div>

                        <div className="space-y-2">
                          <Label>Contact number</Label>
                          <Input
                            value={representative.contactNumber}
                            onChange={(event) =>
                              updateRepresentative(
                                index,
                                "contactNumber",
                                event.target.value
                              )
                            }
                            placeholder="+63 917 000 0000"
                            className="field-blank h-11"
                          />
                        </div>

                        <div className="space-y-2 md:col-span-2">
                          <Label>Email</Label>
                          <Input
                            type="email"
                            value={representative.email}
                            onChange={(event) =>
                              updateRepresentative(index, "email", event.target.value)
                            }
                            placeholder="representative@example.com"
                            className="field-blank h-11"
                          />
                        </div>
                      </div>

                      <label className="mt-4 flex items-start gap-3 rounded-[1rem] border border-border/70 bg-muted/40 px-3 py-3">
                        <input
                          type="checkbox"
                          checked={representative.isPrimary}
                          onChange={() => setPrimaryRepresentative(index)}
                          className="mt-1 size-4 rounded border-border text-primary focus-visible:ring-2 focus-visible:ring-ring"
                        />
                        <div className="space-y-1">
                          <span className="text-sm font-medium">
                            Primary representative
                          </span>
                          <p className="text-sm leading-6 text-muted-foreground">
                            Use this for the main point of contact for notices and
                            contract coordination.
                          </p>
                        </div>
                      </label>
                    </div>
                  ))}
                </div>
              )}
            </section>
          ) : null}

          {state.message ? (
            <div className="rounded-[1.2rem] border border-border/70 bg-muted/55 px-4 py-3 text-sm text-muted-foreground">
              {state.message}
            </div>
          ) : null}
        </div>

        <aside className="space-y-4">
          <div className="border-blank rounded-[1.85rem] p-5">
            <p className="text-[0.72rem] uppercase tracking-[0.26em] text-muted-foreground">
              {mode === "create" ? "New record" : "Update record"}
            </p>
            <h2 className="mt-3 text-xl font-semibold tracking-[-0.04em]">
              {mode === "create" ? "Create tenant" : "Save tenant changes"}
            </h2>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              {mode === "create"
                ? "Create an individual or business tenant profile with a required business name. Business tenants can also carry multiple named representatives."
                : "Update tenant identity, business name, contacts, and business representatives while preserving linked contracts and billing records."}
            </p>

            <div className="mt-5 flex flex-col gap-2">
              <Button
                type="submit"
                size="lg"
                className="h-11 rounded-xl shadow-sm"
                disabled={pending}
              >
                {pending ? <LoaderCircle className="animate-spin" /> : <Save />}
                {mode === "create" ? "Create tenant" : "Save changes"}
              </Button>
              <Button
                render={<Link href="/tenants" />}
                variant="outline"
                size="lg"
                className="button-blank h-11 rounded-xl"
              >
                <ArrowLeft />
                Back to tenants
              </Button>
            </div>
          </div>
        </aside>
      </div>
    </form>
  );
}
