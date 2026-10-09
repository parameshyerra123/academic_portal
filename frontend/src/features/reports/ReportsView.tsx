"use client";

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { useAuth } from "@/components/auth/AuthProvider";
import { AttendanceAnalyticsView } from "@/features/attendance-analytics/AttendanceAnalyticsView";
import { StaffWorkloadView } from "@/features/workload/StaffWorkloadView";
import { MasterVsChangedReport } from "@/features/reports/MasterVsChangedReport";
import { useAcademicContext } from "@/components/layout/AcademicProvider";
import { apiFetch } from "@/lib/api";
import { Calendar, ChevronRight, Printer, RotateCcw } from "lucide-react";
import { cn } from "@/lib/cn";
import { escapeHtml, printElement, printHtml } from "@/lib/print-service";
import {
  classPeriodCellClass,
  emptyPeriodCellClass,
  isNonClassTimingSlot,
  specialPeriodCellClass,
  timingSlotCellClass,
  timingSlotDisplayLabel,
} from "@/features/timetables/timing-slot-utils";

import { useRouter, useSearchParams } from "next/navigation";

type ReportKey =
  | "master-vs-changed"
  | "subject-analytics"
  | "staff-analytics"
  | "change-audit"
  | "department-timetables"
  | "staff-timetables"
  | "student-analytics";

type ReportDef = {
  key: ReportKey;
  title: string;
  permissions: string[];
};

const REPORT_TABS: ReportDef[] = [
  {
    key: "master-vs-changed",
    title: "Master vs Today Comparison",
    permissions: ["today_timetable.view", "timetable.view", "reports.view"],
  },
  {
    key: "subject-analytics",
    title: "Subject Analytics",
    permissions: ["today_timetable.view", "timetable.view", "reports.view"],
  },
  {
    key: "staff-analytics",
    title: "Staff Analytics",
    permissions: ["today_timetable.view", "workload.view", "reports.view"],
  },
  {
    key: "change-audit",
    title: "Change Audit Log",
    permissions: ["today_timetable.view", "timetable.view", "reports.view"],
  },
  {
    key: "department-timetables",
    title: "Department-wise Timetables",
    permissions: ["timetable.view", "reports.view"],
  },
  {
    key: "staff-timetables",
    title: "Staff Timetable Reports",
    permissions: ["workload.view", "reports.view"],
  },
  {
    key: "student-analytics",
    title: "Student Analytics Reports",
    permissions: ["attendance_analytics.view", "reports.view"],
  },
];

export function ReportsView() {
  const { hasAnyPermission } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab") as ReportKey | null;

  const [selectedKey, setSelectedKey] = useState<ReportKey | null>(null);

  useEffect(() => {
    if (tabParam && REPORT_TABS.some((t) => t.key === tabParam)) {
      setSelectedKey(tabParam);
    }
  }, [tabParam]);

  const visibleTabs = useMemo(
    () => REPORT_TABS.filter((tab) => hasAnyPermission(...tab.permissions)),
    [hasAnyPermission],
  );

  const activeKey =
    selectedKey ?? (tabParam && visibleTabs.some((t) => t.key === tabParam) ? tabParam : visibleTabs[0]?.key);
  const activeTab = visibleTabs.find((tab) => tab.key === activeKey) ?? visibleTabs[0];

  const handleSelectTab = (key: ReportKey) => {
    setSelectedKey(key);
    router.push(`/reports?tab=${key}`, { scroll: false });
  };

  function renderActiveReport() {
    if (!activeTab) return null;
    const handleNavigate = (section: "variation" | "subjects" | "staff" | "audit") => {
      const targetKey: ReportKey =
        section === "variation"
          ? "master-vs-changed"
          : section === "subjects"
            ? "subject-analytics"
            : section === "staff"
              ? "staff-analytics"
              : "change-audit";
      handleSelectTab(targetKey);
    };

    if (activeTab.key === "master-vs-changed")
      return <MasterVsChangedReport activeSection="variation" onNavigateSection={handleNavigate} />;
    if (activeTab.key === "subject-analytics")
      return <MasterVsChangedReport activeSection="subjects" onNavigateSection={handleNavigate} />;
    if (activeTab.key === "staff-analytics")
      return <MasterVsChangedReport activeSection="staff" onNavigateSection={handleNavigate} />;
    if (activeTab.key === "change-audit")
      return <MasterVsChangedReport activeSection="audit" onNavigateSection={handleNavigate} />;
    if (activeTab.key === "department-timetables")
      return <DepartmentTimetableReport />;
    if (activeTab.key === "staff-timetables")
      return <StaffWorkloadView embedded />;
    return <AttendanceAnalyticsView embedded />;
  }

  const pageTitle = activeTab ? activeTab.title : "Reports";

  return (
    <div>
      <PageHeader
        title={pageTitle}
        description="Live reports from the selected academic scope."
      />



      {visibleTabs.length === 0 ? (
        <EmptyState
          title="No reports available"
          description="You do not have permission to any report modules in the current role."
        />
      ) : (
        <div>
          {activeTab ? (
            <div className="mt-1">{renderActiveReport()}</div>
          ) : null}
        </div>
      )}
    </div>
  );
}

type TimetableReportRow = {
  planId: number;
  collegeId: number;
  courseId: number;
  branchId: number;
  batch: string;
  section: string | null;
  status: string;
  day: string | null;
  slotId: number | null;
  label: string;
  subjectName: string | null;
  room: string | null;
  slotLabel: string | null;
  startTime: string | null;
  endTime: string | null;
  slotType: string | null;
  slotOrder: number | null;
  facultyName: string | null;
};

type ScheduleGroup = {
  key: string;
  batch: string;
  section: string | null;
  title: string;
  displayBatch: string;
  displaySection: string | null;
};

function cleanSectionCode(raw: string | null | undefined): string {
  if (!raw) return "";
  const trimmed = raw.trim();
  const stripped = trimmed.replace(/^(?:(?:section|sec)[\s.:_-]*)+/i, "").trim();
  return (stripped || trimmed).toUpperCase();
}

function getBatchSections(
  branchId: number | null | undefined,
  batch: string,
  rows: TimetableReportRow[],
  sections?: Array<{ branchId: number; name: string; batch?: string }>,
): string[] {
  if (branchId == null) return [];
  const secSet = new Set<string>();
  for (const r of rows) {
    if (r.branchId === branchId && r.batch === batch && r.section) {
      const code = cleanSectionCode(r.section);
      if (code) secSet.add(code);
    }
  }
  if (sections) {
    for (const s of sections) {
      if (s.branchId === branchId && s.batch === batch) {
        const code = cleanSectionCode(s.name);
        if (code) secSet.add(code);
      }
    }
  }
  return Array.from(secSet).sort((a, b) =>
    a.localeCompare(b, undefined, { numeric: true }),
  );
}

