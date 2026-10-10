"use client";

import React from "react";
import { Skeleton } from "@/components/ui/Skeleton";
import { StatCardSkeleton } from "@/components/ui/CardSkeleton";
import { cn } from "@/lib/cn";

export interface DashboardSkeletonProps {
  className?: string;
}

/**
 * Pixel-accurate Skeleton matching the Pydah Group Academic Portal Dashboard layout.
 * Mirrors SubjectTeacherDashboard with exact 1-to-1 card layout:
 * - Row 1: 6 horizontal KPI cards (icon on left + label, value, hint on right)
 * - Row 2: Today's Classes table | Subject-wise Attendance donut grid | Teaching Progress table
 * - Row 3: Students Attendance table | Internal Exam Performance table | Students Requiring Attention table
 * - Row 4: Pending Work list | My Subject Students Overview table | Upcoming Exams / Deadlines
 */
export function DashboardSkeleton({ className }: DashboardSkeletonProps) {
  return (
    <div
      role="status"
      aria-label="Loading dashboard…"
      className={cn("space-y-4 sm:space-y-5 pb-12 font-sans antialiased portal-fade-in select-none", className)}
    >
      {/* 1. ROW 1 — 6 KPI METRIC CARDS */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-3.5">
        {Array.from({ length: 6 }).map((_, i) => (
          <StatCardSkeleton key={i} layout="horizontal" />
        ))}
      </div>

      {/* 2. ROW 2 — TODAY'S CLASSES | SUBJECT-WISE ATTENDANCE | TEACHING PROGRESS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 sm:gap-4">
        {/* Card A: Today's Classes */}
        <div className="rounded-xl sm:rounded-2xl border border-slate-200/90 bg-white p-3 sm:p-4 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-2 sm:pb-3 border-b border-slate-100">
              <div className="flex items-center gap-1.5 sm:gap-2">
                <Skeleton className="h-3.5 w-3.5 sm:h-4 sm:w-4 rounded" variant="subtle" />
                <Skeleton className="h-4 w-28 sm:w-32 rounded font-bold" />
              </div>
              <Skeleton className="h-3 w-24 rounded" variant="subtle" />
            </div>

            <div className="mt-2 sm:mt-3 overflow-hidden">
              <table className="w-full text-left text-[11px] sm:text-xs">
                <thead>
                  <tr className="border-b border-slate-100 pb-1 sm:pb-1.5">
                    <th className="py-1 sm:py-1.5 w-1/4"><Skeleton className="h-2.5 w-12 rounded" variant="subtle" /></th>
                    <th className="py-1 sm:py-1.5 w-1/3"><Skeleton className="h-2.5 w-14 rounded" variant="subtle" /></th>
                    <th className="py-1 sm:py-1.5 w-1/5"><Skeleton className="h-2.5 w-10 rounded" variant="subtle" /></th>
                    <th className="py-1 sm:py-1.5 text-right"><Skeleton className="h-2.5 w-12 rounded ml-auto" variant="subtle" /></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <tr key={i}>
                      <td className="py-2 sm:py-2.5"><Skeleton className="h-3 w-16 sm:w-20 rounded" /></td>
                      <td className="py-2 sm:py-2.5"><Skeleton className="h-3 w-20 sm:w-28 rounded" /></td>
                      <td className="py-2 sm:py-2.5"><Skeleton className="h-3 w-14 rounded" /></td>
                      <td className="py-2 sm:py-2.5 text-right"><Skeleton className="h-5 w-16 rounded-md ml-auto" variant="subtle" /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Card B: Subject-wise Attendance (Grid of Circular Donuts) */}
        <div className="rounded-xl sm:rounded-2xl border border-slate-200/90 bg-white p-3 sm:p-4 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex flex-wrap items-center justify-between pb-2 sm:pb-3 border-b border-slate-100 gap-1.5">
              <div className="flex items-center gap-1.5 sm:gap-2">
                <Skeleton className="h-3.5 w-3.5 sm:h-4 sm:w-4 rounded" variant="subtle" />
                <Skeleton className="h-4 w-36 sm:w-40 rounded font-bold" />
              </div>
              <div className="flex items-center gap-1.5">
                <Skeleton className="h-6 w-28 rounded-lg" variant="subtle" />
                <Skeleton className="h-3 w-16 rounded" variant="subtle" />
              </div>
            </div>

            <div className="mt-2.5 sm:mt-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 text-center">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex flex-col items-center">
                  <div className="h-7 sm:h-8 flex flex-col items-center justify-center mb-0.5 sm:mb-1 w-full px-1">
                    <Skeleton className="h-2.5 w-16 rounded" />
                    <Skeleton className="h-2 w-10 rounded mt-1" variant="subtle" />
                  </div>
                  {/* Circular Donut Ring Skeleton matching DonutProgress */}
                  <div className="relative inline-flex items-center justify-center shrink-0 w-12 h-12 sm:w-16 sm:h-16 rounded-full border-4 sm:border-[6px] border-slate-200 portal-shimmer">
                    <Skeleton className="h-3 w-6 rounded" />
                  </div>
                  <Skeleton className="h-2.5 w-10 rounded mt-1.5" />
                  <Skeleton className="h-2 w-16 rounded mt-1" variant="subtle" />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Card C: Teaching Progress */}
        <div className="rounded-xl sm:rounded-2xl border border-slate-200/90 bg-white p-3 sm:p-4 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-2 sm:pb-3 border-b border-slate-100">
              <div className="flex items-center gap-1.5 sm:gap-2">
                <Skeleton className="h-3.5 w-3.5 sm:h-4 sm:w-4 rounded" variant="subtle" />
                <Skeleton className="h-4 w-28 sm:w-32 rounded font-bold" />
              </div>
              <Skeleton className="h-3 w-16 rounded" variant="subtle" />
            </div>

            <div className="mt-2 sm:mt-3 overflow-hidden">
              <table className="w-full text-left text-[11px] sm:text-xs">
                <thead>
                  <tr className="border-b border-slate-100 pb-1 sm:pb-1.5">
                    <th className="py-1 sm:py-1.5 w-1/3"><Skeleton className="h-2.5 w-14 rounded" variant="subtle" /></th>
                    <th className="py-1 sm:py-1.5 text-center"><Skeleton className="h-2.5 w-8 rounded mx-auto" variant="subtle" /></th>
                    <th className="py-1 sm:py-1.5 text-center"><Skeleton className="h-2.5 w-10 rounded mx-auto" variant="subtle" /></th>
                    <th className="py-1 sm:py-1.5"><Skeleton className="h-2.5 w-12 rounded" variant="subtle" /></th>
                    <th className="py-1 sm:py-1.5 text-right"><Skeleton className="h-2.5 w-10 rounded ml-auto" variant="subtle" /></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <tr key={i}>
                      <td className="py-2 sm:py-2.5"><Skeleton className="h-3 w-28 sm:w-36 rounded" /></td>
                      <td className="py-2 sm:py-2.5 text-center"><Skeleton className="h-3 w-6 rounded mx-auto" /></td>
                      <td className="py-2 sm:py-2.5 text-center"><Skeleton className="h-3 w-6 rounded mx-auto" /></td>
                      <td className="py-2 sm:py-2.5">
                        <div className="w-14 sm:w-20 bg-slate-100 h-1.5 sm:h-2 rounded-full overflow-hidden">
                          <div className="h-full rounded-full bg-slate-200/80 portal-shimmer" style={{ width: `${30 + i * 15}%` }} />
                        </div>
                      </td>
                      <td className="py-2 sm:py-2.5 text-right"><Skeleton className="h-5 w-14 rounded-md ml-auto" variant="subtle" /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* 3. ROW 3 — STUDENTS ATTENDANCE | INTERNAL EXAM PERFORMANCE | STUDENTS REQUIRING ATTENTION */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3.5 sm:gap-4">
        {/* Card D: Students Attendance (My Subjects) */}
        <div className="rounded-xl sm:rounded-2xl border border-slate-200/90 bg-white p-3 sm:p-4 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-2.5 sm:pb-3 border-b border-slate-100">
              <div className="flex items-center gap-1.5 sm:gap-2">
                <Skeleton className="h-3.5 w-3.5 sm:h-4 sm:w-4 rounded" variant="subtle" />
                <Skeleton className="h-4 w-40 sm:w-48 rounded font-bold" />
              </div>
              <Skeleton className="h-3 w-14 rounded" variant="subtle" />
            </div>

            <div className="mt-2.5 sm:mt-3 overflow-hidden">
              <table className="w-full text-left text-[11px] sm:text-xs">
                <thead>
                  <tr className="border-b border-slate-100 pb-1.5">
                    <th className="py-1 sm:py-1.5 w-2/5"><Skeleton className="h-2.5 w-14 rounded" variant="subtle" /></th>
                    <th className="py-1 sm:py-1.5 text-center"><Skeleton className="h-2.5 w-7 rounded mx-auto" variant="subtle" /></th>
                    <th className="py-1 sm:py-1.5 text-center"><Skeleton className="h-2.5 w-8 rounded mx-auto" variant="subtle" /></th>
                    <th className="py-1 sm:py-1.5 text-center"><Skeleton className="h-2.5 w-8 rounded mx-auto" variant="subtle" /></th>
                    <th className="py-1 sm:py-1.5 text-right"><Skeleton className="h-2.5 w-12 rounded ml-auto" variant="subtle" /></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <tr key={i}>
                      <td className="py-2 sm:py-2.5"><Skeleton className="h-3 w-28 rounded" /></td>
                      <td className="py-2 sm:py-2.5 text-center"><Skeleton className="h-3 w-5 rounded mx-auto" /></td>
                      <td className="py-2 sm:py-2.5 text-center"><Skeleton className="h-3 w-5 rounded mx-auto" /></td>
                      <td className="py-2 sm:py-2.5 text-center"><Skeleton className="h-3 w-5 rounded mx-auto" /></td>
                      <td className="py-2 sm:py-2.5 text-right"><Skeleton className="h-3 w-8 rounded ml-auto" /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Card E: Internal Exam Performance (My Subjects) */}
        <div className="rounded-xl sm:rounded-2xl border border-slate-200/90 bg-white p-3 sm:p-4 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-2.5 sm:pb-3 border-b border-slate-100">
              <div className="flex items-center gap-1.5 sm:gap-2">
                <Skeleton className="h-3.5 w-3.5 sm:h-4 sm:w-4 rounded" variant="subtle" />
                <Skeleton className="h-4 w-44 sm:w-52 rounded font-bold" />
              </div>
              <Skeleton className="h-3 w-16 rounded" variant="subtle" />
            </div>

            <div className="mt-2.5 sm:mt-3 overflow-hidden">
              <table className="w-full text-left text-[11px] sm:text-xs">
                <thead>
                  <tr className="border-b border-slate-100 pb-1.5">
                    <th className="py-1 sm:py-1.5 w-2/5"><Skeleton className="h-2.5 w-14 rounded" variant="subtle" /></th>
                    <th className="py-1 sm:py-1.5 text-center"><Skeleton className="h-2.5 w-10 rounded mx-auto" variant="subtle" /></th>
                    <th className="py-1 sm:py-1.5 text-center"><Skeleton className="h-2.5 w-7 rounded mx-auto" variant="subtle" /></th>
                    <th className="py-1 sm:py-1.5 text-center"><Skeleton className="h-2.5 w-7 rounded mx-auto" variant="subtle" /></th>
                    <th className="py-1 sm:py-1.5 text-right"><Skeleton className="h-2.5 w-10 rounded ml-auto" variant="subtle" /></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <tr key={i}>
                      <td className="py-2 sm:py-2.5"><Skeleton className="h-3 w-24 rounded" /></td>
                      <td className="py-2 sm:py-2.5 text-center"><Skeleton className="h-3 w-5 rounded mx-auto" /></td>
                      <td className="py-2 sm:py-2.5 text-center"><Skeleton className="h-3 w-5 rounded mx-auto" /></td>
                      <td className="py-2 sm:py-2.5 text-center"><Skeleton className="h-3 w-5 rounded mx-auto" /></td>
                      <td className="py-2 sm:py-2.5 text-right"><Skeleton className="h-3 w-10 rounded ml-auto font-bold" /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Card F: Students Requiring Attention */}
        <div className="rounded-xl sm:rounded-2xl border border-slate-200/90 bg-white p-3 sm:p-4 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-2.5 sm:pb-3 border-b border-slate-100">
              <div className="flex items-center gap-1.5 sm:gap-2">
                <Skeleton className="h-3.5 w-3.5 sm:h-4 sm:w-4 rounded" variant="subtle" />
                <Skeleton className="h-4 w-40 sm:w-48 rounded font-bold" />
              </div>
              <Skeleton className="h-3 w-14 rounded" variant="subtle" />
            </div>

            {/* Filter Pills */}
            <div className="mt-2.5 sm:mt-3 flex flex-wrap items-center gap-1 sm:gap-1.5">
              <Skeleton className="h-6 sm:h-7 w-36 rounded-md" />
              <Skeleton className="h-6 sm:h-7 w-28 rounded-md" variant="subtle" />
              <Skeleton className="h-6 sm:h-7 w-28 rounded-md" variant="subtle" />
            </div>

            <div className="mt-2.5 sm:mt-3 overflow-hidden">
              <table className="w-full text-left text-[11px] sm:text-xs">
                <thead>
                  <tr className="border-b border-slate-100 pb-1.5">
                    <th className="py-1 sm:py-1.5"><Skeleton className="h-2.5 w-10 rounded" variant="subtle" /></th>
                    <th className="py-1 sm:py-1.5"><Skeleton className="h-2.5 w-12 rounded" variant="subtle" /></th>
                    <th className="py-1 sm:py-1.5"><Skeleton className="h-2.5 w-14 rounded" variant="subtle" /></th>
                    <th className="py-1 sm:py-1.5 text-center"><Skeleton className="h-2.5 w-12 rounded mx-auto" variant="subtle" /></th>
                    <th className="py-1 sm:py-1.5 text-right"><Skeleton className="h-2.5 w-10 rounded ml-auto" variant="subtle" /></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <tr key={i}>
                      <td className="py-2 sm:py-2.5"><Skeleton className="h-3 w-14 rounded" /></td>
                      <td className="py-2 sm:py-2.5"><Skeleton className="h-3 w-16 rounded" /></td>
                      <td className="py-2 sm:py-2.5"><Skeleton className="h-3 w-20 rounded" /></td>
                      <td className="py-2 sm:py-2.5 text-center"><Skeleton className="h-3 w-8 rounded mx-auto font-bold" /></td>
                      <td className="py-2 sm:py-2.5 text-right"><Skeleton className="h-5 w-10 rounded ml-auto" variant="subtle" /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* 4. ROW 4 — PENDING WORK | MY SUBJECT STUDENTS OVERVIEW | UPCOMING EXAMS / DEADLINES */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3.5 sm:gap-4">
        {/* Card G: Pending Work */}
        <div className="rounded-xl sm:rounded-2xl border border-slate-200/90 bg-white p-3 sm:p-4 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-2.5 sm:pb-3 border-b border-slate-100">
              <div className="flex items-center gap-1.5 sm:gap-2">
                <Skeleton className="h-3.5 w-3.5 sm:h-4 sm:w-4 rounded" variant="subtle" />
                <Skeleton className="h-4 w-28 sm:w-32 rounded font-bold" />
              </div>
            </div>

            <div className="mt-2.5 sm:mt-3 space-y-2 sm:space-y-2.5">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex items-center justify-between p-1.5 sm:p-2 rounded-xl border border-slate-100">
                  <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                    <Skeleton className="h-6 w-6 sm:h-7 sm:w-7 rounded-full shrink-0" />
                    <Skeleton className="h-3 w-36 sm:w-44 rounded" />
                  </div>
                  <Skeleton className="h-3.5 w-3.5 rounded shrink-0 ml-1" variant="subtle" />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Card H: My Subject Students Overview */}
        <div className="rounded-xl sm:rounded-2xl border border-slate-200/90 bg-white p-3 sm:p-4 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-2.5 sm:pb-3 border-b border-slate-100">
              <div className="flex items-center gap-1.5 sm:gap-2">
                <Skeleton className="h-3.5 w-3.5 sm:h-4 sm:w-4 rounded" variant="subtle" />
                <Skeleton className="h-4 w-44 sm:w-52 rounded font-bold" />
              </div>
              <Skeleton className="h-3 w-14 rounded" variant="subtle" />
            </div>

            <div className="mt-2.5 sm:mt-3 overflow-hidden">
              <table className="w-full text-left text-[11px] sm:text-xs">
                <thead>
                  <tr className="border-b border-slate-100 pb-1.5">
                    <th className="py-1 sm:py-1.5 w-1/3"><Skeleton className="h-2.5 w-12 rounded" variant="subtle" /></th>
                    <th className="py-1 sm:py-1.5 text-center"><Skeleton className="h-2.5 w-7 rounded mx-auto" variant="subtle" /></th>
                    <th className="py-1 sm:py-1.5 text-center"><Skeleton className="h-2.5 w-10 rounded mx-auto" variant="subtle" /></th>
                    <th className="py-1 sm:py-1.5 text-center"><Skeleton className="h-2.5 w-10 rounded mx-auto" variant="subtle" /></th>
                    <th className="py-1 sm:py-1.5 text-center"><Skeleton className="h-2.5 w-10 rounded mx-auto" variant="subtle" /></th>
                    <th className="py-1 sm:py-1.5 text-right"><Skeleton className="h-2.5 w-10 rounded ml-auto" variant="subtle" /></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <tr key={i}>
                      <td className="py-2 sm:py-2.5"><Skeleton className="h-3 w-28 rounded" /></td>
                      <td className="py-2 sm:py-2.5 text-center"><Skeleton className="h-3 w-5 rounded mx-auto" /></td>
                      <td className="py-2 sm:py-2.5 text-center"><Skeleton className="h-3 w-5 rounded mx-auto" /></td>
                      <td className="py-2 sm:py-2.5 text-center"><Skeleton className="h-3 w-5 rounded mx-auto" /></td>
                      <td className="py-2 sm:py-2.5 text-center"><Skeleton className="h-3 w-5 rounded mx-auto" /></td>
                      <td className="py-2 sm:py-2.5 text-right"><Skeleton className="h-3 w-6 rounded ml-auto font-bold" /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Card I: Upcoming Exams / Deadlines */}
        <div className="rounded-xl sm:rounded-2xl border border-slate-200/90 bg-white p-3 sm:p-4 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-2.5 sm:pb-3 border-b border-slate-100">
              <div className="flex items-center gap-1.5 sm:gap-2">
                <Skeleton className="h-3.5 w-3.5 sm:h-4 sm:w-4 rounded" variant="subtle" />
                <Skeleton className="h-4 w-44 sm:w-52 rounded font-bold" />
              </div>
              <Skeleton className="h-3 w-14 rounded" variant="subtle" />
            </div>

            <div className="mt-2.5 sm:mt-3 space-y-2 sm:space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex items-center justify-between gap-2 p-1 sm:p-1.5 rounded-xl">
                  <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                    <Skeleton className="h-8 w-8 sm:h-11 sm:w-11 rounded-lg sm:rounded-xl shrink-0" variant="subtle" />
                    <div className="min-w-0 space-y-1">
                      <Skeleton className="h-3.5 w-28 sm:w-36 rounded" />
                      <Skeleton className="h-2.5 w-20 sm:w-24 rounded" variant="subtle" />
                    </div>
                  </div>
                  <Skeleton className="h-5 w-16 rounded-md shrink-0 ml-1" variant="subtle" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
