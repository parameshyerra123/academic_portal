"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Edit2,
  X,
  AlertCircle,
  History,
  Clock,
  Check,
  RotateCcw,
  ArrowRight,
  Search,
  Info,
  ShieldCheck,
  Shield,
  Lock,
  Users,
  BookOpen,
  CheckCircle,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { useAcademicContext } from "@/components/layout/AcademicProvider";
import { AcademicFilterBar } from "@/components/layout/AcademicFilterBar";
import { useAuth } from "@/components/auth/AuthProvider";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { LoadingAnimation } from "@/components/ui/LoadingAnimation";
import {
  isNonClassTimingSlot,
  timingSlotDisplayLabel,
  timingSlotCellClass,
} from "@/features/timetables/timing-slot-utils";

type SlotCellEntry = {
  id: number;
  subjectId: number | null;
  subjectCode: string | null;
  subjectName: string | null;
  entryType: string;
  facultyStaffLinkId: number | null;
  facultyName: string | null;
  facultyHrmsId: string | null;
  roomLabel: string | null;
  batchLabel?: string | null;
  customLabel?: string | null;
};

type SlotCell = {
  slotId: number;
  slotType: string;
  assignable: boolean;
  label: string;
  startTime: string;
  endTime: string;
  entry: null | SlotCellEntry;
  entries?: SlotCellEntry[];
};

type PlannerResponse = {
  ready: boolean;
  missingTiming?: boolean;
  message?: string;
  context: {
    academicYear: string;
    college: string;
    collegeId?: number;
    course: string;
    courseId?: number;
    branch: string;
    branchId?: number;
    batch: string;
    year: number | null;
    semester: number | null;
    section: string;
    hasSections: boolean;
    studentCount: number;
    status: string | null;
    timingTemplateName: string | null;
    planId: number | null;
    versionNo: number | null;
  };
  days: string[];
  slotsByDay: Record<
    string,
    Array<{
      id: number;
      label: string;
      startTime: string;
      endTime: string;
      slotType: string;
      isAssignable: boolean;
      isActive?: boolean;
    }>
  >;
  grid: Record<string, Record<number, SlotCell>>;
  subjects: Array<{ id: number; code: string; name: string; type: string }>;
  faculty: Array<{
    hrmsEmployeeId: string;
    name: string;
    division: string;
    department: string;
    designation: string;
  }>;
};

type PeriodOverride = {
  slotId: number;
  slotLabel?: string;
  slotTime?: string;
  subjectId: string;
  subjectCode: string;
  subjectName: string;
  hrmsEmployeeId: string;
  facultyName: string;
  remarks?: string | null;
  changedByName?: string | null;
  changedAt?: string;
};

export type AllBatchesCohort = {
  batch: string;
  year: number;
  semester: number;
  section: string | null;
  yearSemLabel: string;
  batchLabel: string;
  planner: PlannerResponse;
  overrides: Record<number, PeriodOverride>;
  datesWithActivity: string[];
};

export type ActivityItem = {
  id: number | string;
  timetableDate: string;
  timingSlotId: number;
  slotLabel: string;
  slotTime: string;
  masterSubjectCode: string | null;
  masterSubjectName: string | null;
  masterFacultyName: string | null;
  newSubjectCode: string | null;
  newSubjectName: string | null;
  newFacultyName: string | null;
  changeType: "PERIOD_CHANGE" | "REVERTED_TO_MASTER";
  remarks: string | null;
  changedByName: string | null;
  createdAt: string;
};

const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

