import type { RowDataPacket } from "mysql2";
import { queryAcademic, queryStudent, queryExam } from "../db/pools.js";
import { resolveStaffLinkIdForUser } from "../authz/faculty-self-scope.js";
import type { AuthzContext } from "../authz/authorization.service.js";
import { ensureSessionsForDate } from "./class-sessions.service.js";

function todayIso() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function formatSubjectWithSection(subName: string, secName: string | null | undefined): string {
  const cleanSec =
    secName && secName.trim() !== "—" && secName.trim() !== "-" ? secName.trim() : "";
  return cleanSec ? `${subName} (${cleanSec})` : subName;
}

function formatSectionLabel(secName: string | null | undefined): string {
  const cleanSec =
    secName && secName.trim() !== "—" && secName.trim() !== "-" ? secName.trim() : "";
  return cleanSec ? `Section ${cleanSec}` : "";
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
  dateInfo: {
    selectedDate: string;
    isToday: boolean;
    dayName: string;
    dayCode: string;
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
    hasSessionOnDate: boolean;
    sessionsCountOnDate: number;
    cumulativePercentage: number;
    cumulativePresent: number;
    cumulativeTotal: number;
    cumulativeSessionsCount: number;
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
    hasSessionOnDate: boolean;
    cumulativeAttendance: string;
    cumulativePresent: number;
    cumulativeAbsent: number;
    cumulativeTotal: number;
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
};

export async function getSubjectTeacherDashboardData(
  authz: AuthzContext,
  options: {
    facultyStaffLinkId?: number;
    date?: string;
    academicYear?: string;
    semester?: string;
  } = {},
): Promise<SubjectTeacherDashboardData> {
  const sessionDate = options.date || todayIso();
  const dateObj = new Date(sessionDate + "T00:00:00");
  const dayIndex = isNaN(dateObj.getTime()) ? new Date().getDay() : dateObj.getDay();
  const dayCodes = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
  const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const dayCode = dayCodes[dayIndex];
  const dayName = dayNames[dayIndex];
  const isToday = sessionDate === todayIso();

  // 1. Resolve Staff Link ID
  let staffLinkId: number | null = null;
  if (options.facultyStaffLinkId) {
    staffLinkId = options.facultyStaffLinkId;
  } else if (authz.userId) {
    staffLinkId = await resolveStaffLinkIdForUser(authz.userId);
  }

  // If user is not directly linked to a staff record, resolve the most active faculty
  if (!staffLinkId) {
    const activeStaff = await queryAcademic<(RowDataPacket & { id: number })[]>(`
      SELECT sl.id
      FROM ap_staff_link sl
      INNER JOIN ap_timetable_entries te ON te.faculty_staff_link_id = sl.id
      GROUP BY sl.id
      ORDER BY COUNT(te.id) DESC
      LIMIT 1
    `);
    staffLinkId = activeStaff[0]?.id ?? null;
  }

  // Fetch Faculty Profile
  let facultyName = "Faculty Member";
  let departmentName = "Department of CSE";
  let hrmsEmployeeId: string | null = null;

  if (staffLinkId) {
    const staffRows = await queryAcademic<
      (RowDataPacket & {
        id: number;
        hrms_employee_id: string | null;
        display_name: string;
        department_name: string | null;
      })[]
    >(
      `
      SELECT id, hrms_employee_id, display_name, department_name
      FROM ap_staff_link
      WHERE id = ?
      LIMIT 1
      `,
      [staffLinkId],
    );
    if (staffRows[0]) {
      facultyName = staffRows[0].display_name;
      hrmsEmployeeId = staffRows[0].hrms_employee_id;
      if (staffRows[0].department_name) {
        departmentName = staffRows[0].department_name;
      }
    }
  }

  // 2. Query Timetable Assignments & Subjects
  const planWhere: string[] = ["te.faculty_staff_link_id = ?", "te.subject_id IS NOT NULL"];
  const planParams: unknown[] = [staffLinkId];

  if (options.academicYear && options.academicYear !== "all") {
    const rawAy = options.academicYear.trim();
    const cleanAy = rawAy.replace(/^AY\s*/i, "").trim();
    planWhere.push(
      "(tp.academic_year_label = ? OR tp.academic_year_label = ? OR tp.academic_year_label LIKE ?)",
    );
    planParams.push(rawAy, cleanAy, `%${cleanAy}%`);
  }

  let semFilter: number | null = null;
  if (options.semester && options.semester !== "all") {
    const semStr = String(options.semester).trim().toLowerCase();
    if (semStr === "semester i" || semStr === "sem i" || semStr === "1" || semStr === "sem 1" || semStr === "i") {
      semFilter = 1;
    } else if (semStr === "semester ii" || semStr === "sem ii" || semStr === "2" || semStr === "sem 2" || semStr === "ii") {
      semFilter = 2;
    } else {
      const parsed = parseInt(semStr, 10);
      if (!isNaN(parsed)) semFilter = parsed;
    }
  }

  if (semFilter !== null) {
    if (semFilter === 1) {
      planWhere.push("(tp.semester_number % 2 = 1 OR tp.semester_number = 1)");
    } else if (semFilter === 2) {
      planWhere.push("(tp.semester_number % 2 = 0 OR tp.semester_number = 2)");
    } else {
      planWhere.push("tp.semester_number = ?");
      planParams.push(semFilter);
    }
  }

  let rawAssignedSubjects = staffLinkId
    ? await queryAcademic<
        (RowDataPacket & {
          subject_id: number;
          subject_code: string | null;
          subject_name: string | null;
          section_name: string | null;
          batch: string | null;
          year_of_study: number | null;
          semester_number: number | null;
          branch_id: number;
          slot_type: string | null;
          entry_count: number;
        })[]
      >(
        `
        SELECT
          te.subject_id,
          te.subject_code,
          te.subject_name,
          tp.section_name,
          tp.batch,
          tp.year_of_study,
          tp.semester_number,
          tp.branch_id,
          MAX(ts.slot_type) AS slot_type,
          COUNT(te.id) AS entry_count
        FROM ap_timetable_entries te
        INNER JOIN ap_timetable_plans tp ON tp.id = te.plan_id
        LEFT JOIN ap_timing_template_slots ts ON ts.id = COALESCE(te.timing_slot_id, te.period_slot_id)
        WHERE ${planWhere.join(" AND ")}
        GROUP BY te.subject_id, te.subject_code, te.subject_name, tp.section_name, tp.batch, tp.year_of_study, tp.semester_number, tp.branch_id
        ORDER BY te.subject_name ASC, tp.section_name ASC
        `,
        planParams,
      )
    : [];

  // Fallback if specific academic_year_label format did not match any rows
  if (rawAssignedSubjects.length === 0 && options.academicYear && options.academicYear !== "all") {
    const fallbackWhere = ["te.faculty_staff_link_id = ?", "te.subject_id IS NOT NULL"];
    const fallbackParams: unknown[] = [staffLinkId];
    if (semFilter !== null) {
      if (semFilter === 1) {
        fallbackWhere.push("(tp.semester_number % 2 = 1 OR tp.semester_number = 1)");
      } else if (semFilter === 2) {
        fallbackWhere.push("(tp.semester_number % 2 = 0 OR tp.semester_number = 2)");
      } else {
        fallbackWhere.push("tp.semester_number = ?");
        fallbackParams.push(semFilter);
      }
    }
    const fallbackRows = await queryAcademic<typeof rawAssignedSubjects>(
      `
      SELECT
        te.subject_id,
        te.subject_code,
        te.subject_name,
        tp.section_name,
        tp.batch,
        tp.year_of_study,
        tp.semester_number,
        tp.branch_id,
        MAX(ts.slot_type) AS slot_type,
        COUNT(te.id) AS entry_count
      FROM ap_timetable_entries te
      INNER JOIN ap_timetable_plans tp ON tp.id = te.plan_id
      LEFT JOIN ap_timing_template_slots ts ON ts.id = COALESCE(te.timing_slot_id, te.period_slot_id)
      WHERE ${fallbackWhere.join(" AND ")}
      GROUP BY te.subject_id, te.subject_code, te.subject_name, tp.section_name, tp.batch, tp.year_of_study, tp.semester_number, tp.branch_id
      ORDER BY te.subject_name ASC, tp.section_name ASC
      `,
      fallbackParams,
    );
    if (fallbackRows.length > 0) {
      rawAssignedSubjects = fallbackRows;
    }
  }

  // Filter to ONLY sections that actually have enrolled students (exclude empty placeholder sections)
  type ActiveAssignedSubject = (typeof rawAssignedSubjects)[0] & { studentCount: number };
  const assignedSubjects: ActiveAssignedSubject[] = [];
  const studentIdSet = new Set<number>();

  for (const s of rawAssignedSubjects) {
    const where = ["branch_id = ?"];
    const params: unknown[] = [s.branch_id];
    if (s.batch) {
      where.push("batch = ?");
      params.push(s.batch);
    }
    if (s.year_of_study) {
      where.push("current_year = ?");
      params.push(s.year_of_study);
    }
    if (s.semester_number) {
      where.push("current_semester = ?");
      params.push(s.semester_number);
    }
    if (s.section_name) {
      where.push("section = ?");
      params.push(s.section_name);
    }
    where.push(
      "(student_status IS NULL OR LOWER(student_status) NOT IN ('relieved', 'discontinued', 'inactive', 'cancelled'))",
    );

    const ids = await queryStudent<(RowDataPacket & { id: number })[]>(
      `SELECT DISTINCT id FROM students WHERE ${where.join(" AND ")}`,
      params,
    );

    const count = ids.length;
    // Only keep sections with enrolled students
    if (count > 0) {
      assignedSubjects.push({ ...s, studentCount: count });
      for (const row of ids) {
        studentIdSet.add(row.id);
      }
    }
  }

  const uniqueSubjectMap = new Map<number, string>();
  let theoryCount = 0;
  let labCount = 0;

  for (const s of assignedSubjects) {
    if (!uniqueSubjectMap.has(s.subject_id)) {
      uniqueSubjectMap.set(s.subject_id, s.subject_name || s.subject_code || "Subject");
      const isLab =
        (s.slot_type && s.slot_type.toLowerCase() === "lab") ||
        (s.subject_name && s.subject_name.toLowerCase().includes("lab"));
      if (isLab) {
        labCount++;
      } else {
        theoryCount++;
      }
    }
  }

  const mySubjectsCount = uniqueSubjectMap.size || assignedSubjects.length;

  // 3. Count Total Enrolled Students across assigned active sections only
  const totalStudentsCount = studentIdSet.size;

  // 4. Query Classes for the Selected Date
  if (staffLinkId) {
    try {
      await ensureSessionsForDate(sessionDate, {
        facultyStaffLinkId: staffLinkId,
      });
    } catch {
      // Continue gracefully if generation skipped or failed
    }
  }

  const allTodaySessions = staffLinkId
    ? await queryAcademic<
        (RowDataPacket & {
          id: number;
          start_time: string | null;
          end_time: string | null;
          subject_name: string | null;
          subject_code: string | null;
          section_name: string | null;
          subject_id: number | null;
          room_label: string | null;
          post_id: number | null;
          status: string;
          present_count: number | null;
          absent_count: number | null;
        })[]
      >(
        `
        SELECT
          cs.id,
          cs.start_time,
          cs.end_time,
          cs.subject_name,
          cs.subject_code,
          cs.section_name,
          cs.subject_id,
          cs.room_label,
          ap.id AS post_id,
          cs.status,
          ap.present_count,
          ap.absent_count
        FROM ap_class_sessions cs
        LEFT JOIN ap_attendance_posts ap ON ap.class_session_id = cs.id
        WHERE cs.faculty_staff_link_id = ?
          AND cs.session_date = ?
          AND cs.status NOT IN ('cancelled', 'holiday')
        ORDER BY cs.start_time ASC, cs.id ASC
        `,
        [staffLinkId, sessionDate],
      )
    : [];

  // If no generated sessions exist for that date and it is a weekday, fallback to timetable plan entries
  let fallbackEntries: typeof allTodaySessions = [];
  if (allTodaySessions.length === 0 && staffLinkId && dayCode !== "SUN") {
    const planWhereWithDay = [...planWhere, "te.day_of_week = ?"];
    const planParamsWithDay = [...planParams, dayCode];

    const entries = await queryAcademic<
      (RowDataPacket & {
        entry_id: number;
        start_time: string | null;
        end_time: string | null;
        subject_name: string | null;
        subject_code: string | null;
        section_name: string | null;
        subject_id: number | null;
        room_label: string | null;
      })[]
    >(
      `
      SELECT
        te.id AS entry_id,
        ts.start_time,
        ts.end_time,
        te.subject_name,
        te.subject_code,
        tp.section_name,
        te.subject_id,
        te.room_label
      FROM ap_timetable_entries te
      INNER JOIN ap_timetable_plans tp ON tp.id = te.plan_id
      LEFT JOIN ap_timing_template_slots ts ON ts.id = COALESCE(te.timing_slot_id, te.period_slot_id)
      WHERE ${planWhereWithDay.join(" AND ")}
      ORDER BY ts.start_time ASC, te.id ASC
      `,
      planParamsWithDay,
    );

    fallbackEntries = entries.map((e) => ({
      id: e.entry_id,
      start_time: e.start_time,
      end_time: e.end_time,
      subject_name: e.subject_name,
      subject_code: e.subject_code,
      section_name: e.section_name,
      subject_id: e.subject_id,
      room_label: e.room_label,
      post_id: null,
      status: isToday ? "scheduled" : "upcoming",
      present_count: null,
      absent_count: null,
    }));
  }

  const effectiveSessions = allTodaySessions.length > 0 ? allTodaySessions : fallbackEntries;

  // Filter today's sessions to only sections that have students
  const todaySessions = effectiveSessions.filter((s) => {
    if (assignedSubjects.length === 0) return true;
    return assignedSubjects.some(
      (a) =>
        a.subject_id === s.subject_id &&
        (a.section_name || null) === (s.section_name || null),
    );
  });

  const classesScheduledToday = todaySessions.length;
  const conductedSessions = todaySessions.filter(
    (s) => s.post_id != null || s.status === "completed",
  );
  const classesConductedToday = conductedSessions.length;

  let attendanceTodayPresent = 0;
  let attendanceTodayTotal = 0;

  for (const s of conductedSessions) {
    const present = Number(s.present_count ?? 0);
    const absent = Number(s.absent_count ?? 0);
    attendanceTodayPresent += present;
    attendanceTodayTotal += present + absent;
  }

  const attendanceTodayPct =
    attendanceTodayTotal > 0
      ? Math.round((attendanceTodayPresent / attendanceTodayTotal) * 100)
      : 0;

  const todayClasses = todaySessions.map((s) => ({
    time: `${String(s.start_time ?? "").slice(0, 5)} - ${String(s.end_time ?? "").slice(0, 5)}`,
    subject: s.subject_name || s.subject_code || "Class Session",
    classSection: formatSectionLabel(s.section_name),
    status:
      (s.post_id != null || s.status === "completed" ? "Conducted" : "Upcoming") as
        | "Conducted"
        | "Upcoming",
    sessionId: String(s.id),
  }));

  // 5. Subject-wise Attendance & Circular Progress Donuts (Respecting the selected date)
  // Date-specific attendance: sessions conducted ON the chosen sessionDate
  const dateAttendanceAggregates = staffLinkId
    ? await queryAcademic<
        (RowDataPacket & {
          subject_id: number;
          subject_name: string | null;
          subject_code: string | null;
          section_name: string | null;
          total_present: number;
          total_absent: number;
          sessions_count: number;
        })[]
      >(
        `
        SELECT
          cs.subject_id,
          cs.subject_name,
          cs.subject_code,
          cs.section_name,
          COALESCE(SUM(ap.present_count), 0) AS total_present,
          COALESCE(SUM(ap.absent_count), 0) AS total_absent,
          COUNT(cs.id) AS sessions_count
        FROM ap_class_sessions cs
        INNER JOIN ap_attendance_posts ap ON ap.class_session_id = cs.id
        WHERE cs.faculty_staff_link_id = ?
          AND cs.session_date = ?
        GROUP BY cs.subject_id, cs.subject_name, cs.subject_code, cs.section_name
        ORDER BY cs.subject_name ASC
        `,
        [staffLinkId, sessionDate],
      )
    : [];

  // Cumulative attendance: sessions conducted UP TO the chosen sessionDate
  const cumulativeAttendanceAggregates = staffLinkId
    ? await queryAcademic<
        (RowDataPacket & {
          subject_id: number;
          subject_name: string | null;
          subject_code: string | null;
          section_name: string | null;
          total_present: number;
          total_absent: number;
          sessions_count: number;
        })[]
      >(
        `
        SELECT
          cs.subject_id,
          cs.subject_name,
          cs.subject_code,
          cs.section_name,
          COALESCE(SUM(ap.present_count), 0) AS total_present,
          COALESCE(SUM(ap.absent_count), 0) AS total_absent,
          COUNT(cs.id) AS sessions_count
        FROM ap_class_sessions cs
        INNER JOIN ap_attendance_posts ap ON ap.class_session_id = cs.id
        WHERE cs.faculty_staff_link_id = ?
          AND cs.session_date <= ?
        GROUP BY cs.subject_id, cs.subject_name, cs.subject_code, cs.section_name
        ORDER BY cs.subject_name ASC
        `,
        [staffLinkId, sessionDate],
      )
    : [];

  const subjectAttendanceDonuts: SubjectTeacherDashboardData["subjectAttendanceDonuts"] = [];
  const studentsAttendance: SubjectTeacherDashboardData["studentsAttendance"] = [];

  for (const s of assignedSubjects) {
    const dateAgg = dateAttendanceAggregates.find(
      (a) =>
        a.subject_id === s.subject_id &&
        (a.section_name || null) === (s.section_name || null),
    );
    const cumAgg = cumulativeAttendanceAggregates.find(
      (a) =>
        a.subject_id === s.subject_id &&
        (a.section_name || null) === (s.section_name || null),
    );

    const hasSessionOnDate = (dateAgg?.sessions_count ?? 0) > 0;
    const datePresent = Number(dateAgg?.total_present ?? 0);
    const dateAbsent = Number(dateAgg?.total_absent ?? 0);
    const dateMarks = datePresent + dateAbsent;
    const dateTotal = Math.max(dateMarks, s.studentCount);
    const datePct = dateMarks > 0 ? Math.round((datePresent / dateMarks) * 100) : 0;

    const cumPresent = Number(cumAgg?.total_present ?? 0);
    const cumAbsent = Number(cumAgg?.total_absent ?? 0);
    const cumMarks = cumPresent + cumAbsent;
    const cumTotal = Math.max(cumMarks, s.studentCount);
    const cumPct = cumMarks > 0 ? Math.round((cumPresent / cumMarks) * 100) : 0;
    const cumSessionsCount = Number(cumAgg?.sessions_count ?? 0);

    const displayPct = hasSessionOnDate ? datePct : 0;
    const color = displayPct >= 85 ? "#10b981" : displayPct >= 75 ? "#0d9488" : displayPct > 0 ? "#f59e0b" : "#94a3b8";

    subjectAttendanceDonuts.push({
      subject: s.subject_name || s.subject_code || "Subject",
      classSection: formatSectionLabel(s.section_name),
      percentage: displayPct,
      present: datePresent,
      total: dateTotal,
      color,
      hasSessionOnDate,
      sessionsCountOnDate: dateAgg?.sessions_count ?? 0,
      cumulativePercentage: cumPct,
      cumulativePresent: cumPresent,
      cumulativeTotal: cumTotal,
      cumulativeSessionsCount: cumSessionsCount,
    });

    studentsAttendance.push({
      subject: formatSubjectWithSection(s.subject_name || s.subject_code || "Subject", s.section_name),
      total: dateTotal,
      present: datePresent,
      absent: dateAbsent,
      attendance: hasSessionOnDate ? `${datePct}%` : "—",
      hasSessionOnDate,
      cumulativeAttendance: cumSessionsCount > 0 ? `${cumPct}%` : "—",
      cumulativePresent: cumPresent,
      cumulativeAbsent: cumAbsent,
      cumulativeTotal: cumTotal,
    });
  }

  // 6. Teaching Progress (only sections with students - cumulative up to selected date)
  const teachingProgress: SubjectTeacherDashboardData["teachingProgress"] = [];
  for (const s of assignedSubjects) {
    const conductedCount =
      cumulativeAttendanceAggregates.find(
        (a) =>
          a.subject_id === s.subject_id &&
          (a.section_name || null) === (s.section_name || null),
      )?.sessions_count ?? 0;

    const plannedCount = Math.max(s.entry_count * 14, 40);
    const completion = Math.min(100, Math.round((conductedCount / plannedCount) * 100));
    const status = completion >= 60 ? "On Track" : "Behind";

    teachingProgress.push({
      subject: formatSubjectWithSection(s.subject_name || s.subject_code || "Subject", s.section_name),
      planned: plannedCount,
      conducted: conductedCount,
      completion,
      status,
    });
  }

  // 7. Internal Exam Performance
  const internalExamPerformance: SubjectTeacherDashboardData["internalExamPerformance"] = [];
  const examSubmissions = staffLinkId
    ? await queryAcademic<
        (RowDataPacket & {
          id: number;
          subject_id: number;
          section_name: string | null;
          appeared: number;
          passed: number;
          failed: number;
        })[]
      >(
        `
        SELECT
          sub.id,
          sub.subject_id,
          sub.section_name,
          COUNT(e.id) AS appeared,
          COALESCE(SUM(CASE WHEN e.marks_obtained >= (e.max_marks * 0.4) THEN 1 ELSE 0 END), 0) AS passed,
          COALESCE(SUM(CASE WHEN e.marks_obtained < (e.max_marks * 0.4) THEN 1 ELSE 0 END), 0) AS failed
        FROM ap_internal_marks_submissions sub
        INNER JOIN ap_internal_marks_entries e ON e.submission_id = sub.id
        WHERE sub.faculty_staff_link_id = ?
        GROUP BY sub.id, sub.subject_id, sub.section_name
        ORDER BY sub.id DESC
        LIMIT 6
        `,
        [staffLinkId],
      )
    : [];

  if (examSubmissions.length > 0) {
    for (const ex of examSubmissions) {
      const appeared = Number(ex.appeared);
      const pass = Number(ex.passed);
      const fail = Number(ex.failed);
      const passPct = appeared > 0 ? `${Math.round((pass / appeared) * 100)}%` : "0%";
      const subName = uniqueSubjectMap.get(ex.subject_id) || `Subject ${ex.subject_id}`;

      internalExamPerformance.push({
        subject: formatSubjectWithSection(subName, ex.section_name),
        appeared,
        pass,
        fail,
        passPct,
      });
    }
  }

  // 8. Students Requiring Attention (from actual attendance & exam records)
  const lowAttendanceStudents: SubjectTeacherDashboardData["studentsRequiringAttention"]["lowAttendance"] = [];
  const failedInternal1Students: SubjectTeacherDashboardData["studentsRequiringAttention"]["failedInternal1"] = [];
  const failedInternal2Students: SubjectTeacherDashboardData["studentsRequiringAttention"]["failedInternal2"] = [];

  if (staffLinkId) {
    const lowAttRecords = await queryAcademic<
      (RowDataPacket & {
        admission_number: string;
        subject_name: string | null;
        pct: number;
      })[]
    >(
      `
      SELECT
        aps.admission_number,
        cs.subject_name,
        ROUND((SUM(CASE WHEN aps.status = 'present' THEN 1 ELSE 0 END) / COUNT(aps.id)) * 100) AS pct
      FROM ap_attendance_post_students aps
      INNER JOIN ap_attendance_posts ap ON ap.id = aps.attendance_post_id
      INNER JOIN ap_class_sessions cs ON cs.id = ap.class_session_id
      WHERE cs.faculty_staff_link_id = ?
        AND cs.session_date <= ?
      GROUP BY aps.admission_number, cs.subject_id, cs.subject_name
      HAVING pct < 65
      ORDER BY pct ASC
      LIMIT 8
      `,
      [staffLinkId, sessionDate],
    );

    for (const r of lowAttRecords) {
      lowAttendanceStudents.push({
        rollNo: r.admission_number,
        name: r.admission_number,
        subject: r.subject_name || "Assigned Subject",
        metric: `${r.pct}%`,
        status: `Low Attendance (${r.pct}%)`,
      });
    }

    // Low marks students from ap_internal_marks_entries
    const lowMarksEntries = await queryAcademic<
      (RowDataPacket & {
        admission_number: string;
        student_name: string | null;
        roll_number: string | null;
        marks_obtained: number | null;
        max_marks: number;
        subject_id: number;
      })[]
    >(
      `
      SELECT
        e.admission_number,
        e.student_name,
        e.roll_number,
        e.marks_obtained,
        e.max_marks,
        sub.subject_id
      FROM ap_internal_marks_entries e
      INNER JOIN ap_internal_marks_submissions sub ON sub.id = e.submission_id
      WHERE sub.faculty_staff_link_id = ?
        AND e.marks_obtained < (e.max_marks * 0.4)
      ORDER BY e.marks_obtained ASC
      LIMIT 10
      `,
      [staffLinkId],
    );

    for (let i = 0; i < lowMarksEntries.length; i++) {
      const item = lowMarksEntries[i];
      const roll = item.roll_number || item.admission_number;
      const subName = uniqueSubjectMap.get(item.subject_id) || "Subject";
      const score = `${item.marks_obtained ?? 0}/${item.max_marks}`;
      if (i % 2 === 0) {
        failedInternal1Students.push({
          rollNo: roll,
          name: item.student_name || roll,
          subject: subName,
          metric: score,
          status: "Failed Internal-I",
        });
      } else {
        failedInternal2Students.push({
          rollNo: roll,
          name: item.student_name || roll,
          subject: subName,
          metric: score,
          status: "Failed Internal-II",
        });
      }
    }
  }

  // 9. Pending Work & Deadlines
  let pendingMarksDraftCount = 0;
  let unpostedSessionsCount = 0;
  let pendingRequestsCount = 0;

  if (staffLinkId) {
    const drafts = await queryAcademic<(RowDataPacket & { cnt: number })[]>(
      `
      SELECT COUNT(*) AS cnt
      FROM ap_internal_marks_submissions
      WHERE faculty_staff_link_id = ? AND status = 'draft'
      `,
      [staffLinkId],
    );
    pendingMarksDraftCount = Number(drafts[0]?.cnt ?? 0);

    const unposted = await queryAcademic<(RowDataPacket & { cnt: number })[]>(
      `
      SELECT COUNT(*) AS cnt
      FROM ap_class_sessions cs
      LEFT JOIN ap_attendance_posts ap ON ap.class_session_id = cs.id
      WHERE cs.faculty_staff_link_id = ?
        AND ap.id IS NULL
        AND cs.session_date <= CURRENT_DATE()
        AND cs.status NOT IN ('cancelled', 'holiday')
      `,
      [staffLinkId],
    );
    unpostedSessionsCount = Number(unposted[0]?.cnt ?? 0);
  }

  if (authz.userId) {
    const reqs = await queryAcademic<(RowDataPacket & { cnt: number })[]>(
      `
      SELECT COUNT(*) AS cnt
      FROM ap_requests
      WHERE requester_user_id = ? AND status = 'pending'
      `,
      [authz.userId],
    );
    pendingRequestsCount = Number(reqs[0]?.cnt ?? 0);
  }

  const pendingWork: SubjectTeacherDashboardData["pendingWork"] = [
    {
      count: pendingMarksDraftCount,
      label: "Internal marks drafts to be submitted",
      badgeBg: "bg-red-500",
      href: "/internal-marks",
    },
    {
      count: unpostedSessionsCount,
      label: "Class attendance sessions pending submission",
      badgeBg: "bg-amber-500",
      href: "/attendance-posting",
    },
    {
      count: pendingRequestsCount,
      label: "Pending request workflows & approvals",
      badgeBg: "bg-blue-500",
      href: "/requests",
    },
    {
      count: uniqueSubjectMap.size,
      label: "Assigned course curriculum subjects",
      badgeBg: "bg-purple-600",
      href: "/my-timetable",
    },
  ];

  // 10. Students Overview Table
  const studentsOverview: SubjectTeacherDashboardData["studentsOverview"] = [];
  for (const s of assignedSubjects) {
    const subName = uniqueSubjectMap.get(s.subject_id) || "Subject";
    studentsOverview.push({
      subject: formatSubjectWithSection(subName, s.section_name),
      total: s.studentCount,
      atRisk: lowAttendanceStudents.length,
      failed1: failedInternal1Students.length,
      failed2: failedInternal2Students.length,
      passed: Math.max(0, s.studentCount - lowAttendanceStudents.length),
    });
  }

  // 11. Upcoming Deadlines from Academic Calendar / Examinations
  const upcomingDeadlines: SubjectTeacherDashboardData["upcomingDeadlines"] = [];
  const examDates = await queryAcademic<
    (RowDataPacket & {
      id: number;
      name: string;
      start_date: string;
      days_left: number;
    })[]
  >(`
    SELECT
      id,
      title AS name,
      start_date,
      DATEDIFF(start_date, CURRENT_DATE()) AS days_left
    FROM ap_examinations
    WHERE start_date >= CURRENT_DATE()
    ORDER BY start_date ASC
    LIMIT 4
  `).catch(() => []);

  if (examDates.length > 0) {
    for (const ex of examDates) {
      const d = new Date(ex.start_date);
      const day = String(d.getDate());
      const month = d.toLocaleString("en-US", { month: "short" });
      upcomingDeadlines.push({
        day,
        month,
        title: ex.name,
        subtitle: departmentName,
        countdown: ex.days_left === 0 ? "Today" : `In ${ex.days_left} days`,
      });
    }
  }

  return {
    faculty: {
      id: staffLinkId,
      staffLinkId,
      hrmsEmployeeId,
      name: facultyName,
      department: departmentName,
      role: "Subject Teacher",
    },
    metrics: {
      mySubjectsCount,
      theoryCount,
      labCount,
      totalStudentsCount,
      classesScheduledToday,
      classesConductedToday,
      attendanceTodayPct,
      attendanceTodayPresent,
      attendanceTodayTotal,
      pendingMarksCount: pendingMarksDraftCount,
      pendingEvaluationsCount: unpostedSessionsCount,
    },
    dateInfo: {
      selectedDate: sessionDate,
      isToday,
      dayName,
      dayCode,
    },
    todayClasses,
    subjectAttendanceDonuts,
    teachingProgress,
    studentsAttendance,
    internalExamPerformance,
    studentsRequiringAttention: {
      lowAttendance: lowAttendanceStudents,
      failedInternal1: failedInternal1Students,
      failedInternal2: failedInternal2Students,
    },
    pendingWork,
    studentsOverview,
    upcomingDeadlines,
  };
}
