"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAcademicContext } from "@/components/layout/AcademicProvider";
import { apiFetch } from "@/lib/api";
import { printElement } from "@/lib/print-service";
import { cn } from "@/lib/cn";
import {
  RotateCcw,
  Search,
  BookOpen,
  FileSpreadsheet,
  FileText,
  X,
  CalendarCheck,
  UserCheck,
  ArrowRight,
  ArrowLeftRight,
  UserX,
  User,
  Clock,
  Calendar,
  ChevronRight,
  AlertTriangle,
  CheckCircle2,
  Percent,
  Info,
} from "lucide-react";

type KpiModalType = "master" | "conducted" | "changed" | "substituted" | "swapped" | "rate" | null;

type ReportSummary = {
  totalMasterPeriods: number;
  totalMasterPeriodsScheduled?: number;
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
  branchId?: number | null;
  branchName?: string;
  branchCode?: string;
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

type MasterPeriodItem = {
  id: number;
  dayOfWeek: string;
  slotLabel: string;
  slotTime: string;
  branchId?: number | null;
  branchName?: string;
  branchCode?: string;
  batch: string;
  semester: number;
  sectionName: string | null;
  subjectCode: string;
  subjectName: string;
  facultyName: string;
  facultyHrmsId: string | null;
  entryType: string;
  customLabel?: string | null;
};

type ChangeEvent = {
  id: number;
  timetableDate: string;
  collegeId: number;
  courseId: number;
  branchId: number;
  branchName?: string;
  branchCode?: string;
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

type CatalogClass = {
  key: string;
  label: string;
  collegeId?: number;
  courseId?: number;
  branchId?: number;
  batch: string;
  year: number;
  semester: number;
  sections: string[];
};

type ReportResponse = {
  summary: ReportSummary;
  subjects: SubjectStat[];
  faculties: FacultyStat[];
  recentChanges: ChangeEvent[];
  comparisons?: ComparisonItem[];
  masterScheduledPeriods?: MasterPeriodItem[];
  catalogSubjects?: Array<{ subjectCode: string; subjectName: string }>;
  catalogFaculties?: Array<{ hrmsId: string; facultyName: string }>;
  catalogClasses?: CatalogClass[];
};

function cleanSectionCode(raw: string | null | undefined): string {
  if (!raw) return "";
  const trimmed = raw.trim();
  const stripped = trimmed.replace(/^(?:(?:section|sec)[\s.:_-]*)+/i, "").trim();
  return (stripped || trimmed).toUpperCase();
}

function getTodayDateString(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDisplayDate(dateStr: string): string {
  if (!dateStr) return "";
  const parts = dateStr.split("-");
  if (parts.length === 3) {
    const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    if (!isNaN(d.getTime())) {
      return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
    }
  }
  return dateStr;
}

export type MasterReportSection = "variation" | "subjects" | "staff" | "audit";

export interface MasterVsChangedReportProps {
  activeSection?: MasterReportSection;
  onNavigateSection?: (section: MasterReportSection) => void;
}

export function MasterVsChangedReport({
  activeSection = "variation",
  onNavigateSection,
}: MasterVsChangedReportProps) {
  const { masters } = useAcademicContext();
  const [academicYear, setAcademicYear] = useState("");
  const [selectedCollege, setSelectedCollege] = useState<number | null>(null);
  const [selectedCourse, setSelectedCourse] = useState<number | null>(null);
  const [selectedBranch, setSelectedBranch] = useState<number | null>(null);
  const [selectedClassKey, setSelectedClassKey] = useState<string | null>(null);
  const [selectedBatch, setSelectedBatch] = useState<string | null>(null);
  const [selectedSection, setSelectedSection] = useState<string | null>(null);
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [selectedSemester, setSelectedSemester] = useState<number | null>(null);
  const [selectedStaffHrmsId, setSelectedStaffHrmsId] = useState<string | null>(null);
  const [selectedSubjectCode, setSelectedSubjectCode] = useState<string | null>(null);

  // Date mode: "today" or "range"
  const [dateMode, setDateMode] = useState<"today" | "range">("today");
  const [startDate, setStartDate] = useState(getTodayDateString());
  const [endDate, setEndDate] = useState(getTodayDateString());
  const [searchQuery, setSearchQuery] = useState("");

  // Interactive KPI Pop Card / Drawer State
  const [activeKpiDrawer, setActiveKpiDrawer] = useState<KpiModalType>(null);
  const [drawerSearch, setDrawerSearch] = useState("");

  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<ReportResponse | null>(null);
  const printAreaRef = useRef<HTMLDivElement>(null);

  // Close drawer on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setActiveKpiDrawer(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

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
      if (selectedYear != null) params.set("year", String(selectedYear));
      if (selectedSemester != null) params.set("semester", String(selectedSemester));
      if (selectedSection) {
        params.set("sectionName", selectedSection);
        params.set("section", selectedSection);
      }
      if (selectedStaffHrmsId) params.set("staffHrmsId", selectedStaffHrmsId);
      if (selectedSubjectCode) params.set("subjectCode", selectedSubjectCode);

      if (dateMode === "today") {
        const todayStr = getTodayDateString();
        params.set("startDate", todayStr);
        params.set("endDate", todayStr);
      } else {
        if (startDate) params.set("startDate", startDate);
        if (endDate) params.set("endDate", endDate);
      }

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
    selectedYear,
    selectedSemester,
    selectedSection,
    selectedStaffHrmsId,
    selectedSubjectCode,
    dateMode,
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

  // Available Classes: derived from live server catalog (filtered reactively) or fallback from masters
  const availableClasses = useMemo<CatalogClass[]>(() => {
    let list = data?.catalogClasses ?? [];
    if (selectedCollege != null) {
      list = list.filter((c) => !c.collegeId || c.collegeId === selectedCollege);
    }
    if (selectedCourse != null) {
      list = list.filter((c) => !c.courseId || c.courseId === selectedCourse);
    }
    if (selectedBranch != null) {
      list = list.filter((c) => !c.branchId || c.branchId === selectedBranch);
    }
    if (list.length > 0) {
      return list;
    }
    if (!masters || selectedBranch == null) return [];
    const branchSections = masters.sections.filter((s) => s.branchId === selectedBranch);
    const branchBatches = (masters.batches ?? []).filter((b) => b.branchId === selectedBranch);
    const batchSet = Array.from(
      new Set([...branchSections.map((s) => s.batch), ...branchBatches.map((b) => b.batch)]),
    )
      .filter(Boolean)
      .sort();

    const romanYears = ["I", "II", "III", "IV"];
    return batchSet.map((b, idx) => {
      const bSecs = Array.from(
        new Set(
          branchSections
            .filter((s) => s.batch === b)
            .map((s) => cleanSectionCode(s.name))
            .filter(Boolean),
        ),
      ).sort();
      const approxYear = Math.min(4, Math.max(1, idx + 1));
      return {
        key: `${b}_${approxYear}_1`,
        label: `${romanYears[approxYear - 1] || approxYear} Year (Batch ${b})`,
        collegeId: selectedCollege ?? undefined,
        courseId: selectedCourse ?? undefined,
        branchId: selectedBranch,
        batch: b,
        year: approxYear,
        semester: 1,
        sections: bSecs,
      };
    });
  }, [data?.catalogClasses, masters, selectedCollege, selectedCourse, selectedBranch]);

  // Active selected class object
  const activeClassObj = useMemo(() => {
    if (!selectedClassKey) return null;
    return availableClasses.find((c) => c.key === selectedClassKey) ?? null;
  }, [availableClasses, selectedClassKey]);

  // Year options for the course
  const yearOptions = useMemo(() => {
    if (selectedCourse != null && masters) {
      const course = masters.courses.find((c) => c.id === selectedCourse);
      if (course?.totalYears) {
        return Array.from({ length: course.totalYears }, (_, i) => i + 1);
      }
    }
    return masters?.yearOptions ?? [1, 2, 3, 4];
  }, [masters, selectedCourse]);

  // Dynamic sections: if class is selected, show exact sections for that class (e.g. 2 sections or 4 sections)
  const availableSections = useMemo<string[]>(() => {
    if (activeClassObj) {
      return activeClassObj.sections;
    }
    if (selectedYear != null) {
      const matchingClasses = availableClasses.filter((c) => c.year === selectedYear);
      const allSecs = new Set<string>();
      for (const c of matchingClasses) {
        for (const s of c.sections) allSecs.add(s);
      }
      return Array.from(allSecs).sort();
    }
    const allSecs = new Set<string>();
    for (const c of availableClasses) {
      for (const s of c.sections) allSecs.add(s);
    }
    return Array.from(allSecs).sort();
  }, [activeClassObj, selectedYear, availableClasses]);

  // Keep section valid when available sections change
  useEffect(() => {
    if (selectedSection != null && !availableSections.includes(selectedSection)) {
      setSelectedSection(null);
    }
  }, [availableSections, selectedSection]);

  // Handlers for class, year, semester
  const handleClassChange = (key: string | null) => {
    setSelectedClassKey(key);
    if (key) {
      const match = availableClasses.find((c) => c.key === key);
      if (match) {
        setSelectedBatch(match.batch);
        if (match.year) setSelectedYear(match.year);
        if (match.semester) setSelectedSemester(match.semester);
        if (selectedSection && !match.sections.includes(selectedSection)) {
          setSelectedSection(null);
        }
      }
    } else {
      setSelectedBatch(null);
      setSelectedSection(null);
      setSelectedYear(null);
      setSelectedSemester(null);
    }
  };

  const handleYearChange = (year: number | null) => {
    setSelectedYear(year);
    if (year == null) {
      if (activeClassObj) {
        setSelectedClassKey(null);
        setSelectedBatch(null);
        setSelectedSection(null);
      }
    } else if (activeClassObj && activeClassObj.year !== year) {
      const matchCls = availableClasses.find((c) => c.year === year);
      if (matchCls) {
        setSelectedClassKey(matchCls.key);
        setSelectedBatch(matchCls.batch);
      } else {
        setSelectedClassKey(null);
        setSelectedBatch(null);
        setSelectedSection(null);
      }
    }
  };

  const handleSemesterChange = (sem: number | null) => {
    setSelectedSemester(sem);
    if (activeClassObj && activeClassObj.semester !== sem) {
      setSelectedClassKey(null);
      setSelectedBatch(null);
      setSelectedSection(null);
    }
  };

  // Catalog faculties & subjects (for drilldown / reference)
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

  const selectedStaffObj = useMemo<FacultyStat | null>(() => {
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

  const selectedSubjectObj = useMemo<SubjectStat | null>(() => {
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

  // Reset all filters
  const handleResetFilters = () => {
    setSelectedCollege(null);
    setSelectedCourse(null);
    setSelectedBranch(null);
    setSelectedClassKey(null);
    setSelectedBatch(null);
    setSelectedYear(null);
    setSelectedSemester(null);
    setSelectedSection(null);
    setSelectedStaffHrmsId(null);
    setSelectedSubjectCode(null);
    setDateMode("today");
    const t = getTodayDateString();
    setStartDate(t);
    setEndDate(t);
    setSearchQuery("");
  };

  const hasActiveFilters = Boolean(
    selectedCollege != null ||
      selectedCourse != null ||
      selectedBranch != null ||
      selectedClassKey != null ||
      selectedYear != null ||
      selectedSemester != null ||
      selectedSection != null ||
      selectedStaffHrmsId != null ||
      selectedSubjectCode != null ||
      dateMode === "range" ||
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
        (c.batch || "").toLowerCase().includes(q) ||
        (c.sectionName || "").toLowerCase().includes(q) ||
        c.slotLabel.toLowerCase().includes(q) ||
        c.date.includes(q),
    );
  }, [data?.comparisons, searchQuery]);

  // Filtered subjects list
  const filteredSubjects = useMemo(() => {
    const list = data?.subjects ?? [];
    if (!searchQuery.trim()) return list;
    const q = searchQuery.toLowerCase();
    return list.filter(
      (s) =>
        s.subjectName.toLowerCase().includes(q) ||
        s.subjectCode.toLowerCase().includes(q) ||
        s.facultyNames.some((f) => f.toLowerCase().includes(q)),
    );
  }, [data?.subjects, searchQuery]);

  // Filtered faculty list
  const filteredFaculties = useMemo(() => {
    const list = data?.faculties ?? [];
    if (!searchQuery.trim()) return list;
    const q = searchQuery.toLowerCase();
    return list.filter(
      (f) =>
        f.facultyName.toLowerCase().includes(q) ||
        f.hrmsId.toLowerCase().includes(q) ||
        f.subjects.some((s) => s.toLowerCase().includes(q)),
    );
  }, [data?.faculties, searchQuery]);

  // Filtered recent changes (Audit Log)
  const filteredRecentChanges = useMemo(() => {
    const list = data?.recentChanges ?? [];
    if (!searchQuery.trim()) return list;
    const q = searchQuery.toLowerCase();
    return list.filter(
      (c) =>
        (c.masterSubjectName || "").toLowerCase().includes(q) ||
        (c.masterSubjectCode || "").toLowerCase().includes(q) ||
        (c.masterFacultyName || "").toLowerCase().includes(q) ||
        (c.newSubjectName || "").toLowerCase().includes(q) ||
        (c.newSubjectCode || "").toLowerCase().includes(q) ||
        (c.newFacultyName || "").toLowerCase().includes(q) ||
        (c.batch || "").toLowerCase().includes(q) ||
        (c.sectionName || "").toLowerCase().includes(q) ||
        (c.remarks || "").toLowerCase().includes(q) ||
        c.slotLabel.toLowerCase().includes(q) ||
        c.timetableDate.includes(q),
    );
  }, [data?.recentChanges, searchQuery]);

  // Branch lookup map for displaying branch codes (CSE, ECE, MEC...)
  const branchLookup = useMemo(() => {
    const map = new Map<number, { name: string; code: string }>();
    (masters?.branches || []).forEach((b) => {
      map.set(b.id, {
        name: b.name,
        code: b.code || b.name,
      });
    });
    return map;
  }, [masters?.branches]);

  const getBranchBadge = useCallback(
    (branchId?: number | null, fallbackCode?: string | null): string => {
      if (fallbackCode && fallbackCode.trim()) return fallbackCode.trim();
      if (branchId && branchLookup.has(branchId)) return branchLookup.get(branchId)!.code;
      if (selectedBranch && branchLookup.has(selectedBranch)) return branchLookup.get(selectedBranch)!.code;
      return "CSE";
    },
    [branchLookup, selectedBranch],
  );

  // Group comparisons cleanly by section (e.g. Sec A classes together, then Sec B classes together)
  const comparisonsBySection = useMemo(() => {
    const map = new Map<string, ComparisonItem[]>();

    for (const c of filteredComparisons) {
      const secCode = cleanSectionCode(c.sectionName) || "Unassigned";
      if (!map.has(secCode)) {
        map.set(secCode, []);
      }
      map.get(secCode)!.push(c);
    }

    // Sort sections: "A", "B", "C", ... followed by "Unassigned"
    const sortedSections = Array.from(map.keys()).sort((a, b) => {
      if (a === "Unassigned") return 1;
      if (b === "Unassigned") return -1;
      return a.localeCompare(b);
    });

    return sortedSections.map((secKey) => {
      const rawItems = map.get(secKey)!;
      // Sort items chronologically by date and start time / slot
      const items = [...rawItems].sort((a, b) => {
        if (a.date !== b.date) return a.date.localeCompare(b.date);
        return (a.time || "").localeCompare(b.time || "");
      });

      const conductedCount = items.filter((i) => i.isConducted).length;
      const substitutedCount = items.filter(
        (i) => i.varianceType === "FACULTY_SUBSTITUTE" || i.varianceType === "BOTH",
      ).length;
      const swappedCount = items.filter(
        (i) => i.varianceType === "SUBJECT_SWAP" || i.varianceType === "BOTH",
      ).length;
      const unchangedCount = items.filter((i) => i.varianceType === "UNCHANGED").length;

      return {
        sectionKey: secKey,
        sectionTitle: secKey === "Unassigned" ? "General / Combined Section" : `Section ${secKey}`,
        items,
        totalClasses: items.length,
        conductedCount,
        substitutedCount,
        swappedCount,
        unchangedCount,
      };
    });
  }, [filteredComparisons]);

  // Drill-down data sets for KPI Analytics Drawer
  const changedItems = useMemo(() => {
    const list: Array<{
      id: string;
      date: string;
      slotLabel: string;
      slotTime: string;
      branchCode?: string;
      branchName?: string;
      batch: string;
      sectionName: string | null;
      masterSubjectName: string;
      masterSubjectCode: string;
      masterFacultyName: string;
      masterFacultyHrmsId?: string | null;
      newSubjectName: string;
      newSubjectCode: string;
      newFacultyName: string;
      newFacultyHrmsId?: string | null;
      varianceType: string;
      remarks: string | null;
      changedByName?: string | null;
    }> = [];

    const seenKeys = new Set<string>();

    // 1. Authoritative change events from data.recentChanges
    (data?.recentChanges || []).forEach((c) => {
      const secCode = cleanSectionCode(c.sectionName);
      if (selectedSection && secCode && secCode !== cleanSectionCode(selectedSection)) {
        return;
      }
      const slotClean = (c.slotLabel || "").toUpperCase().replace(/\s+/g, "");
      const timeClean = (c.slotTime || "").trim();
      const bClean = (c.batch || "").trim().toLowerCase().replace(/^batch\s*/i, "");

      seenKeys.add(`${c.timetableDate}_${bClean}_${secCode}_${slotClean}`);
      if (timeClean) {
        seenKeys.add(`${c.timetableDate}_${bClean}_${secCode}_${timeClean}`);
      }

      list.push({
        id: `change-${c.id}`,
        date: c.timetableDate,
        slotLabel: c.slotLabel,
        slotTime: c.slotTime,
        branchCode: c.branchCode,
        branchName: c.branchName,
        batch: c.batch,
        sectionName: c.sectionName,
        masterSubjectName: c.masterSubjectName || "Scheduled Subject",
        masterSubjectCode: c.masterSubjectCode || "",
        masterFacultyName: c.masterFacultyName || "Scheduled Faculty",
        masterFacultyHrmsId: c.masterFacultyHrmsId,
        newSubjectName: c.newSubjectName || c.masterSubjectName || "Current Subject",
        newSubjectCode: c.newSubjectCode || c.masterSubjectCode || "",
        newFacultyName: c.newFacultyName || c.masterFacultyName || "Current Faculty",
        newFacultyHrmsId: c.newFacultyHrmsId,
        varianceType: c.varianceType,
        remarks: c.remarks,
        changedByName: c.changedByName,
      });
    });

    // 2. Only add from comparisons if this session was NOT already in recentChanges
    (data?.comparisons || []).forEach((c) => {
      if (c.varianceType !== "UNCHANGED") {
        const secCode = cleanSectionCode(c.sectionName);
        if (selectedSection && secCode && secCode !== cleanSectionCode(selectedSection)) {
          return;
        }
        const slotClean = (c.slotLabel || "").toUpperCase().replace(/\s+/g, "");
        const timeClean = (c.time || "").trim();
        const bClean = (c.batch || "").trim().toLowerCase().replace(/^batch\s*/i, "");

        const keyBySlot = `${c.date}_${bClean}_${secCode}_${slotClean}`;
        const keyByTime = `${c.date}_${bClean}_${secCode}_${timeClean}`;

        // Prevent duplicate if already captured from recentChanges
        const alreadyInList =
          seenKeys.has(keyBySlot) ||
          (timeClean ? seenKeys.has(keyByTime) : false) ||
          list.some(
            (item) =>
              item.date === c.date &&
              (item.batch || "").trim().toLowerCase().replace(/^batch\s*/i, "") === bClean &&
              cleanSectionCode(item.sectionName) === secCode &&
              ((slotClean && (item.slotLabel || "").toUpperCase().replace(/\s+/g, "") === slotClean) ||
                (timeClean && (item.slotTime || "").trim() === timeClean) ||
                (item.newSubjectCode && c.todaySubjectCode && item.newSubjectCode === c.todaySubjectCode)),
          );

        if (!alreadyInList) {
          seenKeys.add(keyBySlot);
          if (timeClean) seenKeys.add(keyByTime);
          list.push({
            id: `comp-${c.id}`,
            date: c.date,
            slotLabel: c.slotLabel,
            slotTime: c.time,
            branchCode: c.branchCode,
            branchName: c.branchName,
            batch: c.batch,
            sectionName: c.sectionName,
            masterSubjectName: c.masterSubjectName || "Scheduled Subject",
            masterSubjectCode: c.masterSubjectCode || "",
            masterFacultyName: c.masterFacultyName || "Scheduled Faculty",
            masterFacultyHrmsId: c.masterFacultyHrmsId,
            newSubjectName: c.todaySubjectName || c.masterSubjectName || "Current Subject",
            newSubjectCode: c.todaySubjectCode || c.masterSubjectCode || "",
            newFacultyName: c.todayFacultyName || c.masterFacultyName || "Current Faculty",
            newFacultyHrmsId: c.todayFacultyHrmsId,
            varianceType: c.varianceType,
            remarks: "Session altered from master schedule",
            changedByName: "Timetable Coordinator",
          });
        }
      }
    });

    return list;
  }, [data?.recentChanges, data?.comparisons, selectedSection]);

  // Specific Faculty Substitutions (Who was changed & Who took over)
  const substitutedItems = useMemo(() => {
    return changedItems.filter((c) => {
      return (
        c.varianceType === "FACULTY_SUBSTITUTE" ||
        c.varianceType === "BOTH" ||
        (c.masterFacultyName && c.newFacultyName && c.masterFacultyName.trim().toLowerCase() !== c.newFacultyName.trim().toLowerCase()) ||
        (c.masterFacultyHrmsId && c.newFacultyHrmsId && c.masterFacultyHrmsId !== c.newFacultyHrmsId)
      );
    });
  }, [changedItems]);

  // Specific Subject Swaps
  const swappedItems = useMemo(() => {
    return changedItems.filter((c) => {
      return (
        c.varianceType === "SUBJECT_SWAP" ||
        c.varianceType === "BOTH" ||
        (c.masterSubjectCode && c.newSubjectCode && c.masterSubjectCode.trim() !== c.newSubjectCode.trim()) ||
        (c.masterSubjectName && c.newSubjectName && c.masterSubjectName.trim().toLowerCase() !== c.newSubjectName.trim().toLowerCase())
      );
    });
  }, [changedItems]);

  // Conducted Classes (De-duplicated)
  const conductedItems = useMemo(() => {
    const list: NonNullable<typeof data>["comparisons"] = [];
    const seen = new Set<string>();
    (data?.comparisons || []).forEach((c) => {
      if (c.isConducted) {
        const secCode = cleanSectionCode(c.sectionName);
        if (selectedSection && secCode && secCode !== cleanSectionCode(selectedSection)) {
          return;
        }
        const key = `${c.date}_${c.slotLabel}_${c.batch}_${secCode}`;
        if (!seen.has(key)) {
          seen.add(key);
          list.push(c);
        }
      }
    });
    return list;
  }, [data?.comparisons, selectedSection]);

  // Master scheduled classes for today / date range (strictly excluding breaks)
  const masterScheduledList = useMemo(() => {
    let list = data?.masterScheduledPeriods ?? [];
    if (selectedSection) {
      const secCode = cleanSectionCode(selectedSection);
      list = list.filter((item) => cleanSectionCode(item.sectionName) === secCode);
    }
    return list;
  }, [data?.masterScheduledPeriods, selectedSection]);

  const filteredDrawerMasterScheduled = useMemo(() => {
    if (!drawerSearch.trim()) return masterScheduledList;
    const q = drawerSearch.toLowerCase();
    return masterScheduledList.filter(
      (m) =>
        m.subjectName.toLowerCase().includes(q) ||
        m.subjectCode.toLowerCase().includes(q) ||
        m.facultyName.toLowerCase().includes(q) ||
        m.slotLabel.toLowerCase().includes(q) ||
        (m.branchCode || "").toLowerCase().includes(q) ||
        (m.branchName || "").toLowerCase().includes(q) ||
        (m.sectionName || "").toLowerCase().includes(q),
    );
  }, [masterScheduledList, drawerSearch]);

  // Master subjects quota (De-duplicated)
  const masterSubjectItems = useMemo(() => {
    const map = new Map<string, NonNullable<typeof data>["subjects"][0]>();
    (data?.subjects || []).forEach((s) => {
      if (s.masterWeeklyPeriods > 0 && !map.has(s.subjectCode)) {
        map.set(s.subjectCode, s);
      }
    });
    return Array.from(map.values());
  }, [data?.subjects]);

  // Drawer Search Filtered Results
  const filteredDrawerSubstitutions = useMemo(() => {
    if (!drawerSearch.trim()) return substitutedItems;
    const q = drawerSearch.toLowerCase();
    return substitutedItems.filter(
      (s) =>
        s.masterFacultyName.toLowerCase().includes(q) ||
        s.newFacultyName.toLowerCase().includes(q) ||
        s.masterSubjectName.toLowerCase().includes(q) ||
        s.newSubjectName.toLowerCase().includes(q) ||
        s.slotLabel.toLowerCase().includes(q) ||
        s.date.includes(q) ||
        (s.sectionName || "").toLowerCase().includes(q) ||
        (s.remarks || "").toLowerCase().includes(q),
    );
  }, [substitutedItems, drawerSearch]);

  const filteredDrawerChanges = useMemo(() => {
    if (!drawerSearch.trim()) return changedItems;
    const q = drawerSearch.toLowerCase();
    return changedItems.filter(
      (c) =>
        c.masterSubjectName.toLowerCase().includes(q) ||
        c.newSubjectName.toLowerCase().includes(q) ||
        c.masterFacultyName.toLowerCase().includes(q) ||
        c.newFacultyName.toLowerCase().includes(q) ||
        c.slotLabel.toLowerCase().includes(q) ||
        c.date.includes(q) ||
        (c.sectionName || "").toLowerCase().includes(q) ||
        (c.remarks || "").toLowerCase().includes(q),
    );
  }, [changedItems, drawerSearch]);

  const filteredDrawerSwaps = useMemo(() => {
    if (!drawerSearch.trim()) return swappedItems;
    const q = drawerSearch.toLowerCase();
    return swappedItems.filter(
      (s) =>
        s.masterSubjectName.toLowerCase().includes(q) ||
        s.newSubjectName.toLowerCase().includes(q) ||
        s.newFacultyName.toLowerCase().includes(q) ||
        s.slotLabel.toLowerCase().includes(q) ||
        s.date.includes(q) ||
        (s.sectionName || "").toLowerCase().includes(q) ||
        (s.remarks || "").toLowerCase().includes(q),
    );
  }, [swappedItems, drawerSearch]);

  const filteredDrawerConducted = useMemo(() => {
    const list = conductedItems;
    if (!drawerSearch.trim()) return list;
    const q = drawerSearch.toLowerCase();
    return list.filter(
      (c) =>
        (c.todaySubjectName || "").toLowerCase().includes(q) ||
        (c.todayFacultyName || "").toLowerCase().includes(q) ||
        c.slotLabel.toLowerCase().includes(q) ||
        c.date.includes(q) ||
        (c.sectionName || "").toLowerCase().includes(q),
    );
  }, [conductedItems, drawerSearch]);

  const filteredDrawerMaster = useMemo(() => {
    const list = masterSubjectItems;
    if (!drawerSearch.trim()) return list;
    const q = drawerSearch.toLowerCase();
    return list.filter(
      (s) =>
        s.subjectName.toLowerCase().includes(q) ||
        s.subjectCode.toLowerCase().includes(q) ||
        s.facultyNames.some((f) => f.toLowerCase().includes(q)),
    );
  }, [masterSubjectItems, drawerSearch]);

  // Export to Excel / CSV
  const handleExportCsv = () => {
    if (activeSection === "subjects") {
      const subjectsList = filteredSubjects.length ? filteredSubjects : (data?.subjects ?? []);
      if (!subjectsList.length) {
        alert("No subject data available to export.");
        return;
      }
      const headers = [
        "Subject Code",
        "Subject Name",
        "Master Quota",
        "Conducted",
        "Swapped Out",
        "Swapped In",
        "Total Changes",
        "Attendance %",
        "Assigned Faculty",
      ];
      const rows = subjectsList.map((s) => [
        `"${s.subjectCode}"`,
        `"${(s.subjectName || "").replace(/"/g, '""')}"`,
        s.masterWeeklyPeriods,
        s.totalConducted,
        s.timesSwappedOut,
        s.timesSwappedIn,
        s.timesChanged,
        s.attendancePct != null ? `${s.attendancePct}%` : "-",
        `"${(s.facultyNames || []).join(", ").replace(/"/g, '""')}"`,
      ]);
      const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\r\n");
      const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `subject_analytics_${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      return;
    }

    if (activeSection === "staff") {
      const facultiesList = filteredFaculties.length ? filteredFaculties : (data?.faculties ?? []);
      if (!facultiesList.length) {
        alert("No faculty data available to export.");
        return;
      }
      const headers = [
        "Faculty Name",
        "HRMS ID",
        "Assigned Subjects",
        "Master Quota",
        "Conducted",
        "Relieved Out",
        "Substitute In",
        "Net Load",
      ];
      const rows = facultiesList.map((f) => [
        `"${(f.facultyName || "").replace(/"/g, '""')}"`,
        `"#${f.hrmsId}"`,
        `"${(f.subjects || []).join(", ").replace(/"/g, '""')}"`,
        f.masterAssignedPeriods,
        f.classesConducted,
        f.relievedCount,
        f.substituteTakenCount,
        f.netTeachingCount,
      ]);
      const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\r\n");
      const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `staff_analytics_${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      return;
    }

    if (activeSection === "audit") {
      const changesList = filteredRecentChanges.length ? filteredRecentChanges : (data?.recentChanges ?? []);
      if (!changesList.length) {
        alert("No change audit data available to export.");
        return;
      }
      const headers = [
        "Date",
        "Slot",
        "Batch",
        "Section",
        "Master Subject",
        "Master Faculty",
        "Actual Subject",
        "Actual Faculty",
        "Type",
        "Reason",
      ];
      const rows = changesList.map((c) => [
        c.timetableDate,
        `"${c.slotLabel} (${c.slotTime})"`,
        c.batch,
        c.sectionName || "N/A",
        `"${(c.masterSubjectName || c.masterSubjectCode || "").replace(/"/g, '""')}"`,
        `"${(c.masterFacultyName || "").replace(/"/g, '""')}"`,
        `"${(c.newSubjectName || c.newSubjectCode || "").replace(/"/g, '""')}"`,
        `"${(c.newFacultyName || "").replace(/"/g, '""')}"`,
        c.varianceType,
        `"${(c.remarks || "").replace(/"/g, '""')}"`,
      ]);
      const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\r\n");
      const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `change_audit_log_${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      return;
    }

    // Default: activeSection === "variation"
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

  // Export to PDF / Print (Prints exclusively the comparison tables matching the screenshot)
  const handlePrintPdf = () => {
    if (printAreaRef.current) {
      printElement(printAreaRef.current, {
        title: "",
      });
    }
  };

  return (
    <div className="space-y-4">
      {/* 1. All-in-one Comprehensive Filter Toolbar */}
      <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-xs space-y-3">
        {/* Academic Filters Grid: Academic Year, College, Program, Branch, Class, Section, Year, Semester */}
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 lg:grid-cols-8">
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
                setSelectedClassKey(null);
                setSelectedBatch(null);
                setSelectedYear(null);
                setSelectedSemester(null);
                setSelectedSection(null);
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
                setSelectedClassKey(null);
                setSelectedBatch(null);
                setSelectedYear(null);
                setSelectedSemester(null);
                setSelectedSection(null);
              }}
              className="mt-1 block h-8.5 w-full rounded-md border border-slate-300 bg-white px-2 text-xs text-slate-800 shadow-xs focus:border-navy-600 focus:outline-none truncate"
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
                setSelectedClassKey(null);
                setSelectedBatch(null);
                setSelectedYear(null);
                setSelectedSemester(null);
                setSelectedSection(null);
              }}
              className="mt-1 block h-8.5 w-full rounded-md border border-slate-300 bg-white px-2 text-xs text-slate-800 shadow-xs focus:border-navy-600 focus:outline-none truncate"
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
                setSelectedClassKey(null);
                setSelectedBatch(null);
                setSelectedYear(null);
                setSelectedSemester(null);
                setSelectedSection(null);
              }}
              className="mt-1 block h-8.5 w-full rounded-md border border-slate-300 bg-white px-2 text-xs text-slate-800 shadow-xs focus:border-navy-600 focus:outline-none truncate"
            >
              <option value="">All Branches</option>
              {filterBranches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </label>

          {/* Class (Dynamic cascading: shows available classes / cohorts) */}
          <label className="text-[11px] font-medium text-slate-600">
            Class
            <select
              value={selectedClassKey ?? ""}
              onChange={(e) => handleClassChange(e.target.value || null)}
              className="mt-1 block h-8.5 w-full rounded-md border border-slate-300 bg-white px-2 text-xs text-slate-800 shadow-xs focus:border-navy-600 focus:outline-none truncate"
            >
              <option value="">
                {availableClasses.length === 0 ? "All Classes" : `All Classes (${availableClasses.length})`}
              </option>
              {availableClasses.map((cls) => (
                <option key={cls.key} value={cls.key}>
                  {cls.label} {cls.sections.length > 0 ? `(${cls.sections.length} sec)` : ""}
                </option>
              ))}
            </select>
          </label>

          {/* Section (Dynamic: if selected class has 2 sections -> shows 2, if 4 -> shows 4) */}
          <label className="text-[11px] font-medium text-slate-600">
            Section
            <select
              value={selectedSection ?? ""}
              onChange={(e) => setSelectedSection(e.target.value || null)}
              disabled={availableSections.length === 0}
              className="mt-1 block h-8.5 w-full rounded-md border border-slate-300 bg-white px-2 text-xs text-slate-800 shadow-xs focus:border-navy-600 focus:outline-none disabled:bg-slate-100 disabled:text-slate-400"
            >
              <option value="">
                {availableSections.length === 0
                  ? "No Sections"
                  : `All Sections (${availableSections.length})`}
              </option>
              {availableSections.map((sec) => (
                <option key={sec} value={sec}>
                  Section {sec}
                </option>
              ))}
            </select>
          </label>

          {/* Year */}
          <label className="text-[11px] font-medium text-slate-600">
            Year
            <select
              value={selectedYear ?? ""}
              onChange={(e) => handleYearChange(e.target.value ? Number(e.target.value) : null)}
              className="mt-1 block h-8.5 w-full rounded-md border border-slate-300 bg-white px-2 text-xs text-slate-800 shadow-xs focus:border-navy-600 focus:outline-none"
            >
              <option value="">All Years</option>
              {yearOptions.map((y) => (
                <option key={y} value={y}>
                  Year {y}
                </option>
              ))}
            </select>
          </label>

          {/* Semester */}
          <label className="text-[11px] font-medium text-slate-600">
            Semester
            <select
              value={selectedSemester ?? ""}
              onChange={(e) => handleSemesterChange(e.target.value ? Number(e.target.value) : null)}
              className="mt-1 block h-8.5 w-full rounded-md border border-slate-300 bg-white px-2 text-xs text-slate-800 shadow-xs focus:border-navy-600 focus:outline-none"
            >
              <option value="">All Semesters</option>
              <option value="1">Sem 1</option>
              <option value="2">Sem 2</option>
            </select>
          </label>
        </div>

        {/* Row 2: Search on Left Side, Date Filter (Today / Range toggle + pickers) */}
        <div className="pt-2.5 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            {/* Search Input on the LEFT SIDE */}
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search staff, subject, period..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-8.5 w-56 sm:w-64 rounded-md border border-slate-300 bg-white pl-8 pr-7 text-xs text-slate-800 placeholder-slate-400 focus:border-navy-700 focus:outline-none shadow-2xs"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {/* Date Mode Toggle: Today vs Date Range */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex rounded-lg border border-slate-200 bg-slate-100/90 p-0.5 text-xs font-medium">
                <button
                  type="button"
                  onClick={() => {
                    setDateMode("today");
                    const t = getTodayDateString();
                    setStartDate(t);
                    setEndDate(t);
                  }}
                  className={cn(
                    "px-3 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer",
                    dateMode === "today"
                      ? "bg-white text-navy-900 shadow-xs font-bold"
                      : "text-slate-600 hover:text-navy-900",
                  )}
                >
                  Today
                </button>
                <button
                  type="button"
                  onClick={() => setDateMode("range")}
                  className={cn(
                    "px-3 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer",
                    dateMode === "range"
                      ? "bg-white text-navy-900 shadow-xs font-bold"
                      : "text-slate-600 hover:text-navy-900",
                  )}
                >
                  Date Range
                </button>
              </div>

              {dateMode === "today" ? (
                <span className="inline-flex items-center gap-1.5 rounded-md bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700 border border-blue-200/80">
                  <CalendarCheck className="h-3.5 w-3.5 text-blue-600" />
                  Today ({formatDisplayDate(getTodayDateString())})
                </span>
              ) : (
                <div className="flex flex-wrap items-center gap-1.5 text-xs">
                  <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">From:</span>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="h-8 rounded-md border border-slate-300 px-2 text-xs text-slate-800 bg-white shadow-2xs"
                  />
                  <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">To:</span>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="h-8 rounded-md border border-slate-300 px-2 text-xs text-slate-800 bg-white shadow-2xs"
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
                      Clear
                    </button>
                  )}
                </div>
              )}
            </div>
            {/* Filter chips if staff or subject selected */}
            {selectedStaffObj && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-800 border border-amber-200">
                Staff: {selectedStaffObj.facultyName}
                <button
                  type="button"
                  onClick={() => setSelectedStaffHrmsId(null)}
                  className="hover:text-amber-950 cursor-pointer ml-0.5"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            )}
            {selectedSubjectObj && (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-800 border border-emerald-200">
                Subject: {selectedSubjectObj.subjectCode}
                <button
                  type="button"
                  onClick={() => setSelectedSubjectCode(null)}
                  className="hover:text-emerald-950 cursor-pointer ml-0.5"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            )}
          </div>

          {/* Action Buttons: Excel, PDF, Reset on the RIGHT SIDE */}
          <div className="flex items-center gap-2 ml-auto">
            {loading && (
              <span className="text-[11px] text-slate-400 font-medium mr-1 animate-pulse">
                Refreshing...
              </span>
            )}
            <button
              type="button"
              onClick={handleExportCsv}
              className="inline-flex h-8 items-center gap-1.5 rounded-md border border-emerald-300 bg-emerald-50/60 px-3 text-xs font-semibold text-emerald-800 shadow-2xs hover:bg-emerald-100 transition-colors cursor-pointer"
            >
              <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" />
              Excel
            </button>
            <button
              type="button"
              onClick={handlePrintPdf}
              className="inline-flex h-8 items-center gap-1.5 rounded-md border border-rose-300 bg-rose-50/60 px-3 text-xs font-semibold text-rose-700 shadow-2xs hover:bg-rose-100 transition-colors cursor-pointer"
            >
              <FileText className="h-3.5 w-3.5 text-rose-600" />
              PDF
            </button>
            <button
              type="button"
              onClick={handleResetFilters}
              disabled={!hasActiveFilters}
              className={cn(
                "inline-flex h-8 items-center gap-1 rounded-md border px-2.5 text-xs font-medium shadow-2xs transition-colors",
                hasActiveFilters
                  ? "border-slate-300 bg-white text-slate-700 hover:bg-slate-50 hover:text-navy-900 cursor-pointer"
                  : "border-slate-200 bg-slate-50 text-slate-400 cursor-not-allowed",
              )}
            >
              <RotateCcw className="h-3.5 w-3.5 text-slate-500" />
              Reset
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="space-y-4">
        {/* 3. Executive KPI Metric Cards (Interactive) */}
        <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-3 lg:grid-cols-6">
          {/* Card 1: Master Lectures Assigned */}
          <button
            type="button"
            onClick={() => {
              setActiveKpiDrawer("master");
              setDrawerSearch("");
            }}
            className={cn(
              "rounded-xl border p-3.5 shadow-2xs text-left transition-all duration-200 cursor-pointer group hover:-translate-y-0.5 hover:shadow-md",
              activeKpiDrawer === "master"
                ? "border-blue-400 bg-blue-100/70 ring-2 ring-blue-400"
                : "border-blue-100 bg-blue-50/40 hover:bg-blue-50/80 hover:border-blue-200",
            )}
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600">
                Master Assigned
              </span>
              <BookOpen className="h-3.5 w-3.5 text-blue-400 group-hover:text-blue-600 transition-colors" />
            </div>
            <div className="mt-1">
              <span className="text-2xl font-extrabold text-blue-900">
                {selectedSection
                  ? masterScheduledList.length
                  : (dateMode === "today" || (startDate && endDate)
                    ? (data?.summary?.totalMasterPeriodsScheduled ?? masterScheduledList.length)
                    : summary.totalMasterPeriods)}
              </span>
            </div>
            <p className="mt-0.5 text-[10px] text-blue-700/80">
              {dateMode === "today"
                ? "Today's master classes"
                : startDate && endDate
                  ? "Scheduled classes in range"
                  : "Weekly lecture quota"}
            </p>
            <p className="text-[9px] text-blue-600/70 font-semibold">Excl. lunch & normal break · Incl. CRT, Library</p>
            <span className="mt-1 flex items-center gap-1 text-[10px] font-bold text-blue-600 opacity-80 group-hover:opacity-100 group-hover:underline">
              View master schedule <ChevronRight className="h-2.5 w-2.5" />
            </span>
          </button>

          {/* Card 2: Conducted Classes */}
          <button
            type="button"
            onClick={() => {
              setActiveKpiDrawer("conducted");
              setDrawerSearch("");
            }}
            className={cn(
              "rounded-xl border p-3.5 shadow-2xs text-left transition-all duration-200 cursor-pointer group hover:-translate-y-0.5 hover:shadow-md",
              activeKpiDrawer === "conducted"
                ? "border-emerald-400 bg-emerald-100/70 ring-2 ring-emerald-400"
                : "border-emerald-100 bg-emerald-50/40 hover:bg-emerald-50/80 hover:border-emerald-200",
            )}
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600">
                Classes Conducted
              </span>
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 group-hover:text-emerald-600 transition-colors" />
            </div>
            <div className="mt-1">
              <span className="text-2xl font-extrabold text-emerald-800">
                {summary.totalConductedSessions}
              </span>
            </div>
            <p className="mt-0.5 text-[10px] text-emerald-700/80">Attended / held</p>
            <span className="mt-1.5 flex items-center gap-1 text-[10px] font-bold text-emerald-700 opacity-80 group-hover:opacity-100 group-hover:underline">
              View held classes <ChevronRight className="h-2.5 w-2.5" />
            </span>
          </button>

          {/* Card 3: Classes Changed */}
          <button
            type="button"
            onClick={() => {
              setActiveKpiDrawer("changed");
              setDrawerSearch("");
            }}
            className={cn(
              "rounded-xl border p-3.5 shadow-2xs text-left transition-all duration-200 cursor-pointer group hover:-translate-y-0.5 hover:shadow-md",
              activeKpiDrawer === "changed"
                ? "border-amber-400 bg-amber-100/70 ring-2 ring-amber-400"
                : "border-amber-100 bg-amber-50/40 hover:bg-amber-50/80 hover:border-amber-200",
            )}
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700">
                Classes Changed
              </span>
              <AlertTriangle className="h-3.5 w-3.5 text-amber-500 group-hover:text-amber-700 transition-colors" />
            </div>
            <div className="mt-1">
              <span className="text-2xl font-extrabold text-amber-800">
                {summary.totalChangesRecorded}
              </span>
            </div>
            <p className="mt-0.5 text-[10px] text-amber-700/80">Altered from plan</p>
            <span className="mt-1.5 flex items-center gap-1 text-[10px] font-bold text-amber-800 opacity-90 group-hover:opacity-100 group-hover:underline">
              View changed subjects <ChevronRight className="h-2.5 w-2.5" />
            </span>
          </button>

          {/* Card 4: Faculty Substitutions */}
          <button
            type="button"
            onClick={() => {
              setActiveKpiDrawer("substituted");
              setDrawerSearch("");
            }}
            className={cn(
              "rounded-xl border p-3.5 shadow-2xs text-left transition-all duration-200 cursor-pointer group hover:-translate-y-0.5 hover:shadow-md",
              activeKpiDrawer === "substituted"
                ? "border-sky-400 bg-sky-100/70 ring-2 ring-sky-400"
                : "border-sky-100 bg-sky-50/40 hover:bg-sky-50/80 hover:border-sky-200",
            )}
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-sky-700">
                Faculty Substituted
              </span>
              <UserCheck className="h-3.5 w-3.5 text-sky-500 group-hover:text-sky-700 transition-colors" />
            </div>
            <div className="mt-1">
              <span className="text-2xl font-extrabold text-sky-800">
                {summary.facultySubstitutionsCount}
              </span>
            </div>
            <p className="mt-0.5 text-[10px] text-sky-700/80">Relievers stepped in</p>
            <span className="mt-1.5 flex items-center gap-1 text-[10px] font-bold text-sky-800 opacity-90 group-hover:opacity-100 group-hover:underline">
              Who changed & stepped in <ChevronRight className="h-2.5 w-2.5" />
            </span>
          </button>

          {/* Card 5: Subject Swaps */}
          <button
            type="button"
            onClick={() => {
              setActiveKpiDrawer("swapped");
              setDrawerSearch("");
            }}
            className={cn(
              "rounded-xl border p-3.5 shadow-2xs text-left transition-all duration-200 cursor-pointer group hover:-translate-y-0.5 hover:shadow-md",
              activeKpiDrawer === "swapped"
                ? "border-purple-400 bg-purple-100/70 ring-2 ring-purple-400"
                : "border-purple-100 bg-purple-50/40 hover:bg-purple-50/80 hover:border-purple-200",
            )}
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-purple-700">
                Subject Swapped
              </span>
              <ArrowLeftRight className="h-3.5 w-3.5 text-purple-500 group-hover:text-purple-700 transition-colors" />
            </div>
            <div className="mt-1">
              <span className="text-2xl font-extrabold text-purple-800">
                {summary.subjectSwapsCount}
              </span>
            </div>
            <p className="mt-0.5 text-[10px] text-purple-700/80">Subject exchange</p>
            <span className="mt-1.5 flex items-center gap-1 text-[10px] font-bold text-purple-800 opacity-90 group-hover:opacity-100 group-hover:underline">
              View swapped subjects <ChevronRight className="h-2.5 w-2.5" />
            </span>
          </button>

          {/* Card 6: Change Rate % */}
          <button
            type="button"
            onClick={() => {
              setActiveKpiDrawer("rate");
              setDrawerSearch("");
            }}
            className={cn(
              "rounded-xl border p-3.5 shadow-2xs text-left transition-all duration-200 cursor-pointer group hover:-translate-y-0.5 hover:shadow-md",
              activeKpiDrawer === "rate"
                ? "border-rose-400 bg-rose-100/70 ring-2 ring-rose-400"
                : "border-rose-100 bg-rose-50/40 hover:bg-rose-50/80 hover:border-rose-200",
            )}
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-rose-600">
                Change Rate %
              </span>
              <Percent className="h-3.5 w-3.5 text-rose-400 group-hover:text-rose-600 transition-colors" />
            </div>
            <div className="mt-1">
              <span className="text-2xl font-extrabold text-rose-700">
                {summary.overallChangeRatePct}%
              </span>
            </div>
            <p className="mt-0.5 text-[10px] text-rose-700/80">Timetable variance</p>
            <span className="mt-1.5 flex items-center gap-1 text-[10px] font-bold text-rose-700 opacity-80 group-hover:opacity-100 group-hover:underline">
              View variance breakdown <ChevronRight className="h-2.5 w-2.5" />
            </span>
          </button>
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

        {/* 6. Section Comparison Header & Color Legend */}
        {activeSection === "variation" && (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-2.5">
              <div className="flex flex-wrap items-center gap-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-navy-900">
              Master vs Today Timetable Comparison
            </h4>
            <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-semibold text-slate-700">
              {comparisonsBySection.length} Section{comparisonsBySection.length !== 1 ? "s" : ""}
            </span>
            <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-[11px] font-bold text-blue-700 border border-blue-200">
              {filteredComparisons.length} Total Sessions
            </span>
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

        {/* 7. Printable Section Comparison Tables Container (Exclusively matching Image 1 for PDF export) */}
        <div ref={printAreaRef} className="space-y-4">

            {filteredComparisons.length === 0 ? (
              <div className="overflow-hidden rounded-xl border border-slate-200 bg-white p-12 text-center text-xs text-slate-500 shadow-xs">
                No timetable sessions match the selected filters.
              </div>
            ) : (
              comparisonsBySection.map((secGroup) => (
                <div
                  key={secGroup.sectionKey}
                  className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs"
                >
                  {/* Distinct Section Header Banner */}
                  <div className="border-b border-slate-200 bg-linear-to-r from-slate-50 via-sky-50/20 to-slate-50 px-4 py-3 flex flex-wrap items-center justify-between gap-2.5">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-navy-900 text-white font-extrabold text-xs shadow-2xs">
                        {secGroup.sectionKey === "Unassigned" ? "ALL" : secGroup.sectionKey}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-bold text-navy-950">
                            {secGroup.sectionTitle}
                          </h4>
                          <span className="rounded bg-indigo-50 border border-indigo-200 px-2 py-0.5 text-[10px] font-bold text-indigo-700">
                            {getBranchBadge(secGroup.items[0]?.branchId, secGroup.items[0]?.branchCode)}
                          </span>
                          <span className="rounded bg-slate-200/80 px-2 py-0.5 text-[10px] font-semibold text-slate-700">
                            Batch {secGroup.items[0]?.batch || selectedBatch || "2023"}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500">
                          {secGroup.totalClasses} scheduled periods · Period sequence in order
                        </p>
                      </div>
                    </div>

                    {/* Section Quick Summary Stats */}
                    <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[10px] font-bold text-emerald-700 border border-emerald-200">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
                        {secGroup.conductedCount} / {secGroup.totalClasses} Conducted
                      </span>
                      {secGroup.substitutedCount > 0 && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-800 border border-amber-200">
                          <span className="h-1.5 w-1.5 rounded-full bg-amber-500"></span>
                          {secGroup.substitutedCount} Substituted
                        </span>
                      )}
                      {secGroup.swappedCount > 0 && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-2 py-0.5 text-[10px] font-bold text-sky-800 border border-sky-200">
                          <span className="h-1.5 w-1.5 rounded-full bg-sky-500"></span>
                          {secGroup.swappedCount} Swapped
                        </span>
                      )}
                      {secGroup.substitutedCount === 0 && secGroup.swappedCount === 0 && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-800 border border-emerald-200">
                          100% As Master
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Table of periods for this Section */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-slate-200 bg-slate-100/70 text-[10px] font-bold uppercase tracking-wider text-slate-600">
                          <th className="py-2.5 px-3">Slot & Time</th>
                          <th className="py-2.5 px-2">Date & Day</th>
                          <th className="py-2.5 px-2">Branch / Section</th>
                          <th className="py-2.5 px-3">Master Timetable (Assigned)</th>
                          <th className="py-2.5 px-3">Today Timetable (Conducted)</th>
                          <th className="py-2.5 px-2 text-center">Variation Status</th>
                          <th className="py-2.5 px-3">Variance Note</th>
                          <th className="py-2.5 px-3 text-center">Attendance %</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {secGroup.items.map((c) => {
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

                              {/* Branch & Section */}
                              <td className="py-3 px-2">
                                <div className="flex flex-wrap items-center gap-1">
                                  <span className="rounded bg-indigo-50 border border-indigo-200 px-1.5 py-0.5 text-[10px] font-bold text-indigo-700">
                                    {getBranchBadge(c.branchId, c.branchCode)}
                                  </span>
                                  <span className="rounded bg-sky-50 px-1.5 py-0.5 text-[10px] font-bold text-sky-700 border border-sky-200">
                                    Sec {cleanSectionCode(c.sectionName) || "A"}
                                  </span>
                                </div>
                                <p className="text-[10px] text-slate-500 mt-0.5">Batch {c.batch}</p>
                              </td>

                              {/* Master Schedule (Assigned) */}
                              <td className="py-3 px-3">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <p className="font-bold text-navy-900">
                                    {c.masterSubjectName || c.masterSubjectCode || <span className="text-slate-400">Not Assigned</span>}
                                  </p>
                                  {(c.masterSubjectName?.toUpperCase() === "CRT" || c.masterSubjectCode?.toUpperCase() === "CRT") && (
                                    <span className="rounded bg-purple-100 text-purple-800 text-[9px] font-extrabold px-1.5 py-0.5 border border-purple-200">
                                      CRT
                                    </span>
                                  )}
                                  {(c.masterSubjectName?.toUpperCase() === "LIBRARY" || c.masterSubjectCode?.toUpperCase() === "LIBRARY") && (
                                    <span className="rounded bg-teal-100 text-teal-800 text-[9px] font-extrabold px-1.5 py-0.5 border border-teal-200">
                                      Library
                                    </span>
                                  )}
                                </div>
                                <p className="text-[10px] text-slate-500 mt-0.5">
                                  Faculty: <span className="font-medium text-slate-700">{c.masterFacultyName || "None"}</span>
                                </p>
                              </td>

                              {/* Today's Schedule (Actual) */}
                              <td className="py-3 px-3">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <p
                                    className={cn(
                                      "font-bold",
                                      isSwap ? "text-amber-800 underline decoration-amber-400" : "text-navy-900",
                                    )}
                                  >
                                    {c.todaySubjectName || c.todaySubjectCode || c.masterSubjectName}
                                  </p>
                                  {(c.todaySubjectName?.toUpperCase() === "CRT" || c.todaySubjectCode?.toUpperCase() === "CRT") && (
                                    <span className="rounded bg-purple-100 text-purple-800 text-[9px] font-extrabold px-1.5 py-0.5 border border-purple-200">
                                      CRT
                                    </span>
                                  )}
                                  {(c.todaySubjectName?.toUpperCase() === "LIBRARY" || c.todaySubjectCode?.toUpperCase() === "LIBRARY") && (
                                    <span className="rounded bg-teal-100 text-teal-800 text-[9px] font-extrabold px-1.5 py-0.5 border border-teal-200">
                                      Library
                                    </span>
                                  )}
                                </div>
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
                </div>
              ))
            )}
          </div>
        </>
      )}

      {/* 7. SUBJECT ANALYTICS REPORT */}
      {activeSection === "subjects" && (
        <div ref={printAreaRef} className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
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
              {filteredSubjects.length} Subject{filteredSubjects.length !== 1 ? "s" : ""}
            </span>
          </div>

          <div className="overflow-x-auto">
            {filteredSubjects.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500">
                No subject records match the selected filters.
              </div>
            ) : (
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
                  {filteredSubjects.map((sub) => (
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
                      <td className="py-3 px-2 text-center font-semibold text-slate-800">
                        {sub.masterWeeklyPeriods}
                      </td>
                      <td className="py-3 px-2 text-center font-bold text-emerald-700">
                        {sub.totalConducted}
                      </td>
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
                            if (onNavigateSection) {
                              onNavigateSection("variation");
                            }
                          }}
                          className="rounded px-2.5 py-1 text-[11px] font-semibold border border-emerald-500 text-emerald-800 bg-emerald-50 hover:bg-emerald-100 cursor-pointer"
                        >
                          Select
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* 8. STAFF ANALYTICS REPORT */}
      {activeSection === "staff" && (
        <div ref={printAreaRef} className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
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
              {filteredFaculties.length} Faculty
            </span>
          </div>

          <div className="overflow-x-auto">
            {filteredFaculties.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500">
                No faculty records match the selected filters.
              </div>
            ) : (
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-[10px] font-bold uppercase text-slate-600">
                    <th className="py-2.5 px-3">Faculty Name</th>
                    <th className="py-2.5 px-2">HRMS ID</th>
                    <th className="py-2.5 px-3">Assigned Subjects</th>
                    <th className="py-2.5 px-2 text-center">Master Quota</th>
                    <th className="py-2.5 px-2 text-center">Conducted</th>
                    <th className="py-2.5 px-2 text-center">Relieved (Out)</th>
                    <th className="py-2.5 px-2 text-center">Substitute (In)</th>
                    <th className="py-2.5 px-2 text-center">Net Load</th>
                    <th className="py-2.5 px-2 text-right">Drill Down</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredFaculties.map((f) => (
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
                      <td className="py-3 px-3 text-slate-600">
                        <div className="flex flex-wrap gap-1 max-w-xs">
                          {f.subjects.map((sub, i) => (
                            <span key={i} className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px]">
                              {sub}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="py-3 px-2 text-center font-semibold text-slate-800">
                        {f.masterAssignedPeriods}
                      </td>
                      <td className="py-3 px-2 text-center font-bold text-emerald-700">
                        {f.classesConducted}
                      </td>
                      <td className="py-3 px-2 text-center font-bold text-rose-600">
                        {f.relievedCount > 0 ? `-${f.relievedCount}` : "0"}
                      </td>
                      <td className="py-3 px-2 text-center font-bold text-sky-600">
                        {f.substituteTakenCount > 0 ? `+${f.substituteTakenCount}` : "0"}
                      </td>
                      <td className="py-3 px-2 text-center font-extrabold text-navy-950">
                        {f.netTeachingCount}
                      </td>
                      <td className="py-3 px-2 text-right">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedStaffHrmsId(f.hrmsId);
                            if (onNavigateSection) {
                              onNavigateSection("variation");
                            }
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
            )}
          </div>
        </div>
      )}

      {/* 9. CHANGE AUDIT LOG */}
      {activeSection === "audit" && (
        <div ref={printAreaRef} className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
          <div className="border-b border-slate-100 pb-3 mb-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-navy-900">
              Official Timetable Alteration History
            </h4>
            <p className="text-[11px] text-slate-500">
              Audit trail of every approved faculty substitution, period swap, and alteration
            </p>
          </div>

          <div className="overflow-x-auto">
            {filteredRecentChanges.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500">
                No timetable alterations recorded matching the filters.
              </div>
            ) : (
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
                  {filteredRecentChanges.map((change) => (
                    <tr key={change.id} className="hover:bg-slate-50">
                      <td className="py-3 px-3">
                        <p className="font-bold text-navy-900">{change.timetableDate}</p>
                        <p className="text-[10px] text-slate-500 font-mono">
                          {change.slotLabel} ({change.slotTime})
                        </p>
                      </td>
                      <td className="py-3 px-2">
                        <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-semibold text-slate-800">
                          Batch {change.batch} {change.sectionName ? `· Sec ${change.sectionName}` : ""}
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        <p className="font-semibold text-slate-800">
                          {change.masterSubjectName || change.masterSubjectCode || "None"}
                        </p>
                        <p className="text-[10px] text-slate-500">
                          Faculty: {change.masterFacultyName || "None"}
                        </p>
                      </td>
                      <td className="py-3 px-3">
                        <p className="font-bold text-amber-900">
                          {change.newSubjectName || change.newSubjectCode || change.masterSubjectName}
                        </p>
                        <p className="text-[10px] text-sky-800 font-bold">
                          Faculty: {change.newFacultyName || change.masterFacultyName}
                        </p>
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
            )}
          </div>
        </div>
      )}
    </div>

      {/* 11. Interactive KPI Drilldown Slide-Over Pop Card Drawer */}
      {activeKpiDrawer && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity duration-300 animate-in fade-in"
            onClick={() => setActiveKpiDrawer(null)}
          />

          {/* Side Drawer Card */}
          <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
            <div className="w-screen max-w-xl bg-white shadow-2xl border-l border-slate-200 flex flex-col transform transition-transform duration-300 ease-in-out animate-in slide-in-from-right">
              {/* Drawer Header */}
              <div
                className={cn(
                  "p-4 border-b flex items-start justify-between gap-3",
                  activeKpiDrawer === "substituted"
                    ? "bg-sky-50/80 border-sky-100"
                    : activeKpiDrawer === "changed"
                      ? "bg-amber-50/80 border-amber-100"
                      : activeKpiDrawer === "swapped"
                        ? "bg-purple-50/80 border-purple-100"
                        : activeKpiDrawer === "conducted"
                          ? "bg-emerald-50/80 border-emerald-100"
                          : activeKpiDrawer === "master"
                            ? "bg-blue-50/80 border-blue-100"
                            : "bg-rose-50/80 border-rose-100",
                )}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={cn(
                      "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl font-bold shadow-xs",
                      activeKpiDrawer === "substituted"
                        ? "bg-sky-600 text-white"
                        : activeKpiDrawer === "changed"
                          ? "bg-amber-600 text-white"
                          : activeKpiDrawer === "swapped"
                            ? "bg-purple-600 text-white"
                            : activeKpiDrawer === "conducted"
                              ? "bg-emerald-600 text-white"
                              : activeKpiDrawer === "master"
                                ? "bg-blue-600 text-white"
                                : "bg-rose-600 text-white",
                    )}
                  >
                    {activeKpiDrawer === "substituted" && <UserCheck className="h-5 w-5" />}
                    {activeKpiDrawer === "changed" && <AlertTriangle className="h-5 w-5" />}
                    {activeKpiDrawer === "swapped" && <ArrowLeftRight className="h-5 w-5" />}
                    {activeKpiDrawer === "conducted" && <CheckCircle2 className="h-5 w-5" />}
                    {activeKpiDrawer === "master" && <BookOpen className="h-5 w-5" />}
                    {activeKpiDrawer === "rate" && <Percent className="h-5 w-5" />}
                  </div>

                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-bold text-navy-950">
                        {activeKpiDrawer === "substituted" && "Faculty Substitutions"}
                        {activeKpiDrawer === "changed" && "Classes Changed / Altered"}
                        {activeKpiDrawer === "swapped" && "Subject Swapped"}
                        {activeKpiDrawer === "conducted" && "Conducted Classes"}
                        {activeKpiDrawer === "master" &&
                          (dateMode === "today" ? "Today's Master Schedule" : "Master Timetable Schedule")}
                        {activeKpiDrawer === "rate" && "Timetable Variance Rate"}
                      </h3>
                      <span
                        className={cn(
                          "rounded-full px-2.5 py-0.5 text-[11px] font-bold border",
                          activeKpiDrawer === "substituted"
                            ? "bg-sky-100 text-sky-800 border-sky-200"
                            : activeKpiDrawer === "changed"
                              ? "bg-amber-100 text-amber-900 border-amber-200"
                              : activeKpiDrawer === "swapped"
                                ? "bg-purple-100 text-purple-900 border-purple-200"
                                : activeKpiDrawer === "conducted"
                                  ? "bg-emerald-100 text-emerald-900 border-emerald-200"
                                  : activeKpiDrawer === "master"
                                    ? "bg-blue-100 text-blue-900 border-blue-200"
                                    : "bg-rose-100 text-rose-900 border-rose-200",
                        )}
                      >
                        {activeKpiDrawer === "substituted" && `${filteredDrawerSubstitutions.length} record(s)`}
                        {activeKpiDrawer === "changed" && `${filteredDrawerChanges.length} record(s)`}
                        {activeKpiDrawer === "swapped" && `${filteredDrawerSwaps.length} record(s)`}
                        {activeKpiDrawer === "conducted" && `${filteredDrawerConducted.length} session(s)`}
                        {activeKpiDrawer === "master" && `${filteredDrawerMasterScheduled.length} scheduled period(s)`}
                        {activeKpiDrawer === "rate" && `${summary.overallChangeRatePct}% deviation`}
                      </span>
                    </div>

                    <p className="mt-0.5 text-xs text-slate-600">
                      {activeKpiDrawer === "substituted" &&
                        "Who was scheduled (relieved) vs who stepped in and took over the lecture"}
                      {activeKpiDrawer === "changed" &&
                        "Full comparison of original master lecture vs what was actually conducted"}
                      {activeKpiDrawer === "swapped" &&
                        "Periods where the master scheduled subject was exchanged for another subject"}
                      {activeKpiDrawer === "conducted" &&
                        "Sessions held with verified student attendance marked and counts"}
                      {activeKpiDrawer === "master" &&
                        "Teaching periods scheduled in master timetable (strictly excluding lunch & normal breaks)"}
                      {activeKpiDrawer === "rate" &&
                        "Breakdown of master plan stability, substitutions, and timetable variance"}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setActiveKpiDrawer(null)}
                  className="rounded-lg p-1.5 text-slate-400 hover:text-navy-950 hover:bg-slate-200/60 transition-colors cursor-pointer"
                  title="Close pop card (Esc)"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* In-Drawer Quick Search & Filter Bar */}
              {activeKpiDrawer !== "rate" && (
                <div className="p-3 bg-slate-50 border-b border-slate-200 flex items-center gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
                    <input
                      type="text"
                      value={drawerSearch}
                      onChange={(e) => setDrawerSearch(e.target.value)}
                      placeholder={
                        activeKpiDrawer === "substituted"
                          ? "Filter by relieved teacher, reliever, subject, slot..."
                          : activeKpiDrawer === "changed"
                            ? "Filter by subject, teacher, slot, section..."
                            : "Filter results..."
                      }
                      className="w-full rounded-lg border border-slate-200 bg-white pl-8.5 pr-8 py-1.5 text-xs text-navy-950 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                    {drawerSearch && (
                      <button
                        type="button"
                        onClick={() => setDrawerSearch("")}
                        className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600 cursor-pointer"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Scrollable Content Body */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50/50">
                {/* 1. FACULTY SUBSTITUTED DRILLDOWN */}
                {activeKpiDrawer === "substituted" && (
                  <>
                    {filteredDrawerSubstitutions.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center">
                        <UserCheck className="mx-auto h-8 w-8 text-slate-400 mb-2" />
                        <h4 className="text-sm font-bold text-navy-950">No Faculty Substitutions Found</h4>
                        <p className="mt-1 text-xs text-slate-500">
                          {drawerSearch
                            ? `No substitutions matching "${drawerSearch}".`
                            : "All scheduled teachers conducted their classes as planned with 0 substitutions."}
                        </p>
                        {drawerSearch && (
                          <button
                            type="button"
                            onClick={() => setDrawerSearch("")}
                            className="mt-3 text-xs font-semibold text-blue-600 hover:underline cursor-pointer"
                          >
                            Clear search filter
                          </button>
                        )}
                      </div>
                    ) : (
                      filteredDrawerSubstitutions.map((sub, idx) => (
                        <div
                          key={sub.id || idx}
                          className="rounded-xl border border-sky-100 bg-white p-3.5 shadow-xs hover:shadow-md transition-shadow space-y-3"
                        >
                          {/* Card Meta Badges */}
                          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="inline-flex items-center gap-1 rounded bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-700">
                                <Calendar className="h-3 w-3 text-slate-500" />
                                {formatDisplayDate(sub.date)}
                              </span>
                              <span className="inline-flex items-center gap-1 rounded bg-sky-50 px-2 py-0.5 text-[11px] font-bold text-sky-800">
                                <Clock className="h-3 w-3 text-sky-600" />
                                {sub.slotLabel} {sub.slotTime ? `(${sub.slotTime})` : ""}
                              </span>
                              <span className="rounded bg-indigo-50 border border-indigo-200 px-2 py-0.5 text-[11px] font-bold text-indigo-700">
                                {getBranchBadge(null, sub.branchCode)}
                              </span>
                              <span className="rounded bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700">
                                Batch {sub.batch} {sub.sectionName ? `· Sec ${cleanSectionCode(sub.sectionName)}` : ""}
                              </span>
                            </div>

                            <span className="rounded-full bg-sky-100 px-2.5 py-0.5 text-[10px] font-extrabold uppercase text-sky-900">
                              Faculty Substituted
                            </span>
                          </div>

                          {/* PROMINENT WHO CHANGED VS WHO TOOK OVER BOX */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 items-stretch bg-slate-50/80 p-3 rounded-lg border border-slate-200">
                            {/* Left: Relieved Faculty (Who was changed) */}
                            <div className="rounded-lg bg-rose-50/80 border border-rose-200 p-2.5">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-rose-700 flex items-center gap-1">
                                <UserX className="h-3 w-3 text-rose-600" />
                                Who Was Changed (Relieved)
                              </span>
                              <p className="mt-1 text-sm font-bold text-rose-950">
                                {sub.masterFacultyName}
                              </p>
                              <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-rose-800 font-mono">
                                {sub.masterFacultyHrmsId ? `HRMS #${sub.masterFacultyHrmsId}` : "Scheduled Staff"}
                              </div>
                              <p className="mt-1 text-[10px] text-rose-700/80 italic">
                                Scheduled in master plan
                              </p>
                            </div>

                            {/* Right: Reliever Faculty (Who took over the period) */}
                            <div className="rounded-lg bg-emerald-50/90 border border-emerald-200 p-2.5">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 flex items-center gap-1">
                                <UserCheck className="h-3 w-3 text-emerald-700" />
                                Who Took Over (Reliever)
                              </span>
                              <p className="mt-1 text-sm font-bold text-emerald-950">
                                {sub.newFacultyName}
                              </p>
                              <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-emerald-900 font-mono font-semibold">
                                {sub.newFacultyHrmsId ? `HRMS #${sub.newFacultyHrmsId}` : "Substitute Staff"}
                              </div>
                              <p className="mt-1 text-[10px] text-emerald-700 font-medium">
                                Stepped in & conducted period
                              </p>
                            </div>
                          </div>

                          {/* Subject & Details Row */}
                          <div className="space-y-1.5 text-xs text-slate-700 pt-1">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-slate-500">Subject:</span>
                              <span className="font-bold text-navy-900">
                                {sub.newSubjectName || sub.masterSubjectName}
                              </span>
                              {(sub.newSubjectCode || sub.masterSubjectCode) && (
                                <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] text-slate-600">
                                  {sub.newSubjectCode || sub.masterSubjectCode}
                                </span>
                              )}
                            </div>

                            {sub.remarks && (
                              <div className="flex items-start gap-1.5 bg-amber-50/70 border border-amber-200/70 p-2 rounded text-[11px] text-amber-900">
                                <Info className="h-3.5 w-3.5 text-amber-600 shrink-0 mt-0.5" />
                                <div>
                                  <span className="font-bold">Official Note / Reason: </span>
                                  <span>{sub.remarks}</span>
                                </div>
                              </div>
                            )}

                            {sub.changedByName && (
                              <p className="text-[10px] text-slate-400">
                                Authorized by: <span className="font-medium text-slate-600">{sub.changedByName}</span>
                              </p>
                            )}
                          </div>

                          {/* Quick Filter Action Button */}
                          <div className="pt-2 border-t border-slate-100 flex items-center justify-end gap-2">
                            {sub.newFacultyHrmsId && (
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedStaffHrmsId(sub.newFacultyHrmsId!);
                                  setActiveKpiDrawer(null);
                                }}
                                className="inline-flex items-center gap-1 rounded bg-sky-50 px-2.5 py-1 text-xs font-semibold text-sky-800 hover:bg-sky-100 border border-sky-200 cursor-pointer"
                              >
                                Filter Report by {sub.newFacultyName}
                                <ArrowRight className="h-3 w-3" />
                              </button>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </>
                )}

                {/* 2. CLASSES CHANGED DRILLDOWN */}
                {activeKpiDrawer === "changed" && (
                  <>
                    {filteredDrawerChanges.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center">
                        <AlertTriangle className="mx-auto h-8 w-8 text-slate-400 mb-2" />
                        <h4 className="text-sm font-bold text-navy-950">No Changed Classes Found</h4>
                        <p className="mt-1 text-xs text-slate-500">
                          {drawerSearch
                            ? `No changed classes matching "${drawerSearch}".`
                            : "No timetable variances recorded for this view."}
                        </p>
                      </div>
                    ) : (
                      filteredDrawerChanges.map((change, idx) => (
                        <div
                          key={change.id || idx}
                          className="rounded-xl border border-amber-100 bg-white p-3.5 shadow-xs hover:shadow-md transition-shadow space-y-3"
                        >
                          {/* Header Badges */}
                          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="inline-flex items-center gap-1 rounded bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-700">
                                <Calendar className="h-3 w-3 text-slate-500" />
                                {formatDisplayDate(change.date)}
                              </span>
                              <span className="inline-flex items-center gap-1 rounded bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-800">
                                <Clock className="h-3 w-3 text-amber-600" />
                                {change.slotLabel} {change.slotTime ? `(${change.slotTime})` : ""}
                              </span>
                              <span className="rounded bg-indigo-50 border border-indigo-200 px-2 py-0.5 text-[11px] font-bold text-indigo-700">
                                {getBranchBadge(null, change.branchCode)}
                              </span>
                              <span className="rounded bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700">
                                Batch {change.batch} {change.sectionName ? `· Sec ${cleanSectionCode(change.sectionName)}` : ""}
                              </span>
                            </div>

                            <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-[10px] font-bold text-amber-900 border border-amber-200">
                              {change.varianceType}
                            </span>
                          </div>

                          {/* Before & After Comparison */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 bg-slate-50/80 p-3 rounded-lg border border-slate-200">
                            {/* Master Plan */}
                            <div className="rounded-lg bg-slate-100/80 p-2.5 border border-slate-200">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-600">
                                Master Plan (Scheduled)
                              </span>
                              <p className="mt-1 text-xs font-bold text-navy-950">
                                {change.masterSubjectName}
                              </p>
                              {change.masterSubjectCode && (
                                <p className="font-mono text-[10px] text-slate-500">{change.masterSubjectCode}</p>
                              )}
                              <p className="mt-1 text-[11px] text-slate-600">
                                Faculty: <span className="font-semibold">{change.masterFacultyName}</span>
                              </p>
                            </div>

                            {/* Actual / Changed */}
                            <div className="rounded-lg bg-amber-50/80 p-2.5 border border-amber-200">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800">
                                Actual Conducted (Altered)
                              </span>
                              <p className="mt-1 text-xs font-bold text-amber-950">
                                {change.newSubjectName}
                              </p>
                              {change.newSubjectCode && (
                                <p className="font-mono text-[10px] text-amber-800">{change.newSubjectCode}</p>
                              )}
                              <p className="mt-1 text-[11px] text-amber-900">
                                Faculty: <span className="font-semibold">{change.newFacultyName}</span>
                              </p>
                            </div>
                          </div>

                          {change.remarks && (
                            <div className="bg-amber-50/60 p-2 rounded text-[11px] text-amber-900 border border-amber-200/60">
                              <span className="font-semibold">Reason: </span>
                              {change.remarks}
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </>
                )}

                {/* 3. SUBJECT SWAPPED DRILLDOWN */}
                {activeKpiDrawer === "swapped" && (
                  <>
                    {filteredDrawerSwaps.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center">
                        <ArrowLeftRight className="mx-auto h-8 w-8 text-slate-400 mb-2" />
                        <h4 className="text-sm font-bold text-navy-950">No Subject Swaps Found</h4>
                        <p className="mt-1 text-xs text-slate-500">
                          {drawerSearch
                            ? `No subject swaps matching "${drawerSearch}".`
                            : "All periods conducted their planned curriculum subjects without swaps."}
                        </p>
                      </div>
                    ) : (
                      filteredDrawerSwaps.map((swap, idx) => (
                        <div
                          key={swap.id || idx}
                          className="rounded-xl border border-purple-100 bg-white p-3.5 shadow-xs hover:shadow-md transition-shadow space-y-3"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="rounded bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-700">
                                {formatDisplayDate(swap.date)}
                              </span>
                              <span className="rounded bg-purple-50 px-2 py-0.5 text-[11px] font-bold text-purple-800">
                                {swap.slotLabel} {swap.slotTime ? `(${swap.slotTime})` : ""}
                              </span>
                              <span className="rounded bg-indigo-50 border border-indigo-200 px-2 py-0.5 text-[11px] font-bold text-indigo-700">
                                {getBranchBadge(null, swap.branchCode)}
                              </span>
                              <span className="rounded bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700">
                                Batch {swap.batch} {swap.sectionName ? `· Sec ${cleanSectionCode(swap.sectionName)}` : ""}
                              </span>
                            </div>

                            <span className="rounded-full bg-purple-100 px-2.5 py-0.5 text-[10px] font-bold text-purple-900">
                              Subject Exchanged
                            </span>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 bg-slate-50/80 p-3 rounded-lg border border-slate-200">
                            <div className="rounded-lg bg-slate-100 p-2.5 border border-slate-200">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-600">
                                Master Subject (Replaced)
                              </span>
                              <p className="mt-1 text-xs font-bold text-navy-950">{swap.masterSubjectName}</p>
                              <p className="font-mono text-[10px] text-slate-500">{swap.masterSubjectCode}</p>
                            </div>

                            <div className="rounded-lg bg-purple-50 p-2.5 border border-purple-200">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-purple-800">
                                Swapped Subject (Taught)
                              </span>
                              <p className="mt-1 text-xs font-bold text-purple-950">{swap.newSubjectName}</p>
                              <p className="font-mono text-[10px] text-purple-800">{swap.newSubjectCode}</p>
                            </div>
                          </div>

                          <p className="text-xs text-slate-700">
                            Teacher: <span className="font-semibold text-navy-900">{swap.newFacultyName}</span>
                          </p>

                          {swap.remarks && (
                            <p className="text-[11px] italic text-slate-600 bg-slate-50 p-2 rounded">
                              &ldquo;{swap.remarks}&rdquo;
                            </p>
                          )}
                        </div>
                      ))
                    )}
                  </>
                )}

                {/* 4. CONDUCTED CLASSES DRILLDOWN */}
                {activeKpiDrawer === "conducted" && (
                  <>
                    {filteredDrawerConducted.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center">
                        <CheckCircle2 className="mx-auto h-8 w-8 text-slate-400 mb-2" />
                        <h4 className="text-sm font-bold text-navy-950">No Conducted Classes Recorded</h4>
                        <p className="mt-1 text-xs text-slate-500">
                          {drawerSearch
                            ? `No sessions matching "${drawerSearch}".`
                            : "Attendance has not been posted for classes in this date range yet."}
                        </p>
                      </div>
                    ) : (
                      filteredDrawerConducted.map((c) => (
                        <div
                          key={c.id}
                          className="rounded-xl border border-emerald-100 bg-white p-3.5 shadow-xs hover:shadow-md transition-shadow space-y-2"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div>
                              <h4 className="text-xs font-bold text-navy-950">
                                {c.todaySubjectName || c.masterSubjectName}
                              </h4>
                              <p className="text-[11px] text-slate-500">
                                Faculty: <span className="font-semibold text-slate-700">{c.todayFacultyName || c.masterFacultyName}</span>
                              </p>
                            </div>

                            <div className="text-right">
                              <span
                                className={cn(
                                  "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-extrabold",
                                  (c.attendancePct ?? 0) >= 75
                                    ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                                    : (c.attendancePct ?? 0) >= 60
                                      ? "bg-amber-100 text-amber-800 border border-amber-200"
                                      : "bg-rose-100 text-rose-800 border border-rose-200",
                                )}
                              >
                                {c.attendancePct != null ? `${c.attendancePct}% Attendance` : "Conducted"}
                              </span>
                              <p className="text-[10px] text-slate-500 mt-0.5 font-medium">
                                {c.presentCount} present · {c.absentCount} absent
                              </p>
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center gap-1.5 pt-1 text-[11px] text-slate-600 border-t border-slate-100">
                            <span className="rounded bg-indigo-50 border border-indigo-200 px-1.5 py-0.5 font-bold text-indigo-700">
                              {getBranchBadge(c.branchId, c.branchCode)}
                            </span>
                            <span className="rounded bg-slate-100 px-1.5 py-0.5">{formatDisplayDate(c.date)}</span>
                            <span className="rounded bg-slate-100 px-1.5 py-0.5">{c.slotLabel} ({c.time})</span>
                            <span className="rounded bg-slate-100 px-1.5 py-0.5">Batch {c.batch}</span>
                            {c.sectionName && (
                              <span className="rounded bg-sky-50 px-1.5 py-0.5 text-sky-700 border border-sky-200 font-semibold">
                                Sec {cleanSectionCode(c.sectionName)}
                              </span>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </>
                )}

                {/* 5. MASTER ASSIGNED DRILLDOWN */}
                {activeKpiDrawer === "master" && (
                  <>
                    <div className="rounded-lg bg-blue-50/80 border border-blue-200 p-2.5 flex items-center justify-between text-xs text-blue-900">
                      <div className="flex items-center gap-2">
                        <BookOpen className="h-4 w-4 text-blue-600 shrink-0" />
                        <span>
                          Showing <strong>{filteredDrawerMasterScheduled.length}</strong> master scheduled classes for{" "}
                          <strong>{dateMode === "today" ? "Today" : "Selected Range"}</strong>
                        </span>
                      </div>
                      <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-800 border border-blue-200">
                        Breaks Excluded
                      </span>
                    </div>

                    {filteredDrawerMasterScheduled.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center">
                        <BookOpen className="mx-auto h-8 w-8 text-slate-400 mb-2" />
                        <h4 className="text-sm font-bold text-navy-950">No Classes Scheduled in Master Timetable</h4>
                        <p className="mt-1 text-xs text-slate-500">
                          {drawerSearch
                            ? `No master scheduled classes matching "${drawerSearch}".`
                            : "No academic periods scheduled in the master timetable for this day (lunch & normal breaks are strictly excluded)."}
                        </p>
                      </div>
                    ) : (
                      filteredDrawerMasterScheduled.map((item) => (
                        <div
                          key={item.id}
                          className="rounded-xl border border-blue-200 bg-white p-3.5 shadow-xs hover:shadow-md transition-shadow space-y-2.5"
                        >
                          {/* Header Badges */}
                          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="rounded bg-indigo-50 border border-indigo-200 px-2 py-0.5 text-[11px] font-bold text-indigo-700">
                                {getBranchBadge(item.branchId, item.branchCode)}
                              </span>
                              <span className="inline-flex items-center gap-1 rounded bg-blue-50 px-2 py-0.5 text-[11px] font-bold text-blue-800 border border-blue-200">
                                <Clock className="h-3 w-3 text-blue-600" />
                                {item.slotLabel} {item.slotTime ? `(${item.slotTime})` : ""}
                              </span>
                              <span className="rounded bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700">
                                Batch {item.batch} {item.sectionName ? `· Sec ${cleanSectionCode(item.sectionName)}` : ""}
                              </span>
                            </div>
                            <span
                              className={cn(
                                "rounded-full px-2.5 py-0.5 text-[10px] font-bold border uppercase",
                                item.customLabel === "CRT"
                                  ? "bg-purple-100 text-purple-900 border-purple-200"
                                  : item.customLabel === "Library"
                                    ? "bg-teal-100 text-teal-900 border-teal-200"
                                    : item.entryType === "lab"
                                      ? "bg-emerald-100 text-emerald-900 border-emerald-200"
                                      : "bg-blue-100 text-blue-900 border-blue-200",
                              )}
                            >
                              {item.customLabel || (item.entryType === "lab" ? "Laboratory" : "Academic Class")}
                            </span>
                          </div>

                          {/* Subject & Assigned Faculty */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 bg-slate-50/80 p-2.5 rounded-lg border border-slate-200">
                            <div>
                              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                                Curriculum Subject
                              </span>
                              <p className="mt-0.5 text-xs font-bold text-navy-950">{item.subjectName}</p>
                              {item.subjectCode && (
                                <span className="font-mono text-[10px] font-semibold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded">
                                  {item.subjectCode}
                                </span>
                              )}
                            </div>

                            <div>
                              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                                Master Assigned Faculty
                              </span>
                              <p className="mt-0.5 text-xs font-bold text-navy-950 flex items-center gap-1">
                                <User className="h-3.5 w-3.5 text-blue-600" />
                                {item.facultyName}
                              </p>
                              {item.facultyHrmsId && (
                                <span className="font-mono text-[10px] text-slate-500">HRMS #{item.facultyHrmsId}</span>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center justify-between text-[10px] text-slate-500 pt-0.5">
                            <span>Master Timetable Standard Plan</span>
                            <span className="font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100">
                              ✓ Excludes lunch & normal break
                            </span>
                          </div>
                        </div>
                      ))
                    )}

                    {/* Weekly Subject Allotment Quota Breakdown */}
                    {filteredDrawerMaster.length > 0 && (
                      <div className="pt-3 border-t border-slate-200 space-y-2">
                        <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                          <span>Weekly Subject Quota Overview</span>
                          <span className="text-[10px] text-slate-500 font-normal">{filteredDrawerMaster.length} subject(s) in curriculum</span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {filteredDrawerMaster.map((sub) => (
                            <div key={sub.subjectCode} className="rounded-lg bg-white border border-slate-200 p-2.5 text-xs">
                              <div className="flex items-center justify-between">
                                <span className="font-bold text-navy-900 truncate">{sub.subjectName}</span>
                                <span className="font-mono text-[10px] text-blue-700 font-bold bg-blue-50 px-1.5 py-0.5 rounded ml-1 shrink-0">
                                  {sub.masterWeeklyPeriods} p/wk
                                </span>
                              </div>
                              <p className="text-[10px] text-slate-500 mt-0.5 font-mono">{sub.subjectCode}</p>
                              {sub.facultyNames.length > 0 && (
                                <p className="text-[10px] text-slate-600 mt-1 truncate">
                                  Staff: {sub.facultyNames.join(", ")}
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}

                {/* 6. TIMETABLE CHANGE RATE & VARIANCE BREAKDOWN */}
                {activeKpiDrawer === "rate" && (
                  <div className="space-y-4">
                    <div className="rounded-xl bg-linear-to-br from-rose-50 to-white p-4 border border-rose-200 space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-[10px] font-bold uppercase tracking-wider text-rose-700">
                            Timetable Variance Ratio
                          </span>
                          <h4 className="text-3xl font-extrabold text-rose-800 mt-1">
                            {summary.overallChangeRatePct}%
                          </h4>
                        </div>
                        <div className="text-right text-xs text-slate-600">
                          <p className="font-bold text-navy-950">{summary.totalChangesRecorded} Alterations</p>
                          <p className="text-[11px] text-slate-500">out of {summary.totalMasterPeriods * 15 || summary.totalScheduledSessions || 1} planned slots</p>
                        </div>
                      </div>

                      <div className="w-full bg-slate-200 h-2.5 rounded-full overflow-hidden">
                        <div
                          className="bg-rose-500 h-full rounded-full transition-all duration-500"
                          style={{ width: `${Math.min(100, summary.overallChangeRatePct)}%` }}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2.5">
                      <div className="rounded-lg bg-white p-3 border border-slate-200 shadow-2xs">
                        <span className="text-[10px] font-semibold text-slate-500 uppercase">Faculty Substitutions</span>
                        <p className="mt-1 text-xl font-bold text-sky-800">{summary.facultySubstitutionsCount}</p>
                        <p className="text-[10px] text-slate-500">Relievers deployed</p>
                      </div>

                      <div className="rounded-lg bg-white p-3 border border-slate-200 shadow-2xs">
                        <span className="text-[10px] font-semibold text-slate-500 uppercase">Subject Swaps</span>
                        <p className="mt-1 text-xl font-bold text-purple-800">{summary.subjectSwapsCount}</p>
                        <p className="text-[10px] text-slate-500">Curriculum exchanges</p>
                      </div>

                      <div className="rounded-lg bg-white p-3 border border-slate-200 shadow-2xs">
                        <span className="text-[10px] font-semibold text-slate-500 uppercase">Classes Conducted</span>
                        <p className="mt-1 text-xl font-bold text-emerald-800">{summary.totalConductedSessions}</p>
                        <p className="text-[10px] text-slate-500">Sessions held</p>
                      </div>

                      <div className="rounded-lg bg-white p-3 border border-slate-200 shadow-2xs">
                        <span className="text-[10px] font-semibold text-slate-500 uppercase">Avg Attendance</span>
                        <p className="mt-1 text-xl font-bold text-indigo-900">{summary.attendanceAvgPct}%</p>
                        <p className="text-[10px] text-slate-500">Student attendance</p>
                      </div>
                    </div>

                    <div className="rounded-lg bg-blue-50/70 p-3 border border-blue-200 text-xs text-blue-900 space-y-1">
                      <p className="font-bold flex items-center gap-1">
                        <Info className="h-3.5 w-3.5 text-blue-600" />
                        Understanding Timetable Stability
                      </p>
                      <p className="text-[11px] text-blue-800 leading-relaxed">
                        A low change rate (&lt; 15%) signifies strong timetable fidelity where master scheduled classes run as planned. Higher change rates indicate frequent faculty absences, relocations, or emergency adjustments.
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Drawer Footer */}
              <div className="p-3 bg-white border-t border-slate-200 flex items-center justify-between">
                <p className="text-[11px] text-slate-500">
                  Press <kbd className="rounded bg-slate-100 px-1 py-0.5 font-mono text-[10px] text-slate-700 border">Esc</kbd> or click outside to dismiss
                </p>
                <button
                  type="button"
                  onClick={() => setActiveKpiDrawer(null)}
                  className="rounded-lg bg-navy-950 px-3 py-1.5 text-xs font-bold text-white hover:bg-navy-900 cursor-pointer transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
