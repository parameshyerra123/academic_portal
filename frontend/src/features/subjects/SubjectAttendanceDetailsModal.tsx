"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  BookOpen,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ClipboardCheck,
  Clock,
  Download,
  Filter,
  FlaskConical,
  GraduationCap,
  Info,
  Search,
  UserCheck,
  UserX,
  Users,
  X,
  AlertTriangle,
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";

export type SubjectAttendanceDetailsData = {
  subject: {
    id: number;
    code: string;
    name: string;
    type: string | null;
    slotType: string | null;
  };
  context: {
    collegeId: number | null;
    collegeName: string | null;
    courseId: number | null;
    courseName: string | null;
    branchId: number | null;
    branchName: string | null;
    batch: string | null;
    yearOfStudy: number | null;
    semesterNumber: number | null;
    sectionName: string | null;
    academicYear: string | null;
    facultyName: string | null;
  };
  academicWindow: {
    startDate: string | null;
    endDate: string | null;
    attendanceEndDate: string | null;
    label: string;
    source: string;
    totalInstructionalDays?: number;
  };
  metrics: {
    totalStudents: number;
    totalClassesConducted: number;
    averageAttendancePct: number;
    goodStandingCount: number;
    warningCount: number;
    criticalCount: number;
    eligiblePct: number;
  };
  sessionsSummary: Array<{
    sessionId: number;
    sessionDate: string;
    startTime: string | null;
    endTime: string | null;
    slotLabel?: string | null;
    roomLabel?: string | null;
    status: string;
    presentCount: number;
    absentCount: number;
    totalCount: number;
  }>;
  students: Array<{
    studentId: number;
    admissionNumber: string;
    pinNo: string | null;
    studentName: string;
    hasPhoto: boolean;
    photoUrl?: string | null;
    totalConducted: number;
    presentCount: number;
    absentCount: number;
    odCount: number;
    leaveCount: number;
    attendancePct: number;
    status: "good" | "warning" | "critical";
    overallSemesterAttendancePct?: number | null;
    recentMarks: Array<{
      sessionDate: string;
      slotLabel?: string | null;
      status: "present" | "absent" | "od" | "leave";
    }>;
  }>;
};

type Props = {
  subjectId: number;
  subjectName: string;
  subjectCode: string;
  sectionName?: string | null;
  branchId?: number | null;
  branchName?: string | null;
  academicYear?: string | null;
  semesterNumber?: number | null;
  yearOfStudy?: number | null;
  batch?: string | null;
  isLab?: boolean;
  onClose: () => void;
};

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    return d.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

