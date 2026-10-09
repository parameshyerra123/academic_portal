"use client";

import React from "react";
import { Skeleton } from "@/components/ui/Skeleton";
import { TableSkeleton } from "@/components/ui/TableSkeleton";
import { StatCardSkeleton } from "@/components/ui/CardSkeleton";
import { cn } from "@/lib/cn";

export interface PageSkeletonProps {
  /** Width of the header title skeleton (default: "w-48") */
  titleWidth?: string;
  /** Whether to show a mock filter bar (default: true) */
  showFilterBar?: boolean;
  /** Whether to include a top row of KPI stat cards (default: false) */
  showStats?: boolean;
  /** Number of stat cards if showStats is true (default: 4) */
  statCardsCount?: number;
  /** Number of columns for the table skeleton (default: 5) */
  columns?: number;
  /** Number of rows for the table skeleton (default: 6) */
  rows?: number;
  className?: string;
}

/**
 * Universal Page Skeleton for modules across the Pydah Group Academic Portal.
 * Matches page headers, filters, stat cards, and data table structure.
 */
export function PageSkeleton({
  titleWidth = "w-48 sm:w-64",
  showFilterBar = true,
  showStats = false,
  statCardsCount = 4,
  columns = 5,
  rows = 6,
  className,
}: PageSkeletonProps) {
  return (
    <div
      role="status"
      aria-label="Loading page…"
      className={cn("w-full space-y-4 portal-fade-in select-none", className)}
    >
      {/* Page Header Skeleton */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-border/70">
        <div className="space-y-1.5">
          <Skeleton className={cn("h-6 sm:h-7 rounded-lg", titleWidth)} />
          <Skeleton className="h-3.5 w-52 sm:w-80 rounded" variant="subtle" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-8.5 w-24 rounded-lg" variant="subtle" />
          <Skeleton className="h-8.5 w-28 rounded-lg" />
        </div>
      </div>

      {/* Filter Bar Skeleton */}
      {showFilterBar && (
        <div className="rounded-xl border border-border bg-card p-3 shadow-2xs">
          <div className="flex flex-wrap items-center gap-2.5">
            <Skeleton className="h-8 w-32 rounded-lg" variant="subtle" />
            <Skeleton className="h-8 w-28 rounded-lg" variant="subtle" />
            <Skeleton className="h-8 w-24 rounded-lg" variant="subtle" />
            <Skeleton className="h-8 w-28 rounded-lg" variant="subtle" />
            <div className="ml-auto w-full sm:w-60">
              <Skeleton className="h-8 w-full rounded-lg" />
            </div>
          </div>
        </div>
      )}

      {/* Optional Top Metric Cards */}
      {showStats && (
        <div
          className={cn(
            "grid gap-2.5 sm:gap-3.5",
            statCardsCount === 3 && "grid-cols-1 sm:grid-cols-3",
            statCardsCount === 4 && "grid-cols-2 lg:grid-cols-4",
            statCardsCount >= 5 && "grid-cols-2 sm:grid-cols-3 lg:grid-cols-6"
          )}
        >
          {Array.from({ length: statCardsCount }).map((_, idx) => (
            <StatCardSkeleton key={idx} compact />
          ))}
        </div>
      )}

      {/* Data Table / Content Skeleton */}
      <TableSkeleton columns={columns} rows={rows} showHeader showPagination />
    </div>
  );
}
