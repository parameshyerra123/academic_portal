"use client";

import React from "react";
import { Skeleton } from "@/components/ui/Skeleton";
import { cn } from "@/lib/cn";

export interface StatCardSkeletonProps {
  compact?: boolean;
  layout?: "vertical" | "horizontal";
  className?: string;
}

/**
 * Skeleton placeholder that strictly matches the dimensions of StatCard.
 */
export function StatCardSkeleton({ compact = false, layout = "vertical", className }: StatCardSkeletonProps) {
  if (layout === "horizontal") {
    return (
      <div
        className={cn(
          "rounded-xl sm:rounded-2xl border border-slate-200/90 bg-white p-2.5 sm:p-3.5 shadow-xs flex items-center gap-2 sm:gap-3",
          className
        )}
      >
        <Skeleton className="h-8 w-8 sm:h-11 sm:w-11 shrink-0 rounded-lg sm:rounded-xl" variant="subtle" />
        <div className="min-w-0 flex-1 space-y-1">
          <Skeleton className="h-2.5 sm:h-3 w-16 sm:w-20 rounded" />
          <Skeleton className="h-5 sm:h-6 w-12 sm:w-16 rounded font-black mt-0.5" />
          <Skeleton className="h-2 sm:h-2.5 w-14 sm:w-20 rounded mt-0.5" variant="subtle" />
        </div>
      </div>
    );
  }

  if (compact) {
    return (
      <div
        className={cn(
          "rounded-xl border border-border/80 bg-card p-2 sm:p-2.5 shadow-2xs space-y-1.5",
          className
        )}
      >
        <div className="flex items-center justify-between gap-1">
          <Skeleton className="h-2.5 sm:h-3 w-16 sm:w-20 rounded" />
          <Skeleton className="h-3 sm:h-3.5 w-3 sm:w-3.5 rounded-full shrink-0" variant="subtle" />
        </div>
        <Skeleton className="h-5 sm:h-6 w-14 sm:w-16 rounded" />
        <Skeleton className="h-2 w-12 rounded" variant="subtle" />
      </div>
    );
  }

  return (
    <div
      className={cn(
        "rounded-xl sm:rounded-lg border border-border/80 bg-card p-2.5 sm:p-4 shadow-xs space-y-2",
        className
      )}
    >
      <div className="flex items-center justify-between gap-1">
        <Skeleton className="h-3 w-20 sm:w-24 rounded" />
        <Skeleton className="h-3.5 w-3.5 rounded-full shrink-0" variant="subtle" />
      </div>
      <Skeleton className="h-7 sm:h-8 w-16 sm:w-20 rounded mt-1" />
      <Skeleton className="h-2.5 w-24 sm:w-28 rounded" variant="subtle" />
    </div>
  );
}

export interface ContentCardSkeletonProps {
  /** Optional custom title width */
  titleWidth?: string;
  /** Height of the content area */
  contentHeight?: string;
  className?: string;
  children?: React.ReactNode;
}

export function ContentCardSkeleton({
  titleWidth = "w-36",
  contentHeight = "h-48",
  className,
  children,
}: ContentCardSkeletonProps) {
  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-card p-4 sm:p-5 shadow-xs space-y-4",
        className
      )}
    >
      <div className="flex items-center justify-between">
        <Skeleton className={cn("h-4 rounded", titleWidth)} />
        <Skeleton className="h-4 w-12 rounded-full" variant="subtle" />
      </div>
      {children || <Skeleton className={cn("w-full rounded-lg", contentHeight)} variant="subtle" />}
    </div>
  );
}