export function SubjectAttendanceDetailsModal({
  subjectId,
  subjectName,
  subjectCode,
  sectionName,
  branchId,
  branchName,
  academicYear,
  semesterNumber,
  yearOfStudy,
  batch,
  isLab,
  onClose,
}: Props) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<SubjectAttendanceDetailsData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "good" | "shortage">("all");
  const [sortBy, setSortBy] = useState<"roll" | "name" | "pct_desc" | "pct_asc">("roll");
  const [showSessions, setShowSessions] = useState(false);

  useEffect(() => {
    let active = true;
    async function loadData() {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({
          subjectId: String(subjectId),
        });
        if (sectionName && sectionName !== "All Sections") {
          params.append("sectionName", sectionName);
        }
        if (branchId) params.append("branchId", String(branchId));
        if (academicYear) params.append("academicYear", academicYear);
        if (semesterNumber) params.append("semesterNumber", String(semesterNumber));
        if (yearOfStudy) params.append("yearOfStudy", String(yearOfStudy));
        if (batch) params.append("batch", batch);

        const res = await apiFetch(`/faculty/subject-attendance-details?${params.toString()}`);
        if (!res.ok) {
          const errJson = await res.json().catch(() => ({}));
          throw new Error(
            (errJson as { message?: string }).message ||
              "Failed to load student attendance details",
          );
        }
        const json = (await res.json()) as SubjectAttendanceDetailsData;
        if (active) {
          setData(json);
        }
      } catch (err) {
        if (active) {
          setError((err as Error).message || "Failed to load student attendance details");
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    loadData();
    return () => {
      active = false;
    };
  }, [subjectId, sectionName, branchId, academicYear, semesterNumber, yearOfStudy, batch]);

  const filteredStudents = useMemo(() => {
    if (!data?.students) return [];
    let list = [...data.students];

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (s) =>
          s.studentName.toLowerCase().includes(q) ||
          (s.pinNo && s.pinNo.toLowerCase().includes(q)) ||
          s.admissionNumber.toLowerCase().includes(q),
      );
    }

    if (statusFilter === "good") {
      list = list.filter((s) => s.attendancePct >= 75);
    } else if (statusFilter === "shortage") {
      list = list.filter((s) => s.attendancePct < 75);
    }

    list.sort((a, b) => {
      if (sortBy === "pct_desc") return b.attendancePct - a.attendancePct;
      if (sortBy === "pct_asc") return a.attendancePct - b.attendancePct;
      if (sortBy === "name") return a.studentName.localeCompare(b.studentName);
      // default: roll / pin
      const rollA = a.pinNo || a.admissionNumber;
      const rollB = b.pinNo || b.admissionNumber;
      return rollA.localeCompare(rollB);
    });

    return list;
  }, [data?.students, search, statusFilter, sortBy]);

  const exportCsv = () => {
    if (!data || !data.students.length) return;
    const headers = [
      "Roll No / PIN",
      "Admission No",
      "Student Name",
      "Conducted Classes",
      "Present Classes",
      "Absent Classes",
      "OD Classes",
      "Subject Attendance %",
      "Status",
    ];
    const rows = filteredStudents.map((s) => [
      `"${s.pinNo || "—"}"`,
      `"${s.admissionNumber}"`,
      `"${s.studentName.replace(/"/g, '""')}"`,
      s.totalConducted,
      s.presentCount,
      s.absentCount,
      s.odCount,
      `${s.attendancePct}%`,
      s.attendancePct >= 75 ? "Eligible" : "Attendance Shortage",
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute(
      "download",
      `${subjectCode}_${sectionName || "Section"}_Attendance_${new Date().toISOString().slice(0, 10)}.csv`,
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-2 sm:p-4 animate-in fade-in duration-200">
      <div
        className="fixed inset-0 cursor-default"
        onClick={onClose}
        aria-hidden="true"
      />

      <div className="relative flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-border bg-white shadow-2xl">
        {/* MODAL HEADER */}
        <div className="flex shrink-0 items-start justify-between border-b border-border bg-slate-50/80 px-5 py-4">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={cn(
                  "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold border",
                  isLab
                    ? "bg-purple-50 text-purple-700 border-purple-200"
                    : "bg-blue-50 text-blue-700 border-blue-200",
                )}
              >
                {isLab ? <FlaskConical className="h-3 w-3" /> : <BookOpen className="h-3 w-3" />}
                <span>{isLab ? "Lab / Practical" : "Theory Subject"}</span>
              </span>
              <span className="text-xs font-mono font-bold text-slate-600 bg-slate-200/80 px-2 py-0.5 rounded">
                {subjectCode}
              </span>
              <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-bold text-emerald-700 border border-emerald-200">
                {sectionName || "Section A"} {batch ? `· ${batch}` : ""}
              </span>
            </div>
            <h2 className="text-lg sm:text-xl font-bold text-navy-900 leading-tight">
              {subjectName}
            </h2>
            <p className="text-xs text-slate-500">
              {branchName || "Branch"} · Year {yearOfStudy || "—"} Sem {semesterNumber || "—"} · Academic Year {academicYear || "2026-2027"}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href={`/attendance-posting?subjectId=${subjectId}&section=${encodeURIComponent(sectionName || "")}`}
            >
              <Button size="sm" variant="primary" className="h-8.5 gap-1.5 text-xs font-semibold shadow-xs">
                <ClipboardCheck className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Post Attendance</span>
              </Button>
            </Link>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700 transition-colors"
              title="Close modal"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* MODAL BODY */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          {loading ? (
            <div className="space-y-4 py-8">
              <div className="h-16 rounded-xl bg-slate-100 animate-pulse" />
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="h-20 rounded-xl bg-slate-100 animate-pulse" />
                ))}
              </div>
              <div className="h-64 rounded-xl bg-slate-100 animate-pulse" />
            </div>
          ) : error ? (
            <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center text-red-700">
              <AlertTriangle className="mx-auto h-8 w-8 text-red-500 mb-2" />
              <p className="text-sm font-semibold">{error}</p>
              <Button size="sm" variant="secondary" className="mt-3 text-xs" onClick={() => window.location.reload()}>
                Retry
              </Button>
            </div>
          ) : data ? (
            <>
              {/* 1. Academic Window Context Card */}
              <div className="rounded-xl border border-brand-200/80 bg-linear-to-r from-emerald-50/70 via-teal-50/50 to-blue-50/50 p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-600 text-white shadow-xs">
                    <Calendar className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-xs font-bold uppercase tracking-wider text-brand-800">
                        Academic Calendar Window
                      </p>
                      <span className="rounded-full bg-brand-100 px-2 py-0.2 text-[10px] font-bold text-brand-800">
                        {data.academicWindow.source.includes("student_database") ? "Official Semester Dates" : "Active Window"}
                      </span>
                    </div>
                    <p className="text-sm font-bold text-navy-900 mt-0.5">
                      {formatDate(data.academicWindow.startDate)} &nbsp;→&nbsp; {formatDate(data.academicWindow.endDate)}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-xs text-slate-600 border-t sm:border-t-0 sm:border-l border-slate-200/80 pt-2 sm:pt-0 sm:pl-4">
                  <div>
                    <span className="block text-[10px] text-slate-400 font-medium uppercase">Attendance Tracked Up To</span>
                    <strong className="font-semibold text-navy-900">{formatDate(data.academicWindow.attendanceEndDate)}</strong>
                  </div>
                </div>
              </div>

              {/* 2. Key Summary KPIs */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
                <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-2xs">
                  <div className="flex items-center gap-1.5 text-slate-500 text-xs font-medium">
                    <Users className="h-3.5 w-3.5 text-cyan-600" />
                    <span>Enrolled</span>
                  </div>
                  <p className="text-xl sm:text-2xl font-black text-navy-900 mt-1">
                    {data.metrics.totalStudents}
                  </p>
                  <p className="text-[10px] text-slate-400">In this class</p>
                </div>

                <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-2xs">
                  <div className="flex items-center gap-1.5 text-slate-500 text-xs font-medium">
                    <Clock className="h-3.5 w-3.5 text-amber-600" />
                    <span>Conducted</span>
                  </div>
                  <p className="text-xl sm:text-2xl font-black text-navy-900 mt-1">
                    {data.metrics.totalClassesConducted}
                  </p>
                  <p className="text-[10px] text-slate-400">Classes posted</p>
                </div>

                <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-2xs">
                  <div className="flex items-center gap-1.5 text-slate-500 text-xs font-medium">
                    <GraduationCap className="h-3.5 w-3.5 text-blue-600" />
                    <span>Avg Attendance</span>
                  </div>
                  <p className="text-xl sm:text-2xl font-black text-navy-900 mt-1">
                    {data.metrics.averageAttendancePct}%
                  </p>
                  <p className="text-[10px] text-slate-400">Class average</p>
                </div>

                <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-2xs">
                  <div className="flex items-center gap-1.5 text-emerald-600 text-xs font-medium">
                    <UserCheck className="h-3.5 w-3.5" />
                    <span>Eligible (&ge;75%)</span>
                  </div>
                  <p className="text-xl sm:text-2xl font-black text-emerald-700 mt-1">
                    {data.metrics.goodStandingCount}
                  </p>
                  <p className="text-[10px] text-slate-400">{data.metrics.eligiblePct}% of class</p>
                </div>

                <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-2xs col-span-2 sm:col-span-1">
                  <div className="flex items-center gap-1.5 text-rose-600 text-xs font-medium">
                    <UserX className="h-3.5 w-3.5" />
                    <span>Shortage (&lt;75%)</span>
                  </div>
                  <p className="text-xl sm:text-2xl font-black text-rose-600 mt-1">
                    {data.metrics.warningCount + data.metrics.criticalCount}
                  </p>
                  <p className="text-[10px] text-rose-500">Requires attention</p>
                </div>
              </div>

              {/* Notice when no slot sessions conducted yet */}
              {data.metrics.totalClassesConducted === 0 && (
                <div className="rounded-xl border border-dashed border-amber-300 bg-amber-50/70 p-3.5 text-xs text-amber-900 flex items-start gap-2.5">
                  <Info className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold text-amber-950">No slot sessions posted yet for this subject</p>
                    <p className="text-amber-800 text-[11px] mt-0.5">
                      Timetable slots conducted in this academic session will appear here once attendance is taken. Use the <strong>Post Attendance</strong> button above to record attendance for today's scheduled slot.
                    </p>
                  </div>
                </div>
              )}

              {/* 3. Collapsible Sessions History (if any) */}
              {data.sessionsSummary.length > 0 && (
                <div className="rounded-xl border border-slate-200 bg-slate-50/70 overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setShowSessions(!showSessions)}
                    className="flex w-full items-center justify-between px-3.5 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-100 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <Clock className="h-3.5 w-3.5 text-brand-600" />
                      <span>
                        Posted Timetable Slots ({data.sessionsSummary.length} conducted sessions)
                      </span>
                    </div>
                    {showSessions ? (
                      <ChevronUp className="h-4 w-4 text-slate-400" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-slate-400" />
                    )}
                  </button>

                  {showSessions && (
                    <div className="p-3 border-t border-slate-200 bg-white max-h-48 overflow-y-auto">
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 text-xs">
                        {data.sessionsSummary.map((sess) => (
                          <div
                            key={sess.sessionId}
                            className="rounded-lg border border-slate-100 bg-slate-50 p-2.5 flex items-center justify-between"
                          >
                            <div>
                              <span className="font-bold text-navy-900 block">
                                {formatDate(sess.sessionDate)}
                              </span>
                              <span className="text-[10px] text-slate-500 font-medium">
                                {sess.slotLabel || `${sess.startTime?.slice(0, 5)} - ${sess.endTime?.slice(0, 5)}`}
                                {sess.roomLabel ? ` · ${sess.roomLabel}` : ""}
                              </span>
                            </div>
                            <div className="text-right">
                              <span className="text-[11px] font-bold text-emerald-700">
                                {sess.presentCount} P
                              </span>
                              &nbsp;·&nbsp;
                              <span className="text-[11px] font-bold text-rose-600">
                                {sess.absentCount} A
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* 4. Filter Toolbar */}
              <div className="flex flex-wrap items-center justify-between gap-2.5 pt-1">
                <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[240px]">
                  <div className="relative flex-1 min-w-[180px] sm:max-w-xs">
                    <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
                    <input
                      type="text"
                      placeholder="Search Roll No, PIN, Name..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="h-8.5 w-full rounded-lg border border-slate-200 pl-8 pr-3 text-xs font-medium text-slate-700 outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
                    />
                  </div>

                  {/* Filter chips */}
                  <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5 text-xs font-medium">
                    <button
                      type="button"
                      onClick={() => setStatusFilter("all")}
                      className={cn(
                        "rounded-md px-2.5 py-1 text-xs font-semibold transition-all",
                        statusFilter === "all"
                          ? "bg-white text-navy-900 shadow-2xs font-bold"
                          : "text-slate-600 hover:text-navy-900",
                      )}
                    >
                      All ({data.students.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setStatusFilter("good")}
                      className={cn(
                        "rounded-md px-2.5 py-1 text-xs font-semibold transition-all",
                        statusFilter === "good"
                          ? "bg-white text-emerald-700 shadow-2xs font-bold"
                          : "text-slate-600 hover:text-navy-900",
                      )}
                    >
                      &ge;75% ({data.metrics.goodStandingCount})
                    </button>
                    <button
                      type="button"
                      onClick={() => setStatusFilter("shortage")}
                      className={cn(
                        "rounded-md px-2.5 py-1 text-xs font-semibold transition-all",
                        statusFilter === "shortage"
                          ? "bg-white text-rose-600 shadow-2xs font-bold"
                          : "text-slate-600 hover:text-navy-900",
                      )}
                    >
                      &lt;75% ({data.metrics.warningCount + data.metrics.criticalCount})
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as any)}
                    className="h-8.5 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-700 outline-none focus:border-brand-500"
                  >
                    <option value="roll">Sort by Roll / PIN</option>
                    <option value="name">Sort by Name</option>
                    <option value="pct_desc">Attendance: High to Low</option>
                    <option value="pct_asc">Attendance: Low to High</option>
                  </select>

                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={exportCsv}
                    className="h-8.5 gap-1.5 text-xs font-semibold"
                    title="Export to CSV"
                  >
                    <Download className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Export CSV</span>
                  </Button>
                </div>
              </div>

              {/* 5. Student List Table */}
              <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-2xs">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500 border-b border-border">
                      <th className="px-3.5 py-3">#</th>
                      <th className="px-3.5 py-3">Student</th>
                      <th className="px-3.5 py-3 text-center">Conducted</th>
                      <th className="px-3.5 py-3 text-center text-emerald-700">Present</th>
                      <th className="px-3.5 py-3 text-center text-rose-600">Absent</th>
                      <th className="px-3.5 py-3 text-center">OD / Leave</th>
                      <th className="px-3.5 py-3 text-center">Subject Attendance %</th>
                      <th className="px-3.5 py-3 text-center">Recent Sessions</th>
                      <th className="px-3.5 py-3 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredStudents.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="px-4 py-8 text-center text-slate-400">
                          No students match the selected filter.
                        </td>
                      </tr>
                    ) : (
                      filteredStudents.map((st, idx) => {
                        const isGood = st.attendancePct >= 75;
                        const isWarning = st.attendancePct >= 65 && st.attendancePct < 75;

                        return (
                          <tr
                            key={st.studentId}
                            className={cn(
                              "hover:bg-slate-50/80 transition-colors",
                              !isGood && "bg-rose-50/20",
                            )}
                          >
                            <td className="px-3.5 py-2.5 text-slate-400 font-mono text-[11px]">
                              {idx + 1}
                            </td>

                            <td className="px-3.5 py-2.5">
                              <div className="flex items-center gap-2.5">
                                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-navy-100 font-bold text-navy-800 text-xs">
                                  {st.studentName.charAt(0)}
                                </div>
                                <div>
                                  <p className="font-bold text-navy-900 leading-tight">
                                    {st.studentName}
                                  </p>
                                  <div className="flex items-center gap-1.5 text-[10px] font-mono mt-0.5">
                                    <span className="font-bold text-brand-700">
                                      {st.pinNo || st.admissionNumber}
                                    </span>
                                    {st.pinNo && st.admissionNumber && (
                                      <span className="text-slate-400">· {st.admissionNumber}</span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </td>

                            <td className="px-3.5 py-2.5 text-center font-bold text-slate-600">
                              {st.totalConducted}
                            </td>

                            <td className="px-3.5 py-2.5 text-center font-bold text-emerald-700">
                              {st.presentCount}
                            </td>

                            <td className="px-3.5 py-2.5 text-center font-bold text-rose-600">
                              {st.absentCount}
                            </td>

                            <td className="px-3.5 py-2.5 text-center font-medium text-slate-500">
                              {st.odCount > 0 ? `${st.odCount} OD` : st.leaveCount > 0 ? `${st.leaveCount} L` : "—"}
                            </td>

                            {/* Percentage + Progress bar */}
                            <td className="px-3.5 py-2.5 text-center">
                              {st.totalConducted === 0 ? (
                                <span className="text-[11px] font-semibold text-slate-400 italic">
                                  Not Conducted
                                </span>
                              ) : (
                                <div className="flex flex-col items-center gap-1">
                                  <span
                                    className={cn(
                                      "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-black",
                                      isGood
                                        ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                        : isWarning
                                          ? "bg-amber-50 text-amber-700 border border-amber-200"
                                          : "bg-rose-50 text-rose-700 border border-rose-200",
                                    )}
                                  >
                                    {st.attendancePct}%
                                  </span>
                                  <div className="h-1.5 w-16 overflow-hidden rounded-full bg-slate-100">
                                    <div
                                      className={cn(
                                        "h-full rounded-full transition-all",
                                        isGood
                                          ? "bg-emerald-500"
                                          : isWarning
                                            ? "bg-amber-500"
                                            : "bg-rose-500",
                                      )}
                                      style={{ width: `${Math.min(100, st.attendancePct)}%` }}
                                    />
                                  </div>
                                </div>
                              )}
                            </td>

                            {/* Recent Sessions Dots */}
                            <td className="px-3.5 py-2.5 text-center">
                              {st.recentMarks.length === 0 ? (
                                <span className="text-[10px] text-slate-400">—</span>
                              ) : (
                                <div className="inline-flex items-center gap-1">
                                  {st.recentMarks.slice(0, 6).map((rm, mIdx) => (
                                    <span
                                      key={mIdx}
                                      title={`${formatDate(rm.sessionDate)}${rm.slotLabel ? ` (${rm.slotLabel})` : ""}: ${rm.status.toUpperCase()}`}
                                      className={cn(
                                        "h-3.5 w-3.5 rounded-full flex items-center justify-center text-[9px] font-bold text-white",
                                        rm.status === "present"
                                          ? "bg-emerald-500"
                                          : rm.status === "od"
                                            ? "bg-blue-500"
                                            : "bg-rose-500",
                                      )}
                                    >
                                      {rm.status === "present"
                                        ? "P"
                                        : rm.status === "od"
                                          ? "O"
                                          : "A"}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </td>

                            {/* Standing Status */}
                            <td className="px-3.5 py-2.5 text-right">
                              {st.totalConducted === 0 ? (
                                <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-500">
                                  Pending Classes
                                </span>
                              ) : (
                                <span
                                  className={cn(
                                    "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold",
                                    isGood
                                      ? "bg-emerald-100/70 text-emerald-800"
                                      : isWarning
                                        ? "bg-amber-100/70 text-amber-800"
                                        : "bg-rose-100/70 text-rose-800",
                                  )}
                                >
                                  {isGood ? (
                                    <>
                                      <CheckCircle2 className="h-3 w-3" />
                                      <span>Eligible</span>
                                    </>
                                  ) : (
                                    <>
                                      <AlertTriangle className="h-3 w-3" />
                                      <span>Shortage</span>
                                    </>
                                  )}
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </>
          ) : null}
        </div>

        {/* MODAL FOOTER */}
        <div className="flex shrink-0 items-center justify-between border-t border-border bg-slate-50 px-5 py-3">
          <p className="text-xs text-slate-500">
            Showing {filteredStudents.length} of {data?.students.length || 0} students enrolled in this subject.
          </p>
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
