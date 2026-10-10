"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatCard } from "@/components/ui/StatCard";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Button } from "@/components/ui/Button";
import { StatCardSkeleton } from "@/components/ui/CardSkeleton";
import { TableSkeleton } from "@/components/ui/TableSkeleton";
import { apiFetch } from "@/lib/api";
import { FacultyAvatar } from "@/components/ui/FacultyAvatar";
import {
  Printer,
  ChevronDown,
  ChevronUp,
  BookOpen,
  Calendar,
  Users,
  CheckCircle2,
  Clock,
  Filter,
} from "lucide-react";
import { escapeHtml, printHtml } from "@/lib/print-service";
import type { AttendanceSessionCard } from "@/features/attendance-posting/AttendanceTodayView";

function todayIso() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

const selectClassName =
  "h-9 w-full sm:w-auto rounded-md border border-border bg-white px-2.5 text-xs text-navy-900 outline-none focus:border-brand-600 sm:min-w-[140px]";

const searchClassName =
  "h-9 w-full sm:w-auto rounded-md border border-border bg-white px-2.5 text-xs text-navy-900 outline-none focus:border-brand-600 sm:min-w-[200px]";

export type FacultyLoad = {
  id: string;
  staffLinkId: number;
  hrmsEmployeeId: string;
  code: string;
  name: string;
  department: string;
  division: string;
  profilePhoto?: string | null;
  periodsPerWeek: number;
  hoursPerWeek: number;
  hoursByDay: {
    MON: number;
    TUE: number;
    WED: number;
    THUR: number;
    FRI: number;
    SAT: number;
    SUN: number;
  };
  periodsByDay: {
    MON: number;
    TUE: number;
    WED: number;
    THUR: number;
    FRI: number;
    SAT: number;
    SUN: number;
  };
  status: string;
};

export type WorkloadSummary = {
  kpis: {
    totalFaculty: number;
    averageLoad: number;
    averageHours?: number;
    overloaded: number;
    underloaded: number;
    balanced: number;
  };
  thresholds?: {
    minPeriodsPerWeek: number;
    maxPeriodsPerWeek: number;
    maxPeriodsPerDay: number;
    minHoursPerWeek: number | null;
    maxHoursPerWeek: number | null;
  };
  faculty: FacultyLoad[];
  filterOptions?: {
    divisions: string[];
    departments: string[];
  };
  source?: string;
};

const DAY_COLUMNS = [
  { key: "MON", label: "Mon" },
  { key: "TUE", label: "Tue" },
  { key: "WED", label: "Wed" },
  { key: "THUR", label: "Thu" },
  { key: "FRI", label: "Fri" },
  { key: "SAT", label: "Sat" },
] as const;

function formatDayLoad(row: FacultyLoad, day: (typeof DAY_COLUMNS)[number]["key"]) {
  const periods = row.periodsByDay[day];
  const hours = row.hoursByDay[day];
  if (!periods) return "—";
  return hours > 0 ? `${periods}p · ${hours}h` : `${periods}p`;
}

