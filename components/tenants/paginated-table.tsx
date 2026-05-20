"use client";

import { Children, type ReactNode, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Table, TableBody } from "@/components/ui/table";

export function PaginatedTable({
  header,
  children,
  pageSize = 6,
}: {
  header: ReactNode;
  children: ReactNode;
  pageSize?: number;
}) {
  const rows = useMemo(() => Children.toArray(children), [children]);
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const [page, setPage] = useState(1);
  const startIndex = (page - 1) * pageSize;
  const currentRows = rows.slice(startIndex, startIndex + pageSize);

  return (
    <div className="space-y-3">
      <Table>
        {header}
        <TableBody>{currentRows}</TableBody>
      </Table>
      {totalPages > 1 ? (
        <div className="flex items-center justify-between gap-3 border-t border-border/60 pt-3">
          <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">
            Page {page} of {totalPages}
          </p>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="rounded-full"
              onClick={() => setPage((currentPage) => Math.max(1, currentPage - 1))}
              disabled={page === 1}
            >
              Previous
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="rounded-full"
              onClick={() =>
                setPage((currentPage) => Math.min(totalPages, currentPage + 1))
              }
              disabled={page === totalPages}
            >
              Next
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
