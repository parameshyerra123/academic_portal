"use client";

import { useId, useMemo, useRef, useState, useEffect } from "react";
import {
  CalendarOff,
  Calendar,
  Sun,
  Clock,
  Check,
  X,
  AlertCircle,
  Building,
  GraduationCap,
  GitBranch,
  Layers,
  CheckCircle2,
  Users,
  Search,
  Sparkles,
  ChevronDown,
  Info,
  RotateCcw,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/Button";
import { apiFetch } from "@/lib/api";
import type { AcademicMasters } from "@/components/layout/AcademicProvider";

export type GiveHolidayModalProps = {
  open: boolean;
  onClose: () => void;
  currentDate: string; // YYYY-MM-DD
  academicYear: string;
  availableSlots?: Array<{
    id: number;
    label: string;
    startTime: string;
    endTime: string;
    slotType?: string;
  }>;
  masters: AcademicMasters | null;
  initialScope?: {
    collegeId?: number | "all";
    courseId?: number | "all";
    branchId?: number | "all";
  };
  onHolidayDeclared: () => void;
};

// Fallback standard period slots if none loaded in planner yet
const DEFAULT_PERIOD_SLOTS = [
  { id: 1, label: "Period 1", startTime: "09:00", endTime: "09:50" },
  { id: 2, label: "Period 2", startTime: "09:50", endTime: "10:40" },
  { id: 3, label: "Period 3", startTime: "10:50", endTime: "11:40" },
  { id: 4, label: "Period 4", startTime: "11:40", endTime: "12:30" },
  { id: 5, label: "Period 5", startTime: "01:20", endTime: "02:10" },
  { id: 6, label: "Period 6", startTime: "02:10", endTime: "03:00" },
  { id: 7, label: "Period 7", startTime: "03:00", endTime: "03:50" },
  { id: 8, label: "Period 8", startTime: "03:50", endTime: "04:40" },
];

const SUGGESTED_HOLIDAYS = [
  "Festival Holiday",
  "Annual Sports Day",
  "College Cultural Fest",
  "Special Institute Holiday",
  "Semester Prep Leave",
  "Afternoon Special Holiday",
  "Department Seminar Off",
];

function formatDateDisplay(iso: string): string {
  try {
    const [y, m, d] = iso.split("-").map(Number);
    const date = new Date(y, m - 1, d);
    return date.toLocaleDateString("en-IN", {
      weekday: "long",
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

// ============================================================================
// SLEEK MULTI-SELECT DROPDOWN COMPONENT (Replaces ugly nested scrollable chip boxes)
// ============================================================================
type OptionItem = {
  id: number;
  name: string;
  code?: string | null;
};

type DropdownMultiSelectProps = {
  label: string;
  icon: React.ElementType;
  allLabel: string;
  options: OptionItem[];
  selectedIds: number[];
  onChange: (ids: number[]) => void;
  placeholder?: string;
};

function DropdownMultiSelect({
  label,
  icon: Icon,
  allLabel,
  options,
  selectedIds,
  onChange,
  placeholder = "Search...",
}: DropdownMultiSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  // Close when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleKey);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  const filteredOptions = useMemo(() => {
    if (!query.trim()) return options;
    const q = query.toLowerCase();
    return options.filter(
      (opt) =>
        opt.name.toLowerCase().includes(q) ||
        (opt.code && opt.code.toLowerCase().includes(q)),
    );
  }, [options, query]);

  const isAll = selectedIds.length === 0;

  const toggleOption = (id: number) => {
    if (selectedIds.includes(id)) {
      onChange(selectedIds.filter((x) => x !== id));
    } else {
      onChange([...selectedIds, id]);
    }
  };

  const handleSelectAll = () => {
    onChange([]); // Empty means ALL
  };

  const handleClearAll = () => {
    onChange([]);
  };

  // Selected names for preview
  const selectedItems = useMemo(() => {
    return options.filter((o) => selectedIds.includes(o.id));
  }, [options, selectedIds]);

  return (
    <div ref={containerRef} className="relative">
      <div className="flex items-center justify-between mb-1.5">
        <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
          <Icon className="h-3.5 w-3.5 text-indigo-600" />
          <span>{label}</span>
        </label>
        <span className="text-[11px] font-semibold text-slate-500">
          {isAll
            ? `All (${options.length})`
            : `${selectedIds.length} of ${options.length} selected`}
        </span>
      </div>

      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className={cn(
          "flex min-h-10 w-full items-center justify-between gap-2 rounded-xl border bg-white px-3 py-1.5 text-left text-xs transition-all cursor-pointer shadow-2xs",
          open
            ? "border-amber-500 ring-2 ring-amber-100"
            : "border-slate-200 hover:border-slate-300 hover:bg-slate-50/50",
        )}
      >
        <div className="flex flex-1 flex-wrap items-center gap-1.5 overflow-hidden py-0.5">
          {isAll ? (
            <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-800 border border-emerald-200">
              <Check className="h-3 w-3 text-emerald-600" />
              {allLabel}
            </span>
          ) : (
            <>
              {selectedItems.slice(0, 2).map((item) => (
                <span
                  key={item.id}
                  className="inline-flex items-center gap-1 rounded-md bg-indigo-50 px-2 py-0.5 text-[11px] font-semibold text-indigo-800 border border-indigo-200 max-w-[150px] truncate"
                >
                  <span className="truncate">{item.code || item.name}</span>
                  <span
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleOption(item.id);
                    }}
                    className="hover:text-rose-600 ml-0.5 cursor-pointer font-bold"
                  >
                    ×
                  </span>
                </span>
              ))}
              {selectedItems.length > 2 && (
                <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10.5px] font-bold text-slate-700 border border-slate-200">
                  +{selectedItems.length - 2} more
                </span>
              )}
            </>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0 text-slate-400">
          {!isAll && (
            <span
              onClick={(e) => {
                e.stopPropagation();
                handleClearAll();
              }}
              title="Reset to All"
              className="rounded p-0.5 hover:bg-slate-100 hover:text-slate-600 cursor-pointer"
            >
              <RotateCcw className="h-3 w-3" />
            </span>
          )}
          <ChevronDown
            className={cn("h-4 w-4 transition-transform duration-200", open && "rotate-180")}
          />
        </div>
      </button>

      {/* Popover Menu */}
      {open && (
        <div
          id={listId}
          className="absolute left-0 right-0 top-full z-50 mt-1.5 rounded-xl border border-slate-200 bg-white p-2.5 shadow-xl animate-in fade-in zoom-in-95 duration-150"
        >
          {/* Search & Actions Bar */}
          <div className="space-y-2 mb-2 pb-2 border-b border-slate-100">
            <div className="relative">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={placeholder}
                className="h-8 w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 pl-7 text-xs text-slate-900 outline-none focus:border-amber-500 focus:bg-white"
                autoFocus
              />
              <Search className="absolute left-2 top-2 h-3.5 w-3.5 text-slate-400" />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  className="absolute right-2 top-2 text-slate-400 hover:text-slate-600"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            <div className="flex items-center justify-between text-xs">
              <button
                type="button"
                onClick={handleSelectAll}
                className={cn(
                  "px-2 py-0.5 rounded text-[11px] font-bold cursor-pointer transition-colors",
                  isAll
                    ? "bg-emerald-100 text-emerald-800"
                    : "text-indigo-600 hover:bg-indigo-50",
                )}
              >
                Select All ({allLabel})
              </button>
              {!isAll && (
                <button
                  type="button"
                  onClick={handleClearAll}
                  className="text-[11px] font-semibold text-rose-600 hover:underline cursor-pointer"
                >
                  Reset to All
                </button>
              )}
            </div>
          </div>

          {/* Options List */}
          <div className="max-h-48 overflow-y-auto space-y-0.5 p-0.5">
            {filteredOptions.length === 0 ? (
              <p className="py-3 text-center text-xs text-slate-400">No matching options</p>
            ) : (
              filteredOptions.map((opt) => {
                const isSelected = selectedIds.includes(opt.id);
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => toggleOption(opt.id)}
                    className={cn(
                      "flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-xs transition-colors cursor-pointer",
                      isSelected
                        ? "bg-indigo-50/80 text-indigo-900 font-semibold"
                        : "hover:bg-slate-50 text-slate-700",
                    )}
                  >
                    <div className="flex items-center gap-2 min-w-0 pr-2">
                      <div
                        className={cn(
                          "flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors",
                          isSelected
                            ? "bg-indigo-600 border-indigo-600 text-white"
                            : "border-slate-300 bg-white",
                        )}
                      >
                        {isSelected && <Check className="h-3 w-3 stroke-[3]" />}
                      </div>
                      <span className="truncate">{opt.name}</span>
                    </div>
                    {opt.code && (
                      <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-mono text-slate-600 shrink-0">
                        {opt.code}
                      </span>
                    )}
                  </button>
                );
              })
            )}
          </div>

          {/* Footer Done */}
          <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between">
            <span className="text-[11px] text-slate-500 font-medium">
              {isAll ? "All selected" : `${selectedIds.length} selected`}
            </span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-md bg-slate-900 px-3 py-1 text-xs font-semibold text-white hover:bg-slate-800 cursor-pointer"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// MAIN MODAL COMPONENT
// ============================================================================
export function GiveHolidayModal({
  open,
  onClose,
  currentDate,
  academicYear,
  availableSlots = [],
  masters,
  initialScope,
  onHolidayDeclared,
}: GiveHolidayModalProps) {
  // 1. Basic details
  const [title, setTitle] = useState("");
  const [remarks, setRemarks] = useState("");

  // 2. Session / Slot Selection Mode: "FULL_DAY" vs "SLOTS"
  const [holidayMode, setHolidayMode] = useState<"FULL_DAY" | "SLOTS">("FULL_DAY");

  // Effective slots to display for selection
  const slotsList = useMemo(() => {
    if (availableSlots && availableSlots.length > 0) {
      return availableSlots.filter(
        (s) =>
          s.slotType !== "LUNCH" &&
          s.slotType !== "BREAK" &&
          !s.label?.toLowerCase().includes("break"),
      );
    }
    return DEFAULT_PERIOD_SLOTS;
  }, [availableSlots]);

  // Selected slot IDs in "SLOTS" mode
  const [selectedSlotIds, setSelectedSlotIds] = useState<number[]>(() =>
    slotsList.map((s) => s.id),
  );

  // 3. Audience Selection State
  // College multi-select: empty array means ALL colleges
  const [selectedCollegeIds, setSelectedCollegeIds] = useState<number[]>(() => {
    if (initialScope?.collegeId && initialScope.collegeId !== "all") {
      return [Number(initialScope.collegeId)];
    }
    return []; // empty = All
  });

  // Filtered courses based on selected colleges
  const relevantCourses = useMemo(() => {
    const courses = masters?.courses ?? [];
    if (selectedCollegeIds.length === 0) return courses;
    return courses.filter((c) => selectedCollegeIds.includes(c.collegeId));
  }, [masters, selectedCollegeIds]);

  const [selectedCourseIds, setSelectedCourseIds] = useState<number[]>(() => {
    if (initialScope?.courseId && initialScope.courseId !== "all") {
      return [Number(initialScope.courseId)];
    }
    return []; // empty = All
  });

  // Filtered branches based on selected courses
  const relevantBranches = useMemo(() => {
    const branches = masters?.branches ?? [];
    if (selectedCourseIds.length === 0) {
      if (selectedCollegeIds.length === 0) return branches;
      const validCourseIds = new Set(relevantCourses.map((c) => c.id));
      return branches.filter((b) => validCourseIds.has(b.courseId));
    }
    return branches.filter((b) => selectedCourseIds.includes(b.courseId));
  }, [masters, selectedCourseIds, selectedCollegeIds, relevantCourses]);

  const [selectedBranchIds, setSelectedBranchIds] = useState<number[]>(() => {
    if (initialScope?.branchId && initialScope.branchId !== "all") {
      return [Number(initialScope.branchId)];
    }
    return []; // empty = All
  });

  // Years multi-select: [1, 2, 3, 4] (empty = All)
  const availableYears = useMemo(() => {
    if (masters?.yearOptions && masters.yearOptions.length > 0) {
      return masters.yearOptions;
    }
    return [1, 2, 3, 4];
  }, [masters]);
  const [selectedYears, setSelectedYears] = useState<number[]>([]); // empty = All

  // Semesters multi-select: [1, 2, 3, 4, 5, 6, 7, 8] (empty = All)
  const availableSemesters = useMemo(() => {
    if (masters?.semesterOptions && masters.semesterOptions.length > 0) {
      return masters.semesterOptions;
    }
    return [1, 2, 3, 4, 5, 6, 7, 8];
  }, [masters]);
  const [selectedSemesters, setSelectedSemesters] = useState<number[]>([]); // empty = All

  // Sections multi-select: e.g. ["A", "B", "C", "D"] (empty = All)
  const availableSections = useMemo(() => {
    const secSet = new Set<string>();
    (masters?.sections ?? []).forEach((s) => {
      if (s.name) secSet.add(s.name.trim().toUpperCase());
    });
    if (secSet.size === 0) {
      return ["A", "B", "C", "D"];
    }
    return Array.from(secSet).sort();
  }, [masters]);
  const [selectedSections, setSelectedSections] = useState<string[]>([]); // empty = All

  // Submission & loading state
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  if (!open) return null;

  // Slot selector helper functions
  const handleToggleSlot = (id: number) => {
    setSelectedSlotIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const handleSelectAllSlots = () => {
    setSelectedSlotIds(slotsList.map((s) => s.id));
  };

  const handleClearSlots = () => {
    setSelectedSlotIds([]);
  };

  const handleSelectMorningSlots = () => {
    const morning = slotsList.slice(0, Math.ceil(slotsList.length / 2));
    setSelectedSlotIds(morning.map((s) => s.id));
  };

  const handleSelectAfternoonSlots = () => {
    const afternoon = slotsList.slice(Math.ceil(slotsList.length / 2));
    setSelectedSlotIds(afternoon.map((s) => s.id));
  };

  const toggleYear = (y: number) => {
    setSelectedYears((prev) =>
      prev.includes(y) ? prev.filter((x) => x !== y) : [...prev, y],
    );
  };

  const toggleSemester = (s: number) => {
    setSelectedSemesters((prev) =>
      prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s],
    );
  };

  const toggleSection = (sec: string) => {
    setSelectedSections((prev) =>
      prev.includes(sec) ? prev.filter((x) => x !== sec) : [...prev, sec],
    );
  };

  // Form submission handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError("Please enter a holiday title or choose from suggested options.");
      return;
    }

    if (holidayMode === "SLOTS" && selectedSlotIds.length === 0) {
      setError("Please select at least one period/slot for the holiday.");
      return;
    }

    setSubmitting(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const payload = {
        date: currentDate,
        academicYear,
        title: title.trim(),
        remarks: remarks.trim() || `Holiday: ${title.trim()}`,
        holidayMode,
        slotIds: holidayMode === "SLOTS" ? selectedSlotIds : slotsList.map((s) => s.id),
        collegeIds: selectedCollegeIds,
        courseIds: selectedCourseIds,
        branchIds: selectedBranchIds,
        years: selectedYears,
        semesters: selectedSemesters,
        sections: selectedSections,
      };

      const res = await apiFetch("/today-timetable/holiday", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.message || `Failed to declare holiday (${res.status})`);
      }

      const json = await res.json();
      setSuccessMsg(
        `Holiday "${title.trim()}" successfully declared for ${json.affectedPlansCount || "all"} timetable cohorts!`,
      );

      // Trigger timetable refresh and close modal after brief delay
      setTimeout(() => {
        onHolidayDeclared();
        onClose();
      }, 1000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to declare holiday");
    } finally {
      setSubmitting(false);
    }
  };

  // Audience Summary Label helper
  const audienceSummary = useMemo(() => {
    const parts: string[] = [];

    if (selectedCollegeIds.length === 0) {
      parts.push("All Colleges");
    } else {
      parts.push(
        `${selectedCollegeIds.length} College${selectedCollegeIds.length > 1 ? "s" : ""}`,
      );
    }

    if (selectedCourseIds.length === 0) {
      parts.push("All Courses");
    } else {
      parts.push(
        `${selectedCourseIds.length} Course${selectedCourseIds.length > 1 ? "s" : ""}`,
      );
    }

    if (selectedBranchIds.length === 0) {
      parts.push("All Branches");
    } else {
      parts.push(
        `${selectedBranchIds.length} Branch${selectedBranchIds.length > 1 ? "es" : ""}`,
      );
    }

    if (selectedYears.length === 0) {
      parts.push("All Years");
    } else {
      parts.push(`Year ${selectedYears.join(", ")}`);
    }

    if (selectedSemesters.length === 0) {
      parts.push("All Semesters");
    } else {
      parts.push(`Sem ${selectedSemesters.join(", ")}`);
    }

    if (selectedSections.length === 0) {
      parts.push("All Sections");
    } else {
      parts.push(`Sec ${selectedSections.join(", ")}`);
    }

    return parts.join(" · ");
  }, [
    selectedCollegeIds,
    selectedCourseIds,
    selectedBranchIds,
    selectedYears,
    selectedSemesters,
    selectedSections,
  ]);

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-900/60 p-3 sm:p-4 backdrop-blur-sm animate-in fade-in duration-150 overflow-y-auto">
      <div className="relative my-auto flex max-h-[92vh] w-full max-w-5xl xl:max-w-6xl flex-col rounded-2xl border border-slate-200 bg-white shadow-2xl overflow-hidden">
        {/* Sleek Header */}
        <div className="flex items-center justify-between border-b border-slate-100 bg-gradient-to-r from-amber-500/10 via-orange-500/5 to-transparent px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-md">
              <CalendarOff className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h2 className="text-lg font-bold text-slate-900">
                  Give Holiday · Today Timetable
                </h2>
                <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-bold text-amber-900 border border-amber-200 shadow-2xs">
                  {formatDateDisplay(currentDate)}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1.5">
                <span>Declare a full day or period-specific holiday for today&apos;s schedule.</span>
                <span className="text-slate-300">•</span>
                <span className="text-amber-700 font-medium">Master Timetable benchmark stays intact</span>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex flex-1 flex-col overflow-hidden">
          {/* Scrollable Body Content */}
          <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4">
            {/* SIDE-BY-SIDE BALANCED 2-COLUMN GRID */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
              {/* ======================================================== */}
              {/* LEFT COLUMN: Holiday Occasion & Session / Slot Timing     */}
              {/* ======================================================== */}
              <div className="space-y-4">
                {/* 1. Holiday Title & Suggestions Card */}
                <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                      <Calendar className="h-3.5 w-3.5 text-amber-600" />
                      <span>Holiday Title / Occasion</span>
                    </label>
                    <span className="text-[11px] font-semibold text-rose-500">Required</span>
                  </div>

                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. Annual Sports Day, Festival Leave..."
                    className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200 transition-all font-medium placeholder:text-slate-400"
                    required
                  />

                  {/* Quick suggested chips */}
                  <div>
                    <span className="text-[11px] font-semibold text-slate-500 block mb-1.5">
                      Quick Suggestions:
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {SUGGESTED_HOLIDAYS.map((sug) => (
                        <button
                          key={sug}
                          type="button"
                          onClick={() => setTitle(sug)}
                          className={cn(
                            "rounded-lg px-2.5 py-1 text-xs font-medium transition-all border cursor-pointer",
                            title === sug
                              ? "bg-amber-100 text-amber-900 border-amber-300 font-bold shadow-2xs"
                              : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100 hover:text-slate-900",
                          )}
                        >
                          {sug}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Optional Remarks */}
                  <div className="pt-1">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-600 block mb-1">
                      Remarks / Instructions (Optional)
                    </label>
                    <textarea
                      value={remarks}
                      onChange={(e) => setRemarks(e.target.value)}
                      placeholder="Optional notes for faculty & students..."
                      rows={2}
                      className="w-full rounded-lg border border-slate-300 bg-white p-2.5 text-xs text-slate-800 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200 placeholder:text-slate-400"
                    />
                  </div>
                </div>

                {/* 2. Complete Session vs Slots Selection Card */}
                <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5 text-indigo-600" />
                      <span>Session or Slot Selection</span>
                    </label>
                    <span className="rounded bg-indigo-50 px-2 py-0.5 text-[11px] font-bold text-indigo-700 border border-indigo-200">
                      {holidayMode === "FULL_DAY" ? "Full Day" : "Slot Specific"}
                    </span>
                  </div>

                  {/* Mode Toggle Cards */}
                  <div className="grid grid-cols-2 gap-2.5">
                    <button
                      type="button"
                      onClick={() => setHolidayMode("FULL_DAY")}
                      className={cn(
                        "flex items-center gap-2.5 rounded-xl border-2 p-3 text-left transition-all cursor-pointer",
                        holidayMode === "FULL_DAY"
                          ? "border-amber-500 bg-amber-50/70 shadow-2xs ring-2 ring-amber-200"
                          : "border-slate-200 bg-slate-50/50 hover:border-slate-300",
                      )}
                    >
                      <div
                        className={cn(
                          "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg font-bold",
                          holidayMode === "FULL_DAY"
                            ? "bg-amber-500 text-white"
                            : "bg-slate-200 text-slate-600",
                        )}
                      >
                        <Sun className="h-4 w-4" />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-slate-900">
                          Complete Day
                        </h4>
                        <p className="text-[10px] text-slate-500">
                          All periods for today
                        </p>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setHolidayMode("SLOTS")}
                      className={cn(
                        "flex items-center gap-2.5 rounded-xl border-2 p-3 text-left transition-all cursor-pointer",
                        holidayMode === "SLOTS"
                          ? "border-amber-500 bg-amber-50/70 shadow-2xs ring-2 ring-amber-200"
                          : "border-slate-200 bg-slate-50/50 hover:border-slate-300",
                      )}
                    >
                      <div
                        className={cn(
                          "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg font-bold",
                          holidayMode === "SLOTS"
                            ? "bg-amber-500 text-white"
                            : "bg-slate-200 text-slate-600",
                        )}
                      >
                        <Layers className="h-4 w-4" />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-slate-900">
                          Specific Slots
                        </h4>
                        <p className="text-[10px] text-slate-500">
                          Selected periods only
                        </p>
                      </div>
                    </button>
                  </div>

                  {/* If SLOTS Mode: Show clean interactive slot selector */}
                  {holidayMode === "SLOTS" && (
                    <div className="rounded-xl border border-indigo-100 bg-indigo-50/30 p-3 space-y-2.5 animate-in fade-in duration-150">
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-indigo-100/70 pb-2">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold text-slate-800">
                            Select Periods:
                          </span>
                          <span className="rounded-full bg-amber-100 px-2 py-0.2 text-[10px] font-bold text-amber-800 border border-amber-200">
                            {selectedSlotIds.length} of {slotsList.length}
                          </span>
                        </div>

                        <div className="flex flex-wrap items-center gap-1 text-xs">
                          <button
                            type="button"
                            onClick={handleSelectAllSlots}
                            className="rounded-md bg-white border border-slate-200 px-2 py-0.5 text-[10.5px] font-semibold text-slate-700 hover:bg-slate-100 cursor-pointer"
                          >
                            All
                          </button>
                          <button
                            type="button"
                            onClick={handleSelectMorningSlots}
                            className="rounded-md bg-white border border-slate-200 px-2 py-0.5 text-[10.5px] font-semibold text-slate-700 hover:bg-slate-100 cursor-pointer"
                          >
                            Morning
                          </button>
                          <button
                            type="button"
                            onClick={handleSelectAfternoonSlots}
                            className="rounded-md bg-white border border-slate-200 px-2 py-0.5 text-[10.5px] font-semibold text-slate-700 hover:bg-slate-100 cursor-pointer"
                          >
                            Afternoon
                          </button>
                          <button
                            type="button"
                            onClick={handleClearSlots}
                            className="rounded-md bg-white border border-slate-200 px-2 py-0.5 text-[10.5px] font-semibold text-rose-600 hover:bg-rose-50 cursor-pointer"
                          >
                            Clear
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                        {slotsList.map((slot) => {
                          const isSelected = selectedSlotIds.includes(slot.id);
                          return (
                            <button
                              key={slot.id}
                              type="button"
                              onClick={() => handleToggleSlot(slot.id)}
                              className={cn(
                                "flex flex-col items-start rounded-lg border p-2 text-left transition-all cursor-pointer",
                                isSelected
                                  ? "border-amber-400 bg-amber-50 shadow-xs ring-1 ring-amber-300"
                                  : "border-slate-200 bg-white hover:border-slate-300",
                              )}
                            >
                              <div className="flex w-full items-center justify-between">
                                <span className="text-[11px] font-bold text-slate-900">
                                  {slot.label}
                                </span>
                                <span
                                  className={cn(
                                    "flex h-3.5 w-3.5 items-center justify-center rounded",
                                    isSelected
                                      ? "bg-amber-500 text-white"
                                      : "border border-slate-300 bg-white",
                                  )}
                                >
                                  {isSelected && <Check className="h-2.5 w-2.5 stroke-[3]" />}
                                </span>
                              </div>
                              <span className="text-[9.5px] font-medium text-slate-500 mt-0.5">
                                {slot.startTime}–{slot.endTime}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* ======================================================== */}
              {/* RIGHT COLUMN: Target Audience Selection (Clean & No Mess)*/}
              {/* ======================================================== */}
              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs space-y-4">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                      <Users className="h-4 w-4 text-indigo-600" />
                      <span>Select Target Audience</span>
                    </h3>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Target specific institutions or cohorts (defaults to everyone)
                    </p>
                  </div>

                  {/* Reset All Filters button */}
                  {(selectedCollegeIds.length > 0 ||
                    selectedCourseIds.length > 0 ||
                    selectedBranchIds.length > 0 ||
                    selectedYears.length > 0 ||
                    selectedSemesters.length > 0 ||
                    selectedSections.length > 0) && (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedCollegeIds([]);
                        setSelectedCourseIds([]);
                        setSelectedBranchIds([]);
                        setSelectedYears([]);
                        setSelectedSemesters([]);
                        setSelectedSections([]);
                      }}
                      className="text-[11px] font-bold text-rose-600 hover:text-rose-700 hover:underline cursor-pointer flex items-center gap-1"
                    >
                      <RotateCcw className="h-3 w-3" />
                      Reset to All
                    </button>
                  )}
                </div>

                {/* 1. College Dropdown MultiSelect */}
                <DropdownMultiSelect
                  label="Colleges"
                  icon={Building}
                  allLabel="All Colleges"
                  options={masters?.colleges ?? []}
                  selectedIds={selectedCollegeIds}
                  onChange={(ids) => setSelectedCollegeIds(ids)}
                  placeholder="Search colleges..."
                />

                {/* 2. Course Dropdown MultiSelect */}
                <DropdownMultiSelect
                  label="Courses"
                  icon={GraduationCap}
                  allLabel="All Courses"
                  options={relevantCourses}
                  selectedIds={selectedCourseIds}
                  onChange={(ids) => setSelectedCourseIds(ids)}
                  placeholder="Search courses..."
                />

                {/* 3. Branch Dropdown MultiSelect */}
                <DropdownMultiSelect
                  label="Branches"
                  icon={GitBranch}
                  allLabel="All Branches"
                  options={relevantBranches}
                  selectedIds={selectedBranchIds}
                  onChange={(ids) => setSelectedBranchIds(ids)}
                  placeholder="Search branches..."
                />

                {/* 4. Cohort Matrix: Years, Semesters & Sections Alongside */}
                <div className="space-y-3 pt-2 border-t border-slate-100">
                  {/* Years Row */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-700">
                        Years
                      </span>
                      <span className="text-[10px] text-slate-500">
                        {selectedYears.length === 0 ? "All Years" : `${selectedYears.length} Selected`}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      <button
                        type="button"
                        onClick={() => setSelectedYears([])}
                        className={cn(
                          "rounded-lg px-2.5 py-1 text-xs font-bold border transition-all cursor-pointer",
                          selectedYears.length === 0
                            ? "bg-slate-900 text-white border-slate-900 shadow-2xs"
                            : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100",
                        )}
                      >
                        All
                      </button>
                      {availableYears.map((yr) => {
                        const isSelected = selectedYears.includes(yr);
                        return (
                          <button
                            key={yr}
                            type="button"
                            onClick={() => toggleYear(yr)}
                            className={cn(
                              "rounded-lg px-2.5 py-1 text-xs font-bold border transition-all cursor-pointer",
                              isSelected
                                ? "bg-indigo-600 text-white border-indigo-600 shadow-2xs"
                                : "bg-white text-slate-700 border-slate-200 hover:bg-indigo-50/50",
                            )}
                          >
                            Year {yr}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Semesters Row */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-700">
                        Semesters
                      </span>
                      <span className="text-[10px] text-slate-500">
                        {selectedSemesters.length === 0 ? "All Semesters" : `${selectedSemesters.length} Selected`}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      <button
                        type="button"
                        onClick={() => setSelectedSemesters([])}
                        className={cn(
                          "rounded-lg px-2 py-1 text-xs font-bold border transition-all cursor-pointer",
                          selectedSemesters.length === 0
                            ? "bg-slate-900 text-white border-slate-900 shadow-2xs"
                            : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100",
                        )}
                      >
                        All
                      </button>
                      {availableSemesters.map((sem) => {
                        const isSelected = selectedSemesters.includes(sem);
                        return (
                          <button
                            key={sem}
                            type="button"
                            onClick={() => toggleSemester(sem)}
                            className={cn(
                              "rounded-lg px-2 py-1 text-xs font-bold border transition-all cursor-pointer",
                              isSelected
                                ? "bg-indigo-600 text-white border-indigo-600 shadow-2xs"
                                : "bg-white text-slate-700 border-slate-200 hover:bg-indigo-50/50",
                            )}
                          >
                            S{sem}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Sections Row */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-700">
                        Sections
                      </span>
                      <span className="text-[10px] text-slate-500">
                        {selectedSections.length === 0 ? "All Sections" : `${selectedSections.length} Selected`}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      <button
                        type="button"
                        onClick={() => setSelectedSections([])}
                        className={cn(
                          "rounded-lg px-2.5 py-1 text-xs font-bold border transition-all cursor-pointer",
                          selectedSections.length === 0
                            ? "bg-slate-900 text-white border-slate-900 shadow-2xs"
                            : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100",
                        )}
                      >
                        All
                      </button>
                      {availableSections.map((sec) => {
                        const isSelected = selectedSections.includes(sec);
                        return (
                          <button
                            key={sec}
                            type="button"
                            onClick={() => toggleSection(sec)}
                            className={cn(
                              "rounded-lg px-2.5 py-1 text-xs font-bold border transition-all cursor-pointer",
                              isSelected
                                ? "bg-indigo-600 text-white border-indigo-600 shadow-2xs"
                                : "bg-white text-slate-700 border-slate-200 hover:bg-indigo-50/50",
                            )}
                          >
                            Sec {sec}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Audience Summary Banner */}
                <div className="rounded-lg bg-indigo-50/70 border border-indigo-100 p-2.5 flex items-start gap-2">
                  <Info className="h-4 w-4 text-indigo-600 shrink-0 mt-0.5" />
                  <div className="text-[11px] leading-relaxed text-indigo-950">
                    <span className="font-semibold text-indigo-900">Impacted Audience: </span>
                    <span className="font-medium text-indigo-800">{audienceSummary}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Error Message if any */}
            {error && (
              <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800 flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Success Message if any */}
            {successMsg && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800 flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                <span>{successMsg}</span>
              </div>
            )}
          </div>

          {/* Sticky Footer Action Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 bg-slate-50/90 px-6 py-3.5">
            <div className="text-xs text-slate-500 font-medium flex items-center gap-1.5">
              <span className="inline-block h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
              <span>Target: <strong className="text-slate-800">{audienceSummary}</strong></span>
            </div>

            <div className="flex items-center gap-2.5 ml-auto">
              <Button
                type="button"
                variant="secondary"
                onClick={onClose}
                disabled={submitting}
                className="rounded-xl px-4 py-2 text-sm font-semibold text-slate-600 cursor-pointer"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={submitting || !title.trim()}
                className="rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 px-6 py-2.5 text-sm font-bold text-white shadow-md hover:from-amber-600 hover:to-orange-700 transition-all cursor-pointer"
              >
                {submitting ? (
                  <span>Declaring Holiday...</span>
                ) : (
                  <span className="flex items-center gap-2">
                    <CalendarOff className="h-4 w-4" />
                    <span>Confirm &amp; Give Holiday</span>
                  </span>
                )}
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
