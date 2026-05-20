"use client";

import { Children, type ReactNode, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";

export function PaginatedStack({
  children,
  pageSize = 4,
}: {
  children: ReactNode;
  pageSize?: number;
}) {
  const items = useMemo(() => Children.toArray(children), [children]);
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const [page, setPage] = useState(1);
  const startIndex = (page - 1) * pageSize;
  const currentItems = items.slice(startIndex, startIndex + pageSize);

  return (
    <div className="space-y-3">
      <div className="space-y-3">{currentItems}</div>
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