export function StaffWorkloadView({ embedded = false }: { embedded?: boolean }) {
  const [summary, setSummary] = useState<WorkloadSummary | null>(null);
  const [sessions, setSessions] = useState<AttendanceSessionCard[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>(todayIso());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [freeOnly, setFreeOnly] = useState(false);
  const [searchDraft, setSearchDraft] = useState("");
  const [search, setSearch] = useState("");
  const [divisionFilter, setDivisionFilter] = useState("all");
  const [deptFilter, setDeptFilter] = useState("all");
  const [expandedFacultyId, setExpandedFacultyId] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchDraft.trim()), 300);
    return () => clearTimeout(timer);
  }, [searchDraft]);

  const query = useMemo(() => {
    const params = new URLSearchParams();
    if (divisionFilter !== "all") params.set("division", divisionFilter);
    if (deptFilter !== "all") params.set("department", deptFilter);
    if (search) params.set("search", search);
    return params.toString();
  }, [divisionFilter, deptFilter, search]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [wRes, sRes] = await Promise.all([
          apiFetch(`/workload/summary${query ? `?${query}` : ""}`, { cache: "no-store" }),
          apiFetch(`/attendance/sessions?date=${selectedDate}`, { cache: "no-store" }),
        ]);

        const wBody = await wRes.json().catch(() => ({}));
        const sBody = await sRes.json().catch(() => ({}));

        if (!wRes.ok) {
          throw new Error(
            typeof wBody === "object" && wBody && "message" in wBody
              ? String((wBody as { message: string }).message)
              : "Failed to load workload",
          );
        }

        if (!cancelled) {
          setSummary(wBody as WorkloadSummary);
          if (sRes.ok && sBody?.data) {
            setSessions(sBody.data as AttendanceSessionCard[]);
          } else {
            setSessions([]);
          }
        }
      } catch (err) {
        if (!cancelled) {
          setSummary(null);
          setError(err instanceof Error ? err.message : "Failed to load workload");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [query, selectedDate]);

  const divisionOptions = summary?.filterOptions?.divisions ?? [];
  const deptOptions = summary?.filterOptions?.departments ?? [];

  const faculty = useMemo(() => {
    const rows = summary?.faculty ?? [];
    if (!freeOnly) return rows;
    return rows.filter((row) => row.status === "Underloaded");
  }, [summary, freeOnly]);

  const kpis = summary?.kpis ?? {
    totalFaculty: 0,
    averageLoad: 0,
    averageHours: 0,
    overloaded: 0,
    underloaded: 0,
    balanced: 0,
  };

  const sessionStats = useMemo(() => {
    const totalScheduled = sessions.length;
    const totalPosted = sessions.filter((s) => s.posted).length;
    const totalPresent = sessions.reduce((sum, s) => sum + (s.presentCount ?? 0), 0);
    const totalAbsent = sessions.reduce((sum, s) => sum + (s.absentCount ?? 0), 0);
    const totalEnrolled = totalPresent + totalAbsent;
    const overallStudentPct = totalEnrolled > 0 ? Math.round((totalPresent / totalEnrolled) * 100) : 0;
    return { totalScheduled, totalPosted, totalPresent, totalAbsent, totalEnrolled, overallStudentPct };
  }, [sessions]);

  function printStaffReport() {
    const tableRowsHtml = faculty.map((f) => {
      const fSessions = sessions.filter((s) => s.facultyName === f.name);
      const sched = fSessions.length;
      const posted = fSessions.filter((s) => s.posted).length;
      const present = fSessions.reduce((sum, s) => sum + (s.presentCount ?? 0), 0);
      const absent = fSessions.reduce((sum, s) => sum + (s.absentCount ?? 0), 0);
      const totalStud = present + absent;
      const pct = totalStud > 0 ? `${Math.round((present / totalStud) * 100)}%` : "—";

      const sessionListHtml = fSessions.map((s) => {
        const sEnrolled = (s.presentCount ?? 0) + (s.absentCount ?? 0);
        const sPct = sEnrolled > 0 ? `${Math.round(((s.presentCount ?? 0) / sEnrolled) * 100)}%` : "N/A";
        return `<div>
          <strong>${escapeHtml(s.subjectName || s.subjectCode || "Class")}</strong> (${escapeHtml(s.section || "Sec")}) · ${escapeHtml(s.slotLabel || s.startTime || "")}<br/>
          <small>Status: ${s.posted ? "Attended / Posted" : "Pending"} | Enrolled Students: ${sEnrolled} | Attended: ${s.presentCount ?? 0} (${sPct})</small>
        </div>`;
      }).join("<hr style='border:0;border-top:1px solid #e2e8f0;margin:4px 0;'/>");

      return `<tr>
        <td><strong>${escapeHtml(f.name)}</strong><br/><small>${escapeHtml(f.code || "")}</small></td>
        <td>${escapeHtml(f.department)}</td>
        <td>${f.periodsPerWeek} p/wk</td>
        <td>${sched > 0 ? `${posted} / ${sched} Posted` : "No class scheduled"}</td>
        <td>${totalStud > 0 ? `${present} / ${totalStud} (${pct})` : "—"}</td>
        <td>${sessionListHtml || "<em>No class sessions recorded</em>"}</td>
      </tr>`;
    }).join("");

    printHtml(
      `<table style="width:100%;border-collapse:collapse;font-size:12px;" border="1" cellpadding="6">
        <thead>
          <tr style="background:#f1f5f9;text-align:left;">
            <th>Faculty</th>
            <th>Department</th>
            <th>Workload</th>
            <th>Classes Today</th>
            <th>Students Attended</th>
            <th>Class Session Details</th>
          </tr>
        </thead>
        <tbody>
          ${tableRowsHtml}
        </tbody>
      </table>`,
      {
        title: "Staff Timetable & Attendance Report",
        subtitle: `Date: ${selectedDate} · Total Faculty: ${faculty.length} · Scheduled Classes: ${sessionStats.totalScheduled} · Classes Posted: ${sessionStats.totalPosted}`,
      }
    );
  }

  return (
    <div className="space-y-4">
      {!embedded ? (
        <PageHeader
          title="Staff Timetable & Attendance Reports"
          description={
            summary?.source ||
            "Teaching hours and live class attendance from published timetables across all branches."
          }
          actions={
            <div className="flex items-center gap-2">
              <Button size="sm" variant="secondary" onClick={printStaffReport}>
                <Printer className="mr-1.5 h-4 w-4" />
                Print Staff Report
              </Button>
              <Button
                size="sm"
                variant={freeOnly ? "primary" : "secondary"}
                onClick={() => setFreeOnly((prev) => !prev)}
              >
                {freeOnly ? "Show all faculty" : "Find underloaded faculty"}
              </Button>
            </div>
          }
        />
      ) : null}

      {/* FILTER & DATE CONTROLS BAR (SINGLE ROW) */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 rounded-lg border border-border bg-card p-3">
        <div className="flex flex-wrap items-center gap-2.5 flex-1 min-w-0">
          <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 shrink-0">
            <Calendar className="h-4 w-4 text-brand-600" />
            Date:
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="h-9 rounded-md border border-border bg-white px-2.5 text-xs text-navy-900 outline-none focus:border-brand-600"
            />
          </label>

          <input
            type="search"
            placeholder="Search faculty name, code, or department…"
            className={searchClassName}
            value={searchDraft}
            onChange={(e) => setSearchDraft(e.target.value)}
          />

          <select
            className={selectClassName}
            value={divisionFilter}
            onChange={(e) => setDivisionFilter(e.target.value)}
          >
            <option value="all">All divisions</option>
            {divisionOptions.map((division) => (
              <option key={division} value={division}>
                {division}
              </option>
            ))}
          </select>

          <select
            className={selectClassName}
            value={deptFilter}
            onChange={(e) => setDeptFilter(e.target.value)}
          >
            <option value="all">All departments</option>
            {deptOptions.map((department) => (
              <option key={department} value={department}>
                {department}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button size="sm" variant="secondary" onClick={printStaffReport}>
            <Printer className="mr-1.5 h-4 w-4" />
            Print Report
          </Button>
        </div>
      </div>

      {error ? <p className="text-sm text-critical">{error}</p> : null}

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-2 xl:grid-cols-4 sm:gap-3">
        {loading ? (
          <>
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
          </>
        ) : (
          <>
            <StatCard compact label="Total Faculty" value={kpis.totalFaculty} hint="In active scope" />
            <StatCard
              compact
              label="Classes Today"
              value={sessionStats.totalScheduled}
              hint={`Date: ${selectedDate}`}
              tone="info"
            />
            <StatCard
              compact
              label="Classes Posted"
              value={`${sessionStats.totalPosted} / ${sessionStats.totalScheduled}`}
              hint={sessionStats.totalScheduled > 0 ? `${Math.round((sessionStats.totalPosted / sessionStats.totalScheduled) * 100)}% Conducted` : "No classes"}
              tone={sessionStats.totalPosted === sessionStats.totalScheduled && sessionStats.totalScheduled > 0 ? "success" : "warning"}
            />
            <StatCard
              compact
              label="Attendance Rate"
              value={sessionStats.totalEnrolled > 0 ? `${sessionStats.overallStudentPct}%` : "—"}
              hint={sessionStats.totalEnrolled > 0 ? `${sessionStats.totalPresent} / ${sessionStats.totalEnrolled} Attended` : "Pending posting"}
              tone={sessionStats.overallStudentPct >= 75 ? "success" : "critical"}
            />
          </>
        )}
      </div>

      {loading ? (
        <TableSkeleton columns={7} rows={6} />
      ) : (
        <>

      {/* MOBILE CARD VIEW FOR FACULTY WORKLOAD (Compact Small Cards) */}
      <div className="block md:hidden space-y-2.5">
        {faculty.length === 0 ? (
          <div className="rounded-xl border border-border bg-white p-6 text-center text-xs text-slate-500">
            No faculty match the current filters.
          </div>
        ) : (
          faculty.map((row) => {
            const fSessions = sessions.filter((s) => s.facultyName === row.name);
            const schedCount = fSessions.length;
            const postedCount = fSessions.filter((s) => s.posted).length;
            const presentCount = fSessions.reduce((sum, s) => sum + (s.presentCount ?? 0), 0);
            const absentCount = fSessions.reduce((sum, s) => sum + (s.absentCount ?? 0), 0);
            const totalStudents = presentCount + absentCount;
            const studentPct = totalStudents > 0 ? Math.round((presentCount / totalStudents) * 100) : null;
            const isExpanded = expandedFacultyId === row.id;

            return (
              <div
                key={row.id}
                className="rounded-xl border border-border/80 bg-white p-3 shadow-2xs space-y-2.5"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <FacultyAvatar
                      name={row.name}
                      photo={row.profilePhoto}
                      hrmsEmployeeId={row.hrmsEmployeeId}
                      size="xs"
                    />
                    <div className="min-w-0">
                      <p className="font-bold text-navy-900 text-xs truncate">{row.name}</p>
                      <p className="text-[10px] text-slate-500 truncate">{row.department} {row.code ? `• ${row.code}` : ""}</p>
                    </div>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-[9.5px] font-bold shrink-0 ${postedCount === schedCount && schedCount > 0 ? "bg-emerald-100 text-emerald-800" : schedCount > 0 ? "bg-amber-100 text-amber-800" : "bg-slate-100 text-slate-600"}`}>
                    {schedCount > 0 ? `${postedCount}/${schedCount} Posted` : "No classes"}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-1 rounded-lg bg-slate-50 p-1.5 text-center text-[10px] border border-slate-100">
                  <div>
                    <span className="text-slate-400 block">Weekly Load</span>
                    <strong className="text-navy-900 font-extrabold">{row.periodsPerWeek} p/wk</strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Enrolled</span>
                    <strong className="text-navy-900 font-extrabold">{totalStudents > 0 ? totalStudents : "—"}</strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Attendance</span>
                    <strong className={studentPct !== null && studentPct >= 75 ? "text-emerald-700 font-extrabold" : "text-amber-700 font-extrabold"}>
                      {studentPct !== null ? `${studentPct}%` : "Pending"}
                    </strong>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-1.5 pt-0.5">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2 text-[11px] font-semibold"
                    onClick={() => setExpandedFacultyId(isExpanded ? null : row.id)}
                  >
                    {isExpanded ? <ChevronUp className="h-3 w-3 mr-1" /> : <ChevronDown className="h-3 w-3 mr-1" />}
                    {fSessions.length} Classes
                  </Button>
                  <Link href={`/staff-workload/${row.id}`}>
                    <Button size="sm" variant="secondary" className="h-7 px-2.5 text-[11px] font-semibold">
                      Grid View
                    </Button>
                  </Link>
                </div>

                {/* Mobile Expanded Sessions */}
                {isExpanded && (
                  <div className="pt-2 border-t border-border space-y-2">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      Classes for {selectedDate}
                    </p>
                    {fSessions.length === 0 ? (
                      <p className="text-xs text-slate-400 italic">No classes scheduled on this date.</p>
                    ) : (
                      fSessions.map((s) => (
                        <div key={s.id} className="rounded-lg border border-slate-200 p-2 bg-slate-50 text-[11px] space-y-1">
                          <div className="flex justify-between items-start">
                            <span className="font-bold text-navy-900 line-clamp-1">{s.subjectName || s.subjectCode}</span>
                            <span className={`px-1.5 py-0.2 rounded text-[9px] font-bold ${s.posted ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>
                              {s.posted ? "Attended" : "Pending"}
                            </span>
                          </div>
                          <p className="text-slate-500 text-[10px]">{s.section || "Sec"} · {s.slotLabel || s.startTime}</p>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* DETAILED FACULTY TIMETABLE & CLASS ATTENDANCE TABLE (DESKTOP) */}
      <div className="hidden md:block overflow-x-auto rounded-lg border border-border bg-white shadow-sm">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500 border-b border-border">
              <th className="px-3 py-3">Faculty Member</th>
              <th className="px-3 py-3">Department</th>
              <th className="px-3 py-3">Weekly Load</th>
              <th className="px-3 py-3 text-center">Classes ({selectedDate})</th>
              <th className="px-3 py-3 text-center">Enrolled Students</th>
              <th className="px-3 py-3 text-center">Students Attended</th>
              <th className="px-3 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {faculty.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-sm text-slate-500">
                  No faculty match the current filters.
                </td>
              </tr>
            ) : (
              faculty.map((row) => {
                const fSessions = sessions.filter((s) => s.facultyName === row.name);
                const schedCount = fSessions.length;
                const postedCount = fSessions.filter((s) => s.posted).length;
                const presentCount = fSessions.reduce((sum, s) => sum + (s.presentCount ?? 0), 0);
                const absentCount = fSessions.reduce((sum, s) => sum + (s.absentCount ?? 0), 0);
                const totalStudents = presentCount + absentCount;
                const studentPct = totalStudents > 0 ? Math.round((presentCount / totalStudents) * 100) : null;
                const isExpanded = expandedFacultyId === row.id;

                return (
                  <Fragment key={row.id}>
                    <tr className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-2.5">
                          <FacultyAvatar
                            name={row.name}
                            photo={row.profilePhoto}
                            hrmsEmployeeId={row.hrmsEmployeeId}
                            size="sm"
                          />
                          <div>
                            <p className="font-semibold text-navy-900">{row.name}</p>
                            <p className="text-[10px] text-slate-400 font-mono">{row.code || row.division}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3 text-slate-600 font-medium">{row.department}</td>
                      <td className="px-3 py-3 text-slate-600">
                        <span className="font-bold text-navy-900">{row.periodsPerWeek}</span> periods/wk
                        <span className="text-[10px] text-slate-400 block">({row.hoursPerWeek} hrs/wk)</span>
                      </td>
                      <td className="px-3 py-3 text-center">
                        {schedCount > 0 ? (
                          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${postedCount === schedCount ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>
                            {postedCount} / {schedCount} Conducted
                          </span>
                        ) : (
                          <span className="text-slate-400 text-[10px]">No class today</span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-center font-bold text-navy-900">
                        {totalStudents > 0 ? `${totalStudents} Students` : "—"}
                      </td>
                      <td className="px-3 py-3 text-center">
                        {studentPct !== null ? (
                          <div className="inline-flex items-center gap-1.5">
                            <div className="w-16 bg-slate-200 h-2 rounded-full overflow-hidden">
                              <div className={`h-full ${studentPct >= 75 ? "bg-emerald-500" : "bg-amber-500"}`} style={{ width: `${studentPct}%` }} />
                            </div>
                            <span className="font-bold text-slate-800">{presentCount} ({studentPct}%)</span>
                          </div>
                        ) : (
                          <span className="text-slate-400 text-[10px]">Pending</span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2 text-xs"
                            onClick={() => setExpandedFacultyId(isExpanded ? null : row.id)}
                          >
                            {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                            Classes
                          </Button>
                          <Link href={`/staff-workload/${row.id}`}>
                            <Button size="sm" variant="secondary" className="h-7 px-2 text-xs">
                              Grid
                            </Button>
                          </Link>
                        </div>
                      </td>
                    </tr>

                    {/* EXPANDABLE CLASS SESSION BREAKDOWN FOR THIS FACULTY */}
                    {isExpanded && (
                      <tr className="bg-slate-50/90">
                        <td colSpan={7} className="px-4 py-3">
                          <div className="rounded-lg border border-border bg-white p-3.5 space-y-2.5 shadow-sm">
                            <div className="flex items-center justify-between border-b border-border/60 pb-2">
                              <h4 className="text-xs font-bold text-navy-900 uppercase tracking-wider flex items-center gap-1.5">
                                <BookOpen className="h-4 w-4 text-brand-600" />
                                Assigned Class Sessions for {row.name} ({selectedDate})
                              </h4>
                              <span className="text-xs text-slate-500">{fSessions.length} Classes Scheduled</span>
                            </div>

                            {fSessions.length === 0 ? (
                              <p className="text-xs text-slate-500 italic py-2">
                                No class sessions found for {row.name} on {selectedDate}.
                              </p>
                            ) : (
                              <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                                {fSessions.map((s) => {
                                  const sEnrolled = (s.presentCount ?? 0) + (s.absentCount ?? 0);
                                  const sPct = sEnrolled > 0 ? Math.round(((s.presentCount ?? 0) / sEnrolled) * 100) : null;

                                  return (
                                    <div key={s.id} className="rounded-lg border border-border p-3 bg-white space-y-2 shadow-2xs">
                                      <div className="flex justify-between items-start">
                                        <div>
                                          <p className="font-bold text-navy-900 text-xs">{s.subjectName || s.subjectCode}</p>
                                          <p className="text-[11px] text-slate-500">{s.section || "Section"} · Room {s.roomLabel || "N/A"}</p>
                                        </div>
                                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${s.posted ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>
                                          {s.posted ? "Attended" : "Pending"}
                                        </span>
                                      </div>

                                      <div className="rounded-md bg-slate-50 p-2 text-[11px] space-y-1 border border-slate-100">
                                        <div className="flex justify-between text-slate-600">
                                          <span>Time Slot:</span>
                                          <span className="font-semibold text-slate-800">{s.slotLabel || `${s.startTime} - ${s.endTime}`}</span>
                                        </div>
                                        <div className="flex justify-between text-slate-600">
                                          <span>Enrolled Students:</span>
                                          <span className="font-bold text-navy-900">{sEnrolled > 0 ? `${sEnrolled} Students` : "Enrolled Class"}</span>
                                        </div>
                                        {s.posted && (
                                          <>
                                            <div className="flex justify-between text-slate-600">
                                              <span>Students Present:</span>
                                              <span className="font-bold text-emerald-700">{s.presentCount ?? 0} ({sPct}%)</span>
                                            </div>
                                            <div className="flex justify-between text-slate-600">
                                              <span>Students Absent:</span>
                                              <span className="font-bold text-rose-600">{s.absentCount ?? 0}</span>
                                            </div>
                                          </>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>
        </>
      )}
    </div>
  );
}