function toYMD(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function fromYMD(str: string): Date {
  const [y, m, d] = str.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function formatDate(date: Date): string {
  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatTimeOnly(isoStr: string): string {
  try {
    const d = new Date(isoStr);
    return d.toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  } catch {
    return "";
  }
}

/**
 * Calendar Widget:
 * - Past days: clickable (View Only)
 * - Today: clickable (Editable)
 * - Future days: clickable (Editable)
 */
function CalendarWidget({
  value,
  datesWithActivity,
  onSelect,
}: {
  value: string;
  datesWithActivity: string[];
  onSelect: (ymd: string) => void;
}) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const selected = fromYMD(value);
  const [viewYear, setViewYear] = useState(selected.getFullYear());
  const [viewMonth, setViewMonth] = useState(selected.getMonth());

  const firstDay = new Date(viewYear, viewMonth, 1);
  const startOffset = firstDay.getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array(startOffset).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  const prevMonth = () => {
    if (viewMonth === 0) {
      setViewYear((y) => y - 1);
      setViewMonth(11);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const nextMonth = () => {
    if (viewMonth === 11) {
      setViewYear((y) => y + 1);
      setViewMonth(0);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  // Allow navigating up to 12 months ahead for future scheduling
  const maxFutureDate = new Date(today);
  maxFutureDate.setMonth(maxFutureDate.getMonth() + 12);
  const canGoNext = new Date(viewYear, viewMonth + 1, 1) <= maxFutureDate;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <button
          type="button"
          onClick={prevMonth}
          className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 transition-colors"
          title="Previous Month"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="text-sm font-bold text-slate-800">
          {new Date(viewYear, viewMonth, 1).toLocaleString("en-IN", {
            month: "long",
            year: "numeric",
          })}
        </span>
        <button
          type="button"
          onClick={nextMonth}
          disabled={!canGoNext}
          className={cn(
            "rounded-lg p-1.5 transition-colors",
            canGoNext
              ? "text-slate-500 hover:bg-slate-100"
              : "text-slate-200 cursor-not-allowed",
          )}
          title="Next Month"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      <div className="grid grid-cols-7 pt-3 text-center text-[11px] font-semibold uppercase text-slate-400">
        {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((d) => (
          <div key={d} className="py-1">
            {d}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1 pt-1">
        {cells.map((day, idx) => {
          if (!day) return <div key={"empty-" + idx} className="h-9 w-9" />;
          const cellDate = new Date(viewYear, viewMonth, day);
          cellDate.setHours(0, 0, 0, 0);
          const cellYmd = toYMD(cellDate);
          const isPast = cellDate < today;
          const isToday = cellYmd === toYMD(today);
          const isFuture = cellDate > today;
          const isSelected = cellYmd === value;
          const hasActivity = datesWithActivity.includes(cellYmd);

          return (
            <button
              key={day}
              type="button"
              onClick={() => onSelect(cellYmd)}
              title={cellYmd}
              className={cn(
                "relative flex h-9 w-9 flex-col items-center justify-center rounded-lg text-xs font-semibold transition-all",
                !isSelected && isPast && "text-slate-500 hover:bg-slate-100",
                !isSelected && isFuture && "text-indigo-900 hover:bg-indigo-50 font-medium",
                isSelected && "bg-indigo-600 text-white shadow-md font-bold",
                isToday && !isSelected && "border-2 border-indigo-500 text-indigo-700 bg-indigo-50/70 font-bold",
              )}
            >
              <span>{day}</span>
              {hasActivity && (
                <span
                  className={cn(
                    "absolute bottom-1 h-1.5 w-1.5 rounded-full",
                    isSelected ? "bg-amber-300 ring-1 ring-white" : "bg-rose-500",
                  )}
                  title="Has recorded activity"
                />
              )}
            </button>
          );
        })}
      </div>

      <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3 text-xs">
        <button
          type="button"
          onClick={() => onSelect(toYMD(today))}
          className="font-bold text-indigo-600 hover:text-indigo-800 transition-colors"
        >
          Jump to Today
        </button>
        <div className="flex items-center gap-2 text-[11px] text-slate-500">
          <div className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-rose-500" />
            <span>Activity Logged</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Activity & History Modal: View-only log of previous activities and date navigator
 */
function ActivityDetailsModal({
  selectedDate,
  datesWithActivity,
  activities,
  onSelectDate,
  onClose,
}: {
  selectedDate: string;
  datesWithActivity: string[];
  activities: ActivityItem[];
  onSelectDate: (ymd: string) => void;
  onClose: () => void;
}) {
  const [activeTab, setActiveTab] = useState<"calendar" | "activities">("calendar");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterByDate, setFilterByDate] = useState<boolean>(false);

  const filteredActivities = useMemo(() => {
    let list = activities;
    if (filterByDate) {
      list = list.filter((a) => a.timetableDate === selectedDate);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (a) =>
          (a.slotLabel || "").toLowerCase().includes(q) ||
          (a.newSubjectName || "").toLowerCase().includes(q) ||
          (a.newSubjectCode || "").toLowerCase().includes(q) ||
          (a.newFacultyName || "").toLowerCase().includes(q) ||
          (a.masterSubjectName || "").toLowerCase().includes(q) ||
          (a.masterFacultyName || "").toLowerCase().includes(q) ||
          (a.changedByName || "").toLowerCase().includes(q) ||
          (a.remarks || "").toLowerCase().includes(q),
      );
    }
    return list;
  }, [activities, filterByDate, selectedDate, searchQuery]);

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="relative flex max-h-[90vh] w-full max-w-4xl flex-col rounded-2xl border border-slate-200 bg-white shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-sm">
              <History className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-800">
                Today Timetable · Activity & Date Navigator
              </h2>
              <p className="text-xs text-slate-500">
                Select past days (view-only), today or future dates. Observe previous changes vs master.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-200 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tab switchers */}
        <div className="flex border-b border-slate-200 bg-slate-100/60 px-6 pt-2">
          <button
            type="button"
            onClick={() => setActiveTab("calendar")}
            className={cn(
              "flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-semibold transition-all",
              activeTab === "calendar"
                ? "border-indigo-600 text-indigo-700 bg-white rounded-t-lg"
                : "border-transparent text-slate-600 hover:text-slate-900",
            )}
          >
            <Calendar className="h-4 w-4" />
            <span>Calendar Navigator</span>
            <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-bold text-slate-700">
              {formatDate(fromYMD(selectedDate))}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("activities")}
            className={cn(
              "flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-semibold transition-all",
              activeTab === "activities"
                ? "border-indigo-600 text-indigo-700 bg-white rounded-t-lg"
                : "border-transparent text-slate-600 hover:text-slate-900",
            )}
          >
            <Clock className="h-4 w-4" />
            <span>Activity History</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === "calendar" ? (
            <div className="grid gap-6 md:grid-cols-2 items-start">
              <div>
                <h3 className="mb-2 text-sm font-bold text-slate-800">
                  Select Date
                </h3>
                <p className="mb-4 text-xs text-slate-500">
                  Select any previous date to view its timetable history (view-only), or pick today/future dates to adjust faculty assignments.
                </p>
                <CalendarWidget
                  value={selectedDate}
                  datesWithActivity={datesWithActivity}
                  onSelect={(ymd) => {
                    onSelectDate(ymd);
                    onClose();
                  }}
                />
              </div>

              <div className="space-y-4">
                <div className="rounded-xl border border-indigo-100 bg-indigo-50/60 p-4">
                  <div className="flex items-start gap-3">
                    <Info className="h-5 w-5 text-indigo-600 shrink-0 mt-0.5" />
                    <div className="text-xs text-indigo-900 space-y-1.5">
                      <p className="font-bold text-sm">Rules & Access Control:</p>
                      <p>
                        • <strong>Past Days</strong>: View-only. Modifications to past days are locked.
                      </p>
                      <p>
                        • <strong>Today & Future Days</strong>: Can be modified by authorized personnel (Principal, Vice Principal, HOD, and Super Admin).
                      </p>
                      <p>
                        • <strong>Master Timetable</strong>: Never modified. Used purely as a benchmark for comparison.
                      </p>
                      <p>
                        • <strong>Green</strong> = matches master schedule · <strong>Red</strong> = modified vs master schedule.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 mb-2">
                    Active Date Status
                  </h4>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-base font-bold text-slate-800">
                        {DAY_NAMES[fromYMD(selectedDate).getDay()]},{" "}
                        {formatDate(fromYMD(selectedDate))}
                      </p>
                    </div>
                    <Button
                      variant="secondary"
                      onClick={() => {
                        setActiveTab("activities");
                        setFilterByDate(true);
                      }}
                      className="text-xs"
                    >
                      View Date Activity
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="relative flex-1 min-w-[220px]">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                  <input
                    type="search"
                    placeholder="Search by period, subject, faculty or remarks…"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="h-9 w-full rounded-lg border border-slate-200 pl-9 pr-3 text-xs outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setFilterByDate((p) => !p)}
                    className={cn(
                      "rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors",
                      filterByDate
                        ? "border-indigo-500 bg-indigo-50 text-indigo-700"
                        : "border-slate-200 text-slate-600 hover:bg-slate-100",
                    )}
                  >
                    {filterByDate
                      ? `Showing for ${formatDate(fromYMD(selectedDate))}`
                      : "Filter by Selected Date"}
                  </button>
                </div>
              </div>

              {filteredActivities.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-200 p-12 text-center">
                  <History className="mx-auto h-8 w-8 text-slate-300" />
                  <p className="mt-2 text-sm font-semibold text-slate-600">
                    No activity logs recorded yet
                  </p>
                  <p className="mt-1 text-xs text-slate-400">
                    Any edits made to class periods for any date will be permanently logged here.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredActivities.map((act) => {
                    const isRevert = act.changeType === "REVERTED_TO_MASTER";
                    return (
                      <div
                        key={act.id}
                        className={cn(
                          "relative rounded-xl border p-4 transition-all hover:shadow-sm",
                          isRevert
                            ? "border-emerald-200 bg-emerald-50/40"
                            : "border-rose-200 bg-rose-50/40",
                        )}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200/60 pb-2">
                          <div className="flex items-center gap-2">
                            <span
                              className={cn(
                                "rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide",
                                isRevert
                                  ? "bg-emerald-100 text-emerald-800"
                                  : "bg-rose-100 text-rose-800",
                              )}
                            >
                              {isRevert ? "Reverted to Master" : "Period Modified"}
                            </span>
                            <span className="text-xs font-bold text-slate-800">
                              {act.timetableDate} ({DAY_NAMES[fromYMD(act.timetableDate).getDay()]})
                            </span>
                            <span className="text-xs text-slate-500">· {act.slotLabel}</span>
                            {act.slotTime && (
                              <span className="text-[11px] text-slate-400">({act.slotTime})</span>
                            )}
                          </div>

                          <div className="text-right text-[11px] text-slate-500">
                            <span>{act.changedByName || "User"}</span> ·{" "}
                            <span>{formatDate(new Date(act.createdAt))}</span>{" "}
                            <span className="text-slate-400">
                              ({formatTimeOnly(act.createdAt)})
                            </span>
                          </div>
                        </div>

                        <div className="mt-3 grid gap-3 sm:grid-cols-2 text-xs">
                          {/* Master reference */}
                          <div className="rounded-lg border border-slate-200 bg-white/80 p-2.5">
                            <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase text-slate-500 mb-1">
                              <span>Master Timetable (Baseline)</span>
                            </div>
                            <p className="font-semibold text-slate-800">
                              {act.masterSubjectName || act.masterSubjectCode || "Free Period"}
                            </p>
                            {act.masterFacultyName && (
                              <p className="text-slate-600 mt-0.5">Faculty: {act.masterFacultyName}</p>
                            )}
                          </div>

                          {/* Changed to */}
                          <div
                            className={cn(
                              "rounded-lg border p-2.5",
                              isRevert
                                ? "border-emerald-300 bg-emerald-50 text-emerald-950"
                                : "border-rose-300 bg-rose-50 text-rose-950",
                            )}
                          >
                            <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase mb-1">
                              {isRevert ? (
                                <span className="text-emerald-700">Restored Master Values</span>
                              ) : (
                                <span className="text-rose-700">New / Substitute Details</span>
                              )}
                            </div>
                            <p className="font-bold">
                              {isRevert
                                ? act.masterSubjectName || "Master Schedule"
                                : act.newSubjectName || act.newSubjectCode || "Free Period"}
                            </p>
                            <p className="mt-0.5 opacity-90">
                              Faculty:{" "}
                              {isRevert
                                ? act.masterFacultyName || "Master Faculty"
                                : act.newFacultyName || "Not assigned"}
                            </p>
                          </div>
                        </div>

                        {act.remarks && (
                          <div className="mt-2 text-xs text-slate-600 italic">
                            Reason: &ldquo;{act.remarks}&rdquo;
                          </div>
                        )}

                        <div className="mt-3 flex justify-end">
                          <button
                            type="button"
                            onClick={() => {
                              onSelectDate(act.timetableDate);
                              onClose();
                            }}
                            className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-800 hover:underline"
                          >
                            <span>Open this Date Timetable</span>
                            <ArrowRight className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50 px-6 py-3">
          <p className="text-xs text-slate-500">
            Selected Date: <strong>{formatDate(fromYMD(selectedDate))}</strong> (
            {DAY_NAMES[fromYMD(selectedDate).getDay()]})
          </p>
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}

/**
 * Period Comparison & Edit Modal: Displays Actual Period (Master) and Changed Period (Today) side by side in 2 cards.
 * Master Timetable is untouched and used as baseline comparison.
 */
function PeriodEditModal({
  slot,
  date,
  dayLabel,
  masterEntry,
  currentOverride,
  subjects,
  faculty,
  canEdit = true,
  onSave,
  onClose,
}: {
  slot: { id: number; label: string; startTime: string; endTime: string };
  date: string;
  dayLabel: string;
  masterEntry: SlotCellEntry | null;
  currentOverride: PeriodOverride | null;
  subjects: PlannerResponse["subjects"];
  faculty: PlannerResponse["faculty"];
  canEdit?: boolean;
  onSave: (payload: {
    override: PeriodOverride | null;
    isRevert: boolean;
    remarks: string;
  }) => void;
  onClose: () => void;
}) {
  const [subjectId, setSubjectId] = useState(
    currentOverride?.subjectId ?? (masterEntry?.subjectId != null ? String(masterEntry.subjectId) : ""),
  );
  const [hrmsEmployeeId, setHrmsEmployeeId] = useState(
    currentOverride?.hrmsEmployeeId ?? (masterEntry?.facultyHrmsId ?? ""),
  );
  const [remarks, setRemarks] = useState(currentOverride?.remarks ?? "");
  const [facultySearch, setFacultySearch] = useState("");
  const [facultyOpen, setFacultyOpen] = useState(false);

  const selectedFaculty = faculty.find((f) => f.hrmsEmployeeId === hrmsEmployeeId);
  const filteredFaculty = useMemo(() => {
    const q = facultySearch.trim().toLowerCase();
    if (q.length < 2) return [];
    return faculty
      .filter(
        (f) =>
          f.name.toLowerCase().includes(q) ||
          f.hrmsEmployeeId.toLowerCase().includes(q) ||
          (f.department || "").toLowerCase().includes(q),
      )
      .slice(0, 8);
  }, [faculty, facultySearch]);

  const isPeriodModified = Boolean(
    currentOverride &&
      (currentOverride.subjectId !== (masterEntry?.subjectId != null ? String(masterEntry.subjectId) : "") ||
        currentOverride.hrmsEmployeeId !== (masterEntry?.facultyHrmsId || "")),
  );

  const handleSave = () => {
    if (!canEdit) return;
    const sub = subjects.find((s) => String(s.id) === subjectId);
    const fac = faculty.find((f) => f.hrmsEmployeeId === hrmsEmployeeId);

    // If completely cleared, revert to master
    if (!sub && !hrmsEmployeeId) {
      onSave({ override: null, isRevert: true, remarks });
      return;
    }

    onSave({
      override: {
        slotId: slot.id,
        slotLabel: slot.label,
        slotTime: `${slot.startTime}–${slot.endTime}`,
        subjectId,
        subjectCode: sub?.code ?? "",
        subjectName: sub?.name ?? "",
        hrmsEmployeeId,
        facultyName: fac?.name ?? "",
        remarks,
      },
      isRevert: false,
      remarks,
    });
  };

  const handleRevert = () => {
    if (!canEdit) return;
    onSave({ override: null, isRevert: true, remarks: "Reverted to master timetable" });
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs animate-in fade-in duration-150">
      <button type="button" className="absolute inset-0" onClick={onClose} aria-label="Close" />
      <div className="relative z-10 w-full max-w-3xl rounded-2xl border border-slate-200 bg-white shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/90 px-6 py-4">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-slate-800 text-base">Period Details ({slot.label})</h3>
              <span className="text-xs font-semibold text-slate-600 bg-slate-200/80 px-2 py-0.5 rounded">
                {slot.startTime}–{slot.endTime}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              {dayLabel}, {formatDate(fromYMD(date))}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-200 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4 max-h-[calc(85vh-130px)] overflow-y-auto">
          {/* Status Banner */}
          {isPeriodModified ? (
            <div className="rounded-xl border border-rose-200 bg-rose-50/80 p-3 text-xs text-rose-900 flex items-start gap-2.5">
              <AlertCircle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">Period Modified for {formatDate(fromYMD(date))}</p>
                <p className="text-[11px] text-rose-700 mt-0.5">
                  This class has been altered from the Master Timetable schedule. Master Timetable remains unchanged.
                </p>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/80 p-3 text-xs text-emerald-900 flex items-start gap-2.5">
              <CheckCircle className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">Period Matches Master Timetable</p>
                <p className="text-[11px] text-emerald-700 mt-0.5">
                  Today's schedule matches the baseline master timetable for this period.
                </p>
              </div>
            </div>
          )}

          {/* SIDE-BY-SIDE 2 CARDS */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* CARD 1: Actual Period (Master Timetable Baseline) */}
            <div className="rounded-xl border-2 border-slate-200 bg-slate-50/70 p-4 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-200">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-emerald-100 text-emerald-700">
                      <BookOpen className="h-4 w-4" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-800">Actual Period</h4>
                      <p className="text-[11px] text-slate-500">Master Timetable Baseline</p>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-200">
                    Master Baseline
                  </span>
                </div>

                <div className="space-y-3">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Scheduled Subject</span>
                    <p className="text-sm font-bold text-slate-900 mt-0.5">
                      {masterEntry?.customLabel || masterEntry?.subjectName || masterEntry?.subjectCode || "Free / Unassigned Period"}
                    </p>
                    {masterEntry?.subjectCode && masterEntry.subjectCode !== masterEntry.subjectName && (
                      <p className="text-xs text-slate-500 mt-0.5 font-medium">Code: {masterEntry.subjectCode}</p>
                    )}
                  </div>

                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Assigned Faculty</span>
                    <p className="text-sm font-semibold text-slate-800 mt-0.5">
                      {masterEntry?.facultyName || "No faculty assigned"}
                    </p>
                    {masterEntry?.facultyHrmsId && (
                      <p className="text-xs text-slate-500 mt-0.5">ID: {masterEntry.facultyHrmsId}</p>
                    )}
                  </div>

                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Timing & Slot</span>
                    <p className="text-xs font-medium text-slate-700 mt-0.5">
                      {slot.label} · {slot.startTime}–{slot.endTime}
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-200/80 text-[11px] text-slate-500 flex items-center gap-1.5">
                <Shield className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                <span>Master timetable baseline cannot be modified here.</span>
              </div>
            </div>

            {/* CARD 2: Changed Period (Today's Schedule) */}
            <div
              className={cn(
                "rounded-xl border-2 p-4 flex flex-col justify-between",
                isPeriodModified
                  ? "border-rose-300 bg-rose-50/50"
                  : "border-indigo-200 bg-indigo-50/30",
              )}
            >
              <div>
                <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-200/80">
                  <div className="flex items-center gap-2">
                    <div
                      className={cn(
                        "p-1.5 rounded-lg",
                        isPeriodModified ? "bg-rose-100 text-rose-700" : "bg-indigo-100 text-indigo-700",
                      )}
                    >
                      <Calendar className="h-4 w-4" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-800">Changed Period</h4>
                      <p className="text-[11px] text-slate-500">{formatDate(fromYMD(date))} Schedule</p>
                    </div>
                  </div>
                  <span
                    className={cn(
                      "text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border",
                      isPeriodModified
                        ? "bg-rose-100 text-rose-800 border-rose-200"
                        : "bg-indigo-100 text-indigo-800 border-indigo-200",
                    )}
                  >
                    {isPeriodModified ? "Changed" : "Matches Master"}
                  </span>
                </div>

                {canEdit ? (
                  <div className="space-y-3">
                    {/* Subject Selector */}
                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                        Subject for {formatDate(fromYMD(date))}
                      </label>
                      <select
                        className="h-9 w-full rounded-lg border border-slate-300 bg-white px-2.5 text-xs text-slate-800 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                        value={subjectId}
                        onChange={(e) => setSubjectId(e.target.value)}
                      >
                        <option value="">— Free / Unassigned Period —</option>
                        {subjects.map((s) => (
                          <option key={s.id} value={String(s.id)}>
                            {s.code} — {s.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Faculty Selector */}
                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                        Staff / Faculty for {formatDate(fromYMD(date))}
                      </label>
                      {selectedFaculty && !facultyOpen ? (
                        <div className="flex items-center justify-between rounded-lg border border-indigo-200 bg-white px-2.5 py-1.5 text-xs">
                          <div>
                            <p className="font-semibold text-indigo-900">{selectedFaculty.name}</p>
                            <p className="text-[10px] text-slate-500">
                              {selectedFaculty.hrmsEmployeeId} · {selectedFaculty.department}
                            </p>
                          </div>
                          <button
                            type="button"
                            className="text-[11px] font-bold text-indigo-600 hover:underline"
                            onClick={() => {
                              setHrmsEmployeeId("");
                              setFacultySearch("");
                              setFacultyOpen(true);
                            }}
                          >
                            Change
                          </button>
                        </div>
                      ) : (
                        <div className="relative rounded-lg border border-slate-300 bg-white">
                          <input
                            type="search"
                            className="h-9 w-full px-2.5 text-xs outline-none rounded-lg"
                            placeholder="Type to search faculty name or ID…"
                            value={facultySearch}
                            autoFocus={facultyOpen}
                            onChange={(e) => {
                              setFacultySearch(e.target.value);
                              setFacultyOpen(true);
                            }}
                          />
                          {filteredFaculty.length > 0 && (
                            <ul className="absolute top-full left-0 right-0 z-30 mt-1 max-h-40 overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg">
                              {filteredFaculty.map((f) => (
                                <li key={f.hrmsEmployeeId}>
                                  <button
                                    type="button"
                                    className="w-full px-2.5 py-1.5 text-left text-xs hover:bg-indigo-50"
                                    onClick={() => {
                                      setHrmsEmployeeId(f.hrmsEmployeeId);
                                      setFacultySearch("");
                                      setFacultyOpen(false);
                                    }}
                                  >
                                    <span className="font-semibold text-slate-800">{f.name}</span>
                                    <span className="ml-1.5 text-[10px] text-slate-500">{f.hrmsEmployeeId}</span>
                                  </button>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Remarks */}
                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                        Reason / Activity Remarks (Optional)
                      </label>
                      <input
                        type="text"
                        placeholder="e.g., Leave substitution, Special revision session"
                        value={remarks}
                        onChange={(e) => setRemarks(e.target.value)}
                        className="h-8 w-full rounded-lg border border-slate-300 bg-white px-2.5 text-xs outline-none focus:border-indigo-500"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Current Subject</span>
                      <p className="text-sm font-bold text-slate-900 mt-0.5">
                        {currentOverride?.subjectName || currentOverride?.subjectCode || masterEntry?.subjectName || "Free Period"}
                      </p>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Current Faculty</span>
                      <p className="text-sm font-semibold text-slate-800 mt-0.5">
                        {currentOverride?.facultyName || masterEntry?.facultyName || "No faculty assigned"}
                      </p>
                    </div>
                    {currentOverride?.remarks && (
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Remarks</span>
                        <p className="text-xs text-slate-600 italic mt-0.5">{currentOverride.remarks}</p>
                      </div>
                    )}
                    {currentOverride?.changedByName && (
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Last Changed By</span>
                        <p className="text-xs text-slate-600 mt-0.5">{currentOverride.changedByName}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="mt-4 pt-3 border-t border-slate-200/80 text-[11px] text-slate-500">
                {canEdit ? (
                  <span>Affects {formatDate(fromYMD(date))} only and will be logged in Activity.</span>
                ) : (
                  <span className="text-amber-700 font-medium">View only. Changes cannot be made.</span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50 px-6 py-3.5">
          {canEdit && currentOverride ? (
            <button
              type="button"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-700 hover:text-amber-900"
              onClick={handleRevert}
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>Revert to Master Timetable</span>
            </button>
          ) : (
            <span />
          )}

          <div className="flex gap-2">
            <Button variant="secondary" onClick={onClose}>
              {canEdit ? "Cancel" : "Close"}
            </Button>
            {canEdit && <Button onClick={handleSave}>Save Change</Button>}
          </div>
        </div>
      </div>
    </div>
  );
}

export function TodayTimetableView() {
  const { filters, masters, setFilters } = useAcademicContext();
  const { authorization, hasPermission } = useAuth();

  // Role Access Control: Super Admin or users with 'today_timetable.edit' permission (or legacy roles)
  const userRoles = useMemo(() => {
    const list: string[] = [];
    if (authorization?.roles) {
      for (const r of authorization.roles) {
        if (r.roleKey) {
          list.push(r.roleKey.toLowerCase().replace(/[\s-]/g, "_"));
        }
      }
    }
    return list;
  }, [authorization]);

  const isSuperAdmin = useMemo(() => {
    return (
      userRoles.includes("super_admin") ||
      userRoles.includes("superadmin") ||
      Boolean(authorization?.scope?.isGlobal)
    );
  }, [userRoles, authorization]);

  const canChangeTimetable = useMemo(() => {
    if (isSuperAdmin) return true;
    if (hasPermission("today_timetable.edit")) return true;
    const allowedRoles = [
      "principal",
      "vice_principal",
      "viceprincipal",
      "hod",
      "hods",
    ];
    return allowedRoles.some((role) => userRoles.includes(role));
  }, [isSuperAdmin, hasPermission, userRoles]);

  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const [selectedDate, setSelectedDate] = useState<string>(toYMD(today));
  const [activityModalOpen, setActivityModalOpen] = useState(false);

  const [planner, setPlanner] = useState<PlannerResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Student list resolution info
  const [studentProgressInfo, setStudentProgressInfo] = useState<{
    year: number;
    semester: number;
    studentCount: number;
  } | null>(null);

  // Overrides for the currently selected date: slotId -> PeriodOverride
  const [overrides, setOverrides] = useState<Record<number, PeriodOverride>>({});
  // List of all dates that have activity
  const [datesWithActivity, setDatesWithActivity] = useState<string[]>([]);
  // Full activity list for observing previous details
  const [activities, setActivities] = useState<ActivityItem[]>([]);

  // All Batches mode data: running cohorts in current academic year
  const [allBatchesData, setAllBatchesData] = useState<AllBatchesCohort[]>([]);
  const [allBatchesLoading, setAllBatchesLoading] = useState(false);
  const [allBatchesError, setAllBatchesError] = useState<string | null>(null);

  const [editingSlot, setEditingSlot] = useState<{
    slot: { id: number; label: string; startTime: string; endTime: string };
    masterEntry: SlotCellEntry | null;
    cohort?: AllBatchesCohort;
  } | null>(null);

  const selectedDayName = useMemo(() => {
    return DAY_NAMES[fromYMD(selectedDate).getDay()];
  }, [selectedDate]);

  // Date rules:
  // - isPastDate: selected date is before today -> VIEW ONLY!
  // - isTodayDate or isFutureDate: present and future -> can change!
  const isPastDate = selectedDate < toYMD(today);
  const isTodayDate = selectedDate === toYMD(today);
  const isFutureDate = selectedDate > toYMD(today);

  // Only allowed to edit if user is authorized AND date is today or future!
  const canEditCurrentView = canChangeTimetable && !isPastDate;

  // Auto-resolve required filters so timetable displays by default when college & branch are selected
  useEffect(() => {
    if (!masters) return;
    if (filters.collegeId === "all" || filters.branchId === "all") return;

    const updates: Partial<typeof filters> = {};

    // 1. Course
    if (filters.courseId === "all") {
      const branch = masters.branches.find((b) => b.id === filters.branchId);
      if (branch?.courseId) {
        updates.courseId = branch.courseId;
      } else if (masters.courses.length > 0) {
        updates.courseId = masters.courses[0].id;
      }
    }

    // 2. Batch: Preserve 'all' if user selected All Batches, otherwise initialize if empty
    if (!filters.batch) {
      updates.batch = "all";
    }

    // 3. Section (only when a specific batch is chosen)
    const curBranch = masters.branches.find((b) => b.id === filters.branchId);
    if (curBranch?.hasSections && filters.section === "all" && filters.batch !== "all") {
      const branchSections = masters.sections.filter((s) => s.branchId === filters.branchId);
      if (branchSections.length > 0) {
        updates.section = branchSections[0].name;
      }
    }

    // 4. Academic Year
    if (!filters.academicYear) {
      const defYear = masters.defaults?.academicYear || masters.academicYears[0]?.label || "2024-2025";
      if (defYear) updates.academicYear = defYear;
    }

    // 5. Default Year & Semester if 'all' and not in All Batches mode
    if (filters.batch !== "all") {
      if (filters.year === "all") {
        updates.year = 1;
      }
      if (filters.semester === "all") {
        updates.semester = 1;
      }
    }

    if (Object.keys(updates).length > 0) {
      setFilters(updates);
    }
  }, [
    filters.collegeId,
    filters.branchId,
    filters.courseId,
    filters.batch,
    filters.section,
    filters.academicYear,
    filters.year,
    filters.semester,
    masters,
    setFilters,
  ]);

  // Auto-filter Year and Semester by student list (only when year or semester is 'all')
  useEffect(() => {
    if (
      filters.collegeId === "all" ||
      filters.courseId === "all" ||
      filters.branchId === "all" ||
      filters.batch === "all"
    ) {
      setStudentProgressInfo(null);
      return;
    }

    let cancelled = false;
    async function autoFilterFromStudents() {
      try {
        const params = new URLSearchParams({
          collegeId: String(filters.collegeId),
          courseId: String(filters.courseId),
          branchId: String(filters.branchId),
          batch: String(filters.batch),
        });
        const res = await apiFetch(`/catalog/batch-progress?${params}`, { cache: "no-store" });
        if (!res.ok || cancelled) return;
        const json = await res.json();
        const data = json.data as
          | { year: number | null; semester: number | null; studentCount: number }
          | undefined;

        if (data?.year != null && data?.semester != null) {
          setStudentProgressInfo({
            year: data.year,
            semester: data.semester,
            studentCount: data.studentCount || 0,
          });

          // Auto-update filter state only if currently 'all'
          if (filters.year === "all" || filters.semester === "all") {
            setFilters({ year: data.year, semester: data.semester });
          }
        }
      } catch {
        // Keep manual filters if request fails
      }
    }

    void autoFilterFromStudents();
    return () => {
      cancelled = true;
    };
  }, [
    filters.collegeId,
    filters.courseId,
    filters.branchId,
    filters.batch,
    setFilters,
  ]);

  const selectedBranch =
    filters.branchId === "all" || !masters
      ? null
      : masters.branches.find((b) => b.id === filters.branchId) ?? null;
  const needsSection = Boolean(selectedBranch?.hasSections);
  const isAllBatchesMode = filters.batch === "all";
  const filtersComplete =
    filters.collegeId !== "all" &&
    filters.branchId !== "all" &&
    Boolean(filters.academicYear) &&
    (isAllBatchesMode ||
      (filters.batch !== "all" &&
        filters.semester !== "all" &&
        (!needsSection || filters.section !== "all")));

  const selectedCourse = useMemo(() => {
    if (!masters || filters.courseId === "all") return null;
    return masters.courses.find((c) => c.id === filters.courseId) ?? null;
  }, [masters, filters.courseId]);

  // Semester pills: 1-1, 1-2, 2-1, 2-2, 3-1, 3-2, 4-1, 4-2
  const semesterPills = useMemo(() => {
    const totalYears = selectedCourse?.totalYears ?? 4;
    const semsPerYear = selectedCourse?.semestersPerYear ?? 2;
    const pills: Array<{ label: string; year: number; semester: number }> = [];
    for (let y = 1; y <= totalYears; y++) {
      for (let s = 1; s <= semsPerYear; s++) {
        pills.push({
          label: `${y}-${s}`,
          year: y,
          semester: s,
        });
      }
    }
    return pills;
  }, [selectedCourse]);

  const query = useMemo(() => {
    if (!filtersComplete || isAllBatchesMode) return null;
    const p = new URLSearchParams();
    p.set("collegeId", String(filters.collegeId));
    p.set("courseId", String(filters.courseId));
    p.set("branchId", String(filters.branchId));
    p.set("batch", String(filters.batch));
    p.set("semester", String(filters.semester));
    p.set("academicYear", filters.academicYear);
    if (filters.year !== "all") p.set("year", String(filters.year));
    if (filters.section !== "all") p.set("section", filters.section);
    return "?" + p.toString();
  }, [filters, filtersComplete, isAllBatchesMode]);

  // Load master timetable planner (purely for comparison baseline!)
  const loadPlanner = useCallback(async () => {
    if (!query) {
      setPlanner(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch("/timetables/planner" + query, { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to load timetable planner (" + res.status + ")");
      const data = (await res.json()) as PlannerResponse;
      setPlanner(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load timetable");
    } finally {
      setLoading(false);
    }
  }, [query]);

  // Load daily overrides & activities from backend
  const loadDailyOverridesAndActivities = useCallback(async () => {
    if (!filtersComplete || !query) return;

    try {
      const todayQuery = new URLSearchParams();
      todayQuery.set("collegeId", String(filters.collegeId));
      todayQuery.set("courseId", String(filters.courseId));
      todayQuery.set("branchId", String(filters.branchId));
      todayQuery.set("batch", String(filters.batch));
      todayQuery.set("semester", String(filters.semester));
      todayQuery.set("academicYear", filters.academicYear);
      if (filters.section !== "all") todayQuery.set("section", filters.section);
      todayQuery.set("date", selectedDate);

      // 1. Fetch active overrides for this date
      const res = await apiFetch(`/today-timetable?${todayQuery.toString()}`);
      if (res.ok) {
        const json = await res.json();
        setOverrides(json.overrides || {});
        if (Array.isArray(json.datesWithActivity)) {
          setDatesWithActivity(json.datesWithActivity);
        }
      }

      // 2. Fetch full activity logs for observing previous changes
      const actRes = await apiFetch(`/today-timetable/activities?${todayQuery.toString()}`);
      if (actRes.ok) {
        const actJson = await actRes.json();
        if (Array.isArray(actJson.activities)) {
          setActivities(actJson.activities);
        }
      }
    } catch (err) {
      console.warn("Unable to sync today-timetable activities with backend:", err);
    }
  }, [filtersComplete, query, filters, selectedDate]);

  // Load All Batches timetable for all running cohorts in the academic year
  const loadAllBatches = useCallback(async () => {
    if (
      !isAllBatchesMode ||
      filters.collegeId === "all" ||
      filters.branchId === "all" ||
      !filters.academicYear
    ) {
      setAllBatchesData([]);
      return;
    }

    setAllBatchesLoading(true);
    setAllBatchesError(null);
    try {
      const params = new URLSearchParams();
      params.set("collegeId", String(filters.collegeId));
      if (filters.courseId !== "all") params.set("courseId", String(filters.courseId));
      params.set("branchId", String(filters.branchId));
      params.set("academicYear", filters.academicYear);
      params.set("date", selectedDate);

      const res = await apiFetch(`/today-timetable/all-batches?${params.toString()}`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`Failed to load all batches (${res.status})`);
      const json = await res.json();
      const batches = (json.batches || []) as AllBatchesCohort[];
      setAllBatchesData(batches);

      // Collect dates with activity across all cohorts
      const datesSet = new Set<string>();
      batches.forEach((b) => {
        (b.datesWithActivity || []).forEach((d) => datesSet.add(d));
      });
      if (datesSet.size > 0) {
        setDatesWithActivity((prev) => Array.from(new Set([...prev, ...Array.from(datesSet)])));
      }

      // Also load activity logs
      const actRes = await apiFetch(`/today-timetable/activities?${params.toString()}`);
      if (actRes.ok) {
        const actJson = await actRes.json();
        if (Array.isArray(actJson.activities)) {
          setActivities(actJson.activities);
        }
      }
    } catch (err) {
      setAllBatchesError(err instanceof Error ? err.message : "Failed to load all batches");
    } finally {
      setAllBatchesLoading(false);
    }
  }, [
    isAllBatchesMode,
    filters.collegeId,
    filters.courseId,
    filters.branchId,
    filters.academicYear,
    selectedDate,
  ]);

  useEffect(() => {
    if (isAllBatchesMode) {
      void loadAllBatches();
    } else {
      void loadPlanner();
      void loadDailyOverridesAndActivities();
    }
  }, [isAllBatchesMode, loadAllBatches, loadPlanner, loadDailyOverridesAndActivities]);

  const daySlots = useMemo(
    () => planner?.slotsByDay?.[selectedDayName] ?? [],
    [planner, selectedDayName],
  );
  const dayGrid = useMemo(
    () => (planner?.grid?.[selectedDayName] ?? {}) as Record<number, SlotCell>,
    [planner, selectedDayName],
  );

  function getMasterEntry(slotId: number): SlotCellEntry | null {
    const cell = dayGrid[slotId];
    if (!cell) return null;
    if (Array.isArray(cell.entries) && cell.entries.length > 0) return cell.entries[0];
    return cell.entry;
  }

  function getCohortMasterEntry(cohort: AllBatchesCohort, slotId: number): SlotCellEntry | null {
    const dayCellMap = (cohort.planner?.grid?.[selectedDayName] ?? {}) as Record<number, SlotCell>;
    const cell = dayCellMap[slotId];
    if (!cell) return null;
    if (Array.isArray(cell.entries) && cell.entries.length > 0) return cell.entries[0];
    return cell.entry;
  }

  function isCohortPeriodChanged(cohort: AllBatchesCohort, slotId: number): boolean {
    const override = cohort.overrides?.[slotId];
    if (!override) return false;
    const master = getCohortMasterEntry(cohort, slotId);
    if (!master) {
      return Boolean(override.subjectId || override.hrmsEmployeeId);
    }
    const subjectMatches =
      override.subjectId === (master.subjectId != null ? String(master.subjectId) : "");
    const facultyMatches =
      override.hrmsEmployeeId === (master.facultyHrmsId || "");
    return !subjectMatches || !facultyMatches;
  }

  /**
   * Compare Today's timetable vs Master Timetable:
   * Returns TRUE if period is changed vs master timetable (red card)
   * Returns FALSE if period matches master timetable (green card)
   */
  function isPeriodChanged(slotId: number): boolean {
    const override = overrides[slotId];
    if (!override) return false;
    const master = getMasterEntry(slotId);
    if (!master) {
      return Boolean(override.subjectId || override.hrmsEmployeeId);
    }
    const subjectMatches =
      override.subjectId === (master.subjectId != null ? String(master.subjectId) : "");
    const facultyMatches =
      override.hrmsEmployeeId === (master.facultyHrmsId || "");
    return !subjectMatches || !facultyMatches;
  }

  function prevDay() {
    const d = fromYMD(selectedDate);
    d.setDate(d.getDate() - 1);
    setSelectedDate(toYMD(d));
  }

  function nextDay() {
    const d = fromYMD(selectedDate);
    const next = new Date(d);
    next.setDate(next.getDate() + 1);
    setSelectedDate(toYMD(next));
  }

  const isSunday = fromYMD(selectedDate).getDay() === 0;
  const isDayOff = planner?.ready && !isSunday && daySlots.length === 0;
  const missingLabel = !filtersComplete
    ? "Please select College, Course, Branch, and Batch from the filter bar to view Today's timetable."
    : null;


  // Handle saving an edit for a period (Today or Future date only)
  const handleSavePeriod = async (payload: {
    override: PeriodOverride | null;
    isRevert: boolean;
    remarks: string;
  }) => {
    if (!editingSlot || isPastDate || !canChangeTimetable) return;
    const { slot, masterEntry, cohort } = editingSlot;

    const newOverride = payload.override;
    const isRevert = payload.isRevert;

    const targetBatch = cohort ? cohort.batch : filters.batch;
    const targetSemester = cohort ? cohort.semester : filters.semester;
    const targetSection = cohort
      ? cohort.section
      : filters.section !== "all"
      ? filters.section
      : null;

    // Optimistically update local state
    if (cohort) {
      setAllBatchesData((prev) =>
        prev.map((b) => {
          if (
            b.batch === cohort.batch &&
            b.semester === cohort.semester &&
            b.section === cohort.section
          ) {
            const nextOverrides = { ...b.overrides };
            if (newOverride === null) {
              delete nextOverrides[slot.id];
            } else {
              nextOverrides[slot.id] = newOverride;
            }
            return { ...b, overrides: nextOverrides };
          }
          return b;
        }),
      );
    } else {
      setOverrides((prev) => {
        const next = { ...prev };
        if (newOverride === null) {
          delete next[slot.id];
        } else {
          next[slot.id] = newOverride;
        }
        return next;
      });
    }

    if (!datesWithActivity.includes(selectedDate)) {
      setDatesWithActivity((prev) => [...prev, selectedDate]);
    }

    setEditingSlot(null);

    // Call backend API to record activity and store override permanently
    try {
      const body = {
        date: selectedDate,
        collegeId: filters.collegeId,
        courseId:
          filters.courseId !== "all"
            ? filters.courseId
            : (cohort?.planner.context as any)?.courseId || (selectedBranch?.courseId || 1),
        branchId: filters.branchId,
        batch: targetBatch,
        semester: targetSemester,
        section: targetSection,
        academicYear: filters.academicYear,
        slotId: slot.id,
        slotLabel: slot.label,
        slotTime: `${slot.startTime}–${slot.endTime}`,

        masterSubjectId: masterEntry?.subjectId,
        masterSubjectCode: masterEntry?.subjectCode,
        masterSubjectName: masterEntry?.customLabel || masterEntry?.subjectName,
        masterFacultyHrmsId: masterEntry?.facultyHrmsId,
        masterFacultyName: masterEntry?.facultyName,

        newSubjectId: newOverride?.subjectId ? Number(newOverride.subjectId) : null,
        newSubjectCode: newOverride?.subjectCode ?? null,
        newSubjectName: newOverride?.subjectName ?? null,
        newFacultyHrmsId: newOverride?.hrmsEmployeeId ?? null,
        newFacultyName: newOverride?.facultyName ?? null,

        remarks: payload.remarks || null,
        changeType: isRevert ? "REVERTED_TO_MASTER" : "PERIOD_CHANGE",
      };

      const res = await apiFetch("/today-timetable/override", {
        method: "POST",
        body: JSON.stringify(body),
      });

      if (res.ok) {
        if (isAllBatchesMode) {
          void loadAllBatches();
        } else {
          void loadDailyOverridesAndActivities();
        }
      }
    } catch (e) {
      console.error("Failed to save override to backend:", e);
    }
  };

  return (
    <div>
      {/* Top Header */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-[28px] font-bold leading-tight text-navy-900">Today Timetable</h1>
          <p className="mt-1 text-sm text-slate-500 max-w-xl">
            Live schedule for any date compared against the Master Timetable.{" "}
            <span className="font-semibold text-emerald-700">Green</span> = unchanged,{" "}
            <span className="font-semibold text-rose-700">Red</span> = changed vs master. Master
            timetable remains untouched.
          </p>
        </div>

        {/* Top Right "Activity" Button */}
        <div className="flex items-center gap-2">
          <Button
            id="today-timetable-activity-button"
            onClick={() => setActivityModalOpen(true)}
            className="inline-flex items-center gap-2.5 rounded-xl bg-navy-900 px-4 py-2.5 text-sm font-bold text-white shadow-md hover:bg-navy-800 transition-all"
          >
            <History className="h-4 w-4 text-amber-400" />
            <span>Activity</span>
            <span className="rounded-full bg-white/20 px-2 py-0.5 text-xs font-semibold text-white">
              {formatDate(fromYMD(selectedDate))}
            </span>
          </Button>
        </div>
      </div>

      {/* Filter Bar below the header */}
      <div className="mb-4 print:hidden">
        <AcademicFilterBar title="Page filters" />
      </div>

      {/* Role Access Policy Notice */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs shadow-xs">
        <div className="flex items-center gap-2">
          {canChangeTimetable ? (
            <span className="inline-flex items-center gap-1 font-semibold text-emerald-700 bg-emerald-50 px-2 py-1 rounded-md border border-emerald-200">
              <ShieldCheck className="h-3.5 w-3.5" />
              <span>Authorized: Edit Access Enabled (Super Admin / Assigned Roles)</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 font-semibold text-slate-600 bg-slate-100 px-2 py-1 rounded-md border border-slate-200">
              <Lock className="h-3.5 w-3.5" />
              <span>View Only: Editing requires 'Edit Today Timetable' permission</span>
            </span>
          )}
        </div>
      </div>

      {/* Semester Switcher Bar (only when viewing a specific batch) */}
      {!isAllBatchesMode && filters.branchId !== "all" && semesterPills.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-2.5 shadow-xs">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider px-2">Semester:</span>
            {semesterPills.map((pill) => {
              const isSelected =
                Number(filters.year) === pill.year && Number(filters.semester) === pill.semester;
              return (
                <button
                  key={pill.label}
                  type="button"
                  onClick={() => setFilters({ year: pill.year, semester: pill.semester })}
                  className={cn(
                    "px-3.5 py-1 text-xs font-bold rounded-lg transition-all border",
                    isSelected
                      ? "bg-indigo-600 text-white border-indigo-600 shadow-xs ring-2 ring-indigo-200"
                      : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-300",
                  )}
                >
                  {pill.label}
                </button>
              );
            })}
          </div>
          <div className="text-xs text-slate-500 pr-2">
            Selected: <span className="font-bold text-slate-800">Year {filters.year !== "all" ? filters.year : 1} · Sem {filters.semester !== "all" ? filters.semester : 1}</span>
          </div>
        </div>
      )}

      {missingLabel && (
        <Card className="mb-4">
          <p className="text-sm text-slate-600">{missingLabel}</p>
        </Card>
      )}

      {/* Unified Date & Context Navigation Banner */}
      {filtersComplete && (
        <Card className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-navy-900">
                {selectedBranch ? `${selectedBranch.name}` : ""}
                {filters.academicYear ? ` · ${filters.academicYear}` : ""}
              </h3>
              {isAllBatchesMode ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-indigo-100 px-2.5 py-0.5 text-[11px] font-bold text-indigo-800 border border-indigo-200">
                  <BookOpen className="h-3 w-3" />
                  <span>All Running Batches</span>
                </span>
              ) : studentProgressInfo ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-bold text-emerald-800 border border-emerald-200">
                  <Users className="h-3 w-3" />
                  <span>Auto-filtered by Student List</span>
                </span>
              ) : null}
            </div>
            <p className="mt-0.5 text-sm font-semibold text-navy-900">
              {isAllBatchesMode ? (
                <span>
                  Showing all active cohorts ({allBatchesData.length} running timetable{allBatchesData.length === 1 ? "" : "s"}) for this academic year
                </span>
              ) : planner ? (
                <span>
                  Year {filters.year !== "all" ? filters.year : planner.context.year || "—"} · Sem {planner.context.semester} · {planner.context.course} / {planner.context.branch}
                  {planner.context.hasSections ? " · Section " + planner.context.section : ""} · Batch {planner.context.batch}
                  {studentProgressInfo?.studentCount ? ` (${studentProgressInfo.studentCount} Regular Students)` : ""}
                </span>
              ) : (
                <span>Schedule for {selectedDayName}</span>
              )}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={prevDay}
              className="rounded-lg border border-slate-200 p-2 text-slate-500 hover:bg-slate-100 transition-colors"
              title="Previous Day"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>

            <button
              type="button"
              onClick={() => setActivityModalOpen(true)}
              className="rounded-lg px-3 py-1.5 text-center hover:bg-slate-100 transition-colors min-w-[170px]"
              title="Click to open Activity & Calendar"
            >
              <p className="text-sm font-bold text-navy-900">{selectedDayName}</p>
              <p className="text-xs text-slate-500">{formatDate(fromYMD(selectedDate))}</p>
            </button>

            <button
              type="button"
              onClick={nextDay}
              className="rounded-lg border border-slate-200 p-2 text-slate-500 hover:bg-slate-100 transition-colors"
              title="Next Day"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </Card>
      )}

      {/* Legend and instructions */}
      {filtersComplete && (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3 text-xs font-medium">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded-full bg-emerald-500 ring-2 ring-emerald-200" />
              <span className="font-semibold text-emerald-800">
                Green: Unchanged (Matches Master Timetable)
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded-full bg-rose-500 ring-2 ring-rose-200" />
              <span className="font-semibold text-rose-800">
                Red: Changed from Master Timetable
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 text-slate-500">
            <Edit2 className="h-3 w-3 text-slate-400" />
            <span>Click any period to view actual vs changed comparison</span>
          </div>
        </div>
      )}

      {/* Sunday / Holiday banner */}
      {filtersComplete && isSunday && (
        <Card className="border-amber-200 bg-amber-50 mb-4">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-amber-600" />
            <p className="text-sm font-semibold text-amber-800">
              Sunday — No classes scheduled in the master timetable.
            </p>
          </div>
        </Card>
      )}

      {/* ============================================================ */}
      {/* ALL BATCHES VIEW: Renders all cohorts running this year       */}
      {/* ============================================================ */}
      {isAllBatchesMode && filtersComplete && (
        <>
          {allBatchesLoading && <LoadingAnimation label="Loading all batches timetable..." />}
          {allBatchesError && (
            <Card className="mb-4 border-red-200 bg-red-50">
              <p className="text-sm text-red-700">{allBatchesError}</p>
            </Card>
          )}

          {!allBatchesLoading && !allBatchesError && allBatchesData.length === 0 && (
            <Card className="mb-4">
              <p className="text-sm text-slate-600">
                No active timetable plans found for this branch in {filters.academicYear}.
              </p>
            </Card>
          )}

          {!allBatchesLoading &&
            !allBatchesError &&
            allBatchesData.map((cohort) => {
              const cohortSlots = (cohort.planner?.slotsByDay?.[selectedDayName] ?? []).filter(
                (slot) => slot.isActive !== false,
              );
              const isCohortDayOff = !isSunday && cohortSlots.length === 0;

              return (
                <div
                  key={`${cohort.batch}-${cohort.year}-${cohort.semester}-${cohort.section || ""}`}
                  className="mb-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
                >
                  {/* Cohort Header */}
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-lg bg-navy-900 px-2.5 py-1 text-xs font-bold text-white shadow-xs">
                        Batch {cohort.batch}
                      </span>
                      <span className="rounded-lg bg-indigo-100 px-2.5 py-1 text-xs font-extrabold text-indigo-800 border border-indigo-200">
                        {cohort.yearSemLabel}
                      </span>
                      <span className="text-sm font-bold text-slate-800">
                        Year {cohort.year}, Semester {cohort.semester}
                      </span>
                      {cohort.section && (
                        <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700 border border-slate-200">
                          Section {cohort.section}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-500 font-medium">
                        {cohortSlots.length} Slots
                      </span>
                      <span className="rounded-md bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700 border border-emerald-200">
                        {cohort.planner.context.status === "published"
                          ? "Published Master"
                          : "Master Plan"}
                      </span>
                    </div>
                  </div>

                  {/* Day Off message if no slots on this weekday */}
                  {isCohortDayOff && (
                    <div className="rounded-xl border border-dashed border-slate-200 p-4 text-center text-xs text-slate-500">
                      No classes scheduled for {selectedDayName} in this cohort's timetable.
                    </div>
                  )}

                  {/* SINGLE LINE PERIODS for this cohort */}
                  {!isCohortDayOff && !isSunday && cohortSlots.length > 0 && (
                    <div className="flex items-center gap-2.5 overflow-x-auto pb-2 pt-1 scrollbar-thin">
                      {cohortSlots.map((slot) => {
                        const isBreak = isNonClassTimingSlot(slot);
                        const masterEntry = getCohortMasterEntry(cohort, slot.id);
                        const override = cohort.overrides?.[slot.id] ?? null;
                        const changed = isCohortPeriodChanged(cohort, slot.id);

                        const displaySubjectName =
                          override?.subjectName ||
                          masterEntry?.customLabel ||
                          masterEntry?.subjectName ||
                          masterEntry?.subjectCode;
                        const displayFacultyName =
                          override?.facultyName || masterEntry?.facultyName;
                        const hasContent = Boolean(displaySubjectName || displayFacultyName);

                        if (isBreak) {
                          return (
                            <div
                              key={slot.id}
                              className={cn(
                                "flex flex-col justify-center rounded-xl border px-3 py-1.5 text-center text-xs font-semibold h-[56px] min-w-[105px] shrink-0",
                                timingSlotCellClass(slot),
                              )}
                            >
                              <span className="text-xs font-bold leading-tight truncate">
                                {timingSlotDisplayLabel(slot)}
                              </span>
                              <span className="text-[10px] font-normal opacity-75 mt-0.5 leading-tight">
                                {slot.startTime}–{slot.endTime}
                              </span>
                            </div>
                          );
                        }

                        return (
                          <button
                            key={slot.id}
                            type="button"
                            onClick={() => setEditingSlot({ slot, masterEntry, cohort })}
                            className={cn(
                              "group relative flex flex-col justify-between rounded-xl border-2 px-3 py-1.5 text-left transition-all h-[56px] min-w-[210px] max-w-[250px] shrink-0 shadow-xs hover:shadow-md cursor-pointer",
                              !hasContent
                                ? "border-slate-200 bg-slate-50/80 hover:border-slate-300 hover:bg-slate-100"
                                : changed
                                ? "border-rose-300 bg-rose-50/70 hover:border-rose-400 hover:bg-rose-100/90"
                                : "border-emerald-300 bg-emerald-50/70 hover:border-emerald-400 hover:bg-emerald-100/90",
                            )}
                            title={`Click to view comparison and details for ${slot.label}`}
                          >
                            {/* Top row */}
                            <div className="flex items-center justify-between gap-1 w-full leading-none">
                              <div className="flex items-center gap-1.5 truncate">
                                <span
                                  className={cn(
                                    "text-[11px] font-bold uppercase tracking-wider",
                                    changed
                                      ? "text-rose-700"
                                      : hasContent
                                      ? "text-emerald-800"
                                      : "text-slate-500",
                                  )}
                                >
                                  {slot.label}
                                </span>
                                <span className="text-[10px] font-medium text-slate-400 shrink-0">
                                  ({slot.startTime}–{slot.endTime})
                                </span>
                              </div>

                              <div className="flex items-center gap-1 shrink-0">
                                {changed ? (
                                  <span className="inline-flex items-center gap-1 rounded bg-rose-100 px-1.5 py-0.5 text-[9px] font-extrabold text-rose-700 border border-rose-200">
                                    <span className="h-1.5 w-1.5 rounded-full bg-rose-500 animate-pulse" />
                                    <span>Changed</span>
                                  </span>
                                ) : hasContent ? (
                                  <span className="inline-flex items-center gap-1 rounded bg-emerald-100/90 px-1.5 py-0.5 text-[9px] font-extrabold text-emerald-800 border border-emerald-200">
                                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                                    <span>Actual</span>
                                  </span>
                                ) : (
                                  <span className="text-[10px] text-slate-400 font-medium">Free</span>
                                )}
                              </div>
                            </div>

                            {/* Bottom row */}
                            <div className="w-full flex items-center justify-between gap-1 leading-tight text-xs overflow-hidden">
                              {hasContent ? (
                                <p
                                  className={cn(
                                    "truncate font-semibold text-xs",
                                    changed ? "text-rose-950" : "text-emerald-950",
                                  )}
                                >
                                  <span>{displaySubjectName || "Unassigned"}</span>
                                  {displayFacultyName && (
                                    <span
                                      className={cn(
                                        "font-normal ml-1",
                                        changed ? "text-rose-700" : "text-emerald-700",
                                      )}
                                    >
                                      · {displayFacultyName}
                                    </span>
                                  )}
                                </p>
                              ) : (
                                <p className="text-[11px] text-slate-400 italic">Free Period</p>
                              )}

                              <Edit2
                                className={cn(
                                  "h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity shrink-0",
                                  changed ? "text-rose-600" : "text-emerald-700",
                                )}
                              />
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
        </>
      )}

      {/* ============================================================ */}
      {/* SINGLE BATCH VIEW: Renders selected batch schedule in 1 line  */}
      {/* ============================================================ */}
      {!isAllBatchesMode && (
        <>
          {loading && <LoadingAnimation label="Loading timetable..." />}
          {error && (
            <Card className="mb-4 border-red-200 bg-red-50">
              <p className="text-sm text-red-700">{error}</p>
            </Card>
          )}

          {planner?.ready && !loading && (
            <>
              {/* Day off banner */}
              {isDayOff && (
                <Card className="border-amber-200 bg-amber-50 mb-4">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-amber-600" />
                    <p className="text-sm font-semibold text-amber-800">
                      No classes scheduled for {selectedDayName} in the master timetable.
                    </p>
                  </div>
                </Card>
              )}

              {/* SINGLE LINE PERIODS for single batch */}
              {!isDayOff && !isSunday && daySlots.length > 0 && (
                <div className="flex items-center gap-2.5 overflow-x-auto pb-2 pt-1 scrollbar-thin">
                  {daySlots.map((slot) => {
                    const isBreak = isNonClassTimingSlot(slot);
                    const masterEntry = getMasterEntry(slot.id);
                    const override = overrides[slot.id] ?? null;
                    const changed = isPeriodChanged(slot.id);

                    const displaySubjectName =
                      override?.subjectName ||
                      masterEntry?.customLabel ||
                      masterEntry?.subjectName ||
                      masterEntry?.subjectCode;
                    const displayFacultyName = override?.facultyName || masterEntry?.facultyName;
                    const hasContent = Boolean(displaySubjectName || displayFacultyName);

                    if (isBreak) {
                      return (
                        <div
                          key={slot.id}
                          className={cn(
                            "flex flex-col justify-center rounded-xl border px-3 py-1.5 text-center text-xs font-semibold h-[56px] min-w-[105px] shrink-0",
                            timingSlotCellClass(slot),
                          )}
                        >
                          <span className="text-xs font-bold leading-tight truncate">
                            {timingSlotDisplayLabel(slot)}
                          </span>
                          <span className="text-[10px] font-normal opacity-75 mt-0.5 leading-tight">
                            {slot.startTime}–{slot.endTime}
                          </span>
                        </div>
                      );
                    }

                    return (
                      <button
                        key={slot.id}
                        type="button"
                        onClick={() => setEditingSlot({ slot, masterEntry })}
                        className={cn(
                          "group relative flex flex-col justify-between rounded-xl border-2 px-3 py-1.5 text-left transition-all h-[56px] min-w-[210px] max-w-[250px] shrink-0 shadow-xs hover:shadow-md cursor-pointer",
                          !hasContent
                            ? "border-slate-200 bg-slate-50/80 hover:border-slate-300 hover:bg-slate-100"
                            : changed
                            ? "border-rose-300 bg-rose-50/70 hover:border-rose-400 hover:bg-rose-100/90"
                            : "border-emerald-300 bg-emerald-50/70 hover:border-emerald-400 hover:bg-emerald-100/90",
                        )}
                        title={`Click to view comparison and details for ${slot.label}`}
                      >
                        {/* Top row */}
                        <div className="flex items-center justify-between gap-1 w-full leading-none">
                          <div className="flex items-center gap-1.5 truncate">
                            <span
                              className={cn(
                                "text-[11px] font-bold uppercase tracking-wider",
                                changed
                                  ? "text-rose-700"
                                  : hasContent
                                  ? "text-emerald-800"
                                  : "text-slate-500",
                              )}
                            >
                              {slot.label}
                            </span>
                            <span className="text-[10px] font-medium text-slate-400 shrink-0">
                              ({slot.startTime}–{slot.endTime})
                            </span>
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            {changed ? (
                              <span className="inline-flex items-center gap-1 rounded bg-rose-100 px-1.5 py-0.5 text-[9px] font-extrabold text-rose-700 border border-rose-200">
                                <span className="h-1.5 w-1.5 rounded-full bg-rose-500 animate-pulse" />
                                <span>Changed</span>
                              </span>
                            ) : hasContent ? (
                              <span className="inline-flex items-center gap-1 rounded bg-emerald-100/90 px-1.5 py-0.5 text-[9px] font-extrabold text-emerald-800 border border-emerald-200">
                                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                                <span>Actual</span>
                              </span>
                            ) : (
                              <span className="text-[10px] text-slate-400 font-medium">Free</span>
                            )}
                          </div>
                        </div>

                        {/* Bottom row */}
                        <div className="w-full flex items-center justify-between gap-1 leading-tight text-xs overflow-hidden">
                          {hasContent ? (
                            <p
                              className={cn(
                                "truncate font-semibold text-xs",
                                changed ? "text-rose-950" : "text-emerald-950",
                              )}
                            >
                              <span>{displaySubjectName || "Unassigned"}</span>
                              {displayFacultyName && (
                                <span
                                  className={cn(
                                    "font-normal ml-1",
                                    changed ? "text-rose-700" : "text-emerald-700",
                                  )}
                                >
                                  · {displayFacultyName}
                                </span>
                              )}
                            </p>
                          ) : (
                            <p className="text-[11px] text-slate-400 italic">Free Period</p>
                          )}

                          <Edit2
                            className={cn(
                              "h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity shrink-0",
                              changed ? "text-rose-600" : "text-emerald-700",
                            )}
                          />
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </>
          )}

          {!loading && !error && !planner?.ready && filtersComplete && (
            <Card>
              <p className="text-sm text-slate-600">
                No published master timetable found for the selected filters.
              </p>
            </Card>
          )}
        </>
      )}

      {/* Activity & Date Navigation Modal */}
      {activityModalOpen && (
        <ActivityDetailsModal
          selectedDate={selectedDate}
          datesWithActivity={datesWithActivity}
          activities={activities}
          onSelectDate={(ymd) => setSelectedDate(ymd)}
          onClose={() => setActivityModalOpen(false)}
        />
      )}

      {/* Period Comparison & Edit Modal */}
      {editingSlot && (
        <PeriodEditModal
          slot={editingSlot.slot}
          date={selectedDate}
          dayLabel={selectedDayName}
          masterEntry={editingSlot.masterEntry}
          currentOverride={
            editingSlot.cohort
              ? editingSlot.cohort.overrides?.[editingSlot.slot.id] ?? null
              : overrides[editingSlot.slot.id] ?? null
          }
          subjects={
            editingSlot.cohort
              ? editingSlot.cohort.planner.subjects || []
              : planner?.subjects || []
          }
          faculty={
            editingSlot.cohort
              ? editingSlot.cohort.planner.faculty || []
              : planner?.faculty || []
          }
          canEdit={canEditCurrentView}
          onSave={handleSavePeriod}
          onClose={() => setEditingSlot(null)}
        />
      )}
    </div>
  );
}
