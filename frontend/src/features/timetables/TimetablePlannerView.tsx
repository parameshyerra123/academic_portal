"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { LoadingAnimation } from "@/components/ui/LoadingAnimation";
import { ArrowUpDown, Check, Plus, Printer, Search, Users } from "lucide-react";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { cn } from "@/lib/cn";
import { useAcademicContext } from "@/components/layout/AcademicProvider";
import { useAuth } from "@/components/auth/AuthProvider";
import { apiFetch } from "@/lib/api";
import { TimingEditorDrawer } from "@/features/timetables/TimingEditorDrawer";
import {
  classPeriodCellClass,
  emptyPeriodCellClass,
  isNonClassTimingSlot,
  specialPeriodCellClass,
  timingSlotCellClass,
  timingSlotDisplayLabel,
} from "@/features/timetables/timing-slot-utils";

type SlotCellEntry = {
  id: number;
  subjectId: number | null;
  subjectCode: string | null;
  subjectName: string | null;
  subjectTypeSnapshot?: string | null;
  entryType: string;
  facultyStaffLinkId: number | null;
  facultyName: string | null;
  facultyHrmsId: string | null;
  roomLabel: string | null;
  batchLabel?: string | null;
  customLabel?: string | null;
  studentIds?: number[] | null;
  studentCount?: number | null;
  weeklyRotation?: boolean | null;
  rotationPattern?: string | null;
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
    branchId: number | null;
    batch: string;
    year: number | null;
    semester: number | null;
    section: string;
    hasSections: boolean;
    studentCount: number;
    status: string | null;
    timingTemplateName: string | null;
    timingTemplateId?: number;
    planId: number | null;
    versionNo: number | null;
  };
  timing: { id: number; name: string; academicYear: string; semester: number } | null;
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
    employeeGroup: string;
  }>;
};

type LocalAssignment = {
  dayOfWeek: string;
  timingSlotId: number;
  subjectId: number | null;
  subjectCode: string;
  subjectName: string;
  subjectTypeSnapshot: string | null;
  entryType: "theory" | "lab" | "other";
  hrmsEmployeeId: string;
  facultyName: string;
  roomLabel: string;
  /** Classification or batch tag: "Batch 1", "Batch 2" */
  batchLabel: string;
  /** Free/special period label (CRT, Games, Library, etc.) */
  customLabel: string;
  studentIds?: number[] | null;
  studentCount?: number | null;
  weeklyRotation?: boolean | null;
  rotationPattern?: string | null;
};

type SectionStudent = {
  id: number;
  pin_no: string | null;
  student_name: string | null;
  admission_number: string;
};

type PeriodMode = "subject" | "special";

const SPECIAL_PERIOD_SUGGESTIONS = ["CRT", "Games", "Library", "Seminar", "Mentor", "Self Study"];
const BATCH_SUGGESTIONS = ["Batch 1", "Batch 2"];

type ReviewPayload = {
  ok: boolean;
  assignedCount: number;
  unassignedSlots: string[];
  sectionClashes: string[];
  facultyClashes: string[];
  roomClashes: string[];
  warnings: string[];
  unchanged?: boolean;
  unchangedFromPublishedPlanId?: number | null;
  unchangedFromPublishedVersion?: number | null;
  message?: string | null;
};

function assignmentSignature(assignments: LocalAssignment[]): string {
  return JSON.stringify(
    [...assignments]
      .map((item) => ({
        dayOfWeek: item.dayOfWeek,
        timingSlotId: item.timingSlotId,
        subjectId: item.subjectId,
        hrmsEmployeeId: item.hrmsEmployeeId,
        roomLabel: item.roomLabel,
        batchLabel: item.batchLabel,
        customLabel: item.customLabel,
        entryType: item.entryType,
        studentIds: item.studentIds ?? null,
        weeklyRotation: Boolean(item.weeklyRotation),
        rotationPattern: item.rotationPattern ?? null,
      }))
      .sort((a, b) =>
        `${a.dayOfWeek}:${a.timingSlotId}:${a.batchLabel}:${a.subjectId}`.localeCompare(
          `${b.dayOfWeek}:${b.timingSlotId}:${b.batchLabel}:${b.subjectId}`,
        ),
      ),
  );
}

const DAY_LABEL_TO_CODE: Record<string, string> = {
  Monday: "MON",
  Tuesday: "TUE",
  Wednesday: "WED",
  Thursday: "THUR",
  Friday: "FRI",
  Saturday: "SAT",
  Sunday: "SUN",
};

function mapEmsTypeToEntryType(type: string | null | undefined): "theory" | "lab" | "other" {
  const t = (type ?? "").trim().toLowerCase();
  if (t === "practical" || t === "lab" || t === "practicals") return "lab";
  if (t === "theory") return "theory";
  return "other";
}

function subjectCellDisplay(assignment: Pick<LocalAssignment, "subjectCode" | "subjectName">) {
  const code = assignment.subjectCode.trim();
  const name = assignment.subjectName.trim();
  if (name && code) {
    return { title: name, subtitle: code };
  }
  return { title: name || code || "Subject", subtitle: null };
}

function resolveFacultyForSubject(
  assignments: LocalAssignment[],
  subjectId: number,
  entryType: "theory" | "lab" | "other",
  exclude?: { dayOfWeek: string; timingSlotId: number },
) {
  const candidates = assignments.filter((assignment) => {
    if (!assignment.subjectId || !assignment.hrmsEmployeeId) return false;
    if (assignment.subjectId !== subjectId) return false;
    if (
      exclude &&
      assignment.dayOfWeek === exclude.dayOfWeek &&
      assignment.timingSlotId === exclude.timingSlotId
    ) {
      return false;
    }
    return true;
  });
  const typed = candidates.find((assignment) => assignment.entryType === entryType);
  return (typed ?? candidates[0])?.hrmsEmployeeId ?? "";
}

type PlannerFaculty = PlannerResponse["faculty"][number];

function isMeaningfulFacultyField(value: string | null | undefined) {
  const trimmed = (value ?? "").trim();
  return trimmed.length > 0 && trimmed !== "—";
}

function FacultyPickerMeta({
  faculty,
  active = false,
}: {
  faculty: PlannerFaculty;
  active?: boolean;
}) {
  const muted = active ? "text-white/75" : "text-slate-500";
  const label = active ? "text-white/60" : "text-slate-400";
  const emphasis = active ? "text-white/90" : "text-slate-700";

  return (
    <div className="mt-1 space-y-0.5">
      <p className={cn("text-xs", muted)}>
        Emp {faculty.hrmsEmployeeId}
        {isMeaningfulFacultyField(faculty.designation) ? ` · ${faculty.designation}` : ""}
      </p>
      {isMeaningfulFacultyField(faculty.department) ? (
        <p className={cn("text-xs leading-snug", emphasis)}>
          <span className={cn("font-medium", label)}>Dept: </span>
          <span className="break-words">{faculty.department}</span>
        </p>
      ) : null}
      {isMeaningfulFacultyField(faculty.division) ? (
        <p className={cn("text-xs leading-snug", muted)}>
          <span className={cn("font-medium", label)}>Division: </span>
          <span className="break-words">{faculty.division}</span>
        </p>
      ) : null}
    </div>
  );
}

type DraftAllocation = {
  key: string;
  mode: PeriodMode;
  subjectId: string;
  customLabel: string;
  hrmsEmployeeId: string;
  facultyName: string;
  roomLabel: string;
  batchLabel: string;
  entryType: "theory" | "lab" | "other";
  facultySearch: string;
  facultyOpen: boolean;
  studentIds?: number[];
  studentCount?: number;
  weeklyRotation?: boolean;
  rotationPattern?: string | null;
};

