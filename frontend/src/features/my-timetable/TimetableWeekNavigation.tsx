"use client";

import { useRef } from "react";
import { ChevronLeft, ChevronRight, Calendar } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { formatWeekRange } from "./utils";

type Props = {
  weekLabel: string;
  onPrevious: () => void;
  onNext: () => void;
  onToday: () => void;
  isCurrentWeek: boolean;
  onDateSelect?: (date: Date) => void;
};

export function TimetableWeekNavigation({
  weekLabel,
  onPrevious,
  onNext,
  onToday,
  isCurrentWeek,
  onDateSelect,
}: Props) {
  const dateInputRef = useRef<HTMLInputElement>(null);

  return (
    <nav
      className="flex items-center justify-between gap-1.5 rounded-lg border border-border bg-card px-2 py-1.5 shadow-sm text-xs sm:px-4 sm:py-2"
      aria-label="Week navigation"
    >
      {/* Prev Week on the Left */}
      <Button
        type="button"
        size="sm"
        variant="secondary"
        onClick={onPrevious}
        aria-label="Previous week"
        className="h-7.5 px-2 text-[11px] sm:h-8 sm:px-3 sm:text-xs shrink-0"
      >
        <ChevronLeft className="h-3.5 w-3.5 shrink-0" aria-hidden />
        <span className="hidden sm:inline">Previous week</span>
        <span className="sm:hidden">Prev</span>
      </Button>

      {/* Middle: The Date with interactive Calendar Picker */}
      <div
        onClick={() => {
          try {
            dateInputRef.current?.showPicker?.();
          } catch {}
        }}
        className="relative inline-flex items-center justify-center cursor-pointer group"
      >
        <button
          type="button"
          className="group flex items-center justify-center gap-1.5 rounded-lg border border-border/80 bg-white px-2.5 py-1 sm:px-3 sm:py-1.5 shadow-2xs group-hover:border-brand-500 group-hover:bg-brand-50/40 active:scale-95 transition-all text-center font-bold text-navy-900 text-xs sm:text-sm pointer-events-none"
          title="Tap to open calendar"
        >
          <span className="truncate">{weekLabel}</span>
          <Calendar className="h-4 w-4 text-emerald-600 shrink-0 group-hover:scale-110 transition-transform" />
        </button>
        <input
          ref={dateInputRef}
          type="date"
          onChange={(e) => {
            const val = e.target.value;
            if (val && onDateSelect) {
              const [y, m, d] = val.split("-").map(Number);
              onDateSelect(new Date(y, m - 1, d));
            }
          }}
          onClick={(e) => {
            try {
              (e.target as HTMLInputElement).showPicker?.();
            } catch {}
          }}
          className="calendar-picker-input absolute inset-0 z-10 h-full w-full opacity-0 cursor-pointer"
          title="Click to open calendar and pick week"
          aria-label="Open calendar"
        />
      </div>

      {/* Next Week on the Right */}
      <div className="flex items-center gap-1 shrink-0">
        <Button
          type="button"
          size="sm"
          variant="secondary"
          onClick={onNext}
          aria-label="Next week"
          className="h-7.5 px-2 text-[11px] sm:h-8 sm:px-3 sm:text-xs shrink-0"
        >
          <span className="hidden sm:inline">Next week</span>
          <span className="sm:hidden">Next</span>
          <ChevronRight className="h-3.5 w-3.5 shrink-0" aria-hidden />
        </Button>

        {/* Desktop Quick Today Jump */}
        <Button
          type="button"
          size="sm"
          variant={isCurrentWeek ? "primary" : "secondary"}
          onClick={onToday}
          disabled={isCurrentWeek}
          aria-label="Go to current week"
          className="hidden sm:inline-flex h-8 px-2.5 text-xs font-semibold"
        >
          Today
        </Button>
      </div>
    </nav>
  );
}

export function formatNavigationWeekLabel(start: Date, end: Date) {
  return formatWeekRange(start, end);
}
