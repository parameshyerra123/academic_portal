"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import Link from "next/link";
import { cn } from "@/lib/cn";
import { apiFetch } from "@/lib/api";
import { LoadingAnimation } from "@/components/ui/LoadingAnimation";
import { DashboardSkeleton } from "@/components/ui/DashboardSkeleton";
import { useAcademicContext } from "@/components/layout/AcademicProvider";
import {
  BookOpen,
  Users,
  CheckCircle2,
  Clock,
  FileText,
  Calendar,
  TrendingUp,
  ChevronRight,
  GraduationCap,
  CalendarDays,
  ChevronDown,
  X,
  RefreshCw,
} from "lucide-react";

// Circular Donut Progress Ring
function DonutProgress({
  percentage,
  color = "#10b981",
  size = 64,
  strokeWidth = 6,
}: {
  percentage: number;
  color?: string;
  size?: number;
  strokeWidth?: number;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  return (
    <div
      className="relative inline-flex items-center justify-center shrink-0 w-12 h-12 sm:w-16 sm:h-16"
    >
      <svg className="transform -rotate-90 w-full h-full" viewBox={`0 0 ${size} ${size}`}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="#E2E8F0"
          strokeWidth={strokeWidth}
          fill="transparent"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          fill="transparent"
          className="transition-all duration-700 ease-out"
        />
      </svg>
      <span className="absolute text-[10px] sm:text-xs font-bold text-slate-800">
        {percentage}%
      </span>
    </div>
  );
}

export type SubjectTeacherDashboardData = {
  faculty: {
    id: number | null;
    staffLinkId: number | null;
    hrmsEmployeeId: string | null;
    name: string;
    department: string;
    role: string;
  };
  metrics: {
    mySubjectsCount: number;
    theoryCount: number;
    labCount: number;
    totalStudentsCount: number;
    classesScheduledToday: number;
    classesConductedToday: number;
    attendanceTodayPct: number;
    attendanceTodayPresent: number;
    attendanceTodayTotal: number;
    pendingMarksCount: number;
    pendingEvaluationsCount: number;
  };
  todayClasses: Array<{
    time: string;
    subject: string;
    classSection: string;
    status: "Conducted" | "Upcoming";
    sessionId: string;
  }>;
  subjectAttendanceDonuts: Array<{
    subject: string;
    classSection: string;
    percentage: number;
    present: number;
    total: number;
    color: string;
    hasSessionOnDate?: boolean;
    sessionsCountOnDate?: number;
    cumulativePercentage?: number;
    cumulativePresent?: number;
    cumulativeTotal?: number;
    cumulativeSessionsCount?: number;
  }>;
  teachingProgress: Array<{
    subject: string;
    planned: number;
    conducted: number;
    completion: number;
    status: "On Track" | "Behind";
  }>;
  studentsAttendance: Array<{
    subject: string;
    total: number;
    present: number;
    absent: number;
    attendance: string;
    hasSessionOnDate?: boolean;
    cumulativeAttendance?: string;
    cumulativePresent?: number;
    cumulativeAbsent?: number;
    cumulativeTotal?: number;
  }>;
  internalExamPerformance: Array<{
    subject: string;
    appeared: number;
    pass: number;
    fail: number;
    passPct: string;
  }>;
  studentsRequiringAttention: {
    lowAttendance: Array<{
      rollNo: string;
      name: string;
      subject: string;
      metric: string;
      status: string;
    }>;
    failedInternal1: Array<{
      rollNo: string;
      name: string;
      subject: string;
      metric: string;
      status: string;
    }>;
    failedInternal2: Array<{
      rollNo: string;
      name: string;
      subject: string;
      metric: string;
      status: string;
    }>;
  };
  pendingWork: Array<{
    count: number;
    label: string;
    badgeBg: string;
    href: string;
  }>;
  studentsOverview: Array<{
    subject: string;
    total: number;
    atRisk: number;
    failed1: number;
    failed2: number;
    passed: number;
  }>;
  upcomingDeadlines: Array<{
    day: string;
    month: string;
    title: string;
    subtitle: string;
    countdown: string;
  }>;
  dateInfo?: {
    selectedDate: string;
    isToday: boolean;
    dayName: string;
    dayCode: string;
  };
};

export type SubjectTeacherDashboardProps = {
  userName?: string;
  departmentName?: string;
  roleLabel?: string;
  academicYear?: string;
  facultyStaffLinkId?: number;
  date?: string;
};

function formatIso(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function SubjectTeacherDashboard({
  userName = "Faculty Member",
  departmentName = "Department of CSE",
  roleLabel = "Subject Teacher",
  academicYear,
  facultyStaffLinkId,
  date,
}: SubjectTeacherDashboardProps) {
  const { filters, masters } = useAcademicContext();

  const activeDate = date || filters.date || formatIso(new Date());
  const activeAY =
    filters.academicYear ||
    masters?.defaults?.academicYear ||
    masters?.academicYears?.find((y) => y.isActive)?.label ||
    academicYear ||
    "AY 2024-25";
  const activeSemester =
    filters.semester === 2 ? "Semester II" : "Semester I";

  const [activeAttentionTab, setActiveAttentionTab] = useState<
    "low_attendance" | "failed_int1" | "failed_int2"
  >("low_attendance");

  const [subjectAttendanceMode, setSubjectAttendanceMode] = useState<"date" | "cumulative">("date");

  const [data, setData] = useState<SubjectTeacherDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Selected student for quick view modal
  const [selectedStudent, setSelectedStudent] = useState<{
    rollNo: string;
    name: string;
    subject: string;
    metric?: string;
    status: string;
  } | null>(null);

  // Fetch real data from database via readonly endpoint
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (activeDate) params.set("date", activeDate);
      if (activeAY) params.set("academicYear", activeAY);
      if (activeSemester) params.set("semester", activeSemester);
      if (facultyStaffLinkId) params.set("facultyStaffLinkId", String(facultyStaffLinkId));

      const res = await apiFetch(`/faculty/dashboard?${params.toString()}`);
      if (!res.ok) {
        throw new Error("Failed to load faculty dashboard data from database");
      }
      const json: SubjectTeacherDashboardData = await res.json();
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error loading dashboard");
    } finally {
      setLoading(false);
    }
  }, [activeDate, activeAY, activeSemester, facultyStaffLinkId]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  if (loading && !data) {
    return <DashboardSkeleton />;
  }

  const metrics = data?.metrics || {
    mySubjectsCount: 0,
    theoryCount: 0,
    labCount: 0,
    totalStudentsCount: 0,
    classesScheduledToday: 0,
    classesConductedToday: 0,
    attendanceTodayPct: 0,
    attendanceTodayPresent: 0,
    attendanceTodayTotal: 0,
    pendingMarksCount: 0,
    pendingEvaluationsCount: 0,
  };

  const todayClassesList = data?.todayClasses || [];
  const subjectAttendanceDonuts = data?.subjectAttendanceDonuts || [];
  const teachingProgressList = data?.teachingProgress || [];
  const studentsAttendanceList = data?.studentsAttendance || [];
  const internalExamPerformanceList = data?.internalExamPerformance || [];
  const pendingWorkItems = data?.pendingWork || [];
  const studentsOverviewList = data?.studentsOverview || [];
  const upcomingDeadlinesList = data?.upcomingDeadlines || [];

  const attentionList =
    activeAttentionTab === "low_attendance"
      ? data?.studentsRequiringAttention?.lowAttendance || []
      : activeAttentionTab === "failed_int1"
      ? data?.studentsRequiringAttention?.failedInternal1 || []
      : data?.studentsRequiringAttention?.failedInternal2 || [];

  return (
    <div className="space-y-4 sm:space-y-5 pb-12 font-sans antialiased">
      {error && (
        <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl font-medium">
          {error}
        </div>
      )}

      {/* 2. TOP METRIC SUMMARY CARDS (6 CARDS ROW) */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-3.5">
        {/* Card 1: My Subjects */}
        <div className="rounded-xl sm:rounded-2xl border border-slate-200/90 bg-white p-2.5 sm:p-3.5 shadow-xs flex items-center gap-2 sm:gap-3 transition-transform hover:-translate-y-0.5">
          <div className="flex h-8 w-8 sm:h-11 sm:w-11 shrink-0 items-center justify-center rounded-lg sm:rounded-xl bg-emerald-50 text-emerald-600">
            <BookOpen className="h-4 w-4 sm:h-5 sm:w-5" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] sm:text-[11px] font-bold text-slate-500 leading-tight">My Subjects</p>
            <p className="text-base sm:text-2xl font-black text-slate-900 leading-tight mt-0.5">
              {metrics.mySubjectsCount}
            </p>
            <p className="text-[9px] sm:text-[10px] font-medium text-slate-400 truncate mt-0.5">
              {metrics.theoryCount} Theory | {metrics.labCount} Lab
            </p>
          </div>
        </div>

        {/* Card 2: Total Students */}
        <div className="rounded-xl sm:rounded-2xl border border-slate-200/90 bg-white p-2.5 sm:p-3.5 shadow-xs flex items-center gap-2 sm:gap-3 transition-transform hover:-translate-y-0.5">
          <div className="flex h-8 w-8 sm:h-11 sm:w-11 shrink-0 items-center justify-center rounded-lg sm:rounded-xl bg-blue-50 text-blue-600">
            <Users className="h-4 w-4 sm:h-5 sm:w-5" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] sm:text-[11px] font-bold text-slate-500 leading-tight">Total Students</p>
            <p className="text-base sm:text-2xl font-black text-slate-900 leading-tight mt-0.5">
              {metrics.totalStudentsCount}
            </p>
            <p className="text-[9px] sm:text-[10px] font-medium text-slate-400 truncate mt-0.5">
              (Across all subjects)
            </p>
          </div>
        </div>

        {/* Card 3: Today's / Selected Day's Classes */}
        <div className="rounded-xl sm:rounded-2xl border border-slate-200/90 bg-white p-2.5 sm:p-3.5 shadow-xs flex items-center gap-2 sm:gap-3 transition-transform hover:-translate-y-0.5">
          <div className="flex h-8 w-8 sm:h-11 sm:w-11 shrink-0 items-center justify-center rounded-lg sm:rounded-xl bg-emerald-50 text-emerald-600">
            <CheckCircle2 className="h-4 w-4 sm:h-5 sm:w-5" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] sm:text-[11px] font-bold text-slate-500 leading-tight">
              {data?.dateInfo?.isToday ? "Today's Classes" : `${data?.dateInfo?.dayName || "Selected"} Classes`}
            </p>
            <p className="text-base sm:text-2xl font-black text-slate-900 leading-tight mt-0.5">
              {metrics.classesConductedToday} / {metrics.classesScheduledToday}
            </p>
            <p className="text-[9px] sm:text-[10px] font-medium text-slate-400 truncate mt-0.5">
              {data?.dateInfo?.isToday ? "Conducted" : "Scheduled"}
            </p>
          </div>
        </div>

        {/* Card 4: Attendance Today / for Date */}
        <div className="rounded-xl sm:rounded-2xl border border-slate-200/90 bg-white p-2.5 sm:p-3.5 shadow-xs flex items-center gap-2 sm:gap-3 transition-transform hover:-translate-y-0.5">
          <div className="flex h-8 w-8 sm:h-11 sm:w-11 shrink-0 items-center justify-center rounded-lg sm:rounded-xl bg-amber-50 text-amber-600">
            <Users className="h-4 w-4 sm:h-5 sm:w-5" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] sm:text-[11px] font-bold text-slate-500 leading-tight">
              {data?.dateInfo?.isToday ? "Attendance Today" : "Attendance on Date"}
            </p>
            <p className="text-base sm:text-2xl font-black text-slate-900 leading-tight mt-0.5">
              {metrics.attendanceTodayPct}%
            </p>
            <p className="text-[9px] sm:text-[10px] font-medium text-slate-400 truncate mt-0.5">
              {metrics.attendanceTodayPresent} / {metrics.attendanceTodayTotal} Present
            </p>
          </div>
        </div>

        {/* Card 5: Pending Marks Entry */}
        <div className="rounded-xl sm:rounded-2xl border border-slate-200/90 bg-white p-2.5 sm:p-3.5 shadow-xs flex items-center gap-2 sm:gap-3 transition-transform hover:-translate-y-0.5">
          <div className="flex h-8 w-8 sm:h-11 sm:w-11 shrink-0 items-center justify-center rounded-lg sm:rounded-xl bg-rose-50 text-rose-600">
            <FileText className="h-4 w-4 sm:h-5 sm:w-5" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] sm:text-[11px] font-bold text-slate-500 leading-tight">Pending Marks</p>
            <p className="text-base sm:text-2xl font-black text-rose-600 leading-tight mt-0.5">
              {metrics.pendingMarksCount}
            </p>
            <p className="text-[9px] sm:text-[10px] font-medium text-slate-400 truncate mt-0.5">
              (Internal Drafts)
            </p>
          </div>
        </div>

        {/* Card 6: Pending Evaluations */}
        <div className="rounded-xl sm:rounded-2xl border border-slate-200/90 bg-white p-2.5 sm:p-3.5 shadow-xs flex items-center gap-2 sm:gap-3 transition-transform hover:-translate-y-0.5">
          <div className="flex h-8 w-8 sm:h-11 sm:w-11 shrink-0 items-center justify-center rounded-lg sm:rounded-xl bg-purple-50 text-purple-600">
            <Clock className="h-4 w-4 sm:h-5 sm:w-5" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] sm:text-[11px] font-bold text-slate-500 leading-tight">Evaluations</p>
            <p className="text-base sm:text-2xl font-black text-purple-600 leading-tight mt-0.5">
              {metrics.pendingEvaluationsCount}
            </p>
            <p className="text-[9px] sm:text-[10px] font-medium text-slate-400 truncate mt-0.5">
              Unsubmitted
            </p>
          </div>
        </div>
      </div>

      {/* 3. ROW 2 — TODAY'S CLASSES | SUBJECT-WISE ATTENDANCE | TEACHING PROGRESS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 sm:gap-4">
        {/* Card A: Today's Classes */}
        <div className="rounded-xl sm:rounded-2xl border border-slate-200/90 bg-white p-3 sm:p-4 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-2 sm:pb-3 border-b border-slate-100">
              <h2 className="text-xs sm:text-sm font-bold text-slate-900 flex items-center gap-1.5 sm:gap-2">
                <CalendarDays className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-blue-600" />
                {data?.dateInfo?.isToday
                  ? "Today's Classes"
                  : `Classes for ${activeDate}${data?.dateInfo?.dayName ? ` (${data.dateInfo.dayName})` : ""}`}
              </h2>
              <Link
                href="/my-timetable"
                className="text-[10.5px] sm:text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-0.5 transition-colors"
              >
                View Full Timetable &gt;
              </Link>
            </div>

            {todayClassesList.length === 0 ? (
              <div className="py-6 sm:py-8 text-center text-xs text-slate-400">
                {data?.dateInfo?.isToday
                  ? "No class sessions scheduled for today."
                  : `No class sessions scheduled for ${activeDate}${data?.dateInfo?.dayName ? ` (${data.dateInfo.dayName})` : ""}.`}
              </div>
            ) : (
              <div className="mt-2 sm:mt-3 overflow-x-auto max-h-64">
                <table className="w-full text-left text-[11px] sm:text-xs">
                  <thead>
                    <tr className="text-slate-400 font-semibold border-b border-slate-100 pb-1 sm:pb-1.5 text-[10px] sm:text-[11px]">
                      <th className="py-1 sm:py-1.5 font-medium">Cl.Time</th>
                      <th className="py-1 sm:py-1.5 font-medium">Subject</th>
                      <th className="py-1 sm:py-1.5 font-medium">Class</th>
                      <th className="py-1 sm:py-1.5 text-right font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {todayClassesList.map((c, i) => (
                      <tr key={i} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-1.5 sm:py-2.5 text-slate-600 font-medium whitespace-nowrap">
                          {c.time}
                        </td>
                        <td className="py-1.5 sm:py-2.5 font-semibold text-slate-800 max-w-[110px] sm:max-w-none truncate">
                          {c.subject}
                        </td>
                        <td className="py-1.5 sm:py-2.5 text-slate-600 font-medium">
                          {c.classSection && c.classSection !== "—" ? c.classSection : "—"}
                        </td>
                        <td className="py-1.5 sm:py-2.5 text-right whitespace-nowrap">
                          <span
                            className={cn(
                              "px-1.5 sm:px-2.5 py-0.5 rounded-md text-[10px] sm:text-[11px] font-semibold border",
                              c.status === "Conducted"
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200/70"
                                : "bg-sky-50 text-sky-700 border-sky-200/70"
                            )}
                          >
                            {c.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Card B: Subject-wise Attendance */}
        <div className="rounded-xl sm:rounded-2xl border border-slate-200/90 bg-white p-3 sm:p-4 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex flex-wrap items-center justify-between pb-2 sm:pb-3 border-b border-slate-100 gap-1.5">
              <div className="flex items-center gap-1.5 sm:gap-2">
                <Users className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-blue-600" />
                <h2 className="text-xs sm:text-sm font-bold text-slate-900">
                  Subject-wise Attendance
                </h2>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="flex items-center bg-slate-100 p-0.5 rounded-lg text-[10px] font-semibold">
                  <button
                    type="button"
                    onClick={() => setSubjectAttendanceMode("date")}
                    className={cn(
                      "px-2 py-0.5 rounded-md transition-all cursor-pointer",
                      subjectAttendanceMode === "date"
                        ? "bg-white text-blue-700 shadow-2xs font-bold"
                        : "text-slate-600 hover:text-slate-900"
                    )}
                    title={`Attendance on ${activeDate}`}
                  >
                    On Date
                  </button>
                  <button
                    type="button"
                    onClick={() => setSubjectAttendanceMode("cumulative")}
                    className={cn(
                      "px-2 py-0.5 rounded-md transition-all cursor-pointer",
                      subjectAttendanceMode === "cumulative"
                        ? "bg-white text-blue-700 shadow-2xs font-bold"
                        : "text-slate-600 hover:text-slate-900"
                    )}
                    title={`Cumulative attendance as of ${activeDate}`}
                  >
                    Cumulative
                  </button>
                </div>
                <Link
                  href="/attendance-posting"
                  className="text-[10.5px] sm:text-xs font-semibold text-blue-600 hover:text-blue-700 transition-colors"
                >
                  View Details &gt;
                </Link>
              </div>
            </div>

            {subjectAttendanceDonuts.length === 0 ? (
              <div className="py-6 sm:py-8 text-center text-xs text-slate-400">
                No attendance posts recorded yet for assigned subjects.
              </div>
            ) : (
              <div className="mt-2.5 sm:mt-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 text-center">
                {subjectAttendanceDonuts.map((d, i) => {
                  const isDateMode = subjectAttendanceMode === "date";
                  const pct = isDateMode
                    ? d.hasSessionOnDate
                      ? d.percentage
                      : 0
                    : (d.cumulativePercentage ?? d.percentage);
                  const presentCount = isDateMode
                    ? d.present
                    : (d.cumulativePresent ?? d.present);
                  const totalCount = isDateMode
                    ? d.total
                    : (d.cumulativeTotal ?? d.total);
                  const donutColor =
                    pct >= 85
                      ? "#10b981"
                      : pct >= 75
                      ? "#0d9488"
                      : pct > 0
                      ? "#f59e0b"
                      : "#94a3b8";

                  return (
                    <div key={i} className="flex flex-col items-center">
                      <div className="h-7 sm:h-8 flex flex-col justify-center mb-0.5 sm:mb-1">
                        <p className="text-[10px] sm:text-[11px] font-bold text-slate-800 leading-tight line-clamp-1" title={d.subject}>
                          {d.subject}
                        </p>
                        {d.classSection && d.classSection !== "—" && d.classSection.trim() !== "" ? (
                          <p className="text-[9px] sm:text-[10px] font-semibold text-slate-400">
                            {d.classSection}
                          </p>
                        ) : null}
                      </div>
                      <DonutProgress
                        percentage={pct}
                        color={donutColor}
                        size={64}
                        strokeWidth={6}
                      />
                      <p className="mt-1 sm:mt-1.5 text-[9.5px] sm:text-[10.5px] font-semibold text-slate-700">
                        {presentCount} / {totalCount}
                      </p>
                      <p className="text-[8.5px] sm:text-[9.5px] font-medium text-slate-400 truncate">
                        {isDateMode
                          ? d.hasSessionOnDate
                            ? `${d.sessionsCountOnDate || 1} session conducted`
                            : "No session on date"
                          : `${d.cumulativeSessionsCount ?? 0} total sessions`}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Card C: Teaching Progress */}
        <div className="rounded-xl sm:rounded-2xl border border-slate-200/90 bg-white p-3 sm:p-4 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-2 sm:pb-3 border-b border-slate-100">
              <h2 className="text-xs sm:text-sm font-bold text-slate-900 flex items-center gap-1.5 sm:gap-2">
                <TrendingUp className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-blue-600" />
                Teaching Progress
              </h2>
              <Link
                href="/my-timetable"
                className="text-[10.5px] sm:text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-0.5 transition-colors"
              >
                View Details &gt;
              </Link>
            </div>

            {teachingProgressList.length === 0 ? (
              <div className="py-6 sm:py-8 text-center text-xs text-slate-400">
                No curriculum plans assigned for this faculty.
              </div>
            ) : (
              <div className="mt-2 sm:mt-3 overflow-x-auto max-h-64">
                <table className="w-full text-left text-[11px] sm:text-xs">
                  <thead>
                    <tr className="text-slate-400 font-semibold border-b border-slate-100 pb-1 sm:pb-1.5 text-[10px] sm:text-[11px]">
                      <th className="py-1 sm:py-1.5 font-medium">Subject</th>
                      <th className="py-1 sm:py-1.5 text-center font-medium">Planned</th>
                      <th className="py-1 sm:py-1.5 text-center font-medium">Conducted</th>
                      <th className="py-1 sm:py-1.5 font-medium">Completion</th>
                      <th className="py-1 sm:py-1.5 text-right font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {teachingProgressList.map((p, i) => (
                      <tr key={i} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-1.5 sm:py-2.5 font-semibold text-slate-800 max-w-[110px] sm:max-w-none truncate">
                          {p.subject}
                        </td>
                        <td className="py-1.5 sm:py-2.5 text-center text-slate-600 font-medium">
                          {p.planned}
                        </td>
                        <td className="py-1.5 sm:py-2.5 text-center text-slate-600 font-medium">
                          {p.conducted}
                        </td>
                        <td className="py-1.5 sm:py-2.5">
                          <div className="w-14 sm:w-20 bg-slate-100 h-1.5 sm:h-2 rounded-full overflow-hidden">
                            <div
                              className={cn(
                                "h-full rounded-full transition-all",
                                p.status === "Behind" ? "bg-amber-500" : "bg-emerald-500"
                              )}
                              style={{ width: `${p.completion}%` }}
                            />
                          </div>
                        </td>
                        <td className="py-1.5 sm:py-2.5 text-right whitespace-nowrap">
                          <span
                            className={cn(
                              "px-1.5 sm:px-2 py-0.5 rounded-md text-[10px] sm:text-[11px] font-semibold border",
                              p.status === "On Track"
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200/70"
                                : "bg-rose-50 text-rose-700 border-rose-200/70"
                            )}
                          >
                            {p.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 4. ROW 3 — STUDENTS ATTENDANCE (MY SUBJECTS) | INTERNAL EXAM PERFORMANCE | STUDENTS REQUIRING ATTENTION */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3.5 sm:gap-4">
        {/* Card D: Students Attendance (My Subjects) */}
        <div className="rounded-xl sm:rounded-2xl border border-slate-200/90 bg-white p-3 sm:p-4 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-2.5 sm:pb-3 border-b border-slate-100">
              <h2 className="text-xs sm:text-sm font-bold text-slate-900 flex items-center gap-1.5 sm:gap-2">
                <Users className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-blue-600" />
                Students Attendance (My Subjects)
                <span className="text-[10px] text-slate-400 font-medium">
                  ({subjectAttendanceMode === "date" ? "On Date" : "Cumulative"})
                </span>
              </h2>
              <Link
                href="/attendance-posting"
                className="text-[11px] sm:text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-0.5 transition-colors"
              >
                View All &gt;
              </Link>
            </div>

            {studentsAttendanceList.length === 0 ? (
              <div className="py-6 sm:py-8 text-center text-[11px] sm:text-xs text-slate-400">
                No attendance sessions recorded yet.
              </div>
            ) : (
              <div className="mt-2.5 sm:mt-3 overflow-x-auto max-h-64">
                <table className="w-full text-left text-[11px] sm:text-xs">
                  <thead>
                    <tr className="text-slate-400 font-semibold border-b border-slate-100 pb-1.5 text-[10px] sm:text-xs">
                      <th className="py-1 sm:py-1.5 font-medium">Subject</th>
                      <th className="py-1 sm:py-1.5 text-center font-medium">Total</th>
                      <th className="py-1 sm:py-1.5 text-center font-medium">Present</th>
                      <th className="py-1 sm:py-1.5 text-center font-medium">Absent</th>
                      <th className="py-1 sm:py-1.5 text-right font-medium">Attendance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {studentsAttendanceList.map((s, i) => {
                      const isDateMode = subjectAttendanceMode === "date";
                      const dispTotal = isDateMode ? s.total : (s.cumulativeTotal ?? s.total);
                      const dispPresent = isDateMode ? s.present : (s.cumulativePresent ?? s.present);
                      const dispAbsent = isDateMode ? s.absent : (s.cumulativeAbsent ?? s.absent);
                      const dispAtt = isDateMode ? (s.hasSessionOnDate ? s.attendance : "—") : (s.cumulativeAttendance ?? s.attendance);

                      return (
                        <tr key={i} className="hover:bg-slate-50/70 transition-colors">
                          <td className="py-1.5 sm:py-2.5 font-semibold text-slate-800 whitespace-nowrap max-w-[110px] sm:max-w-none truncate">
                            {s.subject}
                          </td>
                          <td className="py-1.5 sm:py-2.5 text-center text-slate-600 font-medium">
                            {dispTotal}
                          </td>
                          <td className="py-1.5 sm:py-2.5 text-center text-blue-600 font-bold">
                            {dispPresent}
                          </td>
                          <td className="py-1.5 sm:py-2.5 text-center text-rose-500 font-bold">
                            {dispAbsent}
                          </td>
                          <td className="py-1.5 sm:py-2.5 text-right font-bold text-emerald-600">
                            {dispAtt}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Card E: Internal Exam Performance (My Subjects) */}
        <div className="rounded-xl sm:rounded-2xl border border-slate-200/90 bg-white p-3 sm:p-4 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-2.5 sm:pb-3 border-b border-slate-100">
              <h2 className="text-xs sm:text-sm font-bold text-slate-900 flex items-center gap-1.5 sm:gap-2">
                <Users className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-blue-600" />
                Internal Exam Performance (My Subjects)
              </h2>
              <Link
                href="/internal-marks"
                className="text-[11px] sm:text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-0.5 transition-colors"
              >
                View Details &gt;
              </Link>
            </div>

            {internalExamPerformanceList.length === 0 ? (
              <div className="py-6 sm:py-8 text-center text-[11px] sm:text-xs text-slate-400">
                No internal marks evaluation submissions recorded.
              </div>
            ) : (
              <div className="mt-2.5 sm:mt-3 overflow-x-auto max-h-64">
                <table className="w-full text-left text-[11px] sm:text-xs">
                  <thead>
                    <tr className="text-slate-400 font-semibold border-b border-slate-100 pb-1.5 text-[10px] sm:text-xs">
                      <th className="py-1 sm:py-1.5 font-medium">Subject</th>
                      <th className="py-1 sm:py-1.5 text-center font-medium">Appeared</th>
                      <th className="py-1 sm:py-1.5 text-center font-medium">Pass</th>
                      <th className="py-1 sm:py-1.5 text-center font-medium">Fail</th>
                      <th className="py-1 sm:py-1.5 text-right font-medium">Pass %</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {internalExamPerformanceList.map((e, i) => (
                      <tr key={i} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-1.5 sm:py-2 font-semibold text-slate-800 whitespace-nowrap max-w-[110px] sm:max-w-none truncate">
                          {e.subject}
                        </td>
                        <td className="py-1.5 sm:py-2 text-center text-slate-600 font-medium">
                          {e.appeared}
                        </td>
                        <td className="py-1.5 sm:py-2 text-center text-slate-700 font-medium">
                          {e.pass}
                        </td>
                        <td className="py-1.5 sm:py-2 text-center text-rose-500 font-bold">
                          {e.fail}
                        </td>
                        <td className="py-1.5 sm:py-2 text-right font-bold text-slate-800">
                          {e.passPct}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Card F: Students Requiring Attention */}
        <div className="rounded-xl sm:rounded-2xl border border-slate-200/90 bg-white p-3 sm:p-4 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-2.5 sm:pb-3 border-b border-slate-100">
              <h2 className="text-xs sm:text-sm font-bold text-slate-900 flex items-center gap-1.5 sm:gap-2">
                <Users className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-rose-500" />
                Students Requiring Attention
              </h2>
              <Link
                href="/students"
                className="text-[11px] sm:text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-0.5 transition-colors"
              >
                View All &gt;
              </Link>
            </div>

            {/* Filter Pills */}
            <div className="mt-2.5 sm:mt-3 flex flex-wrap items-center gap-1 sm:gap-1.5">
              <button
                type="button"
                onClick={() => setActiveAttentionTab("low_attendance")}
                className={cn(
                  "px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-md text-[10px] sm:text-[11px] font-bold transition-all flex items-center gap-1",
                  activeAttentionTab === "low_attendance"
                    ? "bg-rose-500 text-white shadow-2xs"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                )}
              >
                Low Attendance (&lt; 65%)
                <span
                  className={cn(
                    "px-1 py-0.2 rounded-full text-[8.5px] sm:text-[9px]",
                    activeAttentionTab === "low_attendance"
                      ? "bg-rose-600 text-white"
                      : "bg-slate-200 text-slate-700"
                  )}
                >
                  {data?.studentsRequiringAttention?.lowAttendance?.length || 0}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveAttentionTab("failed_int1")}
                className={cn(
                  "px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-md text-[10px] sm:text-[11px] font-semibold transition-all flex items-center gap-1",
                  activeAttentionTab === "failed_int1"
                    ? "bg-rose-500 text-white shadow-2xs"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                )}
              >
                Failed Internal-I
                <span
                  className={cn(
                    "px-1 py-0.2 rounded-full text-[8.5px] sm:text-[9px]",
                    activeAttentionTab === "failed_int1"
                      ? "bg-rose-600 text-white"
                      : "bg-slate-200 text-slate-700"
                  )}
                >
                  {data?.studentsRequiringAttention?.failedInternal1?.length || 0}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveAttentionTab("failed_int2")}
                className={cn(
                  "px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-md text-[10px] sm:text-[11px] font-semibold transition-all flex items-center gap-1",
                  activeAttentionTab === "failed_int2"
                    ? "bg-rose-500 text-white shadow-2xs"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                )}
              >
                Failed Internal-II
                <span
                  className={cn(
                    "px-1 py-0.2 rounded-full text-[8.5px] sm:text-[9px]",
                    activeAttentionTab === "failed_int2"
                      ? "bg-rose-600 text-white"
                      : "bg-slate-200 text-slate-700"
                  )}
                >
                  {data?.studentsRequiringAttention?.failedInternal2?.length || 0}
                </span>
              </button>
            </div>

            {attentionList.length === 0 ? (
              <div className="py-6 sm:py-8 text-center text-[11px] sm:text-xs text-slate-400">
                No students currently flagged in this category.
              </div>
            ) : (
              <div className="mt-2.5 sm:mt-3 overflow-x-auto max-h-64">
                <table className="w-full text-left text-[11px] sm:text-xs">
                  <thead>
                    <tr className="text-slate-400 font-semibold border-b border-slate-100 pb-1.5 text-[10px] sm:text-xs">
                      <th className="py-1 sm:py-1.5 font-medium">Roll No</th>
                      <th className="py-1 sm:py-1.5 font-medium">Name</th>
                      <th className="py-1 sm:py-1.5 font-medium">Subject</th>
                      <th className="py-1 sm:py-1.5 text-center font-medium">
                        {activeAttentionTab === "low_attendance" ? "Attendance" : "Score"}
                      </th>
                      <th className="py-1 sm:py-1.5 text-right font-medium">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {attentionList.map((st, i) => (
                      <tr key={i} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-1.5 sm:py-2 text-slate-600 font-mono text-[10px] sm:text-[11px]">
                          {st.rollNo}
                        </td>
                        <td className="py-1.5 sm:py-2 font-semibold text-slate-800 whitespace-nowrap max-w-[100px] sm:max-w-none truncate">
                          {st.name}
                        </td>
                        <td className="py-1.5 sm:py-2 text-slate-600 font-medium whitespace-nowrap max-w-[90px] sm:max-w-none truncate">
                          {st.subject}
                        </td>
                        <td className="py-1.5 sm:py-2 text-center font-bold text-rose-500">
                          {st.metric}
                        </td>
                        <td className="py-1.5 sm:py-2 text-right">
                          <button
                            type="button"
                            onClick={() =>
                              setSelectedStudent({
                                rollNo: st.rollNo,
                                name: st.name,
                                subject: st.subject,
                                metric: st.metric,
                                status: st.status,
                              })
                            }
                            className="px-1.5 py-0.5 sm:px-2 sm:py-0.5 rounded text-[10px] sm:text-[11px] font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 transition-colors cursor-pointer"
                          >
                            View
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 5. ROW 4 — PENDING WORK | MY SUBJECT STUDENTS OVERVIEW | UPCOMING EXAMS / DEADLINES */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3.5 sm:gap-4">
        {/* Card G: Pending Work */}
        <div className="rounded-xl sm:rounded-2xl border border-slate-200/90 bg-white p-3 sm:p-4 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-2.5 sm:pb-3 border-b border-slate-100">
              <h2 className="text-xs sm:text-sm font-bold text-slate-900 flex items-center gap-1.5 sm:gap-2">
                <GraduationCap className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-purple-600" />
                Pending Work
              </h2>
            </div>

            {pendingWorkItems.length === 0 ? (
              <div className="py-6 sm:py-8 text-center text-[11px] sm:text-xs text-slate-400">
                No pending work items. You are all caught up!
              </div>
            ) : (
              <div className="mt-2.5 sm:mt-3 space-y-2 sm:space-y-2.5">
                {pendingWorkItems.map((pw, i) => (
                  <Link
                    key={i}
                    href={pw.href}
                    className="flex items-center justify-between p-1.5 sm:p-2 rounded-xl border border-slate-100 hover:border-slate-200 hover:bg-slate-50/80 transition-all group"
                  >
                    <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                      <span
                        className={cn(
                          "flex h-6 w-6 sm:h-7 sm:w-7 shrink-0 items-center justify-center rounded-full text-white text-[11px] sm:text-xs font-bold shadow-2xs",
                          pw.badgeBg
                        )}
                      >
                        {pw.count}
                      </span>
                      <span className="text-[11px] sm:text-xs font-semibold text-slate-700 group-hover:text-slate-900 truncate">
                        {pw.label}
                      </span>
                    </div>
                    <ChevronRight className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-slate-400 group-hover:text-slate-600 transition-colors shrink-0 ml-1" />
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Card H: My Subject Students Overview */}
        <div className="rounded-xl sm:rounded-2xl border border-slate-200/90 bg-white p-3 sm:p-4 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-2.5 sm:pb-3 border-b border-slate-100">
              <h2 className="text-xs sm:text-sm font-bold text-slate-900 flex items-center gap-1.5 sm:gap-2">
                <Users className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-blue-600" />
                My Subject Students Overview
              </h2>
              <Link
                href="/students"
                className="text-[11px] sm:text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-0.5 transition-colors"
              >
                View All &gt;
              </Link>
            </div>

            {studentsOverviewList.length === 0 ? (
              <div className="py-6 sm:py-8 text-center text-[11px] sm:text-xs text-slate-400">
                No subject student rosters available.
              </div>
            ) : (
              <div className="mt-2.5 sm:mt-3 overflow-x-auto max-h-64">
                <table className="w-full text-left text-[11px] sm:text-xs">
                  <thead>
                    <tr className="text-slate-400 font-semibold border-b border-slate-100 pb-1.5 text-[10px] sm:text-xs">
                      <th className="py-1 sm:py-1.5 font-medium">Subject</th>
                      <th className="py-1 sm:py-1.5 text-center font-medium">Total</th>
                      <th className="py-1 sm:py-1.5 text-center font-medium">At Risk (&lt;65%)</th>
                      <th className="py-1 sm:py-1.5 text-center font-medium">Failed I</th>
                      <th className="py-1 sm:py-1.5 text-center font-medium">Failed II</th>
                      <th className="py-1 sm:py-1.5 text-right font-medium">Passed</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {studentsOverviewList.map((st, i) => (
                      <tr key={i} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-1.5 sm:py-2.5 font-semibold text-slate-800 whitespace-nowrap max-w-[110px] sm:max-w-none truncate">
                          {st.subject}
                        </td>
                        <td className="py-1.5 sm:py-2.5 text-center text-slate-600 font-medium">
                          {st.total}
                        </td>
                        <td className="py-1.5 sm:py-2.5 text-center text-rose-500 font-bold">
                          {st.atRisk}
                        </td>
                        <td className="py-1.5 sm:py-2.5 text-center text-rose-500 font-bold">
                          {st.failed1}
                        </td>
                        <td className="py-1.5 sm:py-2.5 text-center text-rose-500 font-bold">
                          {st.failed2}
                        </td>
                        <td className="py-1.5 sm:py-2.5 text-right font-bold text-emerald-600">
                          {st.passed}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Card I: Upcoming Exams / Deadlines */}
        <div className="rounded-xl sm:rounded-2xl border border-slate-200/90 bg-white p-3 sm:p-4 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-2.5 sm:pb-3 border-b border-slate-100">
              <h2 className="text-xs sm:text-sm font-bold text-slate-900 flex items-center gap-1.5 sm:gap-2">
                <Calendar className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-purple-600" />
                Upcoming Exams / Deadlines
              </h2>
              <Link
                href="/examinations"
                className="text-[11px] sm:text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-0.5 transition-colors"
              >
                View All &gt;
              </Link>
            </div>

            {upcomingDeadlinesList.length === 0 ? (
              <div className="py-6 sm:py-8 text-center text-[11px] sm:text-xs text-slate-400">
                No upcoming exams or calendar deadlines scheduled.
              </div>
            ) : (
              <div className="mt-2.5 sm:mt-3 space-y-2 sm:space-y-3">
                {upcomingDeadlinesList.map((d, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between gap-2 p-1 sm:p-1.5 rounded-xl hover:bg-slate-50/70 transition-colors"
                  >
                    <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                      {/* Date Block */}
                      <div className="flex flex-col items-center justify-center h-8 w-8 sm:h-11 sm:w-11 rounded-lg sm:rounded-xl bg-blue-50/80 text-blue-700 shrink-0 font-bold leading-none border border-blue-100">
                        <span className="text-xs sm:text-base font-black">{d.day}</span>
                        <span className="text-[8px] sm:text-[10px] uppercase font-semibold text-blue-600">
                          {d.month}
                        </span>
                      </div>

                      <div className="min-w-0">
                        <p className="text-[11px] sm:text-xs font-bold text-slate-800 truncate leading-tight">
                          {d.title}
                        </p>
                        <p className="text-[10px] sm:text-[11px] font-medium text-slate-500 truncate mt-0.5">
                          {d.subtitle}
                        </p>
                      </div>
                    </div>

                    <span className="shrink-0 px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-md text-[9.5px] sm:text-[10.5px] font-bold bg-purple-50 text-purple-700 border border-purple-200/70">
                      {d.countdown}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* QUICK VIEW STUDENT MODAL */}
      {selectedStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-2xs p-3 sm:p-4">
          <div className="w-full max-w-md rounded-xl sm:rounded-2xl bg-white p-3.5 sm:p-5 shadow-xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-2.5 sm:pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-full bg-rose-100 text-rose-700 font-bold text-[11px] sm:text-xs">
                  {selectedStudent.name.charAt(0)}
                </div>
                <div>
                  <h3 className="text-xs sm:text-sm font-bold text-slate-900">{selectedStudent.name}</h3>
                  <p className="text-[10px] sm:text-xs text-slate-500 font-mono">{selectedStudent.rollNo}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedStudent(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="py-3 sm:py-4 space-y-2 sm:space-y-3 text-[11px] sm:text-xs">
              <div className="flex justify-between p-2 sm:p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                <span className="text-slate-500 font-medium">Subject</span>
                <span className="font-bold text-slate-800">{selectedStudent.subject}</span>
              </div>
              <div className="flex justify-between p-2 sm:p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                <span className="text-slate-500 font-medium">Current Status</span>
                <span className="font-bold text-rose-600">{selectedStudent.status}</span>
              </div>
              {selectedStudent.metric && (
                <div className="flex justify-between p-2 sm:p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                  <span className="text-slate-500 font-medium">Metric Score</span>
                  <span className="font-bold text-slate-800">{selectedStudent.metric}</span>
                </div>
              )}
              <div className="flex justify-between p-2 sm:p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                <span className="text-slate-500 font-medium">Recommended Action</span>
                <span className="font-medium text-slate-700">Counseling & Mentoring session</span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setSelectedStudent(null)}
                className="px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-lg text-[11px] sm:text-xs font-semibold text-slate-600 hover:bg-slate-100"
              >
                Close
              </button>
              <Link
                href={`/students?search=${encodeURIComponent(selectedStudent.rollNo)}`}
                className="px-3 py-1 sm:px-3.5 sm:py-1.5 rounded-lg text-[11px] sm:text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 shadow-2xs"
              >
                View Full Student Profile
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