function AllocationEditorCard({
  alloc,
  index,
  total,
  isSplit = false,
  studentCount = 0,
  planner,
  assignments,
  dayCode,
  slotId,
  fieldClass,
  onChange,
  onRemove,
}: {
  alloc: DraftAllocation;
  index: number;
  total: number;
  isSplit?: boolean;
  studentCount?: number;
  planner: PlannerResponse;
  assignments: LocalAssignment[];
  dayCode: string;
  slotId: number;
  fieldClass: string;
  onChange: (patch: Partial<DraftAllocation>) => void;
  onRemove: () => void;
}) {
  const filteredFaculty = useMemo(() => {
    const list = planner.faculty ?? [];
    const q = alloc.facultySearch.trim().toLowerCase();
    if (q.length < 2) return [];
    const digitsOnly = q.replace(/\D/g, "");

    return list.filter((f) => {
      const name = (f.name ?? "").toLowerCase();
      const id = (f.hrmsEmployeeId ?? "").toLowerCase();
      const idDigits = (f.hrmsEmployeeId ?? "").replace(/\D/g, "");
      const dept = (f.department ?? "").toLowerCase();
      const div = (f.division ?? "").toLowerCase();
      const desig = (f.designation ?? "").toLowerCase();
      const grp = ((f as { employeeGroup?: string }).employeeGroup ?? "").toLowerCase();

      return (
        name.includes(q) ||
        id.includes(q) ||
        (digitsOnly.length > 0 && idDigits.includes(digitsOnly)) ||
        dept.includes(q) ||
        div.includes(q) ||
        desig.includes(q) ||
        grp.includes(q)
      );
    });
  }, [planner.faculty, alloc.facultySearch]);

  const visibleFaculty = useMemo(
    () => filteredFaculty.slice(0, 6),
    [filteredFaculty],
  );

  const selectedFaculty = useMemo(() => {
    if (!alloc.hrmsEmployeeId) return null;
    return (
      planner.faculty.find((f) => f.hrmsEmployeeId === alloc.hrmsEmployeeId) ?? null
    );
  }, [alloc.hrmsEmployeeId, planner.faculty]);

  const facultyAutoMatched = useMemo(() => {
    if (alloc.mode !== "subject" || !alloc.subjectId || !alloc.hrmsEmployeeId) {
      return false;
    }
    const inferred = resolveFacultyForSubject(
      assignments,
      Number(alloc.subjectId),
      alloc.entryType,
      { dayOfWeek: dayCode, timingSlotId: slotId },
    );
    return inferred === alloc.hrmsEmployeeId;
  }, [alloc.entryType, alloc.hrmsEmployeeId, alloc.mode, alloc.subjectId, assignments, dayCode, slotId]);

  return (
    <div
      className={cn(
        "rounded-xl border p-4 space-y-3.5 shadow-xs transition-colors",
        isSplit
          ? index === 0
            ? "border-indigo-200 bg-indigo-50/25"
            : "border-emerald-200 bg-emerald-50/25"
          : "border-border bg-slate-50/60",
      )}
    >
      <div className="flex items-center justify-between border-b border-border/70 pb-2.5">
        <div className="flex items-center gap-2">
          {isSplit || total > 1 ? (
            <span
              className={cn(
                "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-bold text-white shadow-xs",
                index === 0 ? "bg-indigo-600" : "bg-emerald-600",
              )}
            >
              #{index + 1}
            </span>
          ) : null}
          <span className="text-xs font-bold text-navy-900">
            {isSplit
              ? index === 0
                ? "Batch 1"
                : "Batch 2"
              : total > 1
                ? `Parallel Subject ${index + 1}`
                : "Period Subject & Faculty"}
          </span>
        </div>
        {!isSplit && total > 1 ? (
          <button
            type="button"
            onClick={onRemove}
            className="rounded-md px-2.5 py-1 text-xs font-semibold text-critical hover:bg-critical/10 transition-colors"
          >
            Remove
          </button>
        ) : null}
      </div>

      {/* Batch classification when in split mode: strictly Batch 1 or Batch 2 */}
      {isSplit ? (
        <div className="flex items-center justify-between rounded-lg border border-slate-200/80 bg-white px-3 py-2 text-xs">
          <span className="font-semibold text-slate-700">Designated Batch:</span>
          <span
            className={cn(
              "rounded-full px-3 py-0.5 font-bold text-white text-xs shadow-xs",
              index === 0 ? "bg-indigo-600" : "bg-emerald-600",
            )}
          >
            {index === 0 ? "Batch 1" : "Batch 2"}
          </span>
        </div>
      ) : null}

      {/* Mode toggle */}
      <div className="flex gap-2 rounded-lg border border-border bg-slate-100/70 p-1">
        <button
          type="button"
          className={cn(
            "flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
            alloc.mode === "subject"
              ? "bg-white text-navy-900 shadow-sm"
              : "text-slate-600 hover:text-navy-900",
          )}
          onClick={() =>
            onChange({
              mode: "subject",
              customLabel: "",
            })
          }
        >
          Subject class
        </button>
        <button
          type="button"
          className={cn(
            "flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
            alloc.mode === "special"
              ? "bg-white text-navy-900 shadow-sm"
              : "text-slate-600 hover:text-navy-900",
          )}
          onClick={() =>
            onChange({
              mode: "special",
              subjectId: "",
              entryType: "other",
            })
          }
        >
          Free / Special
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {alloc.mode === "special" ? (
          <label className="block text-sm sm:col-span-2">
            <span className="mb-1.5 block font-medium text-slate-700">Period name</span>
            <input
              className={fieldClass}
              placeholder="e.g. CRT, Games, Library"
              value={alloc.customLabel}
              onChange={(e) => onChange({ customLabel: e.target.value })}
            />
            <div className="mt-2 flex flex-wrap gap-1.5">
              {SPECIAL_PERIOD_SUGGESTIONS.map((label) => (
                <button
                  key={label}
                  type="button"
                  className={cn(
                    "rounded-md border px-2 py-1 text-xs transition-colors",
                    alloc.customLabel.trim().toLowerCase() === label.toLowerCase()
                      ? "border-navy-800 bg-navy-900 text-white"
                      : "border-border bg-white text-slate-600 hover:border-slate-300",
                  )}
                  onClick={() => onChange({ customLabel: label })}
                >
                  {label}
                </button>
              ))}
            </div>
          </label>
        ) : (
          <label className="block text-sm sm:col-span-2">
            <span className="mb-1.5 block font-medium text-slate-700">Subject</span>
            <select
              className={fieldClass}
              value={alloc.subjectId}
              onChange={(e) => {
                const subjectId = e.target.value;
                const subject = planner.subjects.find((s) => String(s.id) === subjectId);
                const entryType = subject ? mapEmsTypeToEntryType(subject.type) : alloc.entryType;
                const inferredFaculty = subjectId
                  ? resolveFacultyForSubject(assignments, Number(subjectId), entryType, {
                      dayOfWeek: dayCode,
                      timingSlotId: slotId,
                    })
                  : "";
                const matchedFacultyObj = inferredFaculty
                  ? planner.faculty.find((f) => f.hrmsEmployeeId === inferredFaculty)
                  : null;
                onChange({
                  subjectId,
                  entryType,
                  hrmsEmployeeId: inferredFaculty || alloc.hrmsEmployeeId,
                  facultyName: matchedFacultyObj?.name || alloc.facultyName,
                  facultySearch: "",
                  facultyOpen: false,
                });
              }}
            >
              <option value="">Select subject</option>
              {planner.subjects.map((subject) => (
                <option key={subject.id} value={subject.id}>
                  {subject.code} — {subject.name}
                  {subject.type ? ` (${subject.type})` : ""}
                </option>
              ))}
            </select>
          </label>
        )}

        <label className="block text-sm">
          <span className="mb-1.5 block font-medium text-slate-700">
            Room / Lab <span className="font-normal text-slate-400">(optional)</span>
          </span>
          <input
            className={fieldClass}
            placeholder="e.g. Lab-1, A-204"
            value={alloc.roomLabel}
            onChange={(e) => onChange({ roomLabel: e.target.value })}
          />
        </label>

        {alloc.mode === "subject" ? (
          <label className="block text-sm">
            <span className="mb-1.5 block font-medium text-slate-700">Class Type</span>
            <select
              className={fieldClass}
              value={alloc.entryType}
              onChange={(e) =>
                onChange({ entryType: e.target.value as "theory" | "lab" | "other" })
              }
            >
              <option value="theory">Theory</option>
              <option value="lab">Lab</option>
              <option value="other">Other</option>
            </select>
          </label>
        ) : (
          <div className="block text-sm">
            <span className="mb-1.5 block font-medium text-slate-700">Type</span>
            <div className={cn(fieldClass, "flex items-center text-slate-600")}>
              Free / Special period
            </div>
          </div>
        )}
      </div>

      {/* Faculty picker */}
      <div className="block text-sm">
        <span className="mb-1.5 block font-medium text-slate-700">
          Faculty {alloc.mode === "special" ? <span className="font-normal text-slate-400">(optional)</span> : null}
        </span>

        {selectedFaculty && !alloc.facultyOpen ? (
          <div className="flex items-start justify-between gap-2 rounded-lg border border-navy-200 bg-navy-50/60 px-3 py-2.5">
            <div className="min-w-0 flex-1">
              <p className="font-medium text-navy-900">{selectedFaculty.name}</p>
              <FacultyPickerMeta faculty={selectedFaculty} />
              {facultyAutoMatched ? (
                <p className="mt-1 text-xs text-emerald-700">
                  Auto-filled from another period for this subject.
                </p>
              ) : null}
            </div>
            <button
              type="button"
              className="shrink-0 text-xs font-medium text-navy-800 hover:underline"
              onClick={() => {
                onChange({ hrmsEmployeeId: "", facultyName: "", facultySearch: "", facultyOpen: true });
              }}
            >
              Change
            </button>
          </div>
        ) : (
          <div className="rounded-lg border border-border bg-white">
            <div className="p-2">
              <input
                type="search"
                autoFocus={!selectedFaculty && alloc.mode === "subject"}
                placeholder="Type at least 2 letters to search faculty…"
                className="h-9 w-full rounded-md border border-border bg-slate-50 px-3 text-sm outline-none focus:border-navy-700 focus:bg-white focus:ring-2 focus:ring-navy-900/10"
                value={alloc.facultySearch}
                onChange={(e) => {
                  onChange({ facultySearch: e.target.value, facultyOpen: true });
                }}
              />
            </div>

            {alloc.facultySearch.trim().length < 2 ? (
              <p className="border-t border-border px-3 py-3 text-xs text-slate-500">
                Search by name, emp no, department, division, or designation.
                {alloc.mode === "special" ? " Faculty is optional for free/special periods." : ""}
              </p>
            ) : filteredFaculty.length === 0 ? (
              <p className="border-t border-border px-3 py-3 text-sm text-slate-500">No matching staff</p>
            ) : (
              <div className="max-h-56 overflow-y-auto border-t border-border p-2">
                <div className="grid grid-cols-1 gap-1.5">
                  {visibleFaculty.map((fac) => {
                    const active = alloc.hrmsEmployeeId === fac.hrmsEmployeeId;
                    return (
                      <button
                        key={fac.hrmsEmployeeId}
                        type="button"
                        className={cn(
                          "flex w-full flex-col items-start rounded-md border px-3 py-2.5 text-left transition-colors",
                          active
                            ? "border-navy-900 bg-navy-900 text-white"
                            : "border-border/80 hover:border-slate-300 hover:bg-slate-50",
                        )}
                        onClick={() => {
                          onChange({
                            hrmsEmployeeId: fac.hrmsEmployeeId,
                            facultyName: fac.name,
                            facultySearch: "",
                            facultyOpen: false,
                          });
                        }}
                      >
                        <span className={cn("text-sm font-medium leading-snug", active ? "text-white" : "text-navy-900")}>
                          {fac.name}
                        </span>
                        <FacultyPickerMeta faculty={fac} active={active} />
                      </button>
                    );
                  })}
                </div>
                {filteredFaculty.length > 6 ? (
                  <p className="mt-2 text-xs text-slate-500">
                    Showing 6 of {filteredFaculty.length} — type more to narrow
                  </p>
                ) : (
                  <p className="mt-2 text-xs text-slate-500">
                    {filteredFaculty.length} match{filteredFaculty.length === 1 ? "" : "es"}
                  </p>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Live student count badge for this batch */}
      {isSplit ? (
        <div
          className={cn(
            "flex items-center justify-between rounded-lg border px-3 py-2 text-xs",
            index === 0
              ? "border-indigo-200 bg-indigo-50/70 text-indigo-900"
              : "border-emerald-200 bg-emerald-50/70 text-emerald-900",
          )}
        >
          <div className="flex items-center gap-1.5 font-semibold">
            <Users className="h-4 w-4" />
            <span>Assigned Students:</span>
          </div>
          <span
            className={cn(
              "rounded-full px-2.5 py-0.5 font-bold text-white text-xs shadow-xs",
              index === 0 ? "bg-indigo-600" : "bg-emerald-600",
            )}
          >
            {studentCount} {studentCount === 1 ? "student" : "students"}
          </span>
        </div>
      ) : null}
    </div>
  );
}

function StudentBatchClassifier({
  students,
  loading,
  allocations,
  studentBatchMap,
  onAssignStudent,
  onAssignMultiple,
}: {
  students: SectionStudent[];
  loading: boolean;
  allocations: DraftAllocation[];
  studentBatchMap: Record<number, string>;
  onAssignStudent: (studentId: number, batchLabel: string | null) => void;
  onAssignMultiple: (assignments: Record<number, string>) => void;
}) {
  const [sortBy, setSortBy] = useState<"pin" | "name">("pin");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [search, setSearch] = useState("");

  const activeBatches = useMemo(() => {
    return ["Batch 1", "Batch 2"];
  }, []);

  const counts = useMemo(() => {
    const map: Record<string, number> = {};
    for (const b of activeBatches) map[b] = 0;
    let unassigned = 0;
    for (const s of students) {
      const assigned = studentBatchMap[s.id];
      if (assigned && map[assigned] !== undefined) {
        map[assigned] = (map[assigned] || 0) + 1;
      } else {
        unassigned++;
      }
    }
    return { map, unassigned, total: students.length };
  }, [students, studentBatchMap, activeBatches]);

  const sortedStudents = useMemo(() => {
    const list = [...students];
    list.sort((a, b) => {
      let cmp = 0;
      if (sortBy === "pin") {
        const pinA = (a.pin_no || a.admission_number || "").trim();
        const pinB = (b.pin_no || b.admission_number || "").trim();
        cmp = pinA.localeCompare(pinB, undefined, { numeric: true, sensitivity: "base" });
      } else {
        const nameA = (a.student_name || "").trim();
        const nameB = (b.student_name || "").trim();
        cmp = nameA.localeCompare(nameB, undefined, { sensitivity: "base" });
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return list;
  }, [students, sortBy, sortDir]);

  const displayedStudents = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return sortedStudents;
    return sortedStudents.filter((s) => {
      const pin = (s.pin_no || "").toLowerCase();
      const adm = (s.admission_number || "").toLowerCase();
      const name = (s.student_name || "").toLowerCase();
      return pin.includes(q) || adm.includes(q) || name.includes(q);
    });
  }, [sortedStudents, search]);

  const handleSplit5050 = () => {
    if (activeBatches.length < 2 || sortedStudents.length === 0) return;
    const half = Math.ceil(sortedStudents.length / 2);
    const batch1 = activeBatches[0];
    const batch2 = activeBatches[1];
    const newMap: Record<number, string> = { ...studentBatchMap };
    sortedStudents.forEach((student, idx) => {
      newMap[student.id] = idx < half ? batch1 : batch2;
    });
    onAssignMultiple(newMap);
  };

  const handleSplitOddEven = () => {
    if (activeBatches.length < 2 || sortedStudents.length === 0) return;
    const batch1 = activeBatches[0];
    const batch2 = activeBatches[1];
    const newMap: Record<number, string> = { ...studentBatchMap };
    sortedStudents.forEach((student) => {
      const digits = (student.pin_no || student.admission_number || "").replace(/\D/g, "");
      const num = digits ? parseInt(digits.slice(-4), 10) : student.id;
      newMap[student.id] = num % 2 !== 0 ? batch1 : batch2;
    });
    onAssignMultiple(newMap);
  };

  const handleShuffleBatches = () => {
    const newMap: Record<number, string> = { ...studentBatchMap };
    students.forEach((s) => {
      const current = studentBatchMap[s.id];
      if (current === "Batch 1") {
        newMap[s.id] = "Batch 2";
      } else if (current === "Batch 2") {
        newMap[s.id] = "Batch 1";
      }
    });
    onAssignMultiple(newMap);
  };

  const handleAssignAll = (batch: string) => {
    const newMap: Record<number, string> = { ...studentBatchMap };
    students.forEach((s) => {
      newMap[s.id] = batch;
    });
    onAssignMultiple(newMap);
  };

  const handleClearAll = () => {
    onAssignMultiple({});
  };

  return (
    <div className="rounded-xl border border-border bg-slate-50/70 p-4 space-y-3.5 shadow-xs">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/70 pb-3">
        <div>
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-navy-800" />
            <h4 className="text-sm font-bold text-navy-900">Student Roster & Batch Allocation</h4>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Assign students from this section to Batch 1 or Batch 2 for practicals or alternate periods.
          </p>
        </div>

        {/* Badges / summary counts */}
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <span className="rounded-md bg-white border border-border px-2 py-0.5 font-medium text-slate-700">
            Total: <strong>{counts.total}</strong>
          </span>
          {activeBatches.map((batch, bIdx) => (
            <span
              key={batch}
              className={cn(
                "rounded-md border px-2 py-0.5 font-semibold",
                bIdx === 0
                  ? "bg-indigo-50 border-indigo-200 text-indigo-800"
                  : "bg-emerald-50 border-emerald-200 text-emerald-800",
              )}
            >
              {batch}: <strong>{counts.map[batch] ?? 0}</strong>
            </span>
          ))}
          {counts.unassigned > 0 ? (
            <span className="rounded-md bg-amber-50 border border-amber-200 px-2 py-0.5 font-semibold text-amber-800">
              Unassigned: <strong>{counts.unassigned}</strong>
            </span>
          ) : (
            <span className="rounded-md bg-emerald-50 border border-emerald-200 px-2 py-0.5 font-semibold text-emerald-700 flex items-center gap-1">
              <Check className="h-3 w-3" /> All Assigned
            </span>
          )}
        </div>
      </div>

      {/* Controls toolbar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-2.5 bg-white p-2.5 rounded-lg border border-border">
        {/* Sort controls */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="font-semibold text-slate-600 flex items-center gap-1">
            <ArrowUpDown className="h-3.5 w-3.5 text-slate-400" /> Order by:
          </span>
          <div className="inline-flex rounded-md border border-border bg-slate-100 p-0.5">
            <button
              type="button"
              onClick={() => setSortBy("pin")}
              className={cn(
                "rounded px-2 py-1 font-medium transition-colors",
                sortBy === "pin" ? "bg-white text-navy-900 shadow-xs" : "text-slate-600 hover:text-navy-900",
              )}
            >
              PIN / Roll No
            </button>
            <button
              type="button"
              onClick={() => setSortBy("name")}
              className={cn(
                "rounded px-2 py-1 font-medium transition-colors",
                sortBy === "name" ? "bg-white text-navy-900 shadow-xs" : "text-slate-600 hover:text-navy-900",
              )}
            >
              Student Name
            </button>
          </div>
          <button
            type="button"
            onClick={() => setSortDir((d) => (d === "asc" ? "desc" : "asc"))}
            className="rounded border border-border bg-white px-2 py-1 font-medium text-slate-700 hover:bg-slate-50 transition-colors"
            title="Toggle sort direction"
          >
            {sortDir === "asc" ? "Asc (↑)" : "Desc (↓)"}
          </button>
        </div>

        {/* Quick actions */}
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <span className="text-slate-400 font-medium">Quick batching:</span>
          <button
            type="button"
            onClick={handleSplit5050}
            className="rounded border border-indigo-200 bg-indigo-50 px-2 py-1 font-semibold text-indigo-800 hover:bg-indigo-100 transition-colors"
            title="Assign first 50% to Batch 1 and second 50% to Batch 2 based on current order"
          >
            Split 50 / 50
          </button>
          <button
            type="button"
            onClick={handleSplitOddEven}
            className="rounded border border-emerald-200 bg-emerald-50 px-2 py-1 font-semibold text-emerald-800 hover:bg-emerald-100 transition-colors"
            title="Assign odd roll numbers to Batch 1 and even roll numbers to Batch 2"
          >
            Odd / Even PIN
          </button>
          <button
            type="button"
            onClick={handleShuffleBatches}
            className="rounded border border-purple-200 bg-purple-50 px-2.5 py-1 font-semibold text-purple-800 hover:bg-purple-100 transition-colors flex items-center gap-1 shadow-xs"
            title="Swap Batch 1 students to Batch 2 and Batch 2 students to Batch 1"
          >
            <ArrowUpDown className="h-3.5 w-3.5 rotate-90" />
            ⇄ Shuffle / Swap Batches
          </button>
          <button
            type="button"
            onClick={() => handleAssignAll("Batch 1")}
            className="rounded border border-slate-200 bg-slate-50 px-2 py-1 font-medium text-slate-700 hover:bg-slate-100 transition-colors"
          >
            All → Batch 1
          </button>
          <button
            type="button"
            onClick={() => handleAssignAll("Batch 2")}
            className="rounded border border-slate-200 bg-slate-50 px-2 py-1 font-medium text-slate-700 hover:bg-slate-100 transition-colors"
          >
            All → Batch 2
          </button>
          <button
            type="button"
            onClick={handleClearAll}
            className="rounded border border-slate-200 px-2 py-1 font-medium text-slate-500 hover:text-critical hover:border-critical/30 transition-colors"
          >
            Clear
          </button>
        </div>
      </div>

      {/* Search and list */}
      <div className="space-y-2">
        <div className="relative">
          <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
          <input
            type="search"
            placeholder="Search students by PIN or name..."
            className="h-8.5 w-full rounded-md border border-border bg-white pl-8 pr-3 text-xs outline-none focus:border-navy-700 focus:ring-1 focus:ring-navy-900/10"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {loading ? (
          <div className="p-8 text-center text-xs text-slate-500">
            <div className="inline-block animate-spin rounded-full h-4 w-4 border-2 border-navy-900 border-t-transparent mr-2" />
            Loading student roster...
          </div>
        ) : displayedStudents.length === 0 ? (
          <div className="p-6 text-center text-xs text-slate-500 bg-white rounded-lg border border-border">
            {students.length === 0
              ? "No students registered in this section or branch."
              : "No students match your search filter."}
          </div>
        ) : (
          <div className="max-h-60 overflow-y-auto rounded-lg border border-border bg-white divide-y divide-border/60">
            {displayedStudents.map((student, sIdx) => {
              const assignedBatch = studentBatchMap[student.id];
              return (
                <div
                  key={student.id}
                  className="flex items-center justify-between py-2 px-3 hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1 mr-3">
                    <span className="w-6 text-[11px] text-slate-400 font-mono text-right shrink-0">
                      {sIdx + 1}
                    </span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-xs font-bold text-navy-900 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                          {student.pin_no || student.admission_number}
                        </span>
                        <span className="text-xs font-medium text-slate-800 truncate">
                          {student.student_name || "Unnamed Student"}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    {activeBatches.map((batch, bIdx) => {
                      const active = assignedBatch === batch;
                      return (
                        <button
                          key={batch}
                          type="button"
                          onClick={() => onAssignStudent(student.id, active ? null : batch)}
                          className={cn(
                            "px-2.5 py-1 rounded text-xs font-semibold border transition-all",
                            active
                              ? bIdx === 0
                                ? "bg-indigo-600 border-indigo-700 text-white shadow-xs"
                                : "bg-emerald-600 border-emerald-700 text-white shadow-xs"
                              : "bg-white border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50",
                          )}
                        >
                          {batch}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export function TimetablePlannerView({ embedded = false }: { embedded?: boolean }) {
  const { filters, masters } = useAcademicContext();
  const { hasPermission, hasAnyPermission } = useAuth();
  const canEdit = hasPermission("timetable.edit");
  const canPublish = hasPermission("timetable.publish");
  const canConfigureTimings = hasAnyPermission("timetable.edit");
  const [planner, setPlanner] = useState<PlannerResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [assignments, setAssignments] = useState<LocalAssignment[]>([]);
  const [selected, setSelected] = useState<{
    day: string;
    slotId: number;
  } | null>(null);
  const [review, setReview] = useState<ReviewPayload | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [baselineSignature, setBaselineSignature] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [timingsOpen, setTimingsOpen] = useState(false);
  const [slotAllocations, setSlotAllocations] = useState<DraftAllocation[]>([]);
  const [isSplit, setIsSplit] = useState(false);
  const [sectionStudents, setSectionStudents] = useState<SectionStudent[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [studentBatchMap, setStudentBatchMap] = useState<Record<number, string>>({});
  const [weeklyRotation, setWeeklyRotation] = useState(false);
  const [rotationPattern, setRotationPattern] = useState<number[]>([1, 2, 1, 2]);

  const selectedBranch =
    filters.branchId === "all" || !masters
      ? null
      : masters.branches.find((b) => b.id === filters.branchId) ?? null;

  const selectedCollege =
    filters.collegeId === "all" || !masters
      ? null
      : masters.colleges.find((c) => c.id === filters.collegeId) ?? null;

  const timingContextReady =
    filters.collegeId !== "all" &&
    Boolean(filters.academicYear) &&
    filters.semester !== "all";

  const needsSection = Boolean(selectedBranch?.hasSections);
  const filtersComplete =
    filters.collegeId !== "all" &&
    filters.courseId !== "all" &&
    filters.branchId !== "all" &&
    filters.batch !== "all" &&
    filters.semester !== "all" &&
    Boolean(filters.academicYear) &&
    (!needsSection || filters.section !== "all");

  const query = useMemo(() => {
    if (!filtersComplete) return null;
    const params = new URLSearchParams();
    params.set("collegeId", String(filters.collegeId));
    params.set("courseId", String(filters.courseId));
    params.set("branchId", String(filters.branchId));
    params.set("batch", String(filters.batch));
    params.set("semester", String(filters.semester));
    params.set("academicYear", filters.academicYear);
    if (filters.year !== "all") params.set("year", String(filters.year));
    if (filters.section !== "all") params.set("section", filters.section);
    return `?${params.toString()}`;
  }, [filters, filtersComplete]);

  const fetchSectionStudents = useCallback(async () => {
    if (!filtersComplete || !filters.collegeId || filters.collegeId === "all") {
      setSectionStudents([]);
      return;
    }
    setLoadingStudents(true);
    try {
      const params = new URLSearchParams();
      params.set("collegeId", String(filters.collegeId));
      if (filters.courseId !== "all") params.set("courseId", String(filters.courseId));
      if (filters.branchId !== "all") params.set("branchId", String(filters.branchId));
      if (filters.batch !== "all") params.set("batch", String(filters.batch));
      if (filters.year !== "all") params.set("year", String(filters.year));
      if (filters.semester !== "all") params.set("semester", String(filters.semester));
      if (filters.section !== "all") params.set("section", String(filters.section));
      params.set("limit", "500");

      const res = await apiFetch(`/students?${params.toString()}`);
      if (res.ok) {
        const json = await res.json();
        const list: SectionStudent[] = (json.data ?? []).map((s: {
          id: number;
          pin_no?: string | null;
          student_name?: string | null;
          admission_number: string;
        }) => ({
          id: s.id,
          pin_no: s.pin_no ?? null,
          student_name: s.student_name ?? null,
          admission_number: s.admission_number,
        }));
        setSectionStudents(list);
      }
    } catch (err) {
      console.warn("Failed to fetch students for section", err);
    } finally {
      setLoadingStudents(false);
    }
  }, [filters, filtersComplete]);

  useEffect(() => {
    void fetchSectionStudents();
  }, [fetchSectionStudents]);

  const loadPlanner = useCallback(async () => {
    if (!query) {
      setPlanner(null);
      setAssignments([]);
      setReview(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const response = await apiFetch(`/timetables/planner${query}`, {
        cache: "no-store",
      });
      if (!response.ok) throw new Error(`Failed to load planner (${response.status})`);
      const data = (await response.json()) as PlannerResponse;
      setPlanner(data);
      const loaded: LocalAssignment[] = [];
      for (const day of data.days ?? []) {
        const dayGrid = data.grid?.[day] ?? {};
        for (const cell of Object.values(dayGrid)) {
          if (!cell.assignable) continue;
          const cellEntries =
            Array.isArray(cell.entries) && cell.entries.length > 0
              ? cell.entries
              : cell.entry
                ? [cell.entry]
                : [];
          for (const ent of cellEntries) {
            const customLabel = (ent.customLabel ?? "").trim();
            const isSpecial = Boolean(customLabel) && !ent.subjectId;
            const isSubjectClass =
              Boolean(ent.subjectId) && Boolean(ent.facultyHrmsId);
            if (!isSpecial && !isSubjectClass) continue;
            loaded.push({
              dayOfWeek: DAY_LABEL_TO_CODE[day] ?? day,
              timingSlotId: cell.slotId,
              subjectId: ent.subjectId,
              subjectCode: ent.subjectCode ?? "",
              subjectName: ent.subjectName ?? "",
              subjectTypeSnapshot: ent.subjectTypeSnapshot ?? null,
              entryType: (ent.entryType as "theory" | "lab" | "other") || "theory",
              hrmsEmployeeId: ent.facultyHrmsId ?? "",
              facultyName: ent.facultyName ?? "",
              roomLabel: ent.roomLabel ?? "",
              batchLabel: ent.batchLabel ?? "",
              customLabel: isSpecial ? customLabel : "",
              studentIds: ent.studentIds ?? null,
              studentCount: ent.studentCount ?? null,
              weeklyRotation: Boolean(ent.weeklyRotation),
              rotationPattern: ent.rotationPattern ?? null,
            });
          }
        }
      }
      setAssignments(loaded);
      setBaselineSignature(assignmentSignature(loaded));
      setReview(null);
      setInfo(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load planner");
      setPlanner(null);
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => {
    void loadPlanner();
  }, [loadPlanner]);

  const currentSignature = useMemo(() => assignmentSignature(assignments), [assignments]);
  const hasLocalChanges =
    baselineSignature != null && currentSignature !== baselineSignature;
  const isPublished = planner?.context.status === "published";
  const publishBlocked = isPublished && !hasLocalChanges;

  const assignmentsBySlot = useMemo(() => {
    const map = new Map<string, LocalAssignment[]>();
    for (const item of assignments) {
      const key = `${item.dayOfWeek}:${item.timingSlotId}`;
      const list = map.get(key) ?? [];
      list.push(item);
      map.set(key, list);
    }
    return map;
  }, [assignments]);

  const assignmentMap = useMemo(() => {
    const map = new Map<string, LocalAssignment>();
    for (const item of assignments) {
      const key = `${item.dayOfWeek}:${item.timingSlotId}`;
      if (!map.has(key)) {
        map.set(key, item);
      }
    }
    return map;
  }, [assignments]);

  const openAssign = (day: string, cell: SlotCell) => {
    if (!cell.assignable) return;
    const dayCode = DAY_LABEL_TO_CODE[day] ?? day;
    const existingList = assignmentsBySlot.get(`${dayCode}:${cell.slotId}`) ?? [];
    setSelected({ day, slotId: cell.slotId });

    const hasRotation = existingList.some((item) => Boolean(item.weeklyRotation));
    const hasSplit =
      existingList.length > 1 ||
      Boolean(existingList[0]?.batchLabel) ||
      Boolean(existingList[0]?.studentIds && existingList[0]!.studentIds!.length > 0) ||
      hasRotation;

    setIsSplit(hasSplit);
    setWeeklyRotation(hasRotation);

    const rawPattern = existingList.find((i) => i.rotationPattern)?.rotationPattern;
    let initialPattern = [1, 2, 1, 2];
    if (rawPattern && rawPattern.trim()) {
      const parts = rawPattern.split(",").map((x) => parseInt(x.trim(), 10));
      if (parts.length === 4 && parts.every((n) => n === 1 || n === 2)) {
        initialPattern = parts;
      }
    }
    setRotationPattern(initialPattern);

    // Reconstruct studentBatchMap from saved assignments
    const initialBatchMap: Record<number, string> = {};
    if (hasSplit) {
      existingList.forEach((item, idx) => {
        const bLabel = item.batchLabel.trim() || `Batch ${idx + 1}`;
        if (Array.isArray(item.studentIds)) {
          item.studentIds.forEach((sid) => {
            initialBatchMap[sid] = bLabel;
          });
        }
      });
    }
    setStudentBatchMap(initialBatchMap);

    if (existingList.length === 0) {
      setSlotAllocations([
        {
          key: Math.random().toString(36).substring(2, 9),
          mode: "subject",
          subjectId: "",
          customLabel: "",
          hrmsEmployeeId: "",
          facultyName: "",
          roomLabel: "",
          batchLabel: "",
          entryType: "theory",
          facultySearch: "",
          facultyOpen: false,
          weeklyRotation: false,
          rotationPattern: null,
        },
      ]);
    } else if (hasSplit) {
      // Strictly 2 batches: Batch 1 and Batch 2
      const b1Source =
        existingList.find((i) => i.batchLabel?.toLowerCase() === "batch 1") ?? existingList[0];
      const b2Source =
        existingList.find((i) => i.batchLabel?.toLowerCase() === "batch 2") ?? existingList[1];

      const makeAlloc = (src: LocalAssignment | undefined, defaultBatch: string): DraftAllocation => {
        if (!src) {
          return {
            key: Math.random().toString(36).substring(2, 9),
            mode: "subject",
            subjectId: "",
            customLabel: "",
            hrmsEmployeeId: "",
            facultyName: "",
            roomLabel: "",
            batchLabel: defaultBatch,
            entryType: "theory",
            facultySearch: "",
            facultyOpen: false,
            weeklyRotation: hasRotation,
            rotationPattern: rawPattern ?? "1,2,1,2",
          };
        }
        return {
          key: `${src.subjectId || src.customLabel || defaultBatch}-${Math.random().toString(36).substring(2, 6)}`,
          mode: Boolean(src.customLabel) && !src.subjectId ? "special" : "subject",
          subjectId: src.subjectId ? String(src.subjectId) : "",
          customLabel: src.customLabel || "",
          hrmsEmployeeId: src.hrmsEmployeeId || "",
          facultyName: src.facultyName || "",
          roomLabel: src.roomLabel || "",
          batchLabel: defaultBatch,
          entryType: src.entryType || "theory",
          facultySearch: "",
          facultyOpen: false,
          studentIds: src.studentIds ?? undefined,
          studentCount: src.studentCount ?? undefined,
          weeklyRotation: Boolean(src.weeklyRotation),
          rotationPattern: src.rotationPattern ?? null,
        };
      };

      setSlotAllocations([makeAlloc(b1Source, "Batch 1"), makeAlloc(b2Source, "Batch 2")]);
    } else {
      setSlotAllocations(
        existingList.map((item, idx) => ({
          key: `${item.subjectId || item.customLabel || idx}-${idx}-${Math.random().toString(36).substring(2, 6)}`,
          mode: Boolean(item.customLabel) && !item.subjectId ? "special" : "subject",
          subjectId: item.subjectId ? String(item.subjectId) : "",
          customLabel: item.customLabel || "",
          hrmsEmployeeId: item.hrmsEmployeeId || "",
          facultyName: item.facultyName || "",
          roomLabel: item.roomLabel || "",
          batchLabel: item.batchLabel || "",
          entryType: item.entryType || "theory",
          facultySearch: "",
          facultyOpen: false,
          studentIds: item.studentIds ?? undefined,
          studentCount: item.studentCount ?? undefined,
          weeklyRotation: Boolean(item.weeklyRotation),
          rotationPattern: item.rotationPattern ?? null,
        })),
      );
    }
  };

  const handleToggleSplit = (checked: boolean) => {
    setIsSplit(checked);
    if (checked) {
      setSlotAllocations((prev) => {
        const b1: DraftAllocation = prev[0]
          ? { ...prev[0], batchLabel: "Batch 1" }
          : {
              key: Math.random().toString(36).substring(2, 9),
              mode: "subject",
              subjectId: "",
              customLabel: "",
              hrmsEmployeeId: "",
              facultyName: "",
              roomLabel: "",
              batchLabel: "Batch 1",
              entryType: "theory",
              facultySearch: "",
              facultyOpen: false,
              weeklyRotation: false,
            };
        const b2: DraftAllocation = prev[1]
          ? { ...prev[1], batchLabel: "Batch 2" }
          : {
              key: Math.random().toString(36).substring(2, 9),
              mode: "subject",
              subjectId: "",
              customLabel: "",
              hrmsEmployeeId: "",
              facultyName: "",
              roomLabel: "",
              batchLabel: "Batch 2",
              entryType: "theory",
              facultySearch: "",
              facultyOpen: false,
              weeklyRotation: false,
            };
        return [b1, b2];
      });

      // Default to 50/50 split if students are available and unassigned
      if (sectionStudents.length > 0 && Object.keys(studentBatchMap).length === 0) {
        const half = Math.ceil(sectionStudents.length / 2);
        const newMap: Record<number, string> = {};
        sectionStudents.forEach((s, idx) => {
          newMap[s.id] = idx < half ? "Batch 1" : "Batch 2";
        });
        setStudentBatchMap(newMap);
      }
    } else {
      setWeeklyRotation(false);
      setRotationPattern([1, 2, 1, 2]);
      setSlotAllocations((prev) => {
        const first = prev[0] || {
          key: Math.random().toString(36).substring(2, 9),
          mode: "subject" as PeriodMode,
          subjectId: "",
          customLabel: "",
          hrmsEmployeeId: "",
          facultyName: "",
          roomLabel: "",
          batchLabel: "",
          entryType: "theory" as const,
          facultySearch: "",
          facultyOpen: false,
          weeklyRotation: false,
          rotationPattern: null,
        };
        return [{ ...first, batchLabel: "", weeklyRotation: false, rotationPattern: null }];
      });
      setStudentBatchMap({});
    }
  };

  const updateAllocation = (index: number, patch: Partial<DraftAllocation>) => {
    setSlotAllocations((prev) =>
      prev.map((item, i) => (i === index ? { ...item, ...patch } : item)),
    );
  };

  const removeAllocation = (index: number) => {
    setSlotAllocations((prev) => {
      if (prev.length <= 1) return prev;
      return prev.filter((_, i) => i !== index);
    });
  };

  const saveLocalAssignment = () => {
    if (!selected || !planner) return;
    const dayCode = DAY_LABEL_TO_CODE[selected.day] ?? selected.day;

    if (slotAllocations.length === 0) {
      setError("Please add at least one subject or special period allocation.");
      return;
    }

    const newItems: LocalAssignment[] = [];
    for (let i = 0; i < slotAllocations.length; i++) {
      const alloc = slotAllocations[i];
      const bLabel = isSplit ? (alloc.batchLabel.trim() || `Batch ${i + 1}`) : "";

      let assignedStudentIds: number[] | null = null;
      let assignedStudentCount: number | null = null;
      if (isSplit) {
        const sids = Object.entries(studentBatchMap)
          .filter(([_, batch]) => batch === bLabel)
          .map(([id]) => Number(id));
        assignedStudentIds = sids.length > 0 ? sids : null;
        assignedStudentCount = sids.length;
      }

      if (alloc.mode === "special") {
        const customLabel = alloc.customLabel.trim();
        if (!customLabel) {
          setError(`Period #${i + 1}: Free/Special period name is required (e.g. CRT, Games, Library).`);
          return;
        }
        const faculty = alloc.hrmsEmployeeId
          ? planner.faculty.find((f) => f.hrmsEmployeeId === alloc.hrmsEmployeeId)
          : null;

        newItems.push({
          dayOfWeek: dayCode,
          timingSlotId: selected.slotId,
          subjectId: null,
          subjectCode: "",
          subjectName: "",
          subjectTypeSnapshot: null,
          entryType: "other",
          hrmsEmployeeId: faculty?.hrmsEmployeeId ?? (alloc.hrmsEmployeeId.trim() || ""),
          facultyName: faculty?.name ?? (alloc.facultyName.trim() || ""),
          roomLabel: alloc.roomLabel.trim(),
          batchLabel: bLabel,
          customLabel,
          studentIds: assignedStudentIds,
          studentCount: assignedStudentCount,
          weeklyRotation: isSplit ? weeklyRotation : false,
          rotationPattern: isSplit && weeklyRotation ? rotationPattern.join(",") : null,
        });
      } else {
        const subject = planner.subjects.find((s) => String(s.id) === alloc.subjectId);
        const faculty = planner.faculty.find((f) => f.hrmsEmployeeId === alloc.hrmsEmployeeId);

        if (!subject || !faculty) {
          setError(`Period #${i + 1}: Both Subject and Faculty are required.`);
          return;
        }

        newItems.push({
          dayOfWeek: dayCode,
          timingSlotId: selected.slotId,
          subjectId: subject.id,
          subjectCode: subject.code,
          subjectName: subject.name,
          subjectTypeSnapshot: subject.type ?? null,
          entryType: alloc.entryType,
          hrmsEmployeeId: faculty.hrmsEmployeeId,
          facultyName: faculty.name,
          roomLabel: alloc.roomLabel.trim(),
          batchLabel: bLabel,
          customLabel: "",
          studentIds: assignedStudentIds,
          studentCount: assignedStudentCount,
          weeklyRotation: isSplit ? weeklyRotation : false,
          rotationPattern: isSplit && weeklyRotation ? rotationPattern.join(",") : null,
        });
      }
    }

    // Check for duplicate faculty within the same slot
    const assignedFacs = new Set<string>();
    for (const item of newItems) {
      if (item.hrmsEmployeeId) {
        if (assignedFacs.has(item.hrmsEmployeeId)) {
          setError(
            `Faculty "${item.facultyName}" cannot be assigned multiple times in the same slot. Please choose another faculty for parallel batches.`,
          );
          return;
        }
        assignedFacs.add(item.hrmsEmployeeId);
      }
    }

    // Check for duplicate batch labels if multi-allocation
    if (newItems.length > 1) {
      const seenBatches = new Set<string>();
      for (const item of newItems) {
        const bl = item.batchLabel.trim().toLowerCase();
        if (bl) {
          if (seenBatches.has(bl)) {
            setError(
              `Duplicate batch label "${item.batchLabel}". Please specify unique batch labels (e.g., Batch 1, Batch 2) for parallel periods.`,
            );
            return;
          }
          seenBatches.add(bl);
        }
      }
    }

    setAssignments((prev) => {
      const next = prev.filter(
        (a) => !(a.dayOfWeek === dayCode && a.timingSlotId === selected.slotId),
      );
      next.push(...newItems);
      return next;
    });

    setSelected(null);
    setError(null);
  };

  const clearLocalAssignment = () => {
    if (!selected) return;
    const dayCode = DAY_LABEL_TO_CODE[selected.day] ?? selected.day;
    setAssignments((prev) =>
      prev.filter(
        (a) => !(a.dayOfWeek === dayCode && a.timingSlotId === selected.slotId),
      ),
    );
    setSelected(null);
    setError(null);
  };

  const scopeBody = () => {
    if (!planner?.context || filters.collegeId === "all") return null;
    return {
      collegeId: Number(filters.collegeId),
      courseId: Number(filters.courseId),
      branchId: Number(filters.branchId),
      academicYear: filters.academicYear,
      batch: String(filters.batch),
      year: filters.year === "all" ? null : Number(filters.year),
      semester: Number(filters.semester),
      section: filters.section === "all" ? null : filters.section,
      assignments: assignments.map((a) => ({
        dayOfWeek: a.dayOfWeek,
        timingSlotId: a.timingSlotId,
        subjectId: a.subjectId,
        entryType: a.entryType,
        hrmsEmployeeId: a.hrmsEmployeeId || null,
        facultyName: a.facultyName || null,
        roomLabel: a.roomLabel || null,
        batchLabel: a.batchLabel || null,
        customLabel: a.customLabel || null,
        studentIds: a.studentIds && a.studentIds.length > 0 ? a.studentIds : null,
        studentCount:
          typeof a.studentCount === "number"
            ? a.studentCount
            : Array.isArray(a.studentIds) && a.studentIds.length > 0
              ? a.studentIds.length
              : null,
        weeklyRotation: Boolean(a.weeklyRotation),
        rotationPattern: a.rotationPattern ?? null,
      })),
    };
  };

  const saveDraft = async () => {
    const body = scopeBody();
    if (!body) return;
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      const response = await apiFetch(`/timetables/draft`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Save draft failed");
      if (data.unchanged) {
        setInfo(
          `Timetable is already published (plan #${data.planId}, version ${data.versionNo ?? "—"}) with no changes.`,
        );
      }
      await loadPlanner();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save draft failed");
    } finally {
      setBusy(false);
    }
  };

  const runReview = async () => {
    await saveDraft();
    const planId = planner?.context.planId;
    // reload to get plan id after save
    const body = scopeBody();
    if (!body) return;
    setBusy(true);
    try {
      const plannerRes = await apiFetch(`/timetables/planner${query}`, {
        cache: "no-store",
      });
      const latest = (await plannerRes.json()) as PlannerResponse;
      const id = latest.context.planId ?? planId;
      if (!id) throw new Error("Save draft first");
      const response = await apiFetch(`/timetables/${id}/review`, {
        method: "POST",
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Review failed");
      setReview(data.review as ReviewPayload);
      await loadPlanner();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Review failed");
    } finally {
      setBusy(false);
    }
  };

  const publish = async () => {
    if (publishBlocked) {
      setInfo(
        `This timetable is already published (plan #${planner?.context.planId ?? "—"}, version ${planner?.context.versionNo ?? "—"}). Edit a period before publishing again.`,
      );
      return;
    }
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      await saveDraft();
      const plannerRes = await apiFetch(`/timetables/planner${query}`, {
        cache: "no-store",
      });
      const latest = (await plannerRes.json()) as PlannerResponse;
      const id = latest.context.planId;
      if (!id) throw new Error("No draft plan to publish");
      const response = await apiFetch(`/timetables/${id}/publish`, {
        method: "POST",
      });
      const data = await response.json();
      if (!response.ok) {
        if (data.review) setReview(data.review as ReviewPayload);
        throw new Error(data.message || "Publish failed");
      }
      setReview(data.review as ReviewPayload);
      await loadPlanner();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Publish failed");
    } finally {
      setBusy(false);
    }
  };

  const missingLabel = !filtersComplete
    ? "Select College, Course, Branch, Batch, Semester" +
      (needsSection ? ", and Section" : "") +
      " to open the timetable."
    : null;

  const headerSlots = useMemo(() => {
    if (!planner?.days?.length) return [];
    // Use Monday (or first day) class+break structure for column headers when days share labels;
    // otherwise show union of labels from first day only for compact display.
    const firstDay = planner.days[0];
    return planner.slotsByDay?.[firstDay] ?? [];
  }, [planner]);

  const selectedSlotMeta = useMemo(() => {
    if (!selected || !planner) return null;
    const daySlots = planner.slotsByDay?.[selected.day] ?? [];
    return daySlots.find((s) => s.id === selected.slotId) ?? null;
  }, [selected, planner]);

  const uniqueAllocations = useMemo(() => {
    if (!planner?.days?.length) return [];
    const map = new Map<string, {
      subjectCode: string;
      subjectName: string;
      facultyName: string;
      roomLabel: string;
      batchLabel: string;
      customLabel: string;
      weeklyRotation: boolean;
      rotationPattern?: string | null;
    }>();

    for (const day of planner.days) {
      const daySlots = planner.slotsByDay?.[day] ?? [];
      for (const slot of daySlots) {
        if (isNonClassTimingSlot(slot)) continue;
        const cell = planner.grid[day]?.[slot.id];
        const dayCode = DAY_LABEL_TO_CODE[day] ?? day;
        const locals = assignmentsBySlot.get(`${dayCode}:${slot.id}`) ?? [];

        if (locals.length > 0) {
          for (const local of locals) {
            if (local.customLabel) {
              const key = `custom:${local.customLabel.trim().toLowerCase()}:${local.batchLabel.trim().toLowerCase()}`;
              if (!map.has(key)) {
                map.set(key, {
                  subjectCode: "—",
                  subjectName: local.customLabel,
                  facultyName: local.facultyName || "—",
                  roomLabel: local.roomLabel || "—",
                  batchLabel: local.batchLabel || "",
                  customLabel: local.customLabel,
                  weeklyRotation: Boolean(local.weeklyRotation),
                  rotationPattern: local.rotationPattern ?? null,
                });
              }
            } else if (local.subjectName || local.subjectCode) {
              const key = `${local.subjectCode || local.subjectId}:${local.facultyName || ""}:${local.batchLabel.trim().toLowerCase()}`;
              if (!map.has(key)) {
                map.set(key, {
                  subjectCode: local.subjectCode || "—",
                  subjectName: local.subjectName || "Subject",
                  facultyName: local.facultyName || "Unassigned",
                  roomLabel: local.roomLabel || "—",
                  batchLabel: local.batchLabel || "",
                  customLabel: "",
                  weeklyRotation: Boolean(local.weeklyRotation),
                  rotationPattern: local.rotationPattern ?? null,
                });
              }
            }
          }
        } else if (cell?.entries?.length) {
          for (const entry of cell.entries) {
            if (entry.customLabel) {
              const key = `custom:${entry.customLabel.trim().toLowerCase()}:${(entry.batchLabel ?? "").trim().toLowerCase()}`;
              if (!map.has(key)) {
                map.set(key, {
                  subjectCode: "—",
                  subjectName: entry.customLabel,
                  facultyName: entry.facultyName || "—",
                  roomLabel: entry.roomLabel || "—",
                  batchLabel: entry.batchLabel || "",
                  customLabel: entry.customLabel,
                  weeklyRotation: Boolean(entry.weeklyRotation),
                  rotationPattern: entry.rotationPattern ?? null,
                });
              }
            } else if (entry.subjectName || entry.subjectCode) {
              const key = `${entry.subjectCode || entry.subjectId}:${entry.facultyName || ""}:${(entry.batchLabel ?? "").trim().toLowerCase()}`;
              if (!map.has(key)) {
                map.set(key, {
                  subjectCode: entry.subjectCode || "—",
                  subjectName: entry.subjectName || "Subject",
                  facultyName: entry.facultyName || "Unassigned",
                  roomLabel: entry.roomLabel || "—",
                  batchLabel: entry.batchLabel || "",
                  customLabel: "",
                  weeklyRotation: Boolean(entry.weeklyRotation),
                  rotationPattern: entry.rotationPattern ?? null,
                });
              }
            }
          }
        } else if (cell?.entry) {
          const entry = cell.entry;
          if (entry.customLabel) {
            const key = `custom:${entry.customLabel.trim().toLowerCase()}:${(entry.batchLabel ?? "").trim().toLowerCase()}`;
            if (!map.has(key)) {
              map.set(key, {
                subjectCode: "—",
                subjectName: entry.customLabel,
                facultyName: entry.facultyName || "—",
                roomLabel: entry.roomLabel || "—",
                batchLabel: entry.batchLabel || "",
                customLabel: entry.customLabel,
                weeklyRotation: Boolean(entry.weeklyRotation),
                rotationPattern: entry.rotationPattern ?? null,
              });
            }
          } else if (entry.subjectName || entry.subjectCode) {
            const key = `${entry.subjectCode || entry.subjectId}:${entry.facultyName || ""}:${(entry.batchLabel ?? "").trim().toLowerCase()}`;
            if (!map.has(key)) {
              map.set(key, {
                subjectCode: entry.subjectCode || "—",
                subjectName: entry.subjectName || "Subject",
                facultyName: entry.facultyName || "Unassigned",
                roomLabel: entry.roomLabel || "—",
                batchLabel: entry.batchLabel || "",
                customLabel: "",
                weeklyRotation: Boolean(entry.weeklyRotation),
                rotationPattern: entry.rotationPattern ?? null,
              });
            }
          }
        }
      }
    }

    return Array.from(map.values()).sort((a, b) => a.subjectName.localeCompare(b.subjectName));
  }, [planner, assignmentsBySlot]);

  const fieldClass =
    "h-10 w-full rounded-lg border border-border bg-white px-3 text-sm text-navy-900 outline-none transition-colors focus:border-navy-700 focus:ring-2 focus:ring-navy-900/10";

  return (
    <div>
      {!embedded ? <div className="mb-5 flex flex-col items-center text-center gap-2">
        <h1 className="text-[28px] font-bold leading-tight text-navy-900">
          Timetable
        </h1>
        <p className="text-sm text-slate-500 max-w-3xl print:hidden">
          College-specific timing templates owned by Academic Portal. Student DB is used only for academic masters.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-2 print:hidden mt-2">
          {timingContextReady && canConfigureTimings ? (
            <Button
              variant="secondary"
              disabled={busy}
              onClick={() => setTimingsOpen(true)}
              className="print:hidden"
            >
              {planner?.missingTiming || !planner?.timing
                ? "Configure Timings"
                : "Edit Timings"}
            </Button>
          ) : null}
          <Button
            variant="secondary"
            disabled={!planner?.ready || busy}
            onClick={() => window.print()}
            className="print:hidden"
          >
            <Printer className="mr-2 h-4 w-4" /> Download PDF
          </Button>
          {canEdit ? (
            <Button variant="secondary" disabled={!planner?.ready || busy} onClick={() => void saveDraft()} className="print:hidden">
              Save Draft
            </Button>
          ) : null}
          {canEdit ? (
            <Button variant="secondary" disabled={!planner?.ready || busy} onClick={() => void runReview()} className="print:hidden">
              Review
            </Button>
          ) : null}
          {canPublish ? (
            <Button
              disabled={!planner?.ready || busy || publishBlocked}
              onClick={() => void publish()}
              className="print:hidden"
            >
              Publish
            </Button>
          ) : null}
        </div>
      </div> : null}

      {missingLabel ? (
        <Card className="mb-4">
          <p className="text-sm text-slate-600">{missingLabel}</p>
        </Card>
      ) : null}

      {loading ? (
        <LoadingAnimation label="Loading timetable…" />
      ) : null}

      {error ? (
        <Card className="mb-4 print:hidden">
          <p className="text-sm text-critical">{error}</p>
        </Card>
      ) : null}

      {info ? (
        <Card className="mb-4 border-brand-200 bg-brand-50/40 print:hidden">
          <p className="text-sm text-navy-900">{info}</p>
        </Card>
      ) : null}

      {publishBlocked ? (
        <Card className="mb-4 border-emerald-200 bg-emerald-50 print:hidden">
          <p className="text-sm font-medium text-navy-900">Timetable already published</p>
          <p className="mt-1 text-sm text-slate-700">
            Plan #{planner?.context.planId ?? "—"}
            {planner?.context.versionNo ? ` · version ${planner.context.versionNo}` : ""} is live.
            Make changes to a period before publishing again.
          </p>
        </Card>
      ) : null}

      {planner?.missingTiming ? (
        <Card className="mb-4 border-warning/40 bg-amber-50 print:hidden">
          <h3 className="font-semibold text-navy-900">No timing configured</h3>
          <p className="mt-2 text-sm text-slate-700">
            {planner.message ||
              "Configure the college timing schedule for this academic year and semester before creating the timetable."}
          </p>
          {timingContextReady ? (
            <div className="mt-3">
              <Button onClick={() => setTimingsOpen(true)}>Configure Timings</Button>
            </div>
          ) : null}
        </Card>
      ) : null}

      {planner?.ready ? (
        <>
          <Card className="mb-4 flex flex-wrap items-center justify-between gap-3 print:mb-2 print:p-2 print:text-center print:block print:w-full">
            <div className="print:w-full print:text-center">
              <h3 className="text-base font-bold text-navy-900 print:text-[14px]">
                {planner.context.college}
              </h3>
              <p className="mt-0.5 text-sm font-bold text-navy-900 print:text-[11px]">
                {planner.context.academicYear} • Semester {planner.context.semester}
                {" • "}
                Timing: {planner.context.timingTemplateName}
                {" • "}
                {planner.context.course} / {planner.context.branch}
                {planner.context.hasSections ? ` • Section ${planner.context.section}` : ""}
                {" • Batch "}
                {planner.context.batch}
                {planner.context.year ? ` • Year ${planner.context.year}` : ""}
                {" • "}
                {planner.context.studentCount.toLocaleString()} students
              </p>
            </div>
            <div className="flex flex-col items-end gap-2 print:hidden">
              <Button size="sm" variant="secondary" onClick={() => setTimingsOpen(true)}>
                Edit Timings
              </Button>
              <StatusBadge status={planner.context.status || "draft"} />
              {planner.context.planId ? (
                <p className="text-xs text-slate-500">
                  Plan #{planner.context.planId}
                  {planner.context.versionNo ? ` • v${planner.context.versionNo}` : ""}
                </p>
              ) : (
                <p className="text-xs text-slate-500">Unsaved workspace</p>
              )}
            </div>
          </Card>

          <div className="overflow-x-auto print:overflow-visible rounded-lg border border-border print:border-slate-400 bg-card">
            <table className="w-full min-w-[980px] print:min-w-full table-fixed border-collapse text-sm">
              <colgroup>
                <col style={{ width: "5.5rem" }} />
                {headerSlots.map((slot) => (
                  <col key={slot.id} />
                ))}
              </colgroup>
              <thead>
                <tr className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <th className="border-b border-r border-border px-2 py-2 text-left print:text-center">Day</th>
                  {headerSlots.map((slot) => {
                    const nonClass = isNonClassTimingSlot(slot);
                    return (
                      <th key={slot.id} className="border-b border-r last:border-r-0 border-border px-2 py-2 text-center">
                        <div className="truncate">
                          {nonClass ? timingSlotDisplayLabel(slot) : slot.label}
                        </div>
                        <div className="truncate font-normal normal-case text-[10px] text-slate-400">
                          {nonClass ? slot.label : null}
                          {nonClass ? " · " : null}
                          {slot.startTime}–{slot.endTime}
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {planner.days.map((day) => {
                  const daySlots = planner.slotsByDay?.[day] ?? [];
                  const dayCode = DAY_LABEL_TO_CODE[day] ?? day;
                  return (
                    <tr key={day}>
                      <td className="border-b border-r border-border px-2 py-2 font-medium text-navy-900">
                        {day}
                      </td>
                      {headerSlots.map((headerSlot) => {
                        const slot =
                          daySlots.find(
                            (s) =>
                              s.label === headerSlot.label &&
                              s.startTime === headerSlot.startTime,
                          ) ?? null;
                        if (!slot) {
                          return (
                            <td
                              key={`${day}-${headerSlot.id}`}
                              className="border-b border-r last:border-r-0 border-border bg-slate-50/60 p-1"
                            />
                          );
                        }
                        const cell = planner.grid[day]?.[slot.id];
                        const locals = assignmentsBySlot.get(`${dayCode}:${slot.id}`) ?? [];
                        const isBreak = isNonClassTimingSlot(slot);

                        if (isBreak) {
                          return (
                            <td key={`${day}-${slot.id}`} className="border-b border-r last:border-r-0 border-border p-1 print:p-0.5 text-center">
                              <div
                                className={cn(
                                  "flex min-h-[88px] print:min-h-0 print:h-[44px] h-full flex-col items-center justify-center rounded-md text-xs font-semibold px-1 text-center",
                                  timingSlotCellClass(slot),
                                )}
                              >
                                <span>{timingSlotDisplayLabel(slot)}</span>
                                <span className="mt-0.5 text-[10px] font-normal opacity-80 print:hidden">
                                  {slot.startTime}–{slot.endTime}
                                </span>
                              </div>
                            </td>
                          );
                        }

                        const isMulti = locals.length > 1 || (locals.length === 1 && Boolean(locals[0].batchLabel));
                        const hasAllocations = locals.length > 0;
                        const hasCustomSpecial = locals.some((l) => Boolean(l.customLabel));

                        return (
                          <td key={`${day}-${slot.id}`} className="border-b border-r last:border-r-0 border-border p-1 print:p-0.5 text-center">
                            <button
                              type="button"
                              onClick={() =>
                                openAssign(day, {
                                  slotId: slot.id,
                                  slotType: slot.slotType,
                                  assignable: true,
                                  label: slot.label,
                                  startTime: slot.startTime,
                                  endTime: slot.endTime,
                                  entry: cell?.entry ?? null,
                                  entries: cell?.entries,
                                })
                              }
                              className={cn(
                                "min-h-[88px] print:min-h-0 print:h-[44px] h-full w-full rounded-md border px-1.5 py-1.5 print:py-0.5 text-left print:text-center transition-colors flex flex-col justify-between print:justify-center print:items-center overflow-hidden",
                                selected?.day === day && selected.slotId === slot.id
                                  ? "border-navy-800 ring-1 ring-navy-800"
                                  : "border-border hover:border-slate-300",
                                hasCustomSpecial
                                  ? specialPeriodCellClass()
                                  : hasAllocations
                                    ? classPeriodCellClass()
                                    : emptyPeriodCellClass(),
                              )}
                            >
                              {!hasAllocations ? (
                                <div className="flex items-center justify-center h-full w-full min-h-[60px] print:min-h-0 text-center">
                                  <p className="text-xs font-medium text-slate-400 print:hidden">
                                    Free / Assign
                                  </p>
                                </div>
                              ) : isMulti ? (
                                <div className="flex flex-col justify-between items-stretch h-full w-full space-y-1 text-left print:text-center">
                                  <div className="flex items-center justify-between gap-1 border-b border-navy-200/50 pb-0.5 print:hidden">
                                    <span className="inline-flex items-center rounded bg-indigo-50 border border-indigo-200 px-1 py-0.2 text-[9px] font-bold text-indigo-700">
                                      Parallel ({locals.length})
                                    </span>
                                    {locals.some((l) => l.weeklyRotation) ? (
                                      <span
                                        className="inline-flex items-center gap-0.5 rounded bg-purple-100 border border-purple-300 px-1 py-0.2 text-[8.5px] font-bold text-purple-800"
                                        title={`4-Week Month Rotation: Batches shift subjects across the 4 weeks [${locals.find((l) => l.rotationPattern)?.rotationPattern || "1,2,1,2"}]`}
                                      >
                                        ⟳ 4W Rotates
                                      </span>
                                    ) : null}
                                  </div>
                                  <div className="space-y-1.5 divide-y divide-slate-200/60 overflow-hidden flex-1">
                                    {locals.map((item, idx) => {
                                      const subj = !item.customLabel ? subjectCellDisplay(item) : null;
                                      return (
                                        <div key={`${item.subjectId || item.customLabel}-${idx}`} className={cn("text-left print:text-center", idx > 0 ? "pt-1" : "")}>
                                          <div className="flex items-center justify-between gap-1">
                                            <div className="flex items-center gap-1 min-w-0">
                                              {item.batchLabel ? (
                                                <span className="shrink-0 rounded bg-navy-100 text-navy-800 font-bold px-1 py-0.2 text-[8.5px] uppercase">
                                                  {item.batchLabel}
                                                </span>
                                              ) : null}
                                              <p className="font-bold text-[11px] leading-tight text-navy-900 truncate" title={item.customLabel || subj?.title}>
                                                {item.customLabel || subj?.subtitle || subj?.title}
                                              </p>
                                            </div>
                                            {typeof item.studentCount === "number" && item.studentCount > 0 ? (
                                              <span
                                                className="shrink-0 text-[8.5px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 px-1 py-0.2 rounded print:hidden"
                                                title={`${item.studentCount} students`}
                                              >
                                                {item.studentCount}s
                                              </span>
                                            ) : null}
                                          </div>
                                          {item.facultyName ? (
                                            <p className="text-[9.5px] font-medium text-slate-600 truncate mt-0.5 print:hidden" title={item.facultyName}>
                                              {item.facultyName}
                                            </p>
                                          ) : null}
                                          {item.roomLabel ? (
                                            <p className="text-[8.5px] text-slate-400 truncate print:hidden">
                                              {item.roomLabel}
                                            </p>
                                          ) : null}
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              ) : (
                                (() => {
                                  const local = locals[0];
                                  const subject = local && !local.customLabel ? subjectCellDisplay(local) : null;
                                  return (
                                    <div className="flex flex-col justify-between print:justify-center items-stretch print:items-center h-full w-full space-y-0.5 text-left print:text-center">
                                      <div className="w-full text-left print:text-center">
                                        {local.customLabel ? (
                                          <p className="font-bold text-xs text-navy-900 line-clamp-2 leading-tight print:text-[9.5px] print:leading-tight text-left print:text-center">
                                            {local.customLabel}
                                          </p>
                                        ) : subject ? (
                                          <>
                                            <p
                                              className="line-clamp-2 font-bold text-xs leading-tight text-navy-900 print:text-[9.5px] print:leading-tight text-left print:text-center"
                                              title={subject.title}
                                            >
                                              {subject.title}
                                            </p>
                                            {subject.subtitle ? (
                                              <p className="text-[10px] font-mono text-slate-500 mt-0.5 print:hidden">
                                                {subject.subtitle}
                                              </p>
                                            ) : null}
                                          </>
                                        ) : null}
                                      </div>
                                      <div className="mt-auto print:mt-0 space-y-0 pt-0.5 print:pt-0 text-left print:text-center w-full">
                                        {local.customLabel ? (
                                          <p className="text-[10px] font-medium text-violet-700 print:hidden">
                                            Free / Special
                                          </p>
                                        ) : null}
                                        {local.facultyName ? (
                                          <p
                                            className="text-[10px] font-medium text-slate-600 truncate print:hidden"
                                            title={local.facultyName}
                                          >
                                            {local.facultyName}
                                          </p>
                                        ) : null}
                                        {local.roomLabel ? (
                                          <p className="text-[9px] font-medium text-slate-500 print:hidden">
                                            Room {local.roomLabel}
                                          </p>
                                        ) : null}
                                      </div>
                                    </div>
                                  );
                                })()
                              )}
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Subject & Faculty Allocation Summary Table */}
          {uniqueAllocations.length > 0 ? (
            <div className="mt-3.5 rounded-xl border border-border bg-card p-4 shadow-xs print:mt-2 print:p-0 print:border-0 print:w-full print:shadow-none">
              <div className="flex items-center justify-between mb-2 print:mb-1">
                <h4 className="text-xs font-bold uppercase tracking-wider text-navy-900 print:text-[11px] print:text-left">
                  Subject & Faculty Allocation Summary
                </h4>
                <span className="text-xs text-slate-500 font-medium print:hidden">
                  {uniqueAllocations.length} {uniqueAllocations.length === 1 ? "Subject" : "Subjects / Allocations"}
                </span>
              </div>
              <div className="overflow-x-auto rounded-lg border border-border print:border-slate-400 bg-white print:w-full">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-100/90 text-slate-700 font-semibold border-b border-border text-[11px] uppercase tracking-wide">
                      <th className="py-2 px-3 print:py-1 print:px-2 w-10 text-center print:text-[10px] border-r border-border">#</th>
                      <th className="py-2 px-3 print:py-1 print:px-2 w-28 print:text-[10px] border-r border-border">Batch / Group</th>
                      <th className="py-2 px-3 print:py-1 print:px-2 w-32 print:text-[10px] border-r border-border">Subject Code</th>
                      <th className="py-2 px-3 print:py-1 print:px-2 print:text-[10px] border-r border-border">Subject Name</th>
                      <th className="py-2 px-3 print:py-1 print:px-2 print:text-[10px] border-r border-border">Faculty Name</th>
                      <th className="py-2 px-3 print:py-1 print:px-2 w-28 print:text-[10px]">Room / Special</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {uniqueAllocations.map((alloc, idx) => (
                      <tr key={`${alloc.subjectCode}-${alloc.subjectName}-${alloc.batchLabel}-${idx}`} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-2 px-3 print:py-1 print:px-2 text-center font-bold text-slate-400 print:text-[10px] border-r border-border">{idx + 1}</td>
                        <td className="py-2 px-3 print:py-1 print:px-2 print:text-[10px] border-r border-border">
                          {alloc.batchLabel ? (
                            <div className="flex items-center gap-1 flex-wrap">
                              <span className="inline-block bg-navy-50 text-navy-800 border border-navy-200 font-semibold rounded px-1.5 py-0.5 text-[10.5px]">
                                {alloc.batchLabel}
                              </span>
                              {alloc.weeklyRotation ? (
                                <span
                                  className="inline-block bg-purple-50 text-purple-700 border border-purple-200 font-bold rounded px-1 py-0.2 text-[9px]"
                                  title={`Batches rotate across the 4 weeks of the month: [${alloc.rotationPattern || "1,2,1,2"}]`}
                                >
                                  ⟳ 4W Rotation
                                </span>
                              ) : null}
                            </div>
                          ) : (
                            <span className="text-slate-400 text-[10.5px] italic">Entire Class</span>
                          )}
                        </td>
                        <td className="py-2 px-3 print:py-1 print:px-2 font-mono font-bold text-navy-900 print:text-[10px] border-r border-border">
                          <span className="inline-block bg-slate-100 rounded px-1.5 py-0.5 text-[11px] print:bg-transparent print:p-0 print:text-[10px]">
                            {alloc.subjectCode}
                          </span>
                        </td>
                        <td className="py-2 px-3 print:py-1 print:px-2 font-semibold text-slate-800 print:text-[10px] border-r border-border">{alloc.subjectName}</td>
                        <td className="py-2 px-3 print:py-1 print:px-2 font-medium text-slate-700 print:text-[10px] border-r border-border">{alloc.facultyName}</td>
                        <td className="py-2 px-3 print:py-1 print:px-2 text-slate-500 font-medium print:text-[10px]">
                          {alloc.roomLabel !== "—" ? `Room ${alloc.roomLabel}` : alloc.customLabel || "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}

          {selected && planner ? (
            <div className="fixed inset-0 z-40 flex items-center justify-center p-4">
              <button
                type="button"
                className="absolute inset-0 bg-navy-950/45"
                aria-label="Close assign dialog"
                onClick={() => setSelected(null)}
              />
              <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="assign-class-title"
                className={cn(
                  "relative z-10 flex w-full flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl transition-all",
                  isSplit ? "max-w-5xl" : "max-w-2xl",
                )}
              >
                <div className="border-b border-border px-5 py-3.5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3
                        id="assign-class-title"
                        className="text-lg font-semibold text-navy-900"
                      >
                        Assign Period
                      </h3>
                      <p className="mt-0.5 text-sm text-slate-500">
                        {selected.day}
                        {selectedSlotMeta
                          ? ` · ${selectedSlotMeta.label} · ${selectedSlotMeta.startTime}–${selectedSlotMeta.endTime}`
                          : null}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelected(null)}
                      className="rounded-md px-2 py-1 text-lg leading-none text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                      aria-label="Close"
                    >
                      ×
                    </button>
                  </div>
                </div>

                {/* Split slot checkbox banner */}
                <div className="flex items-center justify-between border-b border-border bg-slate-50/70 px-5 py-3">
                  <label className="flex items-center gap-2.5 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={isSplit}
                      onChange={(e) => handleToggleSplit(e.target.checked)}
                      className="h-4 w-4 rounded border-slate-300 text-navy-900 focus:ring-navy-900"
                    />
                    <span className="text-sm font-bold text-navy-900">
                      Split this slot into parallel batches (e.g. Batch 1 / Batch 2 for practicals or electives)
                    </span>
                  </label>
                  {isSplit ? (
                    <span className="text-xs font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2.5 py-0.5 rounded-full">
                      Split Mode Active
                    </span>
                  ) : (
                    <span className="text-xs text-slate-500 font-medium">
                      Single Period
                    </span>
                  )}
                </div>

                <div className="max-h-[75vh] overflow-y-auto space-y-4 px-5 py-4">
                  {isSplit ? (
                    <>
                      {/* Side-by-side batch cards */}
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        {slotAllocations.map((alloc, idx) => {
                          const bLabel = alloc.batchLabel.trim() || `Batch ${idx + 1}`;
                          const count = Object.values(studentBatchMap).filter((b) => b === bLabel).length;
                          return (
                            <AllocationEditorCard
                              key={alloc.key}
                              alloc={alloc}
                              index={idx}
                              total={slotAllocations.length}
                              isSplit={true}
                              studentCount={count}
                              planner={planner}
                              assignments={assignments}
                              dayCode={DAY_LABEL_TO_CODE[selected.day] ?? selected.day}
                              slotId={selected.slotId}
                              fieldClass={fieldClass}
                              onChange={(patch) => updateAllocation(idx, patch)}
                              onRemove={() => removeAllocation(idx)}
                            />
                          );
                        })}
                      </div>

                      {/* Monthly 4-Week Batch Rotation & Selection Studio */}
                      <div className="rounded-xl border border-indigo-200 bg-gradient-to-r from-indigo-50/70 via-white to-purple-50/70 p-4 shadow-xs">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div className="space-y-1">
                            <label className="flex items-center gap-2.5 cursor-pointer select-none">
                              <input
                                type="checkbox"
                                checked={weeklyRotation}
                                onChange={(e) => setWeeklyRotation(e.target.checked)}
                                className="h-4 w-4 rounded border-indigo-300 text-indigo-600 focus:ring-indigo-500"
                              />
                              <span className="text-sm font-bold text-navy-900 flex items-center gap-1.5">
                                <span>Monthly 4-Week Batch Rotation (Automatic Weekly Shift)</span>
                              </span>
                            </label>
                            <p className="text-xs text-slate-600 pl-6.5">
                              Configure how Batch 1 and Batch 2 rotate across the 4 weeks of the month (W1: Days 1–7, W2: Days 8–14, W3: Days 15–21, W4: Days 22–31). Generated class sessions will shift students automatically.
                            </p>
                          </div>
                          <span
                            className={cn(
                              "self-start sm:self-center shrink-0 rounded-full px-2.5 py-0.5 text-xs font-bold shadow-xs",
                              weeklyRotation
                                ? "bg-indigo-600 text-white"
                                : "bg-slate-200 text-slate-600",
                            )}
                          >
                            {weeklyRotation ? "Rotation Active" : "Rotation Off"}
                          </span>
                        </div>

                        {weeklyRotation ? (
                          <div className="mt-3.5 space-y-3 pt-3 border-t border-indigo-100">
                            {/* 4 Interactive Week Cards */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 text-xs">
                              {[
                                { weekNum: 1, title: "Week 1", days: "Days 1–7" },
                                { weekNum: 2, title: "Week 2", days: "Days 8–14" },
                                { weekNum: 3, title: "Week 3", days: "Days 15–21" },
                                { weekNum: 4, title: "Week 4", days: "Days 22–31" },
                              ].map((w, idx) => {
                                const isShifted = (rotationPattern[idx] ?? 1) === 2;

                                const getSubjLabel = (allocIdx: number, fallback: string) => {
                                  const alloc = slotAllocations[allocIdx];
                                  if (!alloc) return fallback;
                                  if (alloc.mode === "special") return alloc.customLabel || fallback;
                                  const s = planner.subjects.find((sub) => String(sub.id) === alloc.subjectId);
                                  return s ? s.code || s.name : fallback;
                                };

                                const b1Subj = isShifted ? getSubjLabel(1, "Subject 2") : getSubjLabel(0, "Subject 1");
                                const b2Subj = isShifted ? getSubjLabel(0, "Subject 1") : getSubjLabel(1, "Subject 2");

                                return (
                                  <div
                                    key={w.weekNum}
                                    className={cn(
                                      "rounded-lg border p-2.5 space-y-2 transition-all shadow-xs",
                                      isShifted
                                        ? "border-purple-300 bg-purple-50/40"
                                        : "border-indigo-200 bg-white",
                                    )}
                                  >
                                    <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
                                      <div>
                                        <div className="flex items-center gap-1.5">
                                          <span
                                            className={cn(
                                              "h-2 w-2 rounded-full",
                                              isShifted ? "bg-purple-600" : "bg-indigo-600",
                                            )}
                                          />
                                          <span className="font-bold text-navy-900 text-xs">{w.title}</span>
                                        </div>
                                        <span className="text-[10px] text-slate-500 font-medium block">
                                          {w.days}
                                        </span>
                                      </div>
                                      <span
                                        className={cn(
                                          "text-[9.5px] uppercase font-bold px-1.5 py-0.5 rounded shadow-xs",
                                          isShifted
                                            ? "text-purple-700 bg-purple-100 border border-purple-200"
                                            : "text-indigo-700 bg-indigo-50 border border-indigo-200",
                                        )}
                                      >
                                        {isShifted ? "Shifted ⇄" : "Standard"}
                                      </span>
                                    </div>

                                    <div className="space-y-1.5 text-[11px]">
                                      <div className="flex items-center justify-between gap-1.5 bg-white/80 rounded px-1.5 py-1 border border-slate-100">
                                        <span className="font-bold text-indigo-700 shrink-0">Batch 1:</span>
                                        <span className="font-semibold text-slate-800 truncate text-right" title={b1Subj}>
                                          {b1Subj}
                                        </span>
                                      </div>
                                      <div className="flex items-center justify-between gap-1.5 bg-white/80 rounded px-1.5 py-1 border border-slate-100">
                                        <span className="font-bold text-emerald-700 shrink-0">Batch 2:</span>
                                        <span className="font-semibold text-slate-800 truncate text-right" title={b2Subj}>
                                          {b2Subj}
                                        </span>
                                      </div>
                                    </div>

                                    <button
                                      type="button"
                                      onClick={() => {
                                        setRotationPattern((prev) => {
                                          const next = [...prev];
                                          while (next.length < 4) next.push(1);
                                          next[idx] = next[idx] === 1 ? 2 : 1;
                                          return next;
                                        });
                                      }}
                                      className={cn(
                                        "w-full py-1 px-2 rounded text-[10.5px] font-semibold transition-colors cursor-pointer border flex items-center justify-center gap-1",
                                        isShifted
                                          ? "bg-purple-100 text-purple-800 border-purple-300 hover:bg-purple-200"
                                          : "bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100",
                                      )}
                                    >
                                      <span>{isShifted ? "↩ Set Standard" : "⇄ Shift Batches"}</span>
                                    </button>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        ) : null}
                      </div>

                      {/* Student Batch Classifier & Checklist */}
                      <StudentBatchClassifier
                        students={sectionStudents}
                        loading={loadingStudents}
                        allocations={slotAllocations}
                        studentBatchMap={studentBatchMap}
                        onAssignStudent={(studentId, batchLabel) => {
                          setStudentBatchMap((prev) => {
                            const next = { ...prev };
                            if (!batchLabel) {
                              delete next[studentId];
                            } else {
                              next[studentId] = batchLabel;
                            }
                            return next;
                          });
                        }}
                        onAssignMultiple={(newMap) => {
                          setStudentBatchMap(newMap);
                        }}
                      />
                    </>
                  ) : (
                    /* Single period mode */
                    <AllocationEditorCard
                      key={slotAllocations[0]?.key || "single"}
                      alloc={
                        slotAllocations[0] || {
                          key: "single",
                          mode: "subject",
                          subjectId: "",
                          customLabel: "",
                          hrmsEmployeeId: "",
                          facultyName: "",
                          roomLabel: "",
                          batchLabel: "",
                          entryType: "theory",
                          facultySearch: "",
                          facultyOpen: false,
                        }
                      }
                      index={0}
                      total={1}
                      isSplit={false}
                      studentCount={0}
                      planner={planner}
                      assignments={assignments}
                      dayCode={DAY_LABEL_TO_CODE[selected.day] ?? selected.day}
                      slotId={selected.slotId}
                      fieldClass={fieldClass}
                      onChange={(patch) => updateAllocation(0, patch)}
                      onRemove={() => {}}
                    />
                  )}
                </div>

                <div className="flex items-center justify-between border-t border-border bg-slate-50/80 px-5 py-3">
                  <div>
                    {slotAllocations.length > 0 ? (
                      <Button variant="secondary" onClick={clearLocalAssignment}>
                        Clear Slot
                      </Button>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" onClick={() => setSelected(null)}>
                      Cancel
                    </Button>
                    <Button onClick={saveLocalAssignment}>
                      Save Period
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          {review ? (
            <Card className="mt-4">
              <h3 className="mb-3 text-base font-semibold text-navy-900">Timetable Review</h3>
              {review.unchanged ? (
                <div className="mb-4 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-navy-900">
                  {review.message ??
                    "No changes since the last published timetable. Publishing is not required."}
                </div>
              ) : null}
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 text-sm">
                <div>
                  <p className="font-medium text-navy-900">Assigned Classes</p>
                  <p className="text-slate-600">{review.assignedCount}</p>
                </div>
                <div>
                  <p className="font-medium text-navy-900">Unassigned Slots</p>
                  <ul className="mt-1 list-disc pl-4 text-slate-600">
                    {review.unassignedSlots.length === 0 ? (
                      <li>None</li>
                    ) : (
                      review.unassignedSlots.slice(0, 12).map((item) => (
                        <li key={item}>{item}</li>
                      ))
                    )}
                  </ul>
                </div>
                <div>
                  <p className="font-medium text-navy-900">Section Clashes</p>
                  <ul className="mt-1 list-disc pl-4 text-slate-600">
                    {review.sectionClashes.length === 0 ? (
                      <li>None</li>
                    ) : (
                      review.sectionClashes.map((item) => <li key={item}>{item}</li>)
                    )}
                  </ul>
                </div>
                <div>
                  <p className="font-medium text-navy-900">Faculty Clashes</p>
                  <ul className="mt-1 list-disc pl-4 text-slate-600">
                    {review.facultyClashes.length === 0 ? (
                      <li>None</li>
                    ) : (
                      review.facultyClashes.map((item) => <li key={item}>{item}</li>)
                    )}
                  </ul>
                </div>
                <div>
                  <p className="font-medium text-navy-900">Room Clashes</p>
                  <p className="text-slate-600">
                    {review.roomClashes.length === 0
                      ? "Not enforced (no room master)"
                      : review.roomClashes.join("; ")}
                  </p>
                </div>
                <div>
                  <p className="font-medium text-navy-900">Warnings</p>
                  <ul className="mt-1 list-disc pl-4 text-slate-600">
                    {review.warnings.length === 0 ? (
                      <li>None</li>
                    ) : (
                      review.warnings.map((item) => <li key={item}>{item}</li>)
                    )}
                  </ul>
                </div>
              </div>
            </Card>
          ) : null}
        </>
      ) : null}

      {timingContextReady && selectedCollege ? (
        <TimingEditorDrawer
          open={timingsOpen}
          collegeId={Number(filters.collegeId)}
          collegeName={selectedCollege.name}
          academicYear={filters.academicYear}
          semester={Number(filters.semester)}
          onClose={() => setTimingsOpen(false)}
          onSaved={() => {
            void loadPlanner();
          }}
        />
      ) : null}
    </div>
  );
}
