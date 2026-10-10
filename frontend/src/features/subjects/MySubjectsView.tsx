"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  BookOpen,
  Calendar,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  Clock,
  FileBarChart2,
  GraduationCap,
  Layers,
  Search,
  Sparkles,
  Users,
  FlaskConical,
  LayoutGrid,
  List,
} from "lucide-react";
import { useAcademicContext } from "@/components/layout/AcademicProvider";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { apiFetch } from "@/lib/api";
import { cn } from "@/lib/cn";
import { useLoading } from "@/context/LoadingContext";
import { SubjectAttendanceDetailsModal } from "./SubjectAttendanceDetailsModal";

export type AssignedSubjectItem = {
  subjectId: number;
  subjectCode: string;
  subjectName: string;
  sectionName: string | null;
  batch: string | null;
  yearOfStudy: number | null;
  semesterNumber: number | null;
  branchId: number;
  branchName: string;
  courseName: string;
  slotType: string;
  weeklyPeriods: number;
  studentCount: number;
};

type TeachingProgressItem = {
  subject: string;
  planned: number;
  conducted: number;
  completion: number;
  status: "On Track" | "Behind";
};

type SubjectAttendanceDonut = {
  subject: string;
  classSection: string;
  percentage: number;
  present: number;
  total: number;
};

type DashboardResponse = {
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
  };
  assignedSubjects?: AssignedSubjectItem[];
  teachingProgress?: TeachingProgressItem[];
  subjectAttendanceDonuts?: SubjectAttendanceDonut[];
};

export type SubjectItem = AssignedSubjectItem & {
  isLab: boolean;
  planned: number;
  conducted: number;
  completion: number;
  status: string;
  attendancePct: number | null;
};

