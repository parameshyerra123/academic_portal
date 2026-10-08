"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAcademicContext } from "@/components/layout/AcademicProvider";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { printElement } from "@/lib/print-service";
import { cn } from "@/lib/cn";
import {
  Calendar,
  ChevronLeft,
  Download,
  Printer,
  RotateCcw,
  Search,
  Users,
  BookOpen,
  ArrowRightLeft,
  CheckCircle2,
  AlertTriangle,
  History,
  TrendingUp,
  FileSpreadsheet,
  FileText,
  X,
  Filter,
  UserCheck,
  CalendarCheck,
  Clock,
  ExternalLink,
} from "lucide-react";

type ReportSummary = {
  totalMasterPeriods: number;
  totalScheduledSessions: number;
  totalConductedSessions: number;
  totalChangesRecorded: number;
  facultySubstitutionsCount: number;
  subjectSwapsCount: number;
  revertedCount: number;
  overallChangeRatePct: number;
  attendanceAvgPct: number;
};

type SubjectStat = {
  subjectCode: string;
  subjectName: string;
  masterWeeklyPeriods: number;
  totalConducted: number;
  timesChanged: number;
  timesSwappedOut: number;
  timesSwappedIn: number;
  facultyNames: string[];
  attendancePct: number;
};

type FacultyStat = {
  hrmsId: string;
  facultyName: string;
  masterAssignedPeriods: number;
  classesConducted: number;
  relievedCount: number;
  substituteTakenCount: number;
  netTeachingCount: number;
  subjects: string[];
};

type ComparisonItem = {
  id: number;
  date: string;
  dayOfWeek: string;
  time: string;
  slotLabel: string;
  batch: string;
  sectionName: string | null;
  semester: number;
  masterSubjectCode: string | null;
  masterSubjectName: string | null;
  masterFacultyName: string | null;
  masterFacultyHrmsId: string | null;
  todaySubjectCode: string | null;
  todaySubjectName: string | null;
  todayFacultyName: string | null;
  todayFacultyHrmsId: string | null;
  varianceType: "UNCHANGED" | "FACULTY_SUBSTITUTE" | "SUBJECT_SWAP" | "BOTH";
  isConducted: boolean;
  presentCount: number;
  absentCount: number;
  attendancePct: number | null;
};

type ChangeEvent = {
  id: number;
  timetableDate: string;
  collegeId: number;
  courseId: number;
  branchId: number;
  batch: string;
  semester: number;
  sectionName: string | null;
  slotLabel: string;
  slotTime: string;
  masterSubjectCode: string | null;
  masterSubjectName: string | null;
  masterFacultyHrmsId: string | null;
  masterFacultyName: string | null;
  newSubjectCode: string | null;
  newSubjectName: string | null;
  newFacultyHrmsId: string | null;
  newFacultyName: string | null;
  changeType: string;
  remarks: string | null;
  changedByName: string | null;
  createdAt: string;
  varianceType: "FACULTY_SUBSTITUTE" | "SUBJECT_SWAP" | "BOTH" | "REVERTED" | "PERIOD_OVERRIDE";
};

type ReportResponse = {
  summary: ReportSummary;
  subjects: SubjectStat[];
  faculties: FacultyStat[];
  recentChanges: ChangeEvent[];
  comparisons?: ComparisonItem[];
  catalogSubjects?: Array<{ subjectCode: string; subjectName: string }>;
  catalogFaculties?: Array<{ hrmsId: string; facultyName: string }>;
};

type TabKey = "variation" | "subjects" | "staff" | "audit";

function cleanSectionCode(raw: string | null | undefined): string {
  if (!raw) return "";
  const trimmed = raw.trim();
  const stripped = trimmed.replace(/^(?:(?:section|sec)[\s.:_-]*)+/i, "").trim();
  return (stripped || trimmed).toUpperCase();
}

function batchHasMultipleSections(
  branchId: number | null | undefined,
  batch: string | null | undefined,
  sections?: Array<{ branchId: number; name: string; batch?: string }>,
): boolean {
  if (branchId == null || !batch || !sections) return false;
  const secSet = new Set<string>();
  for (const s of sections) {
    if (s.branchId === branchId && s.batch === batch) {
      const code = cleanSectionCode(s.name);
      if (code) secSet.add(code);
    }
  }
  return secSet.size > 1;
}

function branchHasMultipleSections(
  branchId: number | null | undefined,
  sections?: Array<{ branchId: number; name: string; batch?: string }>,
): boolean {
  if (branchId == null || !sections) return false;
  const allBatches = new Set(
    sections.filter((s) => s.branchId === branchId && Boolean(s.batch)).map((s) => s.batch as string),
  );
  for (const b of allBatches) {
    if (batchHasMultipleSections(branchId, b, sections)) {
      return true;
    }
  }
  return false;
}

function getBranchSectionList(
  branchId: number | null | undefined,
  sections?: Array<{ branchId: number; name: string; batch?: string }>,
  selectedBatch?: string | null,
): string[] {
  if (branchId == null || !sections) return [];

  if (selectedBatch != null) {
    const secSet = new Set<string>();
    for (const s of sections) {
      if (s.branchId === branchId && s.batch === selectedBatch) {
        const code = cleanSectionCode(s.name);
        if (code) secSet.add(code);
      }
    }
    return secSet.size > 1
      ? Array.from(secSet).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
      : [];
  }

  const allBatches = new Set(
    sections.filter((s) => s.branchId === branchId && Boolean(s.batch)).map((s) => s.batch as string),
  );
  const multiSectionCodes = new Set<string>();
  for (const b of allBatches) {
    if (batchHasMultipleSections(branchId, b, sections)) {
      for (const s of sections) {
        if (s.branchId === branchId && s.batch === b) {
          const code = cleanSectionCode(s.name);
          if (code) multiSectionCodes.add(code);
        }
      }
    }
  }

  return Array.from(multiSectionCodes).sort((a, b) =>
    a.localeCompare(b, undefined, { numeric: true }),
  );
}