function batchHasMultipleSections(
  branchId: number | null | undefined,
  batch: string,
  rows: TimetableReportRow[],
  sections?: Array<{ branchId: number; name: string; batch?: string }>,
): boolean {
  return getBatchSections(branchId, batch, rows, sections).length > 1;
}

function branchHasMultipleSections(
  branchId: number | null | undefined,
  rows: TimetableReportRow[],
  sections?: Array<{ branchId: number; name: string; batch?: string }>,
): boolean {
  if (branchId == null) return false;
  const allBatches = new Set(
    rows.filter((r) => r.branchId === branchId).map((r) => r.batch),
  );
  for (const b of allBatches) {
    if (batchHasMultipleSections(branchId, b, rows, sections)) {
      return true;
    }
  }
  return false;
}

function getBranchSectionList(
  branchId: number | null | undefined,
  rows: TimetableReportRow[],
  sections?: Array<{ branchId: number; name: string; batch?: string }>,
  selectedBatch?: string | null,
): string[] {
  if (branchId == null) return [];

  // If a specific batch is selected, ONLY return sections if that batch has multiple sections
  if (selectedBatch != null) {
    const batchSecs = getBatchSections(branchId, selectedBatch, rows, sections);
    return batchSecs.length > 1 ? batchSecs : [];
  }

  // If 'All batches' is selected, collect sections from any batch in this branch that has multiple sections
  const allBatches = new Set(
    rows.filter((r) => r.branchId === branchId).map((r) => r.batch),
  );
  const multiSectionCodes = new Set<string>();
  for (const b of allBatches) {
    const bSecs = getBatchSections(branchId, b, rows, sections);
    if (bSecs.length > 1) {
      for (const s of bSecs) multiSectionCodes.add(s);
    }
  }

  return Array.from(multiSectionCodes).sort((a, b) =>
    a.localeCompare(b, undefined, { numeric: true }),
  );
}

