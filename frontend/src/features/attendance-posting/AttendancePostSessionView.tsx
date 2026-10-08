"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Modal } from "@/components/ui/Modal";
import { apiFetch } from "@/lib/api";
import { cn } from "@/lib/cn";
import { StudentAvatar } from "@/features/students/StudentAvatar";

type AttendanceMark = "present" | "absent";
type FilterMark = "all" | "present" | "absent";

type StudentMark = {
  id: string;
  studentDbId: number;
  name: string;
  admissionNo: string;
  pinNo: string | null;
  course?: string | null;
  branch?: string | null;
  year?: number | null;
  semester?: number | null;
  section?: string | null;
  sessionId?: number;
  hasPhoto?: boolean;
  status: AttendanceMark;
  remarks: string | null;
};

type Payload = {
  session: {
    id: number;
    sessionIds?: number[];
    subjectName: string | null;
    subjectCode: string | null;
    section: string | null;
    sections?: string[];
    slotLabel: string | null;
    time: string;
    date: string;
    facultyName: string | null;
    roomLabel: string | null;
    studentCount: number;
    posted: boolean;
  };
  posted: boolean;
  students: StudentMark[];
};

const MARKS: AttendanceMark[] = ["present", "absent"];

const markClass: Record<AttendanceMark, string> = {
  present: "bg-green-50 text-success",
  absent: "bg-red-50 text-critical",
};

function normalizeStatus(status: string | null | undefined): AttendanceMark {
  return status === "absent" ? "absent" : "present";
}

function formatSectionDisplay(section: string | null | undefined, sections?: string[] | null) {
  if (sections && sections.length > 1) {
    const cleaned = sections.map((s) => s.replace(/^section\s+/i, "").trim());
    return `Sections ${cleaned.join(", ")}`;
  }
  if (!section) return "";
  const trimmed = section.trim();
  if (/^sections?\s+/i.test(trimmed)) {
    return trimmed;
  }
  if (trimmed.includes(",")) {
    const parts = trimmed.split(",").map((s) => s.replace(/^section\s+/i, "").trim());
    return `Sections ${parts.join(", ")}`;
  }
  return `Section ${trimmed}`;
}

function normalizeSectionKey(sec: string | null | undefined) {
  if (!sec) return "";
  return sec.replace(/^section\s+/i, "").trim().toLowerCase();
}

