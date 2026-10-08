"use client";

import { Bell, Menu, Sparkles } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { breadcrumbsForPath } from "@/lib/navigation";
import { useAuth } from "@/components/auth/AuthProvider";
import { isTeachingStaffOnly } from "@/lib/teaching-scope";

type Props = {
  onMenuClick: () => void;
};

export function TopHeader({ onMenuClick }: Props) {
  const pathname = usePathname();
  const { user, authorization } = useAuth();
  const teachingStaffOnly = isTeachingStaffOnly(authorization);
  const breadcrumbs = breadcrumbsForPath(pathname);
  const currentTitle = breadcrumbs.length > 0 ? breadcrumbs[breadcrumbs.length - 1].label : "Staff Portal";

  return (
    <header className="sticky top-0 z-20 shrink-0 border-b border-border/80 bg-white/95 backdrop-blur-md shadow-2xs">
      <div className="flex items-center justify-between gap-3 px-3 py-2 sm:px-5 sm:py-2.5">
        <div className="flex min-w-0 items-center gap-2">
          <button
            type="button"
            className="rounded-lg bg-slate-100 p-2 text-slate-700 hover:bg-slate-200 lg:hidden active:scale-95 transition-transform"
            onClick={onMenuClick}
            aria-label="Open navigation"
          >
            <Menu className="h-4 w-4" />
          </button>

          {/* Mobile Title View */}
          <div className="flex sm:hidden items-center gap-1.5 min-w-0">
            <span className="truncate text-xs font-bold text-navy-900 tracking-tight">
              {currentTitle}
            </span>
            {teachingStaffOnly && (
              <span className="shrink-0 rounded-full bg-brand-50 px-1.5 py-0.2 text-[9.5px] font-bold text-brand-700 border border-brand-200">
                Staff
              </span>
            )}
          </div>

          {/* Desktop Breadcrumbs View */}
          <p className="hidden sm:block truncate text-sm text-slate-500">
            <Link href="/dashboard" className="hover:text-slate-700">
              Academic Portal
            </Link>
            {breadcrumbs.map((segment, index) => (
              <span key={`${segment.label}-${index}`}>
                <span className="text-slate-300"> / </span>
                {segment.href ? (
                  <Link href={segment.href} className="font-medium text-slate-700 hover:text-navy-900">
                    {segment.label}
                  </Link>
                ) : (
                  <span className="font-medium text-slate-700">{segment.label}</span>
                )}
              </span>
            ))}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {teachingStaffOnly && (
            <div className="hidden md:flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50/70 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-800">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span>Teaching Portal Live</span>
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

          {/* User Profile Mini Badge */}
          {user?.name && (
            <div
              className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-600 text-xs font-bold text-white shadow-2xs select-none"
              title={user.name}
            >
              {user.name.charAt(0).toUpperCase()}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