function DepartmentTimetableReport() {
  const { masters } = useAcademicContext();
  const [academicYear, setAcademicYear] = useState("");
  const [selectedCollege, setSelectedCollege] = useState<number | null>(null);
  const [selectedCourse, setSelectedCourse] = useState<number | null>(null);
  const [selectedBranch, setSelectedBranch] = useState<number | null>(null);
  const [selectedBatch, setSelectedBatch] = useState<string | null>(null);
  const [selectedSection, setSelectedSection] = useState<string | null>(null);
  const [expandedCollegeIds, setExpandedCollegeIds] = useState<Set<number>>(new Set());
  const [expandedCourseIds, setExpandedCourseIds] = useState<Set<number>>(new Set());
  const [expandedBranchIds, setExpandedBranchIds] = useState<Set<number>>(new Set());
  const [rows, setRows] = useState<TimetableReportRow[]>([]);
  const [loading, setLoading] = useState(false);
  const reportRef = useRef<HTMLDivElement>(null);
  const batchRefs = useRef<Record<string, HTMLDivElement | null>>({});

  useEffect(() => {
    if (masters && !academicYear) {
      const currentYear =
        masters.defaults.academicYear ||
        masters.academicYears.find((item) => item.isActive)?.label;
      if (currentYear) setAcademicYear(currentYear);
    }
  }, [masters, academicYear]);

  useEffect(() => {
    let cancelled = false;
    async function loadRows() {
      if (!academicYear) {
        setRows([]);
        return;
      }
      setLoading(true);
      try {
        const params = new URLSearchParams({ academicYear });
        const response = await apiFetch(`/timetables/report?${params}`, {
          cache: "no-store",
        });
        const data = response.ok
          ? (((await response.json()) as { data?: TimetableReportRow[] })
              .data ?? [])
          : [];
        if (!cancelled) setRows(data);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void loadRows();
    return () => {
      cancelled = true;
    };
  }, [academicYear]);

  // Sync auto-expansion when user selects filters from the top bar
  useEffect(() => {
    if (selectedCollege != null) {
      setExpandedCollegeIds((prev) => new Set(prev).add(selectedCollege));
    }
  }, [selectedCollege]);

  useEffect(() => {
    if (selectedCourse != null) {
      setExpandedCourseIds((prev) => new Set(prev).add(selectedCourse));
      const course = masters?.courses.find((c) => c.id === selectedCourse);
      if (course) {
        setExpandedCollegeIds((prev) => new Set(prev).add(course.collegeId));
      }
    }
  }, [selectedCourse, masters]);

  useEffect(() => {
    if (selectedBranch != null) {
      setExpandedBranchIds((prev) => new Set(prev).add(selectedBranch));
      const branch = masters?.branches.find((b) => b.id === selectedBranch);
      if (branch) {
        setExpandedCourseIds((prev) => new Set(prev).add(branch.courseId));
        const course = masters?.courses.find((c) => c.id === branch.courseId);
        if (course) {
          setExpandedCollegeIds((prev) => new Set(prev).add(course.collegeId));
        }
      }
    }
  }, [selectedBranch, masters]);

  // Dropdown filter options (always populated from master catalog)
  const filterCourses = useMemo(() => {
    if (!masters) return [];
    if (selectedCollege != null) {
      return masters.courses.filter((course) => course.collegeId === selectedCollege);
    }
    return masters.courses;
  }, [masters, selectedCollege]);

  const filterBranches = useMemo(() => {
    if (!masters) return [];
    if (selectedCourse != null) {
      return masters.branches.filter((branch) => branch.courseId === selectedCourse);
    }
    if (selectedCollege != null) {
      const collegeCourseIds = new Set(
        masters.courses
          .filter((course) => course.collegeId === selectedCollege)
          .map((course) => course.id),
      );
      return masters.branches.filter((branch) => collegeCourseIds.has(branch.courseId));
    }
    return masters.branches;
  }, [masters, selectedCollege, selectedCourse]);

  const filterBatches = useMemo(() => {
    if (!masters) return [];
    let relevantBatches = masters.batches ?? [];
    if (selectedBranch != null) {
      relevantBatches = relevantBatches.filter((b) => b.branchId === selectedBranch);
    } else if (selectedCourse != null) {
      const branchIds = new Set(
        masters.branches
          .filter((b) => b.courseId === selectedCourse)
          .map((b) => b.id),
      );
      relevantBatches = relevantBatches.filter((b) => branchIds.has(b.branchId));
    } else if (selectedCollege != null) {
      const collegeCourseIds = new Set(
        masters.courses
          .filter((c) => c.collegeId === selectedCollege)
          .map((c) => c.id),
      );
      const branchIds = new Set(
        masters.branches
          .filter((b) => collegeCourseIds.has(b.courseId))
          .map((b) => b.id),
      );
      relevantBatches = relevantBatches.filter((b) => branchIds.has(b.branchId));
    }
    const batchSet = new Set(relevantBatches.map((b) => b.batch));
    rows.forEach((r) => {
      if (
        (selectedCollege == null || r.collegeId === selectedCollege) &&
        (selectedCourse == null || r.courseId === selectedCourse) &&
        (selectedBranch == null || r.branchId === selectedBranch) &&
        r.batch
      ) {
        batchSet.add(r.batch);
      }
    });
    return Array.from(batchSet).sort();
  }, [masters, selectedCollege, selectedCourse, selectedBranch, rows]);

  // Check if currently selected branch has multiple sections (considering selectedBatch if chosen)
  const selectedBranchHasSections = useMemo(() => {
    if (selectedBranch == null) return false;
    if (selectedBatch != null) {
      return batchHasMultipleSections(selectedBranch, selectedBatch, rows, masters?.sections);
    }
    return branchHasMultipleSections(selectedBranch, rows, masters?.sections);
  }, [selectedBranch, selectedBatch, rows, masters?.sections]);

  // Section options - ONLY populated if branch/batch has multiple sections!
  const availableBranchSections = useMemo(() => {
    if (selectedBranch == null || !selectedBranchHasSections) return [];
    return getBranchSectionList(
      selectedBranch,
      rows,
      masters?.sections,
      selectedBatch,
    );
  }, [selectedBranch, selectedBranchHasSections, rows, masters?.sections, selectedBatch]);

  // Auto-clear selectedSection if branch/batch has no multiple sections or selection is no longer valid
  useEffect(() => {
    if (selectedBranch == null || !selectedBranchHasSections) {
      if (selectedSection != null) setSelectedSection(null);
    } else if (selectedSection != null && !availableBranchSections.includes(selectedSection)) {
      setSelectedSection(null);
    }
  }, [selectedBranch, selectedBranchHasSections, availableBranchSections, selectedSection]);

  // Which colleges to display in the table
  const displayedColleges = useMemo(() => {
    if (!masters?.colleges) return [];
    if (selectedCollege != null) {
      return masters.colleges.filter((c) => c.id === selectedCollege);
    }
    if (selectedCourse != null) {
      const course = masters.courses.find((c) => c.id === selectedCourse);
      if (course) {
        return masters.colleges.filter((c) => c.id === course.collegeId);
      }
    }
    if (selectedBranch != null) {
      const branch = masters.branches.find((b) => b.id === selectedBranch);
      const course = branch ? masters.courses.find((c) => c.id === branch.courseId) : null;
      if (course) {
        return masters.colleges.filter((c) => c.id === course.collegeId);
      }
    }
    return masters.colleges;
  }, [masters, selectedCollege, selectedCourse, selectedBranch]);

  const toggleCollege = (collegeId: number) => {
    setExpandedCollegeIds((prev) => {
      const next = new Set(prev);
      if (next.has(collegeId)) next.delete(collegeId);
      else next.add(collegeId);
      return next;
    });
  };

  const toggleCourse = (courseId: number) => {
    setExpandedCourseIds((prev) => {
      const next = new Set(prev);
      if (next.has(courseId)) next.delete(courseId);
      else next.add(courseId);
      return next;
    });
  };

  const toggleBranch = (branchId: number) => {
    setExpandedBranchIds((prev) => {
      const next = new Set(prev);
      if (next.has(branchId)) next.delete(branchId);
      else next.add(branchId);
      return next;
    });
  };

  const getCollegeCourses = useCallback(
    (collegeId: number) => {
      if (!masters?.courses) return [];
      let list = masters.courses.filter((c) => c.collegeId === collegeId);
      if (selectedCourse != null) {
        list = list.filter((c) => c.id === selectedCourse);
      }
      return list;
    },
    [masters, selectedCourse],
  );

  const getCourseBranches = useCallback(
    (courseId: number) => {
      if (!masters?.branches) return [];
      let list = masters.branches.filter((b) => b.courseId === courseId);
      if (selectedBranch != null) {
        list = list.filter((b) => b.id === selectedBranch);
      }
      return list;
    },
    [masters, selectedBranch],
  );

  const getBranchStats = useCallback(
    (branchId: number) => {
      const branchHasSec = branchHasMultipleSections(branchId, rows, masters?.sections);
      const branchSections = masters?.sections.filter((s) => s.branchId === branchId) ?? [];
      const availableBatches = masters?.batches.filter((b) => b.branchId === branchId) ?? [];

      const configuredSchedules = new Set<string>();
      for (const row of rows) {
        if (row.branchId === branchId) {
          const hasMulti = batchHasMultipleSections(branchId, row.batch, rows, masters?.sections);
          const secCode = hasMulti ? cleanSectionCode(row.section) : "nosec";
          configuredSchedules.add(`${row.batch}__${secCode}`);
        }
      }

      let expectedCount = 0;
      if (branchHasSec && branchSections.length > 0) {
        expectedCount = branchSections.length;
      } else {
        expectedCount = availableBatches.length || configuredSchedules.size;
      }

      return {
        configured: configuredSchedules.size,
        notConfigured: Math.max(0, expectedCount - configuredSchedules.size),
      };
    },
    [masters?.batches, masters?.sections, rows],
  );

  const getBranchSchedules = useCallback(
    (branchId: number): ScheduleGroup[] => {
      const branchRows = rows.filter(
        (row) =>
          row.branchId === branchId &&
          (selectedBatch == null || row.batch === selectedBatch) &&
          (selectedSection == null ||
            !batchHasMultipleSections(branchId, row.batch, rows, masters?.sections) ||
            cleanSectionCode(row.section) === selectedSection),
      );

      const groupMap = new Map<string, ScheduleGroup>();
      for (const r of branchRows) {
        const hasMulti = batchHasMultipleSections(branchId, r.batch, rows, masters?.sections);
        const secCode = hasMulti ? cleanSectionCode(r.section) : "";
        const key = hasMulti && secCode ? `${r.batch}__${secCode}` : `${r.batch}__nosec`;
        if (!groupMap.has(key)) {
          const secLabel = hasMulti && secCode ? `Section ${secCode}` : null;
          const title = secLabel
            ? `Batch ${r.batch} · ${secLabel}`
            : `Batch ${r.batch}`;
          groupMap.set(key, {
            key,
            batch: r.batch,
            section: hasMulti && secCode ? secCode : null,
            title,
            displayBatch: r.batch,
            displaySection: secLabel,
          });
        }
      }

      return Array.from(groupMap.values()).sort((a, b) => {
        const batchCmp = a.batch.localeCompare(b.batch);
        if (batchCmp !== 0) return batchCmp;
        return (a.section ?? "").localeCompare(b.section ?? "");
      });
    },
    [masters?.sections, rows, selectedBatch, selectedSection],
  );

  const hasActiveFilters = Boolean(
    selectedCollege != null ||
    selectedCourse != null ||
    selectedBranch != null ||
    selectedBatch != null ||
    selectedSection != null,
  );

  const handleResetFilters = () => {
    setSelectedCollege(null);
    setSelectedCourse(null);
    setSelectedBranch(null);
    setSelectedBatch(null);
    setSelectedSection(null);
  };

  const timetableDays = ["MON", "TUE", "WED", "THUR", "FRI", "SAT", "SUN"];

  const scopeName = (
    id: number | null,
    items: Array<{ id: number; name: string }>,
    fallback: string,
  ) => items.find((item) => item.id === id)?.name ?? fallback;

  function buildCoursePrintHtml(
    collegeId: number | null,
    courseId: number,
    branchId: number | null = null,
    batchFilter: string | null = null,
    sectionFilter: string | null = null,
  ) {
    const courseRows = rows.filter(
      (row) =>
        row.courseId === courseId &&
        (collegeId == null || row.collegeId === collegeId) &&
        (branchId == null || row.branchId === branchId) &&
        (batchFilter == null || row.batch === batchFilter) &&
        (sectionFilter == null || cleanSectionCode(row.section) === cleanSectionCode(sectionFilter)),
    );
    if (!courseRows.length) return "";

    const slotKey = (row: TimetableReportRow) =>
      String(
        row.slotOrder ??
          row.slotId ??
          `${row.slotLabel ?? ""}|${row.startTime ?? ""}|${row.endTime ?? ""}`,
      );
    const groups = new Map<string, TimetableReportRow[]>();
    for (const row of courseRows) {
      const hasMulti = batchHasMultipleSections(row.branchId, row.batch, rows, masters?.sections);
      const secCode = hasMulti ? cleanSectionCode(row.section) : "";
      const key = `${row.branchId}:${row.batch}:${secCode}`;
      groups.set(key, [...(groups.get(key) ?? []), row]);
    }
    return Array.from(groups.entries())
      .map(([key, batchRows]) => {
        const [bId, batch, sec] = key.split(":");
        const periods = Array.from(
          new Map(
            batchRows
              .filter((row) => row.slotId != null)
              .map((row) => [slotKey(row), row]),
          ).values(),
        ).sort(
          (a, b) =>
            (a.slotOrder ?? a.slotId ?? 0) - (b.slotOrder ?? b.slotId ?? 0),
        );
        const branchName =
          masters?.branches.find((branch) => branch.id === Number(bId))
            ?.name ?? `Branch ${bId}`;
        const hasMulti = batchHasMultipleSections(Number(bId), batch, rows, masters?.sections);
        const secLabel = hasMulti && sec ? `Section ${sec}` : "";
        const titleLabel = secLabel
          ? `${escapeHtml(branchName)} · Batch ${escapeHtml(batch)} · ${escapeHtml(secLabel)}`
          : `${escapeHtml(branchName)} · Batch ${escapeHtml(batch)}`;

        const header = periods
          .map(
            (period) =>
              `<th>${escapeHtml(period.slotLabel || `P${period.slotId}`)}<br><small>${escapeHtml(`${period.startTime?.slice(0, 5) ?? ""}-${period.endTime?.slice(0, 5) ?? ""}`)}</small></th>`,
          )
          .join("");
        const body = timetableDays
          .map((day) => {
            const cells = periods
              .map((period) => {
                const slotRows = batchRows.filter(
                  (row) => row.day === day && slotKey(row) === slotKey(period),
                );
                const slotType = period.slotType ?? "CLASS";
                const emptyLabel =
                  slotType === "LUNCH"
                    ? "Lunch Break"
                    : slotType === "BREAK"
                      ? "Break"
                      : slotType === "ACTIVITY"
                        ? period.slotLabel
                        : "Free";
                if (!slotRows.length) {
                  return `<td class="${emptyLabel === "Free" ? "empty-cell" : "break-cell"}">${escapeHtml(emptyLabel ?? "Free")}</td>`;
                }
                return `<td>${slotRows
                  .map(
                    (row) =>
                      `<div class="${row.subjectName ? "subject-cell" : "special-cell"}"><strong>${escapeHtml(row.subjectName || row.label)}</strong><br><small>${escapeHtml(row.label)}${row.facultyName ? ` · ${escapeHtml(row.facultyName)}` : ""}${row.room ? ` · Room ${escapeHtml(row.room)}` : ""}</small></div>`,
                  )
                  .join("")}</td>`;
              })
              .join("");
            return `<tr><th>${day}</th>${cells}</tr>`;
          })
          .join("");
        return `<section class="batch-section"><div class="batch-title">${titleLabel}</div><table class="batch-table"><thead><tr><th style="width:6%">Day</th>${header}</tr></thead><tbody>${body}</tbody></table></section>`;
      })
      .join("");
  }

  function printSelectedTables() {
    const targetColleges = displayedColleges;
    const content = targetColleges
      .map((college) => {
        const collegeCourses = getCollegeCourses(college.id);
        const courseHtml = collegeCourses
          .map((course) => {
            const html = buildCoursePrintHtml(
              college.id,
              course.id,
              selectedBranch,
              selectedBatch,
              selectedSection,
            );
            if (!html) return "";
            return `<h2 class="course-title">${escapeHtml(course.name)} (${escapeHtml(college.name)})</h2>${html}`;
          })
          .filter(Boolean)
          .join("");
        return courseHtml;
      })
      .filter(Boolean)
      .join("");

    if (!content) {
      alert("No timetable data found to print for the selected filter.");
      return;
    }

    const collegeName = scopeName(
      selectedCollege,
      masters?.colleges ?? [],
      "All colleges",
    );
    const courseName = scopeName(
      selectedCourse,
      masters?.courses ?? [],
      "All courses",
    );
    const branchName = scopeName(
      selectedBranch,
      masters?.branches ?? [],
      "All branches",
    );
    const sectionDisplay = selectedSection
      ? `Section ${cleanSectionCode(selectedSection)}`
      : "All sections";

    printHtml(content, {
      title: "Department-wise timetable report",
      subtitle: [
        academicYear,
        collegeName,
        courseName,
        branchName,
        selectedBatch ? `Batch ${selectedBatch}` : "All batches",
        sectionDisplay,
      ].join(" · "),
    });
  }

  function printScoped(scope: {
    college?: number | null;
    course?: number | null;
    branch?: number | null;
    batch?: string | null;
    section?: string | null;
  }) {
    const activeSection = scope.section ?? selectedSection;
    if (scope.course != null) {
      const collegeName = scopeName(
        scope.college ?? null,
        masters?.colleges ?? [],
        "All colleges",
      );
      const courseName = scopeName(scope.course, masters?.courses ?? [], "Course");
      const branchName = scopeName(
        scope.branch ?? null,
        masters?.branches ?? [],
        "All branches",
      );
      const isBranchPrint = scope.branch != null;
      const html = buildCoursePrintHtml(
        scope.college ?? null,
        scope.course,
        scope.branch ?? null,
        scope.batch ?? null,
        activeSection,
      );
      if (!html) return;
      const sectionDisplay = activeSection
        ? `Section ${cleanSectionCode(activeSection)}`
        : "All sections";
      printHtml(html, {
        title: isBranchPrint ? "Branch timetable report" : "Course timetable report",
        subtitle: [
          academicYear,
          collegeName,
          courseName,
          branchName,
          scope.batch ? `Batch ${scope.batch}` : "All batches",
          sectionDisplay,
        ].join(" · "),
      });
      return;
    }

    const collegeCourses = (masters?.courses ?? []).filter((course) =>
      scope.college == null || course.collegeId === scope.college,
    );
    const content = collegeCourses
      .map((course) => {
        const html = buildCoursePrintHtml(
          scope.college ?? null,
          course.id,
          scope.branch ?? null,
          scope.batch ?? null,
          activeSection,
        );
        if (!html) return "";
        return `<h2 class="course-title">${escapeHtml(course.name)}</h2>${html}`;
      })
      .filter(Boolean)
      .join("");

    if (!content) return;

    printHtml(content, {
      title: "College timetable report",
      subtitle: [
        academicYear,
        scopeName(scope.college ?? null, masters?.colleges ?? [], "All colleges"),
        scopeName(scope.branch ?? null, masters?.branches ?? [], "All branches"),
        scope.batch ? `Batch ${scope.batch}` : "All batches",
      ].join(" · "),
    });
  }

  function renderTimetableMatrix(schedule: ScheduleGroup, branchId: number) {
    const batchRows = rows.filter(
      (row) =>
        row.branchId === branchId &&
        row.batch === schedule.batch &&
        (schedule.section == null
          ? true
          : cleanSectionCode(row.section) === schedule.section),
    );
    const slotKey = (row: TimetableReportRow) =>
      String(
        row.slotOrder ??
          row.slotId ??
          `${row.slotLabel ?? ""}|${row.startTime ?? ""}|${row.endTime ?? ""}`,
      );
    const batchPeriods = Array.from(
      new Map(
        batchRows
          .filter((row) => row.slotId != null)
          .map((row) => [slotKey(row), row]),
      ).values(),
    ).sort(
      (a, b) => (a.slotOrder ?? a.slotId ?? 0) - (b.slotOrder ?? b.slotId ?? 0),
    );
    const getSlot = (period: TimetableReportRow) => ({
      slotType: period.slotType ?? "CLASS",
      label: period.slotLabel || `P${period.slotId}`,
      startTime: period.startTime ?? "",
      endTime: period.endTime ?? "",
    });
    const elementKey = `${branchId}-${schedule.key}`;

    return (
      <div
        key={elementKey}
        ref={(element) => {
          batchRefs.current[elementKey] = element;
        }}
        className="space-y-1.5"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h4 className="text-xs font-semibold text-navy-900">
              Batch {schedule.displayBatch}
            </h4>
            {schedule.displaySection ? (
              <span className="rounded-full bg-sky-50 px-2 py-0.5 text-[10px] font-semibold text-sky-700 border border-sky-200">
                {schedule.displaySection}
              </span>
            ) : null}
          </div>
          <button
            type="button"
            aria-label={`Print ${schedule.title}`}
            title={`Print ${schedule.title}`}
            className="print:hidden inline-flex h-6 w-6 items-center justify-center rounded border border-border text-navy-800 hover:bg-slate-100 transition-colors"
            onClick={() => {
              const element = batchRefs.current[elementKey];
              if (element)
                printElement(element, {
                  title: "Department Timetable Report",
                  subtitle: [academicYear, schedule.title].join(" · "),
                });
            }}
          >
            <Printer className="h-3.5 w-3.5" />
          </button>
        </div>
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full min-w-[980px] table-fixed border-collapse text-sm">
            <colgroup>
              <col style={{ width: "5.5rem" }} />
              {batchPeriods.map((period) => (
                <col key={slotKey(period)} />
              ))}
            </colgroup>
            <thead>
              <tr className="bg-slate-50 text-[10px] uppercase tracking-wide text-slate-500">
                <th className="border-b border-r border-border px-1.5 py-1.5 text-left">
                  Day
                </th>
                {batchPeriods.map((period) => {
                  const slot = getSlot(period);
                  const nonClass = isNonClassTimingSlot(slot);
                  return (
                    <th
                      key={slotKey(period)}
                      className="border-b border-r border-border px-1.5 py-1.5 text-center"
                    >
                      <div className="truncate">
                        {nonClass ? timingSlotDisplayLabel(slot) : slot.label}
                      </div>
                      <div className="truncate text-[8px] font-normal normal-case text-slate-400">
                        {nonClass ? `${slot.label} · ` : ""}
                        {slot.startTime.slice(0, 5)}–{slot.endTime.slice(0, 5)}
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {timetableDays.map((day) => (
                <tr key={day}>
                  <td className="border-b border-r border-border px-1.5 py-1.5 text-[11px] font-medium text-navy-900">
                    {day}
                  </td>
                  {batchPeriods.map((period) => {
                    const slot = getSlot(period);
                    const periodKey = slotKey(period);
                    const cellRows = batchRows.filter(
                      (row) => row.day === day && slotKey(row) === periodKey,
                    );
                    const nonClass = isNonClassTimingSlot(slot);
                    return (
                      <td
                        key={`${day}-${periodKey}`}
                        className="border-b border-r border-border p-0.5 align-top text-center"
                      >
                        {nonClass ? (
                          <div
                            className={cn(
                              "flex h-full min-h-[56px] flex-col items-center justify-center rounded px-0.5 text-center text-[10px] font-semibold",
                              timingSlotCellClass(slot),
                            )}
                          >
                            <span>{timingSlotDisplayLabel(slot)}</span>
                            <span className="text-[8px] font-normal opacity-80">
                              {slot.startTime.slice(0, 5)}–
                              {slot.endTime.slice(0, 5)}
                            </span>
                          </div>
                        ) : cellRows.length ? (
                          cellRows.map((row) => (
                            <div
                              key={`${row.planId}-${row.slotId}`}
                              className={cn(
                                "flex min-h-[56px] h-full w-full flex-col justify-between overflow-hidden rounded border px-1 py-1 text-left",
                                row.subjectName
                                  ? classPeriodCellClass()
                                  : specialPeriodCellClass(),
                              )}
                            >
                              <div>
                                <p className="line-clamp-2 text-[10px] font-bold leading-tight text-navy-900">
                                  {row.subjectName || row.label}
                                </p>
                                <p className="mt-0.5 truncate text-[8px] font-mono text-slate-500">
                                  {row.label}
                                </p>
                              </div>
                              <div className="space-y-0.5 text-[8px] text-slate-600">
                                {row.facultyName ? (
                                  <p className="truncate">{row.facultyName}</p>
                                ) : null}
                                {row.room ? (
                                  <p className="text-slate-500">
                                    Room {row.room}
                                  </p>
                                ) : null}
                              </div>
                            </div>
                          ))
                        ) : (
                          <div
                            className={cn(
                              "flex min-h-[56px] h-full items-center justify-center rounded border text-[10px] font-medium",
                              emptyPeriodCellClass(),
                            )}
                          >
                            <span className="text-slate-400">Free</span>
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  return (
    <div ref={reportRef} className="space-y-4 print:text-black">
      {/* Filters Bar */}
      <div className="flex flex-wrap items-end gap-3 rounded-lg border border-border bg-white p-3.5 shadow-sm print:hidden">
        <label className="text-xs font-medium text-slate-600">
          Academic Year
          <select
            value={academicYear}
            onChange={(event) => {
              setAcademicYear(event.target.value);
              setSelectedCollege(null);
              setSelectedCourse(null);
              setSelectedBranch(null);
              setSelectedBatch(null);
              setSelectedSection(null);
            }}
            className="mt-1 block h-9 rounded-md border border-border bg-white px-2.5 text-xs font-normal text-slate-900 shadow-sm focus:border-navy-600 focus:outline-none focus:ring-1 focus:ring-navy-600"
          >
            <option value="">Select academic year</option>
            {masters?.academicYears.map((item) => (
              <option key={item.label} value={item.label}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-medium text-slate-600">
          College
          <select
            value={selectedCollege ?? ""}
            onChange={(event) => {
              const val = event.target.value ? Number(event.target.value) : null;
              setSelectedCollege(val);
              setSelectedCourse(null);
              setSelectedBranch(null);
              setSelectedBatch(null);
              setSelectedSection(null);
              if (val != null) {
                setExpandedCollegeIds((prev) => new Set(prev).add(val));
              }
            }}
            className="mt-1 block h-9 rounded-md border border-border bg-white px-2.5 text-xs font-normal text-slate-900 shadow-sm focus:border-navy-600 focus:outline-none focus:ring-1 focus:ring-navy-600"
          >
            <option value="">All colleges</option>
            {masters?.colleges.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-medium text-slate-600">
          Course
          <select
            value={selectedCourse ?? ""}
            onChange={(event) => {
              const val = event.target.value ? Number(event.target.value) : null;
              setSelectedCourse(val);
              setSelectedBranch(null);
              setSelectedBatch(null);
              setSelectedSection(null);
              if (val != null) {
                setExpandedCourseIds((prev) => new Set(prev).add(val));
                const c = masters?.courses.find((course) => course.id === val);
                if (c) {
                  setExpandedCollegeIds((prev) => new Set(prev).add(c.collegeId));
                }
              }
            }}
            className="mt-1 block h-9 rounded-md border border-border bg-white px-2.5 text-xs font-normal text-slate-900 shadow-sm focus:border-navy-600 focus:outline-none focus:ring-1 focus:ring-navy-600"
          >
            <option value="">All courses</option>
            {filterCourses.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-medium text-slate-600">
          Branch
          <select
            value={selectedBranch ?? ""}
            onChange={(event) => {
              const val = event.target.value ? Number(event.target.value) : null;
              setSelectedBranch(val);
              setSelectedBatch(null);
              setSelectedSection(null);
              if (val != null) {
                setExpandedBranchIds((prev) => new Set(prev).add(val));
                const b = masters?.branches.find((br) => br.id === val);
                if (b) {
                  setExpandedCourseIds((prev) => new Set(prev).add(b.courseId));
                  const c = masters?.courses.find((course) => course.id === b.courseId);
                  if (c) {
                    setExpandedCollegeIds((prev) => new Set(prev).add(c.collegeId));
                  }
                }
              }
            }}
            className="mt-1 block h-9 rounded-md border border-border bg-white px-2.5 text-xs font-normal text-slate-900 shadow-sm focus:border-navy-600 focus:outline-none focus:ring-1 focus:ring-navy-600"
          >
            <option value="">All branches</option>
            {filterBranches.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-medium text-slate-600">
          Batch
          <select
            value={selectedBatch ?? ""}
            onChange={(event) => {
              setSelectedBatch(event.target.value || null);
              setSelectedSection(null);
            }}
            className="mt-1 block h-9 rounded-md border border-border bg-white px-2.5 text-xs font-normal text-slate-900 shadow-sm focus:border-navy-600 focus:outline-none focus:ring-1 focus:ring-navy-600"
          >
            <option value="">All batches</option>
            {filterBatches.map((batch) => (
              <option key={batch} value={batch}>
                {batch}
              </option>
            ))}
          </select>
        </label>
        {selectedBranch != null && selectedBranchHasSections && availableBranchSections.length > 0 ? (
          <label className="text-xs font-medium text-slate-600">
            Section
            <select
              value={selectedSection ?? ""}
              onChange={(event) => setSelectedSection(event.target.value || null)}
              className="mt-1 block h-9 rounded-md border border-border bg-white px-2.5 text-xs font-normal text-slate-900 shadow-sm focus:border-navy-600 focus:outline-none focus:ring-1 focus:ring-navy-600"
            >
              <option value="">All sections ({availableBranchSections.length})</option>
              {availableBranchSections.map((sec) => (
                <option key={sec} value={sec}>
                  Section {sec}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <div className="flex items-center gap-2">
          <Button size="sm" variant="secondary" onClick={printSelectedTables}>
            <Printer className="mr-1 h-3.5 w-3.5" />
            Print selected tables
          </Button>
          {hasActiveFilters && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={handleResetFilters}
              className="border border-slate-300 text-slate-600 hover:text-navy-900"
            >
              <RotateCcw className="mr-1 h-3.5 w-3.5" />
              Reset filters
            </Button>
          )}
        </div>
      </div>

      {!academicYear ? (
        <EmptyState
          title="Select an academic year"
          description="Choose an academic year to view colleges and their timetable coverage."
        />
      ) : (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-500 px-1">
            <span>
              Showing {displayedColleges.length} {displayedColleges.length === 1 ? "college" : "colleges"}
              {selectedCollege != null ? " (filtered)" : ""}
            </span>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="text-xs text-navy-700 hover:underline inline-flex items-center gap-1"
              >
                Clear all filters
              </button>
            )}
          </div>
          <div className="overflow-x-auto rounded-lg border border-border bg-white">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">College</th>
                  <th className="px-3 py-3 text-right print:hidden">Action</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: 4 }).map((_, i) => (
                    <tr key={i} className="border-b border-border/80">
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-3">
                          <Skeleton className="h-4 w-4 rounded" variant="subtle" />
                          <Skeleton className="h-4 w-48 sm:w-64 rounded" />
                        </div>
                      </td>
                      <td className="px-3 py-4 text-right">
                        <Skeleton className="h-7 w-20 rounded-md ml-auto" variant="subtle" />
                      </td>
                    </tr>
                  ))
                ) : (
                  displayedColleges.map((college) => {
                    const isCollegeOpen = expandedCollegeIds.has(college.id);
                    const collegeCourses = getCollegeCourses(college.id);
                    const collegeRows = rows.filter((r) => r.collegeId === college.id);
                    const collegeScheduleCount = new Set(
                      collegeRows.map((r) => `${r.branchId}-${r.batch}-${r.section ?? ""}`),
                    ).size;
                    const hasCollegeRows = collegeRows.length > 0;

                    return (
                      <Fragment key={college.id}>
                        <tr
                          className="cursor-pointer border-t border-border hover:bg-slate-50/80 transition-colors"
                          onClick={() => toggleCollege(college.id)}
                        >
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2 font-medium text-navy-900">
                                <ChevronRight
                                  className={`h-4 w-4 text-slate-400 transition-transform ${isCollegeOpen ? "rotate-90 text-navy-900" : ""}`}
                                />
                                <span>{college.name}</span>
                                {college.code ? (
                                  <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-mono text-slate-600">
                                    {college.code}
                                  </span>
                                ) : null}
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-slate-500">
                                  {collegeCourses.length} {collegeCourses.length === 1 ? "course" : "courses"}
                                </span>
                                {collegeScheduleCount > 0 ? (
                                  <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700 border border-emerald-200">
                                    {collegeScheduleCount} {collegeScheduleCount === 1 ? "schedule" : "schedules"} active
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500">
                                    No published schedules
                                  </span>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="px-3 py-3 text-right print:hidden">
                            <button
                              type="button"
                              aria-label={`Print ${college.name} timetable`}
                              title={hasCollegeRows ? `Print ${college.name} timetable` : `No timetables published for ${college.name}`}
                              disabled={!hasCollegeRows}
                              className={cn(
                                "inline-flex h-7 w-7 items-center justify-center rounded border border-border text-navy-800 hover:bg-slate-100 transition-colors",
                                !hasCollegeRows && "opacity-30 cursor-not-allowed hover:bg-transparent",
                              )}
                              onClick={(event) => {
                                event.stopPropagation();
                                if (hasCollegeRows) {
                                  printScoped({ college: college.id });
                                }
                              }}
                            >
                              <Printer className="h-3.5 w-3.5" />
                            </button>
                          </td>
                        </tr>

                        {isCollegeOpen ? (
                          <tr>
                            <td colSpan={2} className="bg-slate-50/70 px-6 py-4">
                              <div className="space-y-3">
                                <div className="text-xs font-semibold uppercase text-slate-500">
                                  Courses ({collegeCourses.length})
                                </div>
                                {collegeCourses.length === 0 ? (
                                  <div className="rounded border border-dashed border-slate-200 bg-white p-4 text-center text-xs text-slate-500">
                                    No courses found for this college.
                                  </div>
                                ) : (
                                  collegeCourses.map((course) => {
                                    const isCourseOpen = expandedCourseIds.has(course.id);
                                    const courseBranches = getCourseBranches(course.id);
                                    const courseRows = rows.filter((r) => r.courseId === course.id);
                                    const hasCourseRows = courseRows.length > 0;

                                    return (
                                      <div
                                        key={course.id}
                                        className="overflow-hidden rounded-md border border-border bg-white shadow-sm"
                                      >
                                        <div
                                          className="flex w-full items-center justify-between px-4 py-3 cursor-pointer hover:bg-slate-50 transition-colors"
                                          onClick={() => toggleCourse(course.id)}
                                        >
                                          <div className="flex items-center gap-2 font-medium text-navy-900">
                                            <ChevronRight
                                              className={`h-4 w-4 text-slate-400 transition-transform ${isCourseOpen ? "rotate-90 text-navy-900" : ""}`}
                                            />
                                            <span>{course.name}</span>
                                            {course.code ? (
                                              <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-mono text-slate-600">
                                                {course.code}
                                              </span>
                                            ) : null}
                                          </div>
                                          <div className="flex items-center gap-2">
                                            <span className="text-xs text-slate-500">
                                              {courseBranches.length} {courseBranches.length === 1 ? "branch" : "branches"}
                                            </span>
                                            {hasCourseRows ? (
                                              <span className="inline-flex items-center rounded bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700 border border-emerald-200">
                                                Active
                                              </span>
                                            ) : (
                                              <span className="inline-flex items-center rounded bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500">
                                                Not configured
                                              </span>
                                            )}
                                            <button
                                              type="button"
                                              aria-label={`Print ${course.name} timetable`}
                                              title={hasCourseRows ? `Print ${course.name} timetable` : `No timetables published for ${course.name}`}
                                              disabled={!hasCourseRows}
                                              className={cn(
                                                "ml-2 inline-flex h-6 w-6 items-center justify-center rounded border border-border text-navy-800 hover:bg-slate-100 print:hidden",
                                                !hasCourseRows && "opacity-30 cursor-not-allowed hover:bg-transparent",
                                              )}
                                              onClick={(event) => {
                                                event.stopPropagation();
                                                if (hasCourseRows) {
                                                  printScoped({
                                                    college: college.id,
                                                    course: course.id,
                                                  });
                                                }
                                              }}
                                            >
                                              <Printer className="h-3.5 w-3.5" />
                                            </button>
                                          </div>
                                        </div>

                                        {isCourseOpen ? (
                                          <div className="border-t border-border px-4 py-3 bg-slate-50/40">
                                            <div className="mb-2 text-xs font-semibold uppercase text-slate-500">
                                              Branches ({courseBranches.length})
                                            </div>
                                            {courseBranches.length === 0 ? (
                                              <div className="rounded border border-dashed border-slate-200 bg-white p-3 text-center text-xs text-slate-500">
                                                No branches found for this course.
                                              </div>
                                            ) : (
                                              <div className="overflow-hidden rounded-md border border-border bg-white">
                                                <table className="w-full text-left text-xs">
                                                  <thead className="bg-slate-100 text-[10px] uppercase text-slate-500">
                                                    <tr>
                                                      <th className="px-3 py-2">
                                                        Branch
                                                      </th>
                                                      <th className="px-3 py-2 text-center">
                                                        Configured
                                                      </th>
                                                      <th className="px-3 py-2 text-center">
                                                        Not configured
                                                      </th>
                                                      <th className="px-3 py-2 text-center print:hidden">
                                                        Action
                                                      </th>
                                                    </tr>
                                                  </thead>
                                                  <tbody>
                                                    {courseBranches.map((branch) => {
                                                      const stats = getBranchStats(branch.id);
                                                      const isBranchOpen = expandedBranchIds.has(branch.id);
                                                      const branchSchedules = getBranchSchedules(branch.id);
                                                      const hasBranchRows = rows.some((r) => r.branchId === branch.id);

                                                      return (
                                                        <Fragment key={branch.id}>
                                                          <tr
                                                            className="cursor-pointer border-t border-border hover:bg-slate-50"
                                                            onClick={() => toggleBranch(branch.id)}
                                                          >
                                                            <td className="px-3 py-2 font-medium text-navy-900">
                                                              <span className="flex items-center gap-2">
                                                                <ChevronRight
                                                                  className={`h-3.5 w-3.5 transition-transform ${isBranchOpen ? "rotate-90 text-navy-900" : "text-slate-400"}`}
                                                                />
                                                                {branch.name}
                                                                {branch.code ? (
                                                                  <span className="rounded bg-slate-100 px-1 text-[9px] font-mono text-slate-500">
                                                                    {branch.code}
                                                                  </span>
                                                                ) : null}
                                                              </span>
                                                            </td>
                                                            <td className="px-3 py-2 text-center font-semibold text-emerald-700">
                                                              {stats.configured}
                                                            </td>
                                                            <td className="px-3 py-2 text-center text-slate-500">
                                                              {stats.notConfigured}
                                                            </td>
                                                            <td className="px-3 py-2 text-center print:hidden">
                                                              <button
                                                                type="button"
                                                                aria-label={`Print ${branch.name} timetable`}
                                                                title={hasBranchRows ? `Print ${branch.name} timetable` : `No timetables published for ${branch.name}`}
                                                                disabled={!hasBranchRows}
                                                                className={cn(
                                                                  "inline-flex h-6 w-6 items-center justify-center rounded border border-border text-navy-800 hover:bg-slate-100",
                                                                  !hasBranchRows && "opacity-30 cursor-not-allowed hover:bg-transparent",
                                                                )}
                                                                onClick={(event) => {
                                                                  event.stopPropagation();
                                                                  if (hasBranchRows) {
                                                                    printScoped({
                                                                      college: college.id,
                                                                      course: course.id,
                                                                      branch: branch.id,
                                                                    });
                                                                  }
                                                                }}
                                                              >
                                                                <Printer className="h-3.5 w-3.5" />
                                                              </button>
                                                            </td>
                                                          </tr>
                                                          {isBranchOpen ? (
                                                            <tr>
                                                              <td colSpan={4} className="border-t border-border bg-slate-50/50 p-4">
                                                                {branchSchedules.length > 0 ? (
                                                                  <div className="space-y-4">
                                                                    {branchSchedules.map((schedule) =>
                                                                      renderTimetableMatrix(schedule, branch.id),
                                                                    )}
                                                                  </div>
                                                                ) : (
                                                                  <div className="rounded-lg border border-dashed border-slate-200 bg-white p-5 text-center">
                                                                    <div className="mx-auto mb-2 flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                                                                      <Calendar className="h-4 w-4" />
                                                                    </div>
                                                                    <p className="text-xs font-semibold text-navy-900">
                                                                      No Timetable Published
                                                                    </p>
                                                                    <p className="mt-1 text-[11px] text-slate-500 max-w-sm mx-auto">
                                                                      No timetable schedules have been published for {branch.name}
                                                                      {selectedBatch ? ` (Batch ${selectedBatch})` : ""}
                                                                      {selectedSection ? ` (Section ${cleanSectionCode(selectedSection)})` : ""} for academic year {academicYear}.
                                                                    </p>
                                                                    <div className="mt-2.5">
                                                                      <Link
                                                                        href={`/timetables?collegeId=${college.id}&branchId=${branch.id}&academicYear=${encodeURIComponent(academicYear)}`}
                                                                        className="inline-flex items-center gap-1 rounded bg-navy-800 px-2.5 py-1 text-xs font-medium text-white hover:bg-navy-900 transition-colors shadow-sm"
                                                                      >
                                                                        Open Timetable Planner
                                                                      </Link>
                                                                    </div>
                                                                  </div>
                                                                )}
                                                              </td>
                                                            </tr>
                                                          ) : null}
                                                        </Fragment>
                                                      );
                                                    })}
                                                  </tbody>
                                                </table>
                                              </div>
                                            )}
                                          </div>
                                        ) : null}
                                      </div>
                                    );
                                  })
                                )}
                              </div>
                            </td>
                          </tr>
                        ) : null}
                      </Fragment>
                    );
                  })
                )}
                {!loading && displayedColleges.length === 0 ? (
                  <tr>
                    <td
                      colSpan={2}
                      className="px-4 py-6 text-center text-slate-500"
                    >
                      No colleges found matching the selected filter.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
