"use client";

import { useState } from "react";
import type {
  HistoricalBacklogBulkFormState,
  HistoricalBacklogFormState,
} from "@/app/(dashboard)/billing/backlog/actions";
import { HistoricalBacklogBulkTable } from "@/components/billing/historical-backlog-bulk-table";
import { HistoricalBacklogForm } from "@/components/billing/historical-backlog-form";
import { Button } from "@/components/ui/button";
import type { HistoricalBacklogContractOption } from "@/lib/billing/historical-backlog-drafts";

type HistoricalBacklogWorkspaceProps = {
  singleFormAction: (
    state: HistoricalBacklogFormState,
    formData: FormData
  ) => Promise<HistoricalBacklogFormState>;
  bulkFormAction: (
    state: HistoricalBacklogBulkFormState,
    formData: FormData
  ) => Promise<HistoricalBacklogBulkFormState>;
  contractOptions: HistoricalBacklogContractOption[];
  cutoffLabel: string;
};

export function HistoricalBacklogWorkspace({
  singleFormAction,
  bulkFormAction,
  contractOptions,
  cutoffLabel,
}: HistoricalBacklogWorkspaceProps) {
  const [activeTab, setActiveTab] = useState<"form" | "bulk">("form");

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
          formAction={singleFormAction}
          contractOptions={contractOptions}
          cutoffLabel={cutoffLabel}
        />
      ) : (
        <HistoricalBacklogBulkTable
          formAction={bulkFormAction}
          contractOptions={contractOptions}
          cutoffLabel={cutoffLabel}
        />
      )}
    </div>
  );
}
