"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Calendar,
  CheckCircle2,
  FileText,
  Menu,
} from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";
import { isTeachingStaffOnly } from "@/lib/teaching-scope";
import { cn } from "@/lib/cn";

type Props = {
  onMenuClick: () => void;
};

export function MobileBottomNav({ onMenuClick }: Props) {
  const pathname = usePathname();
  const { authorization } = useAuth();
  const teachingStaffOnly = isTeachingStaffOnly(authorization);

  const timetableHref = teachingStaffOnly ? "/my-timetable" : "/timetables";
  const attendanceHref = "/attendance-posting";

  const tabs = [
    {
      label: "Home",
      href: "/dashboard",
      icon: LayoutDashboard,
      isActive: pathname === "/dashboard" || pathname === "/",
    },
    {
      label: "Timetable",
      href: timetableHref,
      icon: Calendar,
      isActive:
        pathname === timetableHref ||
        pathname.startsWith("/my-timetable") ||
        pathname.startsWith("/timetables") ||
        pathname.startsWith("/today-timetable"),
    },
    {
      label: "Attendance",
      href: attendanceHref,
      icon: CheckCircle2,
      isActive:
        pathname === attendanceHref ||
        pathname.startsWith("/attendance-posting") ||
        pathname.startsWith("/attendance-analytics"),
    },
    {
      label: "Requests",
      href: "/requests",
      icon: FileText,
      isActive: pathname === "/requests" || pathname.startsWith("/requests/"),
    },
  ];

  return (
    <nav
      aria-label="Mobile Navigation"
      className="fixed bottom-0 inset-x-0 z-40 lg:hidden print:hidden border-t border-border/80 bg-white/95 backdrop-blur-md shadow-[0_-4px_20px_rgba(0,0,0,0.06)] pb-[max(0.35rem,env(safe-area-inset-bottom))] transition-transform duration-200"
    >
      <div className="grid grid-cols-5 items-center h-14 max-w-lg mx-auto px-1">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                "relative flex flex-col items-center justify-center h-full py-1 text-center transition-colors select-none",
                tab.isActive
                  ? "text-brand-600 font-bold"
                  : "text-slate-500 hover:text-slate-800 font-medium",
              )}
            >
              {tab.isActive && (
                <span className="absolute top-0 inset-x-4 h-0.5 rounded-full bg-brand-600 animate-in fade-in zoom-in-75 duration-150" />
              )}
              <div
                className={cn(
                  "flex items-center justify-center p-1 rounded-full transition-transform",
                  tab.isActive ? "scale-105" : "scale-100",
                )}
              >
                <Icon className={cn("h-4.5 w-4.5 shrink-0", tab.isActive ? "stroke-[2.5]" : "stroke-[1.8]")} />
              </div>
              <span className="text-[10px] leading-tight tracking-tight mt-0.5 truncate max-w-[58px]">
                {tab.label}
              </span>
            </Link>
          );
        })}

        {/* Menu Drawer Toggle Tab */}
        <button
          type="button"
          onClick={onMenuClick}
          aria-label="Open all navigation options"
          className="flex flex-col items-center justify-center h-full py-1 text-center text-slate-500 hover:text-navy-900 transition-colors select-none"
        >
          <div className="flex items-center justify-center p-1 rounded-full">
            <Menu className="h-4.5 w-4.5 shrink-0 stroke-[1.8]" />
          </div>
          <span className="text-[10px] font-medium leading-tight tracking-tight mt-0.5">
            More
          </span>
        </button>
      </div>
    </nav>
  );
}