export function MySubjectsView() {
  const { filters, setFilters, masters } = useAcademicContext();
  const { startLoading, stopLoading } = useLoading();
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | "theory" | "lab">("all");
  const [viewMode, setViewMode] = useState<"grid" | "table">("grid");
  const [selectedAttendanceSubject, setSelectedAttendanceSubject] = useState<SubjectItem | null>(null);

  const currentAY =
    filters.academicYear ||
    masters?.defaults?.academicYear ||
    masters?.academicYears?.find((y) => y.isActive)?.label ||
    "2026-2027";

  useEffect(() => {
    let cancelled = false;
    async function loadData() {
      setLoading(true);
      setError(null);
      startLoading();
      try {
        const params = new URLSearchParams();
        if (filters.date) params.set("date", filters.date);
        if (currentAY) params.set("academicYear", currentAY);
        if (filters.semester) params.set("semester", String(filters.semester));

        const res = await apiFetch(`/faculty/dashboard?${params.toString()}`);
        if (!res.ok) {
          throw new Error("Failed to load assigned subjects");
        }
        const json = (await res.json()) as DashboardResponse;
        if (!cancelled) {
          setData(json);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Error loading subjects");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
          stopLoading();
        }
      }
    }

    void loadData();
    return () => {
      cancelled = true;
    };
  }, [filters.date, currentAY, filters.semester]);

  // Combine assignedSubjects with teachingProgress
  const subjects = useMemo(() => {
    if (!data?.assignedSubjects) return [];

    return data.assignedSubjects.map((sub) => {
      // Find matching teaching progress
      const progress = data.teachingProgress?.find((p) => {
        const subName = sub.subjectName.toLowerCase();
        const progName = p.subject.toLowerCase();
        return (
          progName.includes(subName) ||
          subName.includes(progName) ||
          (sub.sectionName && progName.includes(sub.sectionName.toLowerCase()))
        );
      });

      // Find attendance donut
      const donut = data.subjectAttendanceDonuts?.find((d) => {
        const subName = sub.subjectName.toLowerCase();
        const dName = d.subject.toLowerCase();
        return dName.includes(subName) || subName.includes(dName);
      });

      const isLab =
        sub.slotType?.toLowerCase() === "lab" ||
        sub.subjectName.toLowerCase().includes("lab") ||
        sub.subjectCode.toLowerCase().includes("l");

      return {
        ...sub,
        isLab,
        planned: progress?.planned ?? (sub.weeklyPeriods * 14 || 42),
        conducted: progress?.conducted ?? 0,
        completion: progress?.completion ?? 0,
        status: progress?.status ?? "On Track",
        attendancePct: donut ? Math.round(donut.percentage) : null,
      };
    });
  }, [data]);

  const filteredSubjects = useMemo(() => {
    return subjects.filter((s) => {
      if (typeFilter === "theory" && s.isLab) return false;
      if (typeFilter === "lab" && !s.isLab) return false;
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (
        s.subjectName.toLowerCase().includes(q) ||
        s.subjectCode.toLowerCase().includes(q) ||
        (s.branchName && s.branchName.toLowerCase().includes(q)) ||
        (s.sectionName && s.sectionName.toLowerCase().includes(q))
      );
    });
  }, [subjects, search, typeFilter]);

  const theoryCount = useMemo(() => subjects.filter((s) => !s.isLab).length, [subjects]);
  const labCount = useMemo(() => subjects.filter((s) => s.isLab).length, [subjects]);
  const totalStudents = useMemo(() => {
    return subjects.reduce((sum, s) => sum + (s.studentCount || 0), 0);
  }, [subjects]);
  const totalPeriods = useMemo(() => {
    return subjects.reduce((sum, s) => sum + (s.weeklyPeriods || 0), 0);
  }, [subjects]);

  return (
    <div className="space-y-4 pb-12">
      {/* 1. Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/80 pb-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold text-navy-900 tracking-tight">
              My Teaching Subjects
            </h1>
            <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-bold text-emerald-700 border border-emerald-200">
              {currentAY} · Sem {filters.semester === 2 ? "II" : "I"}
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Clear overview of your assigned teaching subjects, enrolled students, weekly load, and class progress.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link href="/my-timetable">
            <Button size="sm" variant="secondary" className="gap-1.5 h-8.5 text-xs font-semibold">
              <Clock className="h-3.5 w-3.5 text-slate-500" />
              <span>Full Timetable</span>
            </Button>
          </Link>
          <Link href="/attendance-posting">
            <Button size="sm" variant="primary" className="gap-1.5 h-8.5 text-xs font-semibold">
              <ClipboardCheck className="h-3.5 w-3.5" />
              <span>Post Attendance</span>
            </Button>
          </Link>
        </div>
      </div>

      {/* 2. Top Summary Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5 sm:gap-3.5">
        <div className="rounded-xl border border-slate-200/90 bg-white p-3 shadow-2xs">
          <div className="flex items-center gap-2 text-slate-500 text-xs font-semibold">
            <BookOpen className="h-4 w-4 text-emerald-600" />
            <span>Assigned Subjects</span>
          </div>
          <p className="text-2xl font-black text-navy-900 mt-1">{subjects.length}</p>
          <p className="text-[10px] text-slate-400 mt-0.5">{currentAY}</p>
        </div>

        <div className="rounded-xl border border-slate-200/90 bg-white p-3 shadow-2xs">
          <div className="flex items-center gap-2 text-slate-500 text-xs font-semibold">
            <BookOpen className="h-4 w-4 text-blue-600" />
            <span>Theory Subjects</span>
          </div>
          <p className="text-2xl font-black text-navy-900 mt-1">{theoryCount}</p>
          <p className="text-[10px] text-slate-400 mt-0.5">Lecture based</p>
        </div>

        <div className="rounded-xl border border-slate-200/90 bg-white p-3 shadow-2xs">
          <div className="flex items-center gap-2 text-slate-500 text-xs font-semibold">
            <FlaskConical className="h-4 w-4 text-purple-600" />
            <span>Lab / Practical</span>
          </div>
          <p className="text-2xl font-black text-navy-900 mt-1">{labCount}</p>
          <p className="text-[10px] text-slate-400 mt-0.5">Hands-on practicals</p>
        </div>

        <div className="rounded-xl border border-slate-200/90 bg-white p-3 shadow-2xs">
          <div className="flex items-center gap-2 text-slate-500 text-xs font-semibold">
            <Users className="h-4 w-4 text-cyan-600" />
            <span>Enrolled Students</span>
          </div>
          <p className="text-2xl font-black text-navy-900 mt-1">{totalStudents}</p>
          <p className="text-[10px] text-slate-400 mt-0.5">Across all sections</p>
        </div>

        <div className="rounded-xl border border-slate-200/90 bg-white p-3 shadow-2xs col-span-2 sm:col-span-1">
          <div className="flex items-center gap-2 text-slate-500 text-xs font-semibold">
            <Clock className="h-4 w-4 text-amber-600" />
            <span>Weekly Periods</span>
          </div>
          <p className="text-2xl font-black text-navy-900 mt-1">{totalPeriods} <span className="text-xs font-medium text-slate-400">p/wk</span></p>
          <p className="text-[10px] text-slate-400 mt-0.5">Scheduled workload</p>
        </div>
      </div>

      {/* 3. Search, Filters, and View Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 rounded-xl border border-border/80 bg-white p-2.5 shadow-2xs">
        <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[240px]">
          <div className="relative flex-1 min-w-[180px] sm:max-w-xs">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Search subject, code, branch..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8.5 w-full rounded-lg border border-slate-200 pl-8 pr-3 text-xs font-medium text-slate-700 outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
            />
          </div>

          {/* Type Filter Buttons */}
          <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5 text-xs font-medium">
            <button
              type="button"
              onClick={() => setTypeFilter("all")}
              className={cn(
                "rounded-md px-2.5 py-1 transition-colors",
                typeFilter === "all" ? "bg-white font-bold text-navy-900 shadow-2xs" : "text-slate-600 hover:text-navy-900",
              )}
            >
              All ({subjects.length})
            </button>
            <button
              type="button"
              onClick={() => setTypeFilter("theory")}
              className={cn(
                "rounded-md px-2.5 py-1 transition-colors",
                typeFilter === "theory" ? "bg-white font-bold text-navy-900 shadow-2xs" : "text-slate-600 hover:text-navy-900",
              )}
            >
              Theory ({theoryCount})
            </button>
            <button
              type="button"
              onClick={() => setTypeFilter("lab")}
              className={cn(
                "rounded-md px-2.5 py-1 transition-colors",
                typeFilter === "lab" ? "bg-white font-bold text-navy-900 shadow-2xs" : "text-slate-600 hover:text-navy-900",
              )}
            >
              Lab ({labCount})
            </button>
          </div>
        </div>

        {/* View mode toggle */}
        <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5">
          <button
            type="button"
            onClick={() => setViewMode("grid")}
            className={cn(
              "p-1.5 rounded-md transition-colors",
              viewMode === "grid" ? "bg-white text-navy-900 shadow-2xs" : "text-slate-500 hover:text-navy-900",
            )}
            title="Card Grid View"
          >
            <LayoutGrid className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setViewMode("table")}
            className={cn(
              "p-1.5 rounded-md transition-colors",
              viewMode === "table" ? "bg-white text-navy-900 shadow-2xs" : "text-slate-500 hover:text-navy-900",
            )}
            title="Table View"
          >
            <List className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* 4. Subject Content */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-56 rounded-2xl border border-slate-200 bg-white p-4 animate-pulse" />
          ))}
        </div>
      ) : filteredSubjects.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-white p-8 sm:p-12 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-500">
            <BookOpen className="h-6 w-6" />
          </div>
          <h3 className="mt-3 text-base font-bold text-navy-900">No subjects found</h3>
          <p className="mt-1 text-xs text-slate-500 max-w-md mx-auto">
            {search
              ? `No subjects match the search query "${search}". Try adjusting your filters.`
              : `No timetable teaching assignments recorded for ${currentAY} Sem ${filters.semester === 2 ? "II" : "I"}. Check Master Timetable or consult the department HOD.`}
          </p>
        </div>
      ) : viewMode === "grid" ? (
        /* GRID CARD VIEW */
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3.5">
          {filteredSubjects.map((sub, idx) => (
            <div
              key={`${sub.subjectId}-${sub.sectionName}-${idx}`}
              className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-2xs hover:shadow-xs transition-all flex flex-col justify-between"
            >
              <div>
                {/* Card Top: Badges & Type */}
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold border",
                      sub.isLab
                        ? "bg-purple-50 text-purple-700 border-purple-200"
                        : "bg-blue-50 text-blue-700 border-blue-200",
                    )}
                  >
                    {sub.isLab ? <FlaskConical className="h-3 w-3" /> : <BookOpen className="h-3 w-3" />}
                    <span>{sub.isLab ? "Lab / Practical" : "Theory Subject"}</span>
                  </span>

                  <span className="text-xs font-mono font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                    {sub.subjectCode}
                  </span>
                </div>

                {/* Subject Title */}
                <h3 className="text-base font-bold text-navy-900 line-clamp-2 leading-snug">
                  {sub.subjectName}
                </h3>

                {/* Academic Context Details */}
                <div className="mt-2.5 space-y-1.5 text-xs text-slate-600 bg-slate-50/70 p-2.5 rounded-xl border border-slate-100">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400 font-medium">Branch / Course:</span>
                    <span className="font-semibold text-navy-900 truncate max-w-[180px]" title={sub.branchName}>
                      {sub.branchName}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400 font-medium">Year & Semester:</span>
                    <span className="font-semibold text-navy-900">
                      Year {sub.yearOfStudy || "—"} · Sem {sub.semesterNumber || "—"}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400 font-medium">Section / Batch:</span>
                    <span className="font-semibold text-navy-900">
                      {sub.sectionName || "Section A"} {sub.batch ? `(${sub.batch})` : ""}
                    </span>
                  </div>
                </div>

                {/* Stats Row */}
                <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-slate-100 text-center">
                  <div>
                    <span className="block text-[10px] text-slate-400 font-medium">Enrolled</span>
                    <strong className="text-sm font-bold text-navy-900">{sub.studentCount}</strong>
                  </div>
                  <div>
                    <span className="block text-[10px] text-slate-400 font-medium">Load / Wk</span>
                    <strong className="text-sm font-bold text-navy-900">{sub.weeklyPeriods} periods</strong>
                  </div>
                  <div>
                    <span className="block text-[10px] text-slate-400 font-medium">Classes Done</span>
                    <strong className="text-sm font-bold text-emerald-700">{sub.conducted}</strong>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => setSelectedAttendanceSubject(sub)}
                  className="flex-1 text-xs font-semibold h-8 gap-1 hover:border-brand-500 hover:text-brand-700 hover:bg-brand-50/50"
                  title="View detailed student attendance list and academic calendar window"
                >
                  <ClipboardCheck className="h-3.5 w-3.5 text-brand-600" />
                  <span>Attendance</span>
                </Button>
                <Link
                  href={`/internal-marks?subjectId=${sub.subjectId}&section=${encodeURIComponent(sub.sectionName || "")}`}
                  className="flex-1"
                >
                  <Button size="sm" variant="secondary" className="w-full text-xs font-semibold h-8 gap-1 hover:border-brand-500">
                    <FileBarChart2 className="h-3.5 w-3.5 text-blue-600" />
                    <span>Marks</span>
                  </Button>
                </Link>
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* TABLE VIEW */
        <div className="overflow-x-auto rounded-xl border border-slate-200/90 bg-white shadow-2xs">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500 border-b border-border">
                <th className="px-3.5 py-3">Subject</th>
                <th className="px-3.5 py-3">Branch & Course</th>
                <th className="px-3.5 py-3 text-center">Year / Sem</th>
                <th className="px-3.5 py-3 text-center">Section</th>
                <th className="px-3.5 py-3 text-center">Enrolled</th>
                <th className="px-3.5 py-3 text-center">Weekly Load</th>
                <th className="px-3.5 py-3 text-center">Conducted</th>
                <th className="px-3.5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredSubjects.map((sub, idx) => (
                <tr key={`${sub.subjectId}-${sub.sectionName}-${idx}`} className="hover:bg-slate-50/80 transition-colors">
                  <td className="px-3.5 py-3">
                    <div className="flex items-center gap-2">
                      <div
                        className={cn(
                          "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-white font-bold text-xs",
                          sub.isLab ? "bg-purple-600" : "bg-brand-600",
                        )}
                      >
                        {sub.isLab ? <FlaskConical className="h-3.5 w-3.5" /> : <BookOpen className="h-3.5 w-3.5" />}
                      </div>
                      <div>
                        <p className="font-bold text-navy-900 leading-tight">{sub.subjectName}</p>
                        <p className="text-[10px] text-slate-400 font-mono mt-0.5">{sub.subjectCode} · {sub.slotType}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-3.5 py-3 font-medium text-slate-700">{sub.branchName}</td>
                  <td className="px-3.5 py-3 text-center font-medium text-slate-600">
                    Y{sub.yearOfStudy || "—"} S{sub.semesterNumber || "—"}
                  </td>
                  <td className="px-3.5 py-3 text-center font-bold text-navy-900">
                    {sub.sectionName || "Sec A"}
                  </td>
                  <td className="px-3.5 py-3 text-center">
                    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 font-bold text-slate-700 text-[11px]">
                      <Users className="h-3 w-3" />
                      <span>{sub.studentCount}</span>
                    </span>
                  </td>
                  <td className="px-3.5 py-3 text-center font-bold text-navy-900">
                    {sub.weeklyPeriods} p/wk
                  </td>
                  <td className="px-3.5 py-3 text-center font-bold text-emerald-700">
                    {sub.conducted}
                  </td>
                  <td className="px-3.5 py-3 text-right">
                    <div className="inline-flex items-center gap-1.5">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => setSelectedAttendanceSubject(sub)}
                        className="h-7 text-[11px] px-2.5 font-semibold hover:border-brand-500 hover:text-brand-700"
                        title="View detailed student attendance list and academic calendar window"
                      >
                        Attendance
                      </Button>
                      <Link href={`/internal-marks?subjectId=${sub.subjectId}&section=${encodeURIComponent(sub.sectionName || "")}`}>
                        <Button size="sm" variant="secondary" className="h-7 text-[11px] px-2.5 font-semibold">
                          Marks
                        </Button>
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Student Attendance Details Modal */}
      {selectedAttendanceSubject && (
        <SubjectAttendanceDetailsModal
          subjectId={selectedAttendanceSubject.subjectId}
          subjectName={selectedAttendanceSubject.subjectName}
          subjectCode={selectedAttendanceSubject.subjectCode}
          sectionName={selectedAttendanceSubject.sectionName}
          branchId={selectedAttendanceSubject.branchId}
          branchName={selectedAttendanceSubject.branchName}
          academicYear={currentAY}
          semesterNumber={
            typeof filters.semester === "number"
              ? filters.semester
              : selectedAttendanceSubject.semesterNumber
          }
          yearOfStudy={selectedAttendanceSubject.yearOfStudy}
          batch={selectedAttendanceSubject.batch}
          isLab={selectedAttendanceSubject.isLab}
          onClose={() => setSelectedAttendanceSubject(null)}
        />
      )}
    </div>
  );
}
