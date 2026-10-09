"use client";

import React from "react";
import { Skeleton } from "@/components/ui/Skeleton";
import { cn } from "@/lib/cn";

export interface TableSkeletonProps {
  /** Number of skeleton columns (default: 5) */
  columns?: number;
  /** Number of skeleton rows (default: 6) */
  rows?: number;
  /** Whether to render table header (default: true) */
  showHeader?: boolean;
  /** Whether to show a search/filter bar skeleton above table (default: false) */
  showToolbar?: boolean;
  /** Whether to show a pagination skeleton at bottom (default: false) */
  showPagination?: boolean;
  /** Container custom class name */
  className?: string;
}

export function TableSkeleton({
  columns = 5,
  rows = 6,
  showHeader = true,
  showToolbar = false,
  showPagination = false,
  className,
}: TableSkeletonProps) {
  // Pre-calculated widths for realistic varied content appearance
  const cellWidths = [
    "w-28 sm:w-36",
    "w-20 sm:w-28",
    "w-16 sm:w-24",
    "w-24 sm:w-32",
    "w-16 sm:w-20",
    "w-20 sm:w-24",
    "w-14 sm:w-16",
  ];

  return (
    <div className={cn("w-full space-y-3 portal-fade-in", className)}>
      {/* Optional Toolbar Skeleton */}
      {showToolbar && (
        <div className="flex flex-wrap items-center justify-between gap-3 p-1">
          <Skeleton className="h-9 w-64 rounded-lg" />
          <div className="flex items-center gap-2">
            <Skeleton className="h-9 w-24 rounded-lg" />
            <Skeleton className="h-9 w-28 rounded-lg" />
          </div>
        </div>
      )}

      {/* Mobile Card Skeleton (hidden on desktop) */}
      <div className="grid grid-cols-1 gap-3 md:hidden">
        {Array.from({ length: Math.min(rows, 4) }).map((_, i) => (
          <div
            key={i}
            className="rounded-xl border border-border bg-card p-3.5 shadow-2xs space-y-3"
          >
            <div className="flex items-center justify-between gap-2">
              <Skeleton className="h-4 w-36 rounded" />
              <Skeleton className="h-5 w-16 rounded-full" />
            </div>
            <div className="grid grid-cols-2 gap-2 pt-1 border-t border-border/60">
              <div className="space-y-1">
                <Skeleton className="h-2.5 w-14 rounded" />
                <Skeleton className="h-3.5 w-24 rounded" />
              </div>
              <div className="space-y-1">
                <Skeleton className="h-2.5 w-14 rounded" />
                <Skeleton className="h-3.5 w-20 rounded" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Desktop Table Skeleton (hidden on small screens) */}
      <div className="hidden md:block overflow-x-auto rounded-xl border border-border bg-card shadow-2xs">
        <table className="min-w-full text-left text-sm">
          {showHeader && (
            <thead className="border-b border-border bg-slate-50/80 text-xs">
              <tr>
                {Array.from({ length: columns }).map((_, colIdx) => (
                  <th key={colIdx} className="px-3.5 py-3">
                    <Skeleton className="h-3.5 w-20 rounded" />
                  </th>
                ))}
              </tr>
            </thead>
          )}
          <tbody className="divide-y divide-border/80">
            {Array.from({ length: rows }).map((_, rowIdx) => (
              <tr key={rowIdx} className="hover:bg-slate-50/50 transition-colors">
                {Array.from({ length: columns }).map((_, colIdx) => {
                  const widthClass = cellWidths[(rowIdx + colIdx) % cellWidths.length];
                  return (
                    <td key={colIdx} className="px-3.5 py-3 align-middle">
                      {colIdx === 0 ? (
                        <div className="flex items-center gap-2.5">
                          <Skeleton className="h-7 w-7 rounded-full shrink-0" variant="subtle" />
                          <div className="space-y-1 min-w-0">
                            <Skeleton className={cn("h-3.5 rounded", widthClass)} />
                            <Skeleton className="h-2.5 w-16 rounded" variant="subtle" />
                          </div>
                        </div>
                      ) : colIdx === columns - 1 ? (
                        <Skeleton className="h-5 w-16 rounded-full" />
                      ) : (
                        <Skeleton className={cn("h-3.5 rounded", widthClass)} />
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Optional Pagination Skeleton */}
      {showPagination && (
        <div className="flex items-center justify-between px-2 pt-2">
          <Skeleton className="h-3 w-32 rounded" />
          <div className="flex items-center gap-1.5">
            <Skeleton className="h-8 w-8 rounded-lg" />
            <Skeleton className="h-8 w-8 rounded-lg" />
            <Skeleton className="h-8 w-8 rounded-lg" />
          </div>
        </div>
      )}
    </div>
  );
}