export function AttendancePostSessionView() {
  const params = useParams<{ sessionId: string }>();
  const sessionId = params.sessionId;
  const [payload, setPayload] = useState<Payload | null>(null);
  const [students, setStudents] = useState<StudentMark[]>([]);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<FilterMark>("all");
  const [selectedSectionFilter, setSelectedSectionFilter] = useState<string>("all");
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [modalFilter, setModalFilter] = useState<FilterMark>("all");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [editReason, setEditReason] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const response = await apiFetch(`/attendance/sessions/${encodeURIComponent(sessionId)}`,
          { cache: "no-store" },
        );
        const body = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(
            typeof body === "object" && body && "message" in body
              ? String((body as { message: string }).message)
              : "Unable to load class session",
          );
        }
        if (!cancelled) {
          const data = body as Payload;
          setPayload(data);
          
          const sortedStudents = [...data.students].sort((a, b) => {
            const aKey = (a.pinNo && a.pinNo.trim()) ? a.pinNo.trim() : a.admissionNo;
            const bKey = (b.pinNo && b.pinNo.trim()) ? b.pinNo.trim() : b.admissionNo;
            return aKey.localeCompare(bKey, undefined, { numeric: true, sensitivity: 'base' });
          });
          
          setStudents(
            sortedStudents.map((student) => ({
              ...student,
              status: normalizeStatus(student.status),
            })),
          );
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Unable to load");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  const filtered = useMemo(() => {
    let list = students;
    if (selectedSectionFilter !== "all") {
      const targetSec = normalizeSectionKey(selectedSectionFilter);
      list = list.filter((s) => normalizeSectionKey(s.section) === targetSec);
    }
    if (statusFilter === "present") {
      list = list.filter((s) => s.status === "present");
    } else if (statusFilter === "absent") {
      list = list.filter((s) => s.status === "absent");
    }
    const q = query.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.admissionNo.toLowerCase().includes(q) ||
        (s.pinNo && s.pinNo.toLowerCase().includes(q)),
    );
  }, [students, query, statusFilter, selectedSectionFilter]);

  const modalFilteredStudents = useMemo(() => {
    let list = students;
    if (selectedSectionFilter !== "all") {
      const targetSec = normalizeSectionKey(selectedSectionFilter);
      list = list.filter((s) => normalizeSectionKey(s.section) === targetSec);
    }
    if (modalFilter === "present") {
      return list.filter((s) => s.status === "present");
    }
    if (modalFilter === "absent") {
      return list.filter((s) => s.status === "absent");
    }
    return list;
  }, [students, modalFilter, selectedSectionFilter]);

  const counts = useMemo(() => {
    return {
      total: students.length,
      present: students.filter((s) => s.status === "present").length,
      absent: students.filter((s) => s.status === "absent").length,
    };
  }, [students]);

  const sectionCounts = useMemo(() => {
    const map = new Map<string, { total: number; present: number; absent: number }>();
    if (!payload?.session.sections || payload.session.sections.length <= 1) return map;
    for (const sec of payload.session.sections) {
      const key = normalizeSectionKey(sec);
      const matching = students.filter((s) => normalizeSectionKey(s.section) === key);
      map.set(key, {
        total: matching.length,
        present: matching.filter((s) => s.status === "present").length,
        absent: matching.filter((s) => s.status === "absent").length,
      });
    }
    return map;
  }, [students, payload?.session.sections]);

  function handleMarkAllVisible(status: AttendanceMark) {
    const visibleIds = new Set(filtered.map((s) => s.id));
    setStudents((prev) =>
      prev.map((s) => (visibleIds.has(s.id) ? { ...s, status } : s)),
    );
    setSaved(null);
  }

  function setStatus(id: string, status: AttendanceMark) {
    setStudents((prev) => prev.map((s) => (s.id === id ? { ...s, status } : s)));
    setSaved(null);
  }

  function handleOpenSubmitModal() {
    setError(null);
    if (payload?.posted && !editReason.trim()) {
      setError("Please enter an edit reason before updating.");
      return;
    }
    setModalFilter("all");
    setShowConfirmModal(true);
  }

  async function executeSubmit() {
    setBusy(true);
    setError(null);
    setSaved(null);
    try {
      const response = await apiFetch(`/attendance/sessions/${encodeURIComponent(sessionId)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            editReason: payload?.posted ? editReason : undefined,
            students: students.map((s) => ({
              studentDbId: s.studentDbId,
              admissionNumber: s.admissionNo,
              status: s.status,
            })),
          }),
        },
      );
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(
          typeof body === "object" && body && "message" in body
            ? String((body as { message: string }).message)
            : "Failed to save attendance",
        );
      }
      setSaved(
        `Saved ${body.total} marks • Present ${body.present} • Absent ${body.absent}`,
      );
      setPayload((prev) => (prev ? { ...prev, posted: true } : prev));
      setShowConfirmModal(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save attendance");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return <p className="text-sm text-slate-500">Loading class roster…</p>;
  }

  if (error && !payload) {
    return (
      <div>
        <PageHeader title="Attendance session" />
        <Card>
          <p className="text-sm text-critical">{error}</p>
          <Link href="/attendance-posting" className="mt-3 inline-block text-sm text-navy-800">
            Back to sessions
          </Link>
        </Card>
      </div>
    );
  }

  if (!payload) return null;

  return (
    <div className="flex h-[calc(100dvh-7rem)] flex-col">
      <div className="flex-none pb-2">
        <PageHeader
          title={
            <div className="flex items-center gap-2 flex-wrap text-base sm:text-2xl font-bold leading-tight text-navy-900">
              <span>{payload.session.subjectName ?? "Class session"}</span>
              <span className="text-slate-400 font-normal">|</span>
              <span className="whitespace-nowrap">{payload.session.time}</span>
            </div>
          }
          description={`${formatSectionDisplay(payload.session.section, payload.session.sections)} • ${payload.session.date}${payload.session.slotLabel ? ` • ${payload.session.slotLabel}` : ""}${payload.session.sections && payload.session.sections.length > 1 ? ` • Combined (${payload.session.sections.length} Sections)` : ""}`}
          actions={
            <>
              <Link href="/attendance-posting">
                <Button variant="secondary" className="px-2.5 py-1.5 text-xs">Back</Button>
              </Link>
              <Button className="px-3 py-1.5 text-xs font-semibold" disabled={busy || students.length === 0} onClick={handleOpenSubmitModal}>
                {busy ? "Saving…" : payload.posted ? "Update" : "Submit"}
              </Button>
            </>
          }
        />

        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 min-w-0">
            {/* Mobile-only concise subject and time info */}
            <div className="sm:hidden font-bold text-navy-900 text-xs flex items-center gap-1.5 truncate">
              <span className="truncate">{payload.session.subjectName ?? "Class session"}</span>
              <span className="text-slate-400 font-normal">|</span>
              <span className="whitespace-nowrap text-slate-600 font-medium">{payload.session.time}</span>
            </div>
            <div className="flex items-center gap-2">
              <StatusBadge status={payload.posted ? "Posted" : "Pending"} />
              {payload.session.sections && payload.session.sections.length > 1 ? (
                <span className="inline-flex items-center text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
                  Combined ({payload.session.sections.length} Sections)
                </span>
              ) : null}
              <span className="text-xs text-slate-500 truncate max-w-[140px] sm:max-w-none">
                {payload.session.facultyName ?? "Faculty unassigned"}
                {payload.session.roomLabel ? ` • ${payload.session.roomLabel}` : ""}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1 text-xs font-medium bg-slate-100/80 p-1 rounded-lg">
            <button
              type="button"
              onClick={() => setStatusFilter("all")}
              className={cn(
                "px-2 py-0.5 rounded-md transition-colors text-xs",
                statusFilter === "all" ? "bg-white text-navy-900 font-semibold shadow-sm" : "text-slate-600 hover:text-navy-900"
              )}
            >
              Total: {counts.total}
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter("present")}
              className={cn(
                "px-2 py-0.5 rounded-md transition-colors text-xs",
                statusFilter === "present" ? "bg-green-600 text-white font-semibold shadow-sm" : "text-success hover:bg-green-100/50"
              )}
            >
              P: {counts.present}
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter("absent")}
              className={cn(
                "px-2 py-0.5 rounded-md transition-colors text-xs",
                statusFilter === "absent" ? "bg-red-600 text-white font-semibold shadow-sm" : "text-critical hover:bg-red-100/50"
              )}
            >
              A: {counts.absent}
            </button>
          </div>
        </div>

        {/* Section Filter Tabs & Quick Marking for Combined Sessions */}
        {payload.session.sections && payload.session.sections.length > 1 && (
          <div className="mb-2 bg-slate-50 border border-border/80 p-2 rounded-lg space-y-2 sm:space-y-0 sm:flex sm:items-center sm:justify-between sm:gap-2">
            {/* Inline Section Filter Segmented Grid (Fits to screen on mobile) */}
            <div className="flex items-center gap-1.5 w-full sm:w-auto min-w-0">
              <span className="text-xs font-semibold text-slate-500 hidden sm:inline shrink-0 mr-0.5">Section:</span>
              <div className="grid grid-flow-col auto-cols-fr gap-1 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => setSelectedSectionFilter("all")}
                  className={cn(
                    "px-2 py-1 rounded-md text-xs font-semibold transition-all text-center truncate",
                    selectedSectionFilter === "all"
                      ? "bg-navy-900 text-white shadow-xs"
                      : "bg-white text-slate-700 hover:text-navy-900 border border-border"
                  )}
                >
                  <span className="sm:hidden">All</span>
                  <span className="hidden sm:inline">All Sections</span>
                  <span className="ml-1 opacity-80">({students.length})</span>
                </button>
                {payload.session.sections.map((sec) => {
                  const key = normalizeSectionKey(sec);
                  const stat = sectionCounts.get(key);
                  const isSelected = selectedSectionFilter !== "all" && normalizeSectionKey(selectedSectionFilter) === key;
                  const cleanLabel = sec.replace(/^section\s+/i, "");
                  return (
                    <button
                      key={sec}
                      type="button"
                      onClick={() => setSelectedSectionFilter(sec)}
                      className={cn(
                        "px-2 py-1 rounded-md text-xs font-semibold transition-all text-center truncate",
                        isSelected
                          ? "bg-navy-900 text-white shadow-xs"
                          : "bg-white text-slate-700 hover:text-navy-900 border border-border"
                      )}
                    >
                      <span className="sm:hidden">Sec {cleanLabel}</span>
                      <span className="hidden sm:inline">Section {cleanLabel}</span>
                      <span className={cn(
                        "ml-1 text-[10px] px-1.5 py-0.2 rounded-full inline-block",
                        isSelected ? "bg-white/20 text-white" : "bg-slate-100 text-slate-700 font-bold"
                      )}>
                        {stat?.total ?? 0}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Quick Marking Buttons */}
            <div className="grid grid-cols-2 gap-1.5 w-full sm:w-auto sm:flex sm:items-center sm:gap-1.5 shrink-0 justify-end pt-1 sm:pt-0 border-t sm:border-t-0 border-border/40">
              <button
                type="button"
                onClick={() => handleMarkAllVisible("present")}
                className="px-2.5 py-1 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded transition-colors text-center truncate"
                title="Mark all currently visible students as Present"
              >
                Mark All Present
              </button>
              <button
                type="button"
                onClick={() => handleMarkAllVisible("absent")}
                className="px-2.5 py-1 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded transition-colors text-center truncate"
                title="Mark all currently visible students as Absent"
              >
                Mark All Absent
              </button>
            </div>
          </div>
        )}

        {error ? <p className="mb-2 text-xs text-critical">{error}</p> : null}
        {saved ? <p className="mb-2 text-xs text-success">{saved}</p> : null}

        {payload.posted ? (
          <div className="mb-2 max-w-xl">
            <input
              value={editReason}
              onChange={(e) => setEditReason(e.target.value)}
              placeholder="Edit reason (Required when updating)"
              className="h-8 w-full rounded-md border border-border px-3 text-xs outline-none focus:border-navy-800"
            />
          </div>
        ) : null}

        <div className="mb-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by PIN number or student name..."
            className="h-8 w-full rounded-md border border-border px-3 text-xs outline-none focus:border-navy-800 bg-slate-50"
          />
        </div>
      </div>

      <Card className="flex-1 overflow-auto p-0">
        {filtered.length === 0 ? (
          <p className="px-4 py-6 text-sm text-slate-500 text-center">
            {statusFilter !== "all"
              ? `No ${statusFilter} students found.`
              : selectedSectionFilter !== "all"
              ? `No students found in Section ${selectedSectionFilter.replace(/^section\s+/i, "")}.`
              : "No students on this roster."}
          </p>
        ) : (
          <>
            {/* Mobile View: Clean list with Photo, Student Name, PIN number below, and P/A buttons */}
            <ul className="divide-y divide-border sm:hidden">
              {filtered.map((student) => {
                const displayPin = (student.pinNo && student.pinNo.trim()) ? student.pinNo.trim() : student.admissionNo;
                return (
                  <li
                    key={student.id}
                    className="flex items-center justify-between gap-2 px-3 py-2.5 hover:bg-slate-50/50"
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <StudentAvatar
                        name={student.name}
                        photo={null}
                        studentId={student.id}
                        hasPhoto={student.hasPhoto}
                        size="sm"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <p className="truncate text-sm font-bold text-navy-900 tracking-wide">
                            {displayPin}
                          </p>
                          {payload.session.sections && payload.session.sections.length > 1 && student.section ? (
                            <span className="inline-flex items-center text-[10px] font-bold px-1.5 py-0.2 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
                              Sec {student.section.replace(/^section\s+/i, "")}
                            </span>
                          ) : null}
                        </div>
                        <p className="truncate text-xs font-medium text-slate-600 mt-0.5" title={student.name}>
                          {student.name}
                        </p>
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center rounded-lg border border-border p-0.5 bg-slate-50">
                      {MARKS.map((mark) => (
                        <button
                          key={mark}
                          type="button"
                          onClick={() => setStatus(student.id, mark)}
                          className={cn(
                            "rounded-md px-3 py-1.5 text-xs font-bold uppercase transition-colors",
                            student.status === mark
                              ? markClass[mark] + " shadow-sm ring-1 ring-black/5"
                              : "text-slate-500 hover:text-slate-700 hover:bg-slate-100",
                          )}
                        >
                          {mark === "present" ? "P" : "A"}
                        </button>
                      ))}
                    </div>
                  </li>
                );
              })}
            </ul>

            {/* Desktop View: Clean spacious Data Table */}
            <table className="hidden sm:table w-full text-left text-xs sm:text-sm border-collapse table-fixed">
              <thead className="sticky top-0 z-10 border-b border-border bg-slate-100/95 backdrop-blur text-[11px] uppercase tracking-wider text-slate-600 font-semibold shadow-xs">
                <tr>
                  <th className="px-3 py-2.5 text-center w-12 flex-none">#</th>
                  <th className="px-3 py-2.5 w-44 lg:w-48">PIN Number</th>
                  <th className="px-3 py-2.5 w-1/3">Student Name</th>
                  {payload.session.sections && payload.session.sections.length > 1 ? (
                    <th className="px-3 py-2.5 w-24">Section</th>
                  ) : null}
                  <th className="px-3 py-2.5 w-1/5">Course & Branch</th>
                  <th className="px-3 py-2.5 hidden md:table-cell w-1/6">Year & Sem</th>
                  <th className="px-3 py-2.5 text-right w-28">Attendance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border bg-white">
                {filtered.map((student, index) => {
                  const displayPin = (student.pinNo && student.pinNo.trim()) ? student.pinNo.trim() : student.admissionNo;
                  const courseBranch = [student.course, student.branch].filter(Boolean).join(" - ") || "—";
                  const yearSem = student.year && student.semester ? `Year ${student.year} • Sem ${student.semester}` : "—";

                  return (
                    <tr key={student.id} className="hover:bg-slate-50/80 transition-colors">
                      {/* 1. S.No */}
                      <td className="px-3 py-2.5 text-center font-bold text-slate-400 text-xs">
                        {index + 1}
                      </td>

                      {/* 2. Photo + PIN Number */}
                      <td className="px-3 py-2.5 truncate">
                        <div className="flex items-center gap-2.5 truncate">
                          <StudentAvatar
                            name={student.name}
                            photo={null}
                            studentId={student.id}
                            hasPhoto={student.hasPhoto}
                            size="sm"
                          />
                          <span className="font-bold text-navy-900 tracking-wide text-xs sm:text-sm truncate">
                            {displayPin}
                          </span>
                        </div>
                      </td>

                      {/* 3. Student Name */}
                      <td className="px-3 py-2.5 font-medium text-slate-800 truncate" title={student.name}>
                        {student.name}
                      </td>

                      {/* Section (for merged combined classes) */}
                      {payload.session.sections && payload.session.sections.length > 1 ? (
                        <td className="px-3 py-2.5 truncate">
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                            Sec {student.section?.replace(/^section\s+/i, "") || "—"}
                          </span>
                        </td>
                      ) : null}

                      {/* 4. Course & Branch */}
                      <td className="px-3 py-2.5 text-slate-600 truncate">
                        <span className="inline-flex items-center px-2 py-0.5 rounded bg-slate-100 text-xs font-semibold text-slate-700 truncate">
                          {courseBranch}
                        </span>
                      </td>

                      {/* 5. Year & Semester */}
                      <td className="px-3 py-2.5 text-slate-600 hidden md:table-cell truncate text-xs font-medium">
                        {yearSem}
                      </td>

                      {/* 6. Attendance Status Buttons */}
                      <td className="px-3 py-2.5 text-right">
                        <div className="inline-flex shrink-0 items-center rounded-lg border border-border p-0.5 bg-slate-50">
                          {MARKS.map((mark) => (
                            <button
                              key={mark}
                              type="button"
                              onClick={() => setStatus(student.id, mark)}
                              className={cn(
                                "rounded-md px-3 py-1.5 text-xs font-bold uppercase transition-colors",
                                student.status === mark
                                  ? markClass[mark] + " shadow-sm ring-1 ring-black/5"
                                  : "text-slate-500 hover:text-slate-700 hover:bg-slate-100",
                              )}
                            >
                              {mark === "present" ? "P" : "A"}
                            </button>
                          ))}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </>
        )}
      </Card>

      {showConfirmModal ? (
        <Modal
          title={payload.posted ? "Confirm Attendance Update" : "Confirm Attendance Submission"}
          onClose={() => setShowConfirmModal(false)}
        >
          <div className="space-y-4">
            <div className="rounded-lg bg-slate-50 p-3 border border-border">
              <p className="text-xs text-slate-600 mb-2">Summary Counts (Click to filter list below):</p>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setModalFilter("all")}
                  className={cn(
                    "flex flex-col items-center justify-center p-2 rounded-md border text-center transition-all",
                    modalFilter === "all"
                      ? "border-navy-800 bg-navy-900 text-white shadow-sm font-semibold"
                      : "border-border bg-white text-navy-900 hover:bg-slate-100"
                  )}
                >
                  <span className="text-[11px] uppercase tracking-wider opacity-80">Total</span>
                  <span className="text-lg font-bold">{counts.total}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setModalFilter("present")}
                  className={cn(
                    "flex flex-col items-center justify-center p-2 rounded-md border text-center transition-all",
                    modalFilter === "present"
                      ? "border-green-600 bg-green-600 text-white shadow-sm font-semibold"
                      : "border-green-200 bg-green-50 text-success hover:bg-green-100"
                  )}
                >
                  <span className="text-[11px] uppercase tracking-wider opacity-80">Present</span>
                  <span className="text-lg font-bold">{counts.present}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setModalFilter("absent")}
                  className={cn(
                    "flex flex-col items-center justify-center p-2 rounded-md border text-center transition-all",
                    modalFilter === "absent"
                      ? "border-red-600 bg-red-600 text-white shadow-sm font-semibold"
                      : "border-red-200 bg-red-50 text-critical hover:bg-red-100"
                  )}
                >
                  <span className="text-[11px] uppercase tracking-wider opacity-80">Absent</span>
                  <span className="text-lg font-bold">{counts.absent}</span>
                </button>
              </div>
            </div>

            {/* Section Breakdown in Modal for Combined Class */}
            {payload.session.sections && payload.session.sections.length > 1 && (
              <div className="rounded-lg bg-indigo-50/70 p-2.5 border border-indigo-100 text-xs">
                <p className="font-bold text-navy-900 mb-1.5 flex items-center justify-between">
                  <span>Merged Section Breakdown:</span>
                  <span className="text-[11px] font-normal text-indigo-800">{payload.session.sections.length} Sections Combined</span>
                </p>
                <div className="grid grid-cols-2 gap-2 text-slate-700">
                  {payload.session.sections.map((sec) => {
                    const key = normalizeSectionKey(sec);
                    const stat = sectionCounts.get(key);
                    const cleanLabel = sec.replace(/^section\s+/i, "");
                    return (
                      <div key={sec} className="bg-white rounded-md p-2 border border-indigo-100 shadow-2xs">
                        <p className="font-bold text-navy-900 text-xs">Section {cleanLabel}</p>
                        <p className="text-[11px] text-slate-600 mt-0.5">
                          Total: <strong>{stat?.total ?? 0}</strong> • P: <strong className="text-success">{stat?.present ?? 0}</strong> • A: <strong className="text-critical">{stat?.absent ?? 0}</strong>
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs font-semibold uppercase text-slate-500">
                  {modalFilter === "all"
                    ? `All Students (${modalFilteredStudents.length})`
                    : modalFilter === "present"
                    ? `Present Students (${modalFilteredStudents.length})`
                    : `Absent Students (${modalFilteredStudents.length})`}
                </h4>
              </div>

              <div className="max-h-60 overflow-y-auto rounded-lg border border-border">
                {modalFilteredStudents.length === 0 ? (
                  <p className="p-4 text-xs text-slate-500 text-center">
                    No {modalFilter} students.
                  </p>
                ) : (
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="sticky top-0 border-b border-border bg-slate-100 text-[10px] uppercase font-semibold text-slate-600">
                      <tr>
                        <th className="px-2.5 py-1.5 w-8 text-center">#</th>
                        <th className="px-2.5 py-1.5 w-32">PIN Number</th>
                        <th className="px-2.5 py-1.5">Student Name</th>
                        {payload.session.sections && payload.session.sections.length > 1 ? (
                          <th className="px-2.5 py-1.5 w-16">Section</th>
                        ) : null}
                        <th className="px-2.5 py-1.5 text-right w-20">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border bg-white">
                      {modalFilteredStudents.map((s, idx) => {
                        const displayPin = (s.pinNo && s.pinNo.trim()) ? s.pinNo.trim() : s.admissionNo;
                        return (
                          <tr key={s.id} className="hover:bg-slate-50/80">
                            <td className="px-2.5 py-2 text-center font-bold text-slate-400 text-[11px]">
                              {idx + 1}
                            </td>
                            <td className="px-2.5 py-2 font-bold text-navy-900 whitespace-nowrap">
                              {displayPin}
                            </td>
                            <td className="px-2.5 py-2 font-medium text-slate-700 truncate max-w-[180px]">
                              {s.name}
                            </td>
                            {payload.session.sections && payload.session.sections.length > 1 ? (
                              <td className="px-2.5 py-2 text-slate-600 font-semibold whitespace-nowrap">
                                Sec {s.section?.replace(/^section\s+/i, "") || "—"}
                              </td>
                            ) : null}
                            <td className="px-2.5 py-2 text-right">
                              <span
                                className={cn(
                                  "px-2 py-0.5 text-[10px] font-bold rounded uppercase inline-block",
                                  s.status === "present"
                                    ? "bg-green-100 text-green-700"
                                    : "bg-red-100 text-red-700"
                                )}
                              >
                                {s.status}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
              <Button variant="secondary" size="sm" onClick={() => setShowConfirmModal(false)}>
                Cancel
              </Button>
              <Button size="sm" disabled={busy} onClick={() => void executeSubmit()}>
                {busy ? "Saving…" : payload.posted ? "Confirm Update" : "Confirm Submit"}
              </Button>
            </div>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}


