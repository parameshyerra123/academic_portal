"use client";

import { Bell, Menu, Calendar, ChevronDown } from "lucide-react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { breadcrumbsForPath } from "@/lib/navigation";
import { useAuth } from "@/components/auth/AuthProvider";
import { isTeachingStaffOnly } from "@/lib/teaching-scope";
import { useAcademicContext } from "@/components/layout/AcademicProvider";
import { useLoading } from "@/context/LoadingContext";
import { FacultyAvatar } from "@/components/ui/FacultyAvatar";
import { cn } from "@/lib/cn";

type Props = {
  onMenuClick: () => void;
};

export function TopHeader({ onMenuClick }: Props) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { user, authorization } = useAuth();
  const { filters, setFilters, masters } = useAcademicContext();
  const { activeCount } = useLoading();
  const teachingStaffOnly = isTeachingStaffOnly(authorization);
  const breadcrumbs = breadcrumbsForPath(pathname, searchParams);
  const currentTitle = breadcrumbs.length > 0 ? breadcrumbs[breadcrumbs.length - 1].label : "Staff Portal";

  const isDashboard = pathname === "/dashboard" || pathname.startsWith("/dashboard/");
  const showDateAndScopeControls = isDashboard || teachingStaffOnly;
  const currentAY =
    filters.academicYear ||
    masters?.defaults?.academicYear ||
    masters?.academicYears?.find((y) => y.isActive)?.label ||
    "AY 2024-25";

  return (
    <header className="sticky top-0 z-20 shrink-0 border-b border-border/80 bg-white/95 backdrop-blur-md shadow-2xs">
      <div className="flex flex-wrap items-center justify-between gap-2 sm:gap-3 px-3 py-2 sm:px-6 sm:py-2.5">
        <div className="flex min-w-0 items-center gap-2 sm:gap-2.5">
          <button
            type="button"
            className="rounded-lg bg-slate-100 p-1.5 sm:p-2 text-slate-700 hover:bg-slate-200 lg:hidden active:scale-95 transition-transform"
            onClick={onMenuClick}
            aria-label="Open navigation"
          >
            <Menu className="h-4 w-4" />
          </button>

          {/* Mobile Title View with increased text size */}
          <div className="flex sm:hidden items-center gap-1.5 min-w-0">
            <span className="truncate text-sm sm:text-base font-bold text-navy-900 tracking-tight">
              {currentTitle}
            </span>
            {teachingStaffOnly && (
              <span className="shrink-0 rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-bold text-brand-700 border border-brand-200">
                Staff
              </span>
            )}
          </div>

          {/* Desktop Breadcrumbs View with increased text size */}
          <div className="hidden sm:flex items-center gap-1.5 truncate text-[14.5px] lg:text-[15.5px] font-medium text-slate-600">
            <Link href="/dashboard" className="hover:text-navy-900 transition-colors">
              Academic Portal
            </Link>
            {breadcrumbs.map((segment, index) => {
              const isLast = index === breadcrumbs.length - 1;
              return (
                <span key={`${segment.label}-${index}`} className="flex items-center gap-1.5 truncate">
                  <span className="text-slate-300 font-normal select-none">/</span>
                  {segment.href && !isLast ? (
                    <Link href={segment.href} className="hover:text-navy-900 transition-colors">
                      {segment.label}
                    </Link>
                  ) : (
                    <span className={cn("truncate", isLast ? "font-bold text-navy-900" : "font-medium text-slate-700")}>
                      {segment.label}
                    </span>
                  )}
                </span>
              );
            })}
          </div>
        </div>

        {/* Date, Academic Year, and Semester Controls in Top Header */}
        {showDateAndScopeControls && (
          <div className="order-last sm:order-none w-full sm:w-auto flex items-center justify-between sm:justify-start gap-1 sm:gap-2 pt-1 sm:pt-0 border-t sm:border-t-0 border-slate-100">
            {/* Interactive Date Picker */}
            <div className="flex items-center gap-1 px-1.5 sm:px-2.5 py-0.5 sm:py-1 rounded-lg border border-slate-200 bg-slate-50 text-[10.5px] sm:text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-100 transition-colors h-7 sm:h-8">
              <Calendar className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-slate-500 shrink-0" />
              <input
                type="date"
                value={filters.date}
                onChange={(e) => setFilters({ date: e.target.value })}
                className="bg-transparent text-[10.5px] sm:text-xs font-semibold text-slate-700 outline-none cursor-pointer w-[92px] sm:w-[115px]"
                title="Select Date"
              />
            </div>

            {/* Academic Year Dropdown */}
            <div className="relative">
              <select
                value={currentAY}
                onChange={(e) => setFilters({ academicYear: e.target.value })}
                className="appearance-none h-7 sm:h-8 rounded-lg border border-slate-200 bg-slate-50 pl-2 pr-5 text-[10.5px] sm:text-xs font-semibold text-slate-700 outline-none hover:bg-slate-100 transition-colors cursor-pointer max-w-[100px] sm:max-w-none truncate"
                title="Academic Year"
              >
                {(masters?.academicYears ?? []).length > 0 ? (
                  masters?.academicYears.map((y) => (
                    <option key={y.id} value={y.label}>
                      {y.label}
                    </option>
                  ))
                ) : (
                  <option value={currentAY}>{currentAY}</option>
                )}
              </select>
              <ChevronDown className="absolute right-1 top-2 h-3 w-3 text-slate-400 pointer-events-none" />
            </div>

            {/* Semester Dropdown */}
            <div className="relative">
              <select
                value={filters.semester === 2 ? 2 : 1}
                onChange={(e) => setFilters({ semester: Number(e.target.value) })}
                className="appearance-none h-7 sm:h-8 rounded-lg border border-slate-200 bg-slate-50 pl-2 pr-5 text-[10.5px] sm:text-xs font-semibold text-slate-700 outline-none hover:bg-slate-100 transition-colors cursor-pointer"
                title="Semester"
              >
                <option value={1}>Sem I</option>
                <option value={2}>Sem II</option>
              </select>
              <ChevronDown className="absolute right-1 top-2 h-3 w-3 text-slate-400 pointer-events-none" />
            </div>
          </div>
        )}

        <div className="flex items-center gap-2 sm:gap-3 ml-auto sm:ml-0">
          {activeCount > 0 && (
            <div
              role="status"
              aria-label="Synchronizing academic data"
              className="flex items-center gap-1.5 rounded-full border border-blue-200/90 bg-blue-50/90 px-2 sm:px-2.5 py-0.5 text-[11px] font-semibold text-blue-900 shadow-2xs"
            >
              <span className="h-2 w-2 rounded-full border-[1.5px] border-blue-700 border-t-transparent animate-spin shrink-0" />
              <span className="hidden sm:inline">Updating…</span>
            </div>
          )}

          <Link
            href="/alerts"
            aria-label="Alerts"
            className="relative rounded-lg border border-border p-2 text-slate-600 hover:bg-slate-50 active:scale-95 transition-transform"
            title="Alerts"
          >
            <Bell className="h-4 w-4" />
          </Link>

          {/* User Profile Mini Badge rendering HRMS Photo */}
          {user?.name && (
            <FacultyAvatar
              name={user.name}
              photo={user.profilePhoto}
              hrmsEmployeeId={user.hrmsEmployeeId}
              size="sm"
              className="cursor-default"
            />
          )}
        </div>
      </div>
    </header>
  );
}
