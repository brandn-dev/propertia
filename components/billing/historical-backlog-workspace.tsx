"use client";

import { useState } from "react";
import type {
  HistoricalBacklogBulkFormState,
  HistoricalBacklogFormState,
} from "@/app/(dashboard)/billing/backlog/actions";
import { HistoricalBacklogBulkTable } from "@/components/billing/historical-backlog-bulk-table";
import { HistoricalBacklogForm } from "@/components/billing/historical-backlog-form";
import { Button } from "@/components/ui/button";
import { UTILITY_TYPE_LABELS } from "@/lib/form-options";

type ContractOption = {
  id: string;
  tenantId: string;
  status: string;
  paymentStartDate: string;
  endDate: string;
  monthlyRent: string;
  freeRentCycles: number;
  advanceRentMonths: number;
  advanceRentApplication: "FIRST_BILLABLE_CYCLES" | "LAST_BILLABLE_CYCLES";
  advanceRent: string;
  property: {
    id: string;
    name: string;
    propertyCode: string;
  };
  tenant: {
    firstName: string | null;
    lastName: string | null;
    businessName: string | null;
  };
  meters: {
    id: string;
    propertyId: string;
    tenantId: string | null;
    meterCode: string;
    utilityType: keyof typeof UTILITY_TYPE_LABELS;
  }[];
  pendingBacklogCycles: {
    key: string;
    start: string;
    end: string;
    label: string;
  }[];
};

type HistoricalBacklogWorkspaceProps = {
  singleFormAction: (
    state: HistoricalBacklogFormState,
    formData: FormData
  ) => Promise<HistoricalBacklogFormState>;
  bulkFormAction: (
    state: HistoricalBacklogBulkFormState,
    formData: FormData
  ) => Promise<HistoricalBacklogBulkFormState>;
  contractOptions: ContractOption[];
  cutoffLabel: string;
};

export function HistoricalBacklogWorkspace({
  singleFormAction,
  bulkFormAction,
  contractOptions,
  cutoffLabel,
}: HistoricalBacklogWorkspaceProps) {
  const [activeTab, setActiveTab] = useState<"form" | "bulk">("form");
  const [formSelection, setFormSelection] = useState<{
    tenantId?: string;
    contractId?: string;
    cycleKey?: string;
  }>({});
  const formSelectionKey = [
    formSelection.tenantId ?? "tenant",
    formSelection.contractId ?? "contract",
    formSelection.cycleKey ?? "cycle",
  ].join("::");

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant={activeTab === "form" ? "default" : "outline"}
          className={activeTab === "form" ? "rounded-full" : "button-blank rounded-full"}
          onClick={() => setActiveTab("form")}
        >
          Single Month Form
        </Button>
        <Button
          type="button"
          variant={activeTab === "bulk" ? "default" : "outline"}
          className={activeTab === "bulk" ? "rounded-full" : "button-blank rounded-full"}
          onClick={() => setActiveTab("bulk")}
        >
          Bulk Table
        </Button>
      </div>

      {activeTab === "form" ? (
        <HistoricalBacklogForm
          key={formSelectionKey}
          formAction={singleFormAction}
          contractOptions={contractOptions}
          cutoffLabel={cutoffLabel}
          initialSelection={formSelection}
        />
      ) : (
        <HistoricalBacklogBulkTable
          formAction={bulkFormAction}
          contractOptions={contractOptions}
          cutoffLabel={cutoffLabel}
          onNeedsDetail={(selection) => {
            setFormSelection(selection);
            setActiveTab("form");
          }}
        />
      )}
    </div>
  );
}
