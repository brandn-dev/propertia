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
  "select-blank";

const initialState: TenantFormState = {};

type PersonDraft = {
  personId?: string;
  firstName: string;
  lastName: string;
  middleName: string;
  positionTitle: string;
  contactNumber: string;
  email: string;
  address: string;
  validIdType: string;
  validIdNumber: string;
  notes: string;
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
    businessName: string;
    contactNumber: string;
    email: string;
    address: string;
    validIdType: string;
    validIdNumber: string;
    people: PersonDraft[];
  };
};

const emptyPerson = (): PersonDraft => ({
  personId: undefined,
  firstName: "",
  lastName: "",
  middleName: "",
  positionTitle: "",
  contactNumber: "",
  email: "",
  address: "",
  validIdType: "",
  validIdNumber: "",
  notes: "",
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
    businessName: "",
    contactNumber: "",
    email: "",
    address: "",
    validIdType: "",
    validIdNumber: "",
    people: [],
  },
}: TenantFormProps) {
  const [state, action, pending] = useActionState(formAction, initialState);
  const [tenantType, setTenantType] = useState<(typeof TENANT_TYPES)[number]>(
    initialValues.type
  );
  const [people, setPeople] = useState<PersonDraft[]>(initialValues.people);

  function addPerson() {
    setPeople((current) => {
      const nextPerson = emptyPerson();

      if (current.length === 0) {
        nextPerson.isPrimary = true;
      }

      return [...current, nextPerson];
    });
  }

  function updatePerson(
    index: number,
    field: keyof PersonDraft,
    value: string | boolean | undefined
  ) {
    setPeople((current) =>
      current.map((person, personIndex) =>
        personIndex === index
          ? {
              ...person,
              [field]: value,
            }
          : person
      )
    );
  }

  function removePerson(index: number) {
    setPeople((current) => {
      const nextPeople = current.filter(
        (_person, personIndex) => personIndex !== index
      );

      if (
        nextPeople.length > 0 &&
        !nextPeople.some((person) => person.isPrimary)
      ) {
        nextPeople[0] = {
          ...nextPeople[0],
          isPrimary: true,
        };
      }

      return nextPeople;
    });
  }

  function setPrimaryPerson(index: number) {
    setPeople((current) =>
      current.map((person, personIndex) => ({
        ...person,
        isPrimary: personIndex === index,
      }))
    );
  }

  const serializedPeople = JSON.stringify(people);

  return (
    <form action={action} className="space-y-6">
      <input type="hidden" name="people" value={serializedPeople} readOnly />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="border-blank space-y-6 rounded-xl p-6">
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
                This remains the reusable tenant account label shown across contracts,
                invoices, and operational pages.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="contactNumber">Entity contact number</Label>
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
              <Label htmlFor="email">Entity email</Label>
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
              <Label htmlFor="address">Entity address</Label>
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
              <Label htmlFor="validIdType">Entity valid ID type</Label>
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
              <Label htmlFor="validIdNumber">Entity valid ID number</Label>
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

          <section className="space-y-4 rounded-[1.45rem] border border-border/60 bg-background/55 p-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-base font-semibold tracking-[-0.03em]">
                  People
                </h3>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  Add the people attached to this tenant account. Each saved entry
                  becomes a reusable person record that can be linked again later.
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="button-blank rounded-full"
                onClick={addPerson}
              >
                <Plus />
                Add person
              </Button>
            </div>

            <FieldError message={state.errors?.people?.[0]} />

            {people.length === 0 ? (
              <div className="rounded-[1.2rem] border border-dashed border-border/80 bg-muted/40 px-4 py-4 text-sm leading-6 text-muted-foreground">
                {tenantType === "INDIVIDUAL"
                  ? "Add at least one person for this individual tenant. That person becomes the reusable identity record for the account."
                  : "No people added yet. Add the officers, partners, signatories, or coordinators attached to this business tenant."}
              </div>
            ) : (
              <div className="space-y-4">
                {people.map((person, index) => (
                  <div
                    key={person.personId ?? `person-${index}`}
                    className="rounded-[1.35rem] border border-border/60 bg-background/75 p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium">Person {index + 1}</p>
                        <p className="text-sm text-muted-foreground">
                          Basic information for the linked reusable person record.
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="button-blank rounded-full"
                        onClick={() => removePerson(index)}
                      >
                        <Trash2 />
                        Remove
                      </Button>
                    </div>

                    <div className="mt-4 grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label>First name</Label>
                        <Input
                          value={person.firstName}
                          onChange={(event) =>
                            updatePerson(index, "firstName", event.target.value)
                          }
                          placeholder="Juan"
                          className="field-blank h-11"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>Last name</Label>
                        <Input
                          value={person.lastName}
                          onChange={(event) =>
                            updatePerson(index, "lastName", event.target.value)
                          }
                          placeholder="Dela Cruz"
                          className="field-blank h-11"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>Middle name</Label>
                        <Input
                          value={person.middleName}
                          onChange={(event) =>
                            updatePerson(index, "middleName", event.target.value)
                          }
                          placeholder="Santos"
                          className="field-blank h-11"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>Position or relation</Label>
                        <Input
                          value={person.positionTitle}
                          onChange={(event) =>
                            updatePerson(index, "positionTitle", event.target.value)
                          }
                          placeholder={
                            tenantType === "BUSINESS"
                              ? "President"
                              : "Primary tenant"
                          }
                          className="field-blank h-11"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>Contact number</Label>
                        <Input
                          value={person.contactNumber}
                          onChange={(event) =>
                            updatePerson(index, "contactNumber", event.target.value)
                          }
                          placeholder="+63 917 000 0000"
                          className="field-blank h-11"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>Email</Label>
                        <Input
                          type="email"
                          value={person.email}
                          onChange={(event) =>
                            updatePerson(index, "email", event.target.value)
                          }
                          placeholder="person@example.com"
                          className="field-blank h-11"
                        />
                      </div>

                      <div className="space-y-2 md:col-span-2">
                        <Label>Address</Label>
                        <Textarea
                          value={person.address}
                          onChange={(event) =>
                            updatePerson(index, "address", event.target.value)
                          }
                          placeholder="Residential or mailing address for this person."
                          className="field-blank min-h-20"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>Valid ID type</Label>
                        <Input
                          value={person.validIdType}
                          onChange={(event) =>
                            updatePerson(index, "validIdType", event.target.value)
                          }
                          placeholder="Passport"
                          className="field-blank h-11"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>Valid ID number</Label>
                        <Input
                          value={person.validIdNumber}
                          onChange={(event) =>
                            updatePerson(index, "validIdNumber", event.target.value)
                          }
                          placeholder="P1234567A"
                          className="field-blank h-11"
                        />
                      </div>

                      <div className="space-y-2 md:col-span-2">
                        <Label>Notes</Label>
                        <Textarea
                          value={person.notes}
                          onChange={(event) =>
                            updatePerson(index, "notes", event.target.value)
                          }
                          placeholder="Optional context for this person record."
                          className="field-blank min-h-20"
                        />
                      </div>
                    </div>

                    <div className="mt-4 flex items-center justify-between rounded-[1.1rem] border border-border/60 bg-muted/30 px-4 py-3">
                      <div>
                        <p className="text-sm font-medium">Primary contact</p>
                        <p className="text-sm text-muted-foreground">
                          Use one primary person for notices and main coordination.
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant={person.isPrimary ? "default" : "outline"}
                        size="sm"
                        className={person.isPrimary ? "rounded-full" : "button-blank rounded-full"}
                        onClick={() => setPrimaryPerson(index)}
                      >
                        {person.isPrimary ? "Primary" : "Set primary"}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        <aside className="border-blank rounded-xl p-6">
          <h2 className="text-lg font-semibold tracking-[-0.03em]">
            {mode === "create" ? "Before you save" : "What this updates"}
          </h2>
          <div className="mt-4 space-y-4 text-sm leading-6 text-muted-foreground">
            <p>
              {mode === "create"
                ? "Create a reusable tenant account, then attach one or more people to it. Individual tenants should always have at least one person."
                : "Update the tenant account and its linked people without breaking contracts, invoices, or meter assignments already attached to the tenant."}
            </p>
            <p>
              Every saved person becomes a standalone reusable record. Editing a
              linked person here updates that person record directly.
            </p>
            <div className="rounded-[1.2rem] border border-dashed border-border/70 bg-muted/35 px-4 py-4">
              Keep the tenant account label in <span className="font-medium text-foreground">Business name</span>,
              then store actual people in the <span className="font-medium text-foreground">People</span> section.
            </div>
          </div>

          <div className="mt-6 flex flex-col gap-3">
            <Button type="submit" className="rounded-full" disabled={pending}>
              {pending ? (
                <>
                  <LoaderCircle className="animate-spin" />
                  Saving tenant
                </>
              ) : (
                <>
                  <Save />
                  {mode === "create" ? "Create tenant" : "Save changes"}
                </>
              )}
            </Button>
            <Button
              render={<Link href="/tenants" />}
              variant="outline"
              className="button-blank rounded-full"
            >
              <ArrowLeft />
              Back to tenants
            </Button>
          </div>

          {state.message ? (
            <p className="mt-4 text-sm text-destructive">{state.message}</p>
          ) : null}
        </aside>
      </div>
    </form>
  );
}