export function MasterVsChangedReport() {
  const { masters } = useAcademicContext();
  const [academicYear, setAcademicYear] = useState("");
  const [selectedCollege, setSelectedCollege] = useState<number | null>(null);
  const [selectedCourse, setSelectedCourse] = useState<number | null>(null);
  const [selectedBranch, setSelectedBranch] = useState<number | null>(null);
  const [selectedBatch, setSelectedBatch] = useState<string | null>(null);
  const [selectedSection, setSelectedSection] = useState<string | null>(null);
  const [selectedStaffHrmsId, setSelectedStaffHrmsId] = useState<string | null>(null);
  const [selectedSubjectCode, setSelectedSubjectCode] = useState<string | null>(null);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<TabKey>("variation");

  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<ReportResponse | null>(null);
  const printAreaRef = useRef<HTMLDivElement>(null);

  // Initialize active academic year
  useEffect(() => {
    if (masters && !academicYear) {
      const currentYear =
        masters.defaults.academicYear ||
        masters.academicYears.find((item) => item.isActive)?.label ||
        masters.academicYears[0]?.label;
      if (currentYear) setAcademicYear(currentYear);
    }
  }, [masters, academicYear]);

  // Load report data from server
  const loadReport = useCallback(async () => {
    if (!academicYear) return;
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("academicYear", academicYear);
      if (selectedCollege != null) params.set("collegeId", String(selectedCollege));
      if (selectedCourse != null) params.set("courseId", String(selectedCourse));
      if (selectedBranch != null) params.set("branchId", String(selectedBranch));
      if (selectedBatch) params.set("batch", selectedBatch);
      if (selectedSection) params.set("sectionName", selectedSection);
      if (selectedStaffHrmsId) params.set("staffHrmsId", selectedStaffHrmsId);
      if (selectedSubjectCode) params.set("subjectCode", selectedSubjectCode);
      if (startDate) params.set("startDate", startDate);
      if (endDate) params.set("endDate", endDate);

      const res = await apiFetch(`/today-timetable/master-vs-changed-report?${params.toString()}`);
      if (res.ok) {
        const json = (await res.json()) as ReportResponse;
        setData(json);
      }
    } catch (err) {
      console.error("Failed to load master vs changed report:", err);
    } finally {
      setLoading(false);
    }
  }, [
    academicYear,
    selectedCollege,
    selectedCourse,
    selectedBranch,
    selectedBatch,
    selectedSection,
    selectedStaffHrmsId,
    selectedSubjectCode,
    startDate,
    endDate,
  ]);

  useEffect(() => {
    void loadReport();
  }, [loadReport]);

  // Cascading Course Filter
  const filterCourses = useMemo(() => {
    if (!masters) return [];
    if (selectedCollege != null) {
      return masters.courses.filter((course) => course.collegeId === selectedCollege);
    }
    return masters.courses;
  }, [masters, selectedCollege]);

  // Cascading Branch Filter
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

  // Cascading Batch Filter
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
    }
    const batchSet = new Set(relevantBatches.map((b) => b.batch));
    return Array.from(batchSet).sort();
  }, [masters, selectedCourse, selectedBranch]);

  // Dynamic Section Support
  const selectedBranchHasSections = useMemo(() => {
    if (selectedBranch == null) return false;
    if (selectedBatch != null) {
      return batchHasMultipleSections(selectedBranch, selectedBatch, masters?.sections);
    }
    return branchHasMultipleSections(selectedBranch, masters?.sections);
  }, [selectedBranch, selectedBatch, masters?.sections]);

  const availableBranchSections = useMemo(() => {
    if (selectedBranch == null || !selectedBranchHasSections) return [];
    return getBranchSectionList(selectedBranch, masters?.sections, selectedBatch);
  }, [selectedBranch, selectedBranchHasSections, masters?.sections, selectedBatch]);

  useEffect(() => {
    if (selectedBranch == null || !selectedBranchHasSections) {
      if (selectedSection != null) setSelectedSection(null);
    } else if (selectedSection != null && !availableBranchSections.includes(selectedSection)) {
      setSelectedSection(null);
    }
  }, [selectedBranch, selectedBranchHasSections, availableBranchSections, selectedSection]);

  // Catalog faculties & subjects (always retains full dropdown options)
  const availableFaculties = useMemo(() => {
    if (data?.catalogFaculties && data.catalogFaculties.length > 0) return data.catalogFaculties;
    if (data?.faculties && data.faculties.length > 0)
      return data.faculties.map((f) => ({ hrmsId: f.hrmsId, facultyName: f.facultyName }));
    return [];
  }, [data?.catalogFaculties, data?.faculties]);

  const availableSubjects = useMemo(() => {
    if (data?.catalogSubjects && data.catalogSubjects.length > 0) return data.catalogSubjects;
    if (data?.subjects && data.subjects.length > 0)
      return data.subjects.map((s) => ({ subjectCode: s.subjectCode, subjectName: s.subjectName }));
    return [];
  }, [data?.catalogSubjects, data?.subjects]);

  // Active Selected Staff Drill-down Object
  const selectedStaffObj = useMemo(() => {
    if (!selectedStaffHrmsId) return null;
    const fromStats = data?.faculties?.find((f) => f.hrmsId === selectedStaffHrmsId);
    if (fromStats) return fromStats;
    const fromCatalog = availableFaculties.find((f) => f.hrmsId === selectedStaffHrmsId);
    if (fromCatalog) {
      return {
        hrmsId: fromCatalog.hrmsId,
        facultyName: fromCatalog.facultyName,
        masterAssignedPeriods: 0,
        classesConducted: 0,
        relievedCount: 0,
        substituteTakenCount: 0,
        netTeachingCount: 0,
        subjects: [],
      };
    }
    return null;
  }, [selectedStaffHrmsId, data?.faculties, availableFaculties]);

  // Active Selected Subject Drill-down Object
  const selectedSubjectObj = useMemo(() => {
    if (!selectedSubjectCode) return null;
    const fromStats = data?.subjects?.find((s) => s.subjectCode === selectedSubjectCode);
    if (fromStats) return fromStats;
    const fromCatalog = availableSubjects.find((s) => s.subjectCode === selectedSubjectCode);
    if (fromCatalog) {
      return {
        subjectCode: fromCatalog.subjectCode,
        subjectName: fromCatalog.subjectName,
        masterWeeklyPeriods: 0,
        totalConducted: 0,
        timesChanged: 0,
        timesSwappedOut: 0,
        timesSwappedIn: 0,
        facultyNames: [],
        attendancePct: 0,
      };
    }
    return null;
  }, [selectedSubjectCode, data?.subjects, availableSubjects]);

  // "Back to Summary" button action: clears drilldown and active sub-filters
  const handleBackToSummary = () => {
    setSelectedStaffHrmsId(null);
    setSelectedSubjectCode(null);
    setSelectedBranch(null);
    setSelectedBatch(null);
    setSelectedSection(null);
    setSelectedCourse(null);
    setSelectedCollege(null);
    setStartDate("");
    setEndDate("");
    setSearchQuery("");
    setActiveTab("variation");
  };

  const hasActiveFilters = Boolean(
    selectedCollege != null ||
      selectedCourse != null ||
      selectedBranch != null ||
      selectedBatch != null ||
      selectedSection != null ||
      selectedStaffHrmsId != null ||
      selectedSubjectCode != null ||
      startDate ||
      endDate ||
      searchQuery,
  );

  const summary = data?.summary ?? {
    totalMasterPeriods: 0,
    totalScheduledSessions: 0,
    totalConductedSessions: 0,
    totalChangesRecorded: 0,
    facultySubstitutionsCount: 0,
    subjectSwapsCount: 0,
    revertedCount: 0,
    overallChangeRatePct: 0,
    attendanceAvgPct: 0,
  };

  // Filtered comparison items (Master vs Today)
  const filteredComparisons = useMemo(() => {
    const list = data?.comparisons ?? [];
    if (!searchQuery.trim()) return list;
    const q = searchQuery.toLowerCase();
    return list.filter(
      (c) =>
        (c.masterSubjectName || "").toLowerCase().includes(q) ||
        (c.masterSubjectCode || "").toLowerCase().includes(q) ||
        (c.masterFacultyName || "").toLowerCase().includes(q) ||
        (c.todaySubjectName || "").toLowerCase().includes(q) ||
        (c.todaySubjectCode || "").toLowerCase().includes(q) ||
        (c.todayFacultyName || "").toLowerCase().includes(q) ||
        c.batch.toLowerCase().includes(q) ||
        (c.sectionName || "").toLowerCase().includes(q) ||
        c.slotLabel.toLowerCase().includes(q) ||
        c.date.includes(q),
    );
  }, [data?.comparisons, searchQuery]);

  // Export to Excel / CSV
  const handleExportCsv = () => {
    if (!filteredComparisons.length) {
      alert("No data available to export.");
      return;
    }
    const headers = [
      "Slot/Time",
      "Date",
      "Day",
      "Batch",
      "Section",
      "Master Subject Code",
      "Master Subject Name",
      "Master Faculty",
      "Today Subject Code",
      "Today Subject Name",
      "Today Faculty",
      "Variation Status",
      "Conducted Status",
      "Attendance %",
    ];
    const rows = filteredComparisons.map((c) => [
      `"${c.slotLabel} (${c.time})"`,
      c.date,
      c.dayOfWeek,
      c.batch,
      c.sectionName || "N/A",
      c.masterSubjectCode || "",
      `"${(c.masterSubjectName || "").replace(/"/g, '""')}"`,
      `"${(c.masterFacultyName || "").replace(/"/g, '""')}"`,
      c.todaySubjectCode || "",
      `"${(c.todaySubjectName || "").replace(/"/g, '""')}"`,
      `"${(c.todayFacultyName || "").replace(/"/g, '""')}"`,
      c.varianceType === "UNCHANGED"
        ? "As Master"
        : c.varianceType === "FACULTY_SUBSTITUTE"
          ? "Faculty Substitute"
          : c.varianceType === "SUBJECT_SWAP"
            ? "Subject Swap"
            : "Both Sub & Swap",
      c.isConducted ? "Conducted" : "Scheduled",
      c.attendancePct != null ? `${c.attendancePct}%` : "Pending",
    ]);

    const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\r\n");
    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `master_vs_today_timetable_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Export to PDF / Print
  const handlePrintPdf = () => {
    if (printAreaRef.current) {
      printElement(printAreaRef.current, {
        title: "Master vs Changed Timetable Report",
        subtitle: [
          `Academic Year: ${academicYear}`,
          selectedStaffObj ? `Staff: ${selectedStaffObj.facultyName}` : "",
          selectedSubjectObj ? `Subject: ${selectedSubjectObj.subjectName}` : "",
          startDate && endDate ? `Dates: ${startDate} to ${endDate}` : "",
        ]
          .filter(Boolean)
          .join(" · "),
      });
    }
  };

  const unchangedPct = Math.max(0, 100 - summary.overallChangeRatePct);

  return (
    <div className="space-y-4">
      {/* 1. Header Toolbar with "Back to Summary" button */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleBackToSummary}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-700 shadow-xs hover:bg-slate-50 transition-colors cursor-pointer"
          >
            <ChevronLeft className="h-4 w-4 text-slate-500" />
            Back to Summary
          </button>
          {hasActiveFilters && (
            <span className="text-[11px] font-medium text-slate-500">
              (Filtered view active)
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handlePrintPdf}
            className="inline-flex h-8 items-center gap-1.5 rounded-md border border-rose-400 bg-rose-50/40 px-3 text-xs font-semibold text-rose-600 shadow-2xs hover:bg-rose-100 transition-colors cursor-pointer"
          >
            <FileText className="h-3.5 w-3.5" />
            PDF
          </button>
          <button
            type="button"
            onClick={handleExportCsv}
            className="inline-flex h-8 items-center gap-1.5 rounded-md border border-emerald-500 bg-emerald-50/40 px-3 text-xs font-semibold text-emerald-700 shadow-2xs hover:bg-emerald-100 transition-colors cursor-pointer"
          >
            <FileSpreadsheet className="h-3.5 w-3.5" />
            Excel
          </button>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={handleBackToSummary}
              className="inline-flex h-8 items-center gap-1 rounded-md border border-slate-300 bg-white px-2.5 text-xs font-medium text-slate-600 hover:text-navy-900 cursor-pointer"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Reset
            </button>
          )}
        </div>
      </div>

      {/* 2. Comprehensive Filter Toolbar */}
      <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-xs">
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7">
          {/* Academic Year */}
          <label className="text-[11px] font-medium text-slate-600">
            Academic Year
            <select
              value={academicYear}
              onChange={(e) => {
                setAcademicYear(e.target.value);
                setSelectedCollege(null);
                setSelectedCourse(null);
                setSelectedBranch(null);
                setSelectedBatch(null);
                setSelectedSection(null);
                setSelectedStaffHrmsId(null);
                setSelectedSubjectCode(null);
              }}
              className="mt-1 block h-8.5 w-full rounded-md border border-slate-300 bg-white px-2 text-xs text-slate-800 shadow-xs focus:border-navy-600 focus:outline-none"
            >
              {masters?.academicYears.map((item) => (
                <option key={item.id} value={item.label}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>

          {/* College */}
          <label className="text-[11px] font-medium text-slate-600">
            College
            <select
              value={selectedCollege ?? ""}
              onChange={(e) => {
                const val = e.target.value ? Number(e.target.value) : null;
                setSelectedCollege(val);
                setSelectedCourse(null);
                setSelectedBranch(null);
                setSelectedBatch(null);
                setSelectedSection(null);
              }}
              className="mt-1 block h-8.5 w-full rounded-md border border-slate-300 bg-white px-2 text-xs text-slate-800 shadow-xs focus:border-navy-600 focus:outline-none"
            >
              <option value="">All Colleges</option>
              {masters?.colleges.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>

          {/* Program / Course */}
          <label className="text-[11px] font-medium text-slate-600">
            Program
            <select
              value={selectedCourse ?? ""}
              onChange={(e) => {
                const val = e.target.value ? Number(e.target.value) : null;
                setSelectedCourse(val);
                setSelectedBranch(null);
                setSelectedBatch(null);
                setSelectedSection(null);
              }}
              className="mt-1 block h-8.5 w-full rounded-md border border-slate-300 bg-white px-2 text-xs text-slate-800 shadow-xs focus:border-navy-600 focus:outline-none"
            >
              <option value="">All Programs</option>
              {filterCourses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>

          {/* Branch */}
          <label className="text-[11px] font-medium text-slate-600">
            Branch
            <select
              value={selectedBranch ?? ""}
              onChange={(e) => {
                const val = e.target.value ? Number(e.target.value) : null;
                setSelectedBranch(val);
                setSelectedBatch(null);
                setSelectedSection(null);
              }}
              className="mt-1 block h-8.5 w-full rounded-md border border-slate-300 bg-white px-2 text-xs text-slate-800 shadow-xs focus:border-navy-600 focus:outline-none"
            >
              <option value="">All Branches</option>
              {filterBranches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </label>

          {/* Batch */}
          <label className="text-[11px] font-medium text-slate-600">
            Batch
            <select
              value={selectedBatch ?? ""}
              onChange={(e) => {
                setSelectedBatch(e.target.value || null);
                setSelectedSection(null);
              }}
              className="mt-1 block h-8.5 w-full rounded-md border border-slate-300 bg-white px-2 text-xs text-slate-800 shadow-xs focus:border-navy-600 focus:outline-none"
            >
              <option value="">All Batches</option>
              {filterBatches.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          </label>

          {/* Section (conditionally rendered only if branch has multiple sections) */}
          {selectedBranch != null && selectedBranchHasSections && availableBranchSections.length > 0 && (
            <label className="text-[11px] font-medium text-slate-600">
              Section
              <select
                value={selectedSection ?? ""}
                onChange={(e) => setSelectedSection(e.target.value || null)}
                className="mt-1 block h-8.5 w-full rounded-md border border-slate-300 bg-white px-2 text-xs text-slate-800 shadow-xs focus:border-navy-600 focus:outline-none"
              >
                <option value="">All Sections</option>
                {availableBranchSections.map((sec) => (
                  <option key={sec} value={sec}>
                    Section {sec}
                  </option>
                ))}
              </select>
            </label>
          )}

          {/* Staff / Faculty Selector */}
          <label className="text-[11px] font-medium text-slate-600">
            Staff / Faculty
            <select
              value={selectedStaffHrmsId ?? ""}
              onChange={(e) => setSelectedStaffHrmsId(e.target.value || null)}
              className="mt-1 block h-8.5 w-full rounded-md border border-slate-300 bg-white px-2 text-xs text-slate-800 shadow-xs focus:border-navy-600 focus:outline-none truncate"
            >
              <option value="">All Faculty ({availableFaculties.length})</option>
              {availableFaculties.map((f) => (
                <option key={f.hrmsId} value={f.hrmsId}>
                  {f.facultyName} ({f.hrmsId})
                </option>
              ))}
            </select>
          </label>

          {/* Subject Selector */}
          <label className="text-[11px] font-medium text-slate-600">
            Subject
            <select
              value={selectedSubjectCode ?? ""}
              onChange={(e) => setSelectedSubjectCode(e.target.value || null)}
              className="mt-1 block h-8.5 w-full rounded-md border border-slate-300 bg-white px-2 text-xs text-slate-800 shadow-xs focus:border-navy-600 focus:outline-none truncate"
            >
              <option value="">All Subjects ({availableSubjects.length})</option>
              {availableSubjects.map((s) => (
                <option key={s.subjectCode} value={s.subjectCode}>
                  {s.subjectCode} · {s.subjectName}
                </option>
              ))}
            </select>
          </label>
        </div>

        {/* Date Filter & Search Row */}
        <div className="mt-3 pt-2.5 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="font-semibold text-slate-500 uppercase text-[10px] tracking-wider">Date range:</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="h-8 rounded border border-slate-300 px-2 text-xs text-slate-700 bg-white"
            />
            <span className="text-slate-400">to</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="h-8 rounded border border-slate-300 px-2 text-xs text-slate-700 bg-white"
            />
            {(startDate || endDate) && (
              <button
                type="button"
                onClick={() => {
                  setStartDate("");
                  setEndDate("");
                }}
                className="text-xs text-rose-600 hover:underline cursor-pointer ml-1"
              >
                Clear dates
              </button>
            )}
          </div>

          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search staff, subject, period..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-8 w-56 sm:w-64 rounded-md border border-slate-300 bg-white pl-8 pr-2.5 text-xs text-slate-800 placeholder-slate-400 focus:border-navy-700 focus:outline-none"
            />
          </div>
        </div>
      </div>

      {/* Printable Report Wrapper */}
      <div ref={printAreaRef} className="space-y-4">
        {/* 3. Executive KPI Metric Cards */}
        <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-3 lg:grid-cols-6">
          {/* Card 1: Master Lectures Assigned */}
          <div className="rounded-xl border border-blue-100 bg-blue-50/40 p-3.5 shadow-2xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600">
              Master Assigned
            </span>
            <div className="mt-1">
              <span className="text-2xl font-extrabold text-blue-900">
                {summary.totalMasterPeriods}
              </span>
            </div>
            <p className="mt-0.5 text-[10px] text-blue-700/80">Weekly lecture quota</p>
          </div>

          {/* Card 2: Conducted Classes */}
          <div className="rounded-xl border border-emerald-100 bg-emerald-50/40 p-3.5 shadow-2xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600">
              Classes Conducted
            </span>
            <div className="mt-1">
              <span className="text-2xl font-extrabold text-emerald-800">
                {summary.totalConductedSessions}
              </span>
            </div>
            <p className="mt-0.5 text-[10px] text-emerald-700/80">Attended / held</p>
          </div>

          {/* Card 3: Classes Changed */}
          <div className="rounded-xl border border-amber-100 bg-amber-50/40 p-3.5 shadow-2xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700">
              Classes Changed
            </span>
            <div className="mt-1">
              <span className="text-2xl font-extrabold text-amber-800">
                {summary.totalChangesRecorded}
              </span>
            </div>
            <p className="mt-0.5 text-[10px] text-amber-700/80">Altered from plan</p>
          </div>

          {/* Card 4: Faculty Substitutions */}
          <div className="rounded-xl border border-sky-100 bg-sky-50/40 p-3.5 shadow-2xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-sky-700">
              Faculty Substituted
            </span>
            <div className="mt-1">
              <span className="text-2xl font-extrabold text-sky-800">
                {summary.facultySubstitutionsCount}
              </span>
            </div>
            <p className="mt-0.5 text-[10px] text-sky-700/80">Relievers stepped in</p>
          </div>

          {/* Card 5: Subject Swaps */}
          <div className="rounded-xl border border-purple-100 bg-purple-50/40 p-3.5 shadow-2xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-purple-700">
              Subject Swapped
            </span>
            <div className="mt-1">
              <span className="text-2xl font-extrabold text-purple-800">
                {summary.subjectSwapsCount}
              </span>
            </div>
            <p className="mt-0.5 text-[10px] text-purple-700/80">Subject exchange</p>
          </div>

          {/* Card 6: Change Rate % */}
          <div className="rounded-xl border border-rose-100 bg-rose-50/40 p-3.5 shadow-2xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-rose-600">
              Change Rate %
            </span>
            <div className="mt-1">
              <span className="text-2xl font-extrabold text-rose-700">
                {summary.overallChangeRatePct}%
              </span>
            </div>
            <p className="mt-0.5 text-[10px] text-rose-700/80">Timetable variance</p>
          </div>
        </div>

        {/* 4. Interactive Focus Drill-Down Card for Staff */}
        {selectedStaffObj && (
          <div className="rounded-xl border-2 border-amber-300 bg-linear-to-r from-amber-50/70 to-white p-4 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-amber-200 pb-2.5">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500 text-white font-bold">
                  <UserCheck className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-navy-950">{selectedStaffObj.facultyName}</h3>
                    <span className="rounded bg-amber-100 px-2 py-0.5 font-mono text-[11px] font-bold text-amber-900">
                      HRMS ID: {selectedStaffObj.hrmsId}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600">
                    Faculty Teaching & Substitution Analytics
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedStaffHrmsId(null)}
                className="rounded border border-slate-300 px-2.5 py-1 text-xs text-slate-600 hover:text-navy-900 cursor-pointer"
              >
                Clear Staff Filter
              </button>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-5">
              <div className="rounded-lg bg-white p-2.5 border border-amber-200 shadow-2xs">
                <span className="text-[10px] font-semibold text-slate-500 uppercase">Master Assigned</span>
                <p className="mt-1 text-lg font-bold text-navy-950">{selectedStaffObj.masterAssignedPeriods} <span className="text-xs font-normal text-slate-500">classes</span></p>
              </div>
              <div className="rounded-lg bg-white p-2.5 border border-emerald-200 shadow-2xs">
                <span className="text-[10px] font-semibold text-emerald-700 uppercase">Classes Conducted</span>
                <p className="mt-1 text-lg font-bold text-emerald-800">{selectedStaffObj.classesConducted} <span className="text-xs font-normal text-slate-500">attended</span></p>
              </div>
              <div className="rounded-lg bg-white p-2.5 border border-rose-200 shadow-2xs">
                <span className="text-[10px] font-semibold text-rose-700 uppercase">Relieved (Substituted Out)</span>
                <p className="mt-1 text-lg font-bold text-rose-700">{selectedStaffObj.relievedCount} <span className="text-xs font-normal text-slate-500">classes</span></p>
              </div>
              <div className="rounded-lg bg-white p-2.5 border border-sky-200 shadow-2xs">
                <span className="text-[10px] font-semibold text-sky-700 uppercase">Substitutions Taken (In)</span>
                <p className="mt-1 text-lg font-bold text-sky-800">{selectedStaffObj.substituteTakenCount} <span className="text-xs font-normal text-slate-500">classes</span></p>
              </div>
              <div className="rounded-lg bg-white p-2.5 border border-indigo-200 shadow-2xs">
                <span className="text-[10px] font-semibold text-indigo-700 uppercase">Net Teaching Load</span>
                <p className="mt-1 text-lg font-bold text-indigo-900">{selectedStaffObj.netTeachingCount} <span className="text-xs font-normal text-slate-500">total</span></p>
              </div>
            </div>

            {selectedStaffObj.subjects && selectedStaffObj.subjects.length > 0 && (
              <div className="mt-2.5 flex flex-wrap items-center gap-1.5 text-xs">
                <span className="font-semibold text-slate-600">Subjects:</span>
                {selectedStaffObj.subjects.map((sub, i) => (
                  <span key={i} className="rounded bg-amber-100/90 px-2 py-0.5 text-[11px] font-medium text-amber-900">
                    {sub}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 5. Interactive Focus Drill-Down Card for Subject */}
        {selectedSubjectObj && (
          <div className="rounded-xl border-2 border-emerald-300 bg-linear-to-r from-emerald-50/70 to-white p-4 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-emerald-200 pb-2.5">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-600 text-white font-bold">
                  <BookOpen className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-navy-950">{selectedSubjectObj.subjectName}</h3>
                    <span className="rounded bg-emerald-100 px-2 py-0.5 font-mono text-[11px] font-bold text-emerald-900">
                      Code: {selectedSubjectObj.subjectCode}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600">
                    Subject Allotment & Timetable Alteration Report
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedSubjectCode(null)}
                className="rounded border border-slate-300 px-2.5 py-1 text-xs text-slate-600 hover:text-navy-900 cursor-pointer"
              >
                Clear Subject Filter
              </button>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
              <div className="rounded-lg bg-white p-2.5 border border-emerald-200 shadow-2xs">
                <span className="text-[10px] font-semibold text-slate-500 uppercase">Master Quota</span>
                <p className="mt-1 text-lg font-bold text-navy-950">{selectedSubjectObj.masterWeeklyPeriods} <span className="text-xs font-normal text-slate-500">periods/wk</span></p>
              </div>
              <div className="rounded-lg bg-white p-2.5 border border-emerald-200 shadow-2xs">
                <span className="text-[10px] font-semibold text-emerald-700 uppercase">Classes Conducted</span>
                <p className="mt-1 text-lg font-bold text-emerald-800">{selectedSubjectObj.totalConducted} <span className="text-xs font-normal text-slate-500">attended</span></p>
              </div>
              <div className="rounded-lg bg-white p-2.5 border border-amber-200 shadow-2xs">
                <span className="text-[10px] font-semibold text-amber-700 uppercase">Times Changed</span>
                <p className="mt-1 text-lg font-bold text-amber-800">
                  {selectedSubjectObj.timesChanged}{" "}
                  <span className="text-[11px] font-normal text-slate-500">
                    ({selectedSubjectObj.timesSwappedOut} out / {selectedSubjectObj.timesSwappedIn} in)
                  </span>
                </p>
              </div>
              <div className="rounded-lg bg-white p-2.5 border border-indigo-200 shadow-2xs">
                <span className="text-[10px] font-semibold text-indigo-700 uppercase">Attendance %</span>
                <p className="mt-1 text-lg font-bold text-indigo-900">{selectedSubjectObj.attendancePct}%</p>
              </div>
            </div>

            {selectedSubjectObj.facultyNames && selectedSubjectObj.facultyNames.length > 0 && (
              <div className="mt-2.5 flex flex-wrap items-center gap-1.5 text-xs">
                <span className="font-semibold text-slate-600">Assigned Faculty:</span>
                {selectedSubjectObj.facultyNames.map((name, i) => (
                  <span key={i} className="rounded bg-emerald-100/90 px-2 py-0.5 text-[11px] font-medium text-emerald-900">
                    {name}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 6. View Tabs Switcher & Color Legend */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-2">
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => setActiveTab("variation")}
              className={cn(
                "rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all shadow-2xs cursor-pointer",
                activeTab === "variation"
                  ? "bg-navy-900 text-white"
                  : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50",
              )}
            >
              Master vs Today Comparison ({filteredComparisons.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("subjects")}
              className={cn(
                "rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all shadow-2xs cursor-pointer",
                activeTab === "subjects"
                  ? "bg-navy-900 text-white"
                  : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50",
              )}
            >
              Subject Analytics ({data?.subjects.length ?? 0})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("staff")}
              className={cn(
                "rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all shadow-2xs cursor-pointer",
                activeTab === "staff"
                  ? "bg-navy-900 text-white"
                  : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50",
              )}
            >
              Staff Analytics ({data?.faculties.length ?? 0})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("audit")}
              className={cn(
                "rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all shadow-2xs cursor-pointer",
                activeTab === "audit"
                  ? "bg-navy-900 text-white"
                  : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50",
              )}
            >
              Change Audit Log ({summary.totalChangesRecorded})
            </button>
          </div>

          {/* Color Legend */}
          <div className="flex flex-wrap items-center gap-3 text-[11px] font-medium text-slate-600">
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-500"></span>
              As Master (Unchanged)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-amber-500"></span>
              Faculty Substitute
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-sky-500"></span>
              Subject Swapped
            </span>
          </div>
        </div>

        {/* 7. Tab View 1: MASTER VS TODAY TIMETABLE COMPARISON (Period-by-Period Variation) */}
        {activeTab === "variation" && (
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs">
            <div className="border-b border-slate-100 bg-slate-50/60 px-4 py-2.5">
              <h4 className="text-xs font-bold uppercase tracking-wider text-navy-900">
                Period-by-Period Comparison: Master Timetable vs Actual Conducted
              </h4>
              <p className="text-[11px] text-slate-500">
                Shows exactly what lecture was scheduled in the master timetable versus what actually happened today
              </p>
            </div>

            {filteredComparisons.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-500">
                No timetable sessions match the selected filters.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-100/70 text-[10px] font-bold uppercase tracking-wider text-slate-600">
                      <th className="py-3 px-3">Slot & Time</th>
                      <th className="py-3 px-2">Date & Day</th>
                      <th className="py-3 px-2">Class / Batch</th>
                      <th className="py-3 px-3">Master Timetable (Assigned)</th>
                      <th className="py-3 px-3">Today Timetable (Conducted)</th>
                      <th className="py-3 px-2 text-center">Variation Status</th>
                      <th className="py-3 px-3">Variance Note</th>
                      <th className="py-3 px-3 text-center">Attendance %</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredComparisons.map((c) => {
                      const isUnchanged = c.varianceType === "UNCHANGED";
                      const isSubstitute = c.varianceType === "FACULTY_SUBSTITUTE" || c.varianceType === "BOTH";
                      const isSwap = c.varianceType === "SUBJECT_SWAP" || c.varianceType === "BOTH";

                      return (
                        <tr
                          key={c.id}
                          className={cn(
                            "hover:bg-slate-50/80 transition-colors",
                            !isUnchanged ? "bg-amber-50/20" : "",
                          )}
                        >
                          {/* Slot & Time */}
                          <td className="py-3 px-3 font-mono font-bold text-navy-950">
                            {c.slotLabel}
                            <p className="font-normal text-[10px] text-slate-500">{c.time}</p>
                          </td>

                          {/* Date & Day */}
                          <td className="py-3 px-2">
                            <span className="font-semibold text-slate-800">{c.date}</span>
                            <p className="text-[10px] text-slate-400 font-bold uppercase">{c.dayOfWeek}</p>
                          </td>

                          {/* Batch & Section */}
                          <td className="py-3 px-2">
                            <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-semibold text-slate-800">
                              Batch {c.batch}
                            </span>
                            {c.sectionName && (
                              <span className="ml-1 rounded bg-sky-50 px-1.5 py-0.5 text-[10px] font-bold text-sky-700 border border-sky-200">
                                Sec {cleanSectionCode(c.sectionName)}
                              </span>
                            )}
                          </td>

                          {/* Master Schedule (Assigned) */}
                          <td className="py-3 px-3">
                            <p className="font-bold text-navy-900">
                              {c.masterSubjectName || c.masterSubjectCode || <span className="text-slate-400">Not Assigned</span>}
                            </p>
                            <p className="text-[10px] text-slate-500 mt-0.5">
                              Faculty: <span className="font-medium text-slate-700">{c.masterFacultyName || "None"}</span>
                            </p>
                          </td>

                          {/* Today's Schedule (Actual) */}
                          <td className="py-3 px-3">
                            <p
                              className={cn(
                                "font-bold",
                                isSwap ? "text-amber-800 underline decoration-amber-400" : "text-navy-900",
                              )}
                            >
                              {c.todaySubjectName || c.todaySubjectCode || c.masterSubjectName}
                            </p>
                            <p
                              className={cn(
                                "text-[10px] mt-0.5",
                                isSubstitute ? "text-sky-800 font-bold" : "text-slate-500",
                              )}
                            >
                              Faculty: <span className="font-medium">{c.todayFacultyName || c.masterFacultyName}</span>
                            </p>
                          </td>

                          {/* Variation Status */}
                          <td className="py-3 px-2 text-center">
                            {isUnchanged && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[10px] font-bold text-emerald-700 border border-emerald-200">
                                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
                                As Master
                              </span>
                            )}
                            {c.varianceType === "FACULTY_SUBSTITUTE" && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-[10px] font-bold text-amber-800 border border-amber-300">
                                <span className="h-1.5 w-1.5 rounded-full bg-amber-500"></span>
                                Substitute
                              </span>
                            )}
                            {c.varianceType === "SUBJECT_SWAP" && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-2.5 py-0.5 text-[10px] font-bold text-sky-800 border border-sky-300">
                                <span className="h-1.5 w-1.5 rounded-full bg-sky-500"></span>
                                Swapped
                              </span>
                            )}
                            {c.varianceType === "BOTH" && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-purple-50 px-2.5 py-0.5 text-[10px] font-bold text-purple-800 border border-purple-300">
                                <span className="h-1.5 w-1.5 rounded-full bg-purple-500"></span>
                                Sub + Swap
                              </span>
                            )}
                          </td>

                          {/* Variance Details */}
                          <td className="py-3 px-3 text-slate-600 text-[11px]">
                            {isSubstitute ? (
                              <span className="text-amber-900 font-medium">
                                {c.masterFacultyName?.split(" ")[0]} relieved → {c.todayFacultyName?.split(" ")[0]} covered
                              </span>
                            ) : isSwap ? (
                              <span className="text-sky-900 font-medium">
                                Subject changed to {c.todaySubjectCode}
                              </span>
                            ) : (
                              <span className="text-slate-400 italic">Held as planned</span>
                            )}
                          </td>

                          {/* Attendance */}
                          <td className="py-3 px-3 text-center">
                            {c.isConducted && c.attendancePct != null ? (
                              <span
                                className={cn(
                                  "inline-block rounded-md px-2 py-0.5 text-xs font-bold",
                                  c.attendancePct >= 75
                                    ? "bg-emerald-100 text-emerald-800"
                                    : c.attendancePct >= 50
                                      ? "bg-amber-100 text-amber-800"
                                      : "bg-rose-100 text-rose-800",
                                )}
                              >
                                {c.attendancePct}%
                              </span>
                            ) : (
                              <span className="text-[11px] text-slate-400 font-medium">Scheduled</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* 8. Tab View 2: SUBJECT ANALYTICS REPORT */}
        {activeTab === "subjects" && (
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-3">
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-navy-900">
                  Subject Delivery & Alteration Analytics
                </h4>
                <p className="text-[11px] text-slate-500">
                  Total classes assigned, conducted, and altered per subject
                </p>
              </div>
              <span className="text-xs font-semibold text-slate-600">
                {data?.subjects.length ?? 0} Subjects
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-[10px] font-bold uppercase text-slate-600">
                    <th className="py-2.5 px-3">Subject Name & Code</th>
                    <th className="py-2.5 px-2 text-center">Master Quota</th>
                    <th className="py-2.5 px-2 text-center">Conducted</th>
                    <th className="py-2.5 px-2 text-center">Swapped Out</th>
                    <th className="py-2.5 px-2 text-center">Swapped In</th>
                    <th className="py-2.5 px-2 text-center">Total Changes</th>
                    <th className="py-2.5 px-2 text-center">Attendance %</th>
                    <th className="py-2.5 px-3">Assigned Faculty</th>
                    <th className="py-2.5 px-2 text-right">Drill Down</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data?.subjects.map((sub) => (
                    <tr
                      key={sub.subjectCode}
                      className={cn(
                        "hover:bg-slate-50 transition-colors",
                        selectedSubjectCode === sub.subjectCode ? "bg-emerald-50/50" : "",
                      )}
                    >
                      <td className="py-3 px-3">
                        <p className="font-bold text-navy-900">{sub.subjectName}</p>
                        <span className="font-mono text-[10px] text-slate-400">{sub.subjectCode}</span>
                      </td>
                      <td className="py-3 px-2 text-center font-semibold text-slate-800">{sub.masterWeeklyPeriods}</td>
                      <td className="py-3 px-2 text-center font-bold text-emerald-700">{sub.totalConducted}</td>
                      <td className="py-3 px-2 text-center font-medium text-rose-600">
                        {sub.timesSwappedOut > 0 ? sub.timesSwappedOut : 0}
                      </td>
                      <td className="py-3 px-2 text-center font-medium text-emerald-600">
                        {sub.timesSwappedIn > 0 ? sub.timesSwappedIn : 0}
                      </td>
                      <td className="py-3 px-2 text-center font-bold">
                        {sub.timesChanged > 0 ? (
                          <span className="rounded bg-amber-100 px-1.5 py-0.5 text-amber-800">
                            {sub.timesChanged}
                          </span>
                        ) : (
                          <span className="text-slate-400">0</span>
                        )}
                      </td>
                      <td className="py-3 px-2 text-center font-bold text-slate-700">
                        {sub.attendancePct > 0 ? `${sub.attendancePct}%` : "-"}
                      </td>
                      <td className="py-3 px-3 text-slate-600">
                        <div className="flex flex-wrap gap-1 max-w-xs">
                          {sub.facultyNames.map((name, i) => (
                            <span key={i} className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px]">
                              {name}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="py-3 px-2 text-right">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedSubjectCode(sub.subjectCode);
                            setActiveTab("variation");
                          }}
                          className="rounded px-2.5 py-1 text-[11px] font-semibold border border-emerald-600 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 cursor-pointer"
                        >
                          Select
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 9. Tab View 3: STAFF ANALYTICS REPORT */}
        {activeTab === "staff" && (
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-3">
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-navy-900">
                  Faculty Teaching Load & Substitution Report
                </h4>
                <p className="text-[11px] text-slate-500">
                  Classes assigned, attended, relief substitution given, and extra classes covered
                </p>
              </div>
              <span className="text-xs font-semibold text-slate-600">
                {data?.faculties.length ?? 0} Faculty
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-[10px] font-bold uppercase text-slate-600">
                    <th className="py-2.5 px-3">Faculty Name</th>
                    <th className="py-2.5 px-2">HRMS ID</th>
                    <th className="py-2.5 px-2 text-center">Master Quota</th>
                    <th className="py-2.5 px-2 text-center">Conducted</th>
                    <th className="py-2.5 px-2 text-center">Relieved (Out)</th>
                    <th className="py-2.5 px-2 text-center">Substitute (In)</th>
                    <th className="py-2.5 px-2 text-center">Net Load</th>
                    <th className="py-2.5 px-3">Assigned Subjects</th>
                    <th className="py-2.5 px-2 text-right">Drill Down</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data?.faculties.map((f) => (
                    <tr
                      key={f.hrmsId}
                      className={cn(
                        "hover:bg-slate-50 transition-colors",
                        selectedStaffHrmsId === f.hrmsId ? "bg-amber-50/50" : "",
                      )}
                    >
                      <td className="py-3 px-3">
                        <p className="font-bold text-navy-900">{f.facultyName}</p>
                      </td>
                      <td className="py-3 px-2 font-mono text-[11px] text-slate-500">#{f.hrmsId}</td>
                      <td className="py-3 px-2 text-center font-semibold text-slate-800">{f.masterAssignedPeriods}</td>
                      <td className="py-3 px-2 text-center font-bold text-emerald-700">{f.classesConducted}</td>
                      <td className="py-3 px-2 text-center font-bold text-rose-600">
                        {f.relievedCount > 0 ? `-${f.relievedCount}` : "0"}
                      </td>
                      <td className="py-3 px-2 text-center font-bold text-sky-600">
                        {f.substituteTakenCount > 0 ? `+${f.substituteTakenCount}` : "0"}
                      </td>
                      <td className="py-3 px-2 text-center font-extrabold text-navy-950">{f.netTeachingCount}</td>
                      <td className="py-3 px-3 text-slate-600">
                        <div className="flex flex-wrap gap-1 max-w-xs">
                          {f.subjects.map((sub, i) => (
                            <span key={i} className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px]">
                              {sub}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="py-3 px-2 text-right">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedStaffHrmsId(f.hrmsId);
                            setActiveTab("variation");
                          }}
                          className="rounded px-2.5 py-1 text-[11px] font-semibold border border-amber-500 text-amber-800 bg-amber-50 hover:bg-amber-100 cursor-pointer"
                        >
                          Select
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 10. Tab View 4: CHANGE AUDIT LOG */}
        {activeTab === "audit" && (
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
            <div className="border-b border-slate-100 pb-3 mb-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-navy-900">
                Official Timetable Alteration History
              </h4>
              <p className="text-[11px] text-slate-500">
                Audit trail of every approved faculty substitution, period swap, and alteration
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-[10px] font-bold uppercase text-slate-600">
                    <th className="py-2.5 px-3">Date & Slot</th>
                    <th className="py-2.5 px-2">Batch</th>
                    <th className="py-2.5 px-3">Master (Before)</th>
                    <th className="py-2.5 px-3">Actual (After)</th>
                    <th className="py-2.5 px-2 text-center">Type</th>
                    <th className="py-2.5 px-3">Reason</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data?.recentChanges.map((change) => (
                    <tr key={change.id} className="hover:bg-slate-50">
                      <td className="py-3 px-3">
                        <p className="font-bold text-navy-900">{change.timetableDate}</p>
                        <p className="text-[10px] text-slate-500 font-mono">{change.slotLabel}</p>
                      </td>
                      <td className="py-3 px-2">
                        <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-semibold text-slate-800">
                          Batch {change.batch} {change.sectionName ? `· Sec ${change.sectionName}` : ""}
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        <p className="font-semibold text-slate-800">{change.masterSubjectName || change.masterSubjectCode || "None"}</p>
                        <p className="text-[10px] text-slate-500">Faculty: {change.masterFacultyName || "None"}</p>
                      </td>
                      <td className="py-3 px-3">
                        <p className="font-bold text-amber-900">{change.newSubjectName || change.newSubjectCode || change.masterSubjectName}</p>
                        <p className="text-[10px] text-sky-800 font-bold">Faculty: {change.newFacultyName || change.masterFacultyName}</p>
                      </td>
                      <td className="py-3 px-2 text-center">
                        <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-[10px] font-bold text-amber-800">
                          {change.varianceType}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-slate-600 italic text-[11px]">
                        {change.remarks || "No remarks"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
