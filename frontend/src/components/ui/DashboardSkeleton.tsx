"use client";

import React from "react";
import { Skeleton } from "@/components/ui/Skeleton";
import { StatCardSkeleton } from "@/components/ui/CardSkeleton";
import { cn } from "@/lib/cn";

export interface DashboardSkeletonProps {
  className?: string;
}

/**
 * High-fidelity Skeleton matching the Pydah Group Academic Portal Dashboard layout.
 * Prevents layout shift across KPI cards, schedule cards, donut charts, syllabus bars, and tables.
 */
export function DashboardSkeleton({ className }: DashboardSkeletonProps) {
  return (
    <div
      role="status"
      aria-label="Loading dashboard…"
      className={cn("w-full space-y-4 portal-fade-in select-none", className)}
    >
      {/* Top Banner / Dashboard Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-1 border-b border-border/60">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <Skeleton className="h-6 w-52 sm:w-64 rounded-lg" />
            <Skeleton className="h-5 w-20 rounded-full" variant="subtle" />
          </div>
          <Skeleton className="h-3.5 w-60 sm:w-80 rounded" variant="subtle" />
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Skeleton className="h-8 w-28 rounded-lg" variant="subtle" />
          <Skeleton className="h-8 w-32 rounded-lg" variant="subtle" />
        </div>
      </div>

      {/* Row 1: KPI Metric Cards (6 cards matching StatCard) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 sm:gap-3.5">
        <StatCardSkeleton compact />
        <StatCardSkeleton compact />
        <StatCardSkeleton compact />
        <StatCardSkeleton compact />
        <StatCardSkeleton compact />
        <StatCardSkeleton compact />
      </div>

      {/* Row 2: Today's Schedule (5 cols) + Subject Donut (4 cols) + Syllabus Progress (3 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5 sm:gap-4">
        {/* Card 1: Today's Class Schedule */}
        <div className="lg:col-span-5 rounded-xl border border-border bg-card p-3.5 sm:p-4 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Skeleton className="h-4 w-36 rounded" />
              <Skeleton className="h-4 w-12 rounded-full" variant="subtle" />
            </div>
            <Skeleton className="h-4 w-16 rounded" variant="subtle" />
          </div>

          <div className="space-y-2.5 pt-1">
            {[1, 2, 3].map((item) => (
              <div
                key={item}
                className="flex items-center justify-between p-2.5 rounded-lg border border-border/80 bg-slate-50/50 gap-3"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <Skeleton className="h-10 w-12 rounded-md shrink-0" variant="subtle" />
                  <div className="space-y-1.5 min-w-0">
                    <Skeleton className="h-3.5 w-32 sm:w-44 rounded" />
                    <div className="flex items-center gap-1.5">
                      <Skeleton className="h-2.5 w-16 rounded" variant="subtle" />
                      <Skeleton className="h-2.5 w-12 rounded" variant="subtle" />
                    </div>
                  </div>
                </div>
                <Skeleton className="h-5 w-16 rounded-full shrink-0" />
              </div>
            ))}
          </div>
        </div>

        {/* Card 2: Attendance Donut Chart Placeholder */}
        <div className="lg:col-span-4 rounded-xl border border-border bg-card p-3.5 sm:p-4 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <Skeleton className="h-4 w-40 rounded" />
            <Skeleton className="h-4 w-10 rounded-full" variant="subtle" />
          </div>

          {/* Animated Donut Ring Placeholder */}
          <div className="flex flex-col items-center justify-center my-4">
            <div className="relative flex items-center justify-center h-32 w-32 rounded-full border-8 border-slate-200/80 portal-shimmer">
              <div className="flex flex-col items-center justify-center h-20 w-20 rounded-full bg-card shadow-2xs">
                <Skeleton className="h-5 w-10 rounded" />
                <Skeleton className="h-2 w-12 rounded mt-1" variant="subtle" />
              </div>
            </div>
          </div>

          {/* Legend items */}
          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border/60">
            <div className="flex items-center gap-2">
              <Skeleton className="h-2.5 w-2.5 rounded-full" />
              <Skeleton className="h-2.5 w-20 rounded" variant="subtle" />
            </div>
            <div className="flex items-center gap-2">
              <Skeleton className="h-2.5 w-2.5 rounded-full" />
              <Skeleton className="h-2.5 w-16 rounded" variant="subtle" />
            </div>
          </div>
        </div>

        {/* Card 3: Syllabus Coverage Progress */}
        <div className="lg:col-span-3 rounded-xl border border-border bg-card p-3.5 sm:p-4 shadow-xs space-y-3.5">
          <div className="flex items-center justify-between">
            <Skeleton className="h-4 w-32 rounded" />
            <Skeleton className="h-4 w-12 rounded-full" variant="subtle" />
          </div>

          <div className="space-y-3 pt-1">
            {[1, 2, 3].map((item) => (
              <div key={item} className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Skeleton className="h-3 w-28 rounded" />
                  <Skeleton className="h-3 w-8 rounded" variant="subtle" />
                </div>
                <div className="h-2 w-full rounded-full bg-slate-200/80 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-navy-800/40 portal-shimmer"
                    style={{ width: `${60 + item * 10}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Row 3: Student Attendance Table + Internal Exam Performance */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5 sm:gap-4">
        {/* Left: Students Attendance List Table Skeleton */}
        <div className="lg:col-span-7 rounded-xl border border-border bg-card p-3.5 sm:p-4 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Skeleton className="h-4 w-44 rounded" />
              <Skeleton className="h-4 w-14 rounded-full" variant="subtle" />
            </div>
            <Skeleton className="h-7 w-24 rounded-lg" variant="subtle" />
          </div>

          <div className="space-y-2 pt-1">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="flex items-center justify-between p-2.5 rounded-lg border border-border/70 hover:bg-slate-50/50"
              >
                <div className="flex items-center gap-2.5">
                  <Skeleton className="h-7 w-7 rounded-full shrink-0" variant="subtle" />
                  <div className="space-y-1">
                    <Skeleton className="h-3.5 w-32 sm:w-40 rounded" />
                    <Skeleton className="h-2.5 w-20 rounded" variant="subtle" />
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Skeleton className="h-3.5 w-12 rounded" />
                  <Skeleton className="h-5 w-16 rounded-full" />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right: Internal Exam Performance Chart Skeleton */}
        <div className="lg:col-span-5 rounded-xl border border-border bg-card p-3.5 sm:p-4 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <Skeleton className="h-4 w-36 rounded" />
            <Skeleton className="h-4 w-16 rounded" variant="subtle" />
          </div>

          {/* Bar Chart Skeletons */}
          <div className="flex items-end justify-between gap-3 h-40 pt-6 px-4 pb-2 border-b border-border/80">
            {[45, 75, 60, 90, 65, 80].map((height, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end">
                <div
                  className="w-full rounded-t-md bg-slate-200/90 portal-shimmer"
                  style={{ height: `${height}%` }}
                />
                <Skeleton className="h-2.5 w-6 rounded" variant="subtle" />
              </div>
            ))}
          </div>

          <div className="flex items-center justify-around pt-3">
            <div className="flex items-center gap-1.5">
              <Skeleton className="h-2 w-2 rounded-full" />
              <Skeleton className="h-2.5 w-14 rounded" variant="subtle" />
            </div>
            <div className="flex items-center gap-1.5">
              <Skeleton className="h-2 w-2 rounded-full" />
              <Skeleton className="h-2.5 w-14 rounded" variant="subtle" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
