import type { RowDataPacket } from "mysql2";
import { executeAcademic, queryAcademic, queryStudent } from "../db/pools.js";
import { getTimetablePlanner } from "./timetables.service.js";
import { ensureSessionsForDate } from "./class-sessions.service.js";

export type DailyTimetableFilter = {
  collegeId: number;
  courseId?: number;
  branchId: number;
  batch: string;
  semester: number;
  sectionName?: string | null;
  academicYear: string;
  timetableDate?: string;
};

export type RecordPeriodOverrideInput = {
  timetableDate: string; // YYYY-MM-DD
  collegeId: number;
  courseId: number;
  branchId: number;
  batch: string;
  semester: number;
  sectionName?: string | null;
  academicYear: string;
  timingSlotId: number;
  slotLabel?: string | null;
  slotTime?: string | null;

  masterSubjectId?: number | null;
  masterSubjectCode?: string | null;
  masterSubjectName?: string | null;
  masterFacultyHrmsId?: string | null;
  masterFacultyName?: string | null;

  newSubjectId?: number | null;
  newSubjectCode?: string | null;
  newSubjectName?: string | null;
  newFacultyHrmsId?: string | null;
  newFacultyName?: string | null;

  remarks?: string | null;
  changeType?: "PERIOD_CHANGE" | "REVERTED_TO_MASTER";
  actorUserId?: number | null;
  actorName?: string | null;
};

export type DailyPeriodOverride = {
  slotId: number;
  slotLabel: string;
  slotTime: string;
  subjectId: string;
  subjectCode: string;
  subjectName: string;
  customLabel?: string;
  hrmsEmployeeId: string;
  facultyName: string;
  remarks: string | null;
  changedByName: string | null;
  changedAt: string;
};

export type DailyActivityRow = {
  id: number;
  timetableDate: string;
  collegeId: number;
  courseId: number;
  branchId: number;
  batch: string;
  semester: number;
  sectionName: string | null;
  academicYear: string;
  timingSlotId: number;
  slotLabel: string;
  slotTime: string;
  masterSubjectId: number | null;
  masterSubjectCode: string | null;
  masterSubjectName: string | null;
  masterFacultyHrmsId: string | null;
  masterFacultyName: string | null;
  newSubjectId: number | null;
  newSubjectCode: string | null;
  newSubjectName: string | null;
  newFacultyHrmsId: string | null;
  newFacultyName: string | null;
  changeType: "PERIOD_CHANGE" | "REVERTED_TO_MASTER";
  remarks: string | null;
  changedByUserId: number | null;
  changedByName: string | null;
  createdAt: string;
};

let tableReady: Promise<void> | null = null;

export async function ensureDailyTimetableTable() {
  if (!tableReady) {
    tableReady = (async () => {
      await executeAcademic(`
        CREATE TABLE IF NOT EXISTS ap_daily_timetable_activities (
          id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
          timetable_date DATE NOT NULL,
          college_id INT NOT NULL,
          course_id INT NOT NULL,
          branch_id INT NOT NULL,
          batch VARCHAR(50) NOT NULL,
          semester INT NOT NULL,
          section_name VARCHAR(50) NULL,
          academic_year VARCHAR(50) NOT NULL,
          timing_slot_id INT NOT NULL,
          slot_label VARCHAR(100) NULL,
          slot_time VARCHAR(100) NULL,
          
          master_subject_id INT NULL,
          master_subject_code VARCHAR(100) NULL,
          master_subject_name VARCHAR(255) NULL,
          master_faculty_hrms_id VARCHAR(100) NULL,
          master_faculty_name VARCHAR(255) NULL,
          
          new_subject_id INT NULL,
          new_subject_code VARCHAR(100) NULL,
          new_subject_name VARCHAR(255) NULL,
          new_faculty_hrms_id VARCHAR(100) NULL,
          new_faculty_name VARCHAR(255) NULL,
          
          change_type VARCHAR(50) NOT NULL DEFAULT 'PERIOD_CHANGE',
          remarks VARCHAR(500) NULL,
          changed_by_user_id INT NULL,
          changed_by_name VARCHAR(255) NULL,
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          
          KEY idx_daily_scope (timetable_date, college_id, branch_id, semester, academic_year),
          KEY idx_slot (timing_slot_id),
          KEY idx_created_at (created_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);
    })();
  }
  await tableReady;
}

type ActivityDbRow = RowDataPacket & {
  id: number;
  timetable_date: string;
  college_id: number;
  course_id: number;
  branch_id: number;
  batch: string;
  semester: number;
  section_name: string | null;
  academic_year: string;
  timing_slot_id: number;
  slot_label: string | null;
  slot_time: string | null;
  master_subject_id: number | null;
  master_subject_code: string | null;
  master_subject_name: string | null;
  master_faculty_hrms_id: string | null;
  master_faculty_name: string | null;
  new_subject_id: number | null;
  new_subject_code: string | null;
  new_subject_name: string | null;
  new_faculty_hrms_id: string | null;
  new_faculty_name: string | null;
  change_type: "PERIOD_CHANGE" | "REVERTED_TO_MASTER";
  remarks: string | null;
  changed_by_user_id: number | null;
  changed_by_name: string | null;
  created_at: string;
};

function mapActivityRow(r: ActivityDbRow): DailyActivityRow {
  return {
    id: r.id,
    timetableDate: r.timetable_date,
    collegeId: r.college_id,
    courseId: r.course_id,
    branchId: r.branch_id,
    batch: r.batch,
    semester: r.semester,
    sectionName: r.section_name,
    academicYear: r.academic_year,
    timingSlotId: r.timing_slot_id,
    slotLabel: r.slot_label || `Slot ${r.timing_slot_id}`,
    slotTime: r.slot_time || "",
    masterSubjectId: r.master_subject_id,
    masterSubjectCode: r.master_subject_code,
    masterSubjectName: r.master_subject_name,
    masterFacultyHrmsId: r.master_faculty_hrms_id,
    masterFacultyName: r.master_faculty_name,
    newSubjectId: r.new_subject_id,
    newSubjectCode: r.new_subject_code,
    newSubjectName: r.new_subject_name,
    newFacultyHrmsId: r.new_faculty_hrms_id,
    newFacultyName: r.new_faculty_name,
    changeType: r.change_type,
    remarks: r.remarks,
    changedByUserId: r.changed_by_user_id,
    changedByName: r.changed_by_name,
    createdAt: r.created_at,
  };
}

/**
 * Fetch current period overrides for a given day and class context.
 * Master timetable is completely untouched; overrides are computed from latest activity per slot.
 */
export async function getDailyTimetableData(filters: DailyTimetableFilter) {
  await ensureDailyTimetableTable();

  const conds: string[] = [
    "college_id = ?",
    "branch_id = ?",
    "batch = ?",
    "semester = ?",
    "academic_year = ?",
  ];
  const params: unknown[] = [
    filters.collegeId,
    filters.branchId,
    filters.batch,
    filters.semester,
    filters.academicYear,
  ];

  if (filters.courseId) {
    conds.push("course_id = ?");
    params.push(filters.courseId);
  }

  if (filters.sectionName && filters.sectionName !== "all") {
    conds.push("(section_name = ? OR section_name IS NULL)");
    params.push(filters.sectionName);
  }

  // Get list of distinct dates that have activity for this class scope
  const dateRows = await queryAcademic<RowDataPacket[]>(
    `
    SELECT DISTINCT timetable_date
    FROM ap_daily_timetable_activities
    WHERE ${conds.join(" AND ")}
    ORDER BY timetable_date DESC
    LIMIT 100
    `,
    params,
  );
  const datesWithActivity: string[] = dateRows.map((r) => String(r.timetable_date).slice(0, 10));

  const overrides: Record<number, DailyPeriodOverride> = {};

  if (filters.timetableDate) {
    const dateConds = [...conds, "timetable_date = ?"];
    const dateParams = [...params, filters.timetableDate];

    // Read activities for this date ordered by id ASC so later updates take precedence
    const rows = await queryAcademic<ActivityDbRow[]>(
      `
      SELECT *
      FROM ap_daily_timetable_activities
      WHERE ${dateConds.join(" AND ")}
      ORDER BY id ASC
      `,
      dateParams,
    );

    for (const r of rows) {
      if (r.change_type === "REVERTED_TO_MASTER") {
        delete overrides[r.timing_slot_id];
      } else {
        const isSpecialClass = r.new_subject_id == null && Boolean(r.new_subject_name);
        overrides[r.timing_slot_id] = {
          slotId: r.timing_slot_id,
          slotLabel: r.slot_label || "",
          slotTime: r.slot_time || "",
          subjectId: r.new_subject_id != null ? String(r.new_subject_id) : "",
          subjectCode: r.new_subject_code || "",
          subjectName: r.new_subject_name || "",
          customLabel: isSpecialClass ? (r.new_subject_name || "") : undefined,
          hrmsEmployeeId: r.new_faculty_hrms_id || "",
          facultyName: r.new_faculty_name || "",
          remarks: r.remarks,
          changedByName: r.changed_by_name,
          changedAt: r.created_at,
        };
      }
    }
  }

  return {
    date: filters.timetableDate ?? null,
    overrides,
    datesWithActivity,
  };
}

/**
 * Record a change or reversion for today's timetable.
 * NEVER modifies master timetable entries! Master timetable remains the permanent comparison benchmark.
 */
export async function recordDailyTimetableChange(input: RecordPeriodOverrideInput) {
  await ensureDailyTimetableTable();

  const changeType = input.changeType || "PERIOD_CHANGE";

  const result = await executeAcademic(
    `
    INSERT INTO ap_daily_timetable_activities (
      timetable_date,
      college_id,
      course_id,
      branch_id,
      batch,
      semester,
      section_name,
      academic_year,
      timing_slot_id,
      slot_label,
      slot_time,
      master_subject_id,
      master_subject_code,
      master_subject_name,
      master_faculty_hrms_id,
      master_faculty_name,
      new_subject_id,
      new_subject_code,
      new_subject_name,
      new_faculty_hrms_id,
      new_faculty_name,
      change_type,
      remarks,
      changed_by_user_id,
      changed_by_name
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      input.timetableDate,
      input.collegeId,
      input.courseId,
      input.branchId,
      input.batch,
      input.semester,
      input.sectionName && input.sectionName !== "all" ? input.sectionName : null,
      input.academicYear,
      input.timingSlotId,
      input.slotLabel ?? null,
      input.slotTime ?? null,
      input.masterSubjectId ?? null,
      input.masterSubjectCode ?? null,
      input.masterSubjectName ?? null,
      input.masterFacultyHrmsId ?? null,
      input.masterFacultyName ?? null,
      input.newSubjectId ?? null,
      input.newSubjectCode ?? null,
      input.newSubjectName ?? null,
      input.newFacultyHrmsId ?? null,
      input.newFacultyName ?? null,
      changeType,
      input.remarks ?? null,
      input.actorUserId ?? null,
      input.actorName ?? null,
    ],
  );

  // Synchronize the override directly with ap_class_sessions so the assigned staff sees the class immediately
  try {
    let targetStaffLinkId: number | null = null;
    const targetHrmsId =
      changeType === "REVERTED_TO_MASTER"
        ? input.masterFacultyHrmsId
        : input.newFacultyHrmsId;
    const targetFacName =
      changeType === "REVERTED_TO_MASTER"
        ? input.masterFacultyName
        : input.newFacultyName;

    if (targetHrmsId) {
      const staffRows = await queryAcademic<(RowDataPacket & { id: number })[]>(
        `SELECT id FROM ap_staff_link WHERE hrms_employee_id = ? LIMIT 1`,
        [targetHrmsId],
      );
      if (staffRows[0]) {
        targetStaffLinkId = Number(staffRows[0].id);
      } else {
        const insertRes = await executeAcademic(
          `INSERT INTO ap_staff_link (hrms_employee_id, display_name) VALUES (?, ?)`,
          [targetHrmsId, targetFacName ?? null],
        );
        targetStaffLinkId = Number(insertRes.insertId);
      }
    }

    // Ensure sessions exist for this date before attempting update
    try {
      await ensureSessionsForDate(input.timetableDate, {
        collegeId: input.collegeId,
        courseId: input.courseId,
        branchId: input.branchId,
        batch: input.batch,
        semester: input.semester,
        section: input.sectionName && input.sectionName !== "all" ? input.sectionName : undefined,
        academicYear: input.academicYear,
      });
    } catch (ensureErr) {
      console.warn("Could not ensure sessions before applying daily override:", ensureErr);
    }

    const targetSubjectId =
      changeType === "REVERTED_TO_MASTER" ? input.masterSubjectId : input.newSubjectId;
    const targetSubjectCode =
      changeType === "REVERTED_TO_MASTER" ? input.masterSubjectCode : input.newSubjectCode;
    const targetSubjectName =
      changeType === "REVERTED_TO_MASTER" ? input.masterSubjectName : input.newSubjectName;
    const secName =
      input.sectionName && input.sectionName !== "all" ? input.sectionName : null;

    await executeAcademic(
      `
      UPDATE ap_class_sessions
      SET faculty_staff_link_id = ?,
          subject_id = COALESCE(?, subject_id),
          subject_code = COALESCE(?, subject_code),
          subject_name = COALESCE(?, subject_name),
          status = IF(status = 'posted', status, 'scheduled')
      WHERE session_date = ?
        AND (timing_slot_id = ? OR period_slot_id = ?)
        AND college_id = ?
        AND branch_id = ?
        AND semester_number = ?
        AND (? IS NULL OR section_name = ?)
        AND status <> 'posted'
      `,
      [
        targetStaffLinkId,
        targetSubjectId ?? null,
        targetSubjectCode ?? null,
        targetSubjectName ?? null,
        input.timetableDate,
        input.timingSlotId,
        input.timingSlotId,
        input.collegeId,
        input.branchId,
        input.semester,
        secName,
        secName,
      ],
    );
  } catch (syncErr) {
    console.warn("Could not synchronize daily timetable override to ap_class_sessions:", syncErr);
  }

  return {
    activityId: result.insertId,
    success: true,
  };
}

/**
 * List activity details for observing previous changes.
 * Allows filtering by specific date or viewing all past changes for this class scope.
 */
export async function listDailyTimetableActivities(filters: {
  collegeId?: number;
  courseId?: number;
  branchId?: number;
  batch?: string;
  semester?: number;
  sectionName?: string | null;
  academicYear?: string;
  timetableDate?: string;
  limit?: number;
}) {
  await ensureDailyTimetableTable();

  const conds: string[] = [];
  const params: unknown[] = [];

  if (filters.collegeId) {
    conds.push("college_id = ?");
    params.push(filters.collegeId);
  }
  if (filters.courseId) {
    conds.push("course_id = ?");
    params.push(filters.courseId);
  }
  if (filters.branchId) {
    conds.push("branch_id = ?");
    params.push(filters.branchId);
  }
  if (filters.batch && filters.batch !== "all") {
    conds.push("batch = ?");
    params.push(filters.batch);
  }
  if (filters.semester) {
    conds.push("semester = ?");
    params.push(filters.semester);
  }
  if (filters.academicYear && filters.academicYear !== "all") {
    conds.push("academic_year = ?");
    params.push(filters.academicYear);
  }
  if (filters.sectionName && filters.sectionName !== "all") {
    conds.push("(section_name = ? OR section_name IS NULL)");
    params.push(filters.sectionName);
  }
  if (filters.timetableDate) {
    conds.push("timetable_date = ?");
    params.push(filters.timetableDate);
  }

  const whereClause = conds.length > 0 ? `WHERE ${conds.join(" AND ")}` : "";
  const limit = Math.min(Math.max(Number(filters.limit) || 50, 1), 200);

  const rows = await queryAcademic<ActivityDbRow[]>(
    `
    SELECT *
    FROM ap_daily_timetable_activities
    ${whereClause}
    ORDER BY timetable_date DESC, id DESC
    LIMIT ${limit}
    `,
    params,
  );

  return rows.map(mapActivityRow);
}

export type AllBatchesCohortResult = {
  batch: string;
  year: number;
  semester: number;
  section: string | null;
  yearSemLabel: string;
  batchLabel: string;
  planner: Awaited<ReturnType<typeof getTimetablePlanner>>;
  overrides: Record<number, DailyPeriodOverride>;
  datesWithActivity: string[];
};

export async function getAllBatchesDailyTimetableData(filters: {
  collegeId: number;
  courseId?: number;
  branchId: number;
  academicYear: string;
  timetableDate?: string;
  semester?: number;
}) {
  await ensureDailyTimetableTable();

  let resolvedCourseId = filters.courseId;
  if (!resolvedCourseId && filters.branchId) {
    try {
      const bRows = await queryStudent<(RowDataPacket & { course_id: number })[]>(
        `SELECT course_id FROM course_branches WHERE id = ? LIMIT 1`,
        [filters.branchId],
      );
      if (bRows[0]?.course_id) {
        resolvedCourseId = bRows[0].course_id;
      }
    } catch (err) {
      console.warn("Could not query course_branches for courseId:", err);
    }
  }

  // 1. Fetch plans from ap_timetable_plans (prefer published, then any)
  const planRows = await queryAcademic<
    (RowDataPacket & {
      id: number;
      batch: string;
      year_of_study: number | null;
      semester_number: number | null;
      section_name: string | null;
      status: string;
    })[]
  >(
    `
    SELECT id, batch, year_of_study, semester_number, section_name, status
    FROM ap_timetable_plans
    WHERE college_id = ?
      AND branch_id = ?
      AND academic_year_label = ?
    ORDER BY CASE WHEN status = 'published' THEN 0 ELSE 1 END, year_of_study DESC, batch DESC, section_name ASC
    `,
    [filters.collegeId, filters.branchId, filters.academicYear],
  );

  type CohortKey = {
    batch: string;
    year: number;
    semester: number;
    section: string | null;
  };

  const cohortsMap = new Map<string, CohortKey>();

  for (const p of planRows) {
    const b = String(p.batch || "").trim();
    if (!b) continue;
    const y = p.year_of_study != null ? Number(p.year_of_study) : 1;
    const s = p.semester_number != null ? Number(p.semester_number) : 1;
    const sec = p.section_name ? String(p.section_name).trim() : null;
    const key = `${b}_${y}_${s}_${sec || ""}`;
    if (!cohortsMap.has(key)) {
      cohortsMap.set(key, { batch: b, year: y, semester: s, section: sec });
    }
  }

  // 2. Also check live students table to identify any active batches running in this academic year
  try {
    const studentCohorts = await queryStudent<
      (RowDataPacket & {
        batch: string;
        current_year: number;
        current_semester: number;
      })[]
    >(
      `
      SELECT DISTINCT s.batch, s.current_year, s.current_semester
      FROM students s
      WHERE s.college_id = ?
        AND s.course_id = ?
        AND s.branch_id = ?
        AND s.batch IS NOT NULL AND s.batch != ''
        AND s.current_year IS NOT NULL
        AND s.current_semester IS NOT NULL
        AND TRIM(COALESCE(s.student_status, '')) COLLATE utf8mb4_unicode_ci = 'Regular' COLLATE utf8mb4_unicode_ci
      ORDER BY s.current_year DESC, s.batch DESC
      `,
      [filters.collegeId, filters.courseId, filters.branchId],
    );

    for (const sc of studentCohorts) {
      const b = String(sc.batch || "").trim();
      if (!b) continue;
      const y = Number(sc.current_year) || 1;
      const s = Number(sc.current_semester) || 1;
      const key = `${b}_${y}_${s}_`;
      if (!cohortsMap.has(key)) {
        cohortsMap.set(key, { batch: b, year: y, semester: s, section: null });
      }
    }
  } catch (err) {
    console.warn("Could not query students table for cohort fallback:", err);
  }

  // Convert to array and sort: 4th year first, then 3rd, 2nd, 1st (descending year)
  const sortedCohorts = Array.from(cohortsMap.values()).sort((a, b) => {
    if (b.year !== a.year) return b.year - a.year;
    if (b.batch !== a.batch) return b.batch.localeCompare(a.batch);
    return (a.section || "").localeCompare(b.section || "");
  });

  // Load planner and daily data for each cohort in parallel
  const batches: AllBatchesCohortResult[] = await Promise.all(
    sortedCohorts.map(async (cohort) => {
      const [planner, dailyData] = await Promise.all([
        getTimetablePlanner({
          collegeId: filters.collegeId,
          courseId: resolvedCourseId,
          branchId: filters.branchId,
          batch: cohort.batch,
          year: cohort.year,
          semester: cohort.semester,
          section: cohort.section || undefined,
          academicYear: filters.academicYear,
        }),
        getDailyTimetableData({
          collegeId: filters.collegeId,
          courseId: resolvedCourseId,
          branchId: filters.branchId,
          batch: cohort.batch,
          semester: cohort.semester,
          sectionName: cohort.section,
          academicYear: filters.academicYear,
          timetableDate: filters.timetableDate,
        }),
      ]);

      const yearSemLabel = `${cohort.year}-${cohort.semester}`;
      const batchLabel = `Batch ${cohort.batch} · ${yearSemLabel}${cohort.section ? ` (Sec ${cohort.section})` : ""}`;

      return {
        batch: cohort.batch,
        year: cohort.year,
        semester: cohort.semester,
        section: cohort.section,
        yearSemLabel,
        batchLabel,
        planner,
        overrides: dailyData.overrides,
        datesWithActivity: dailyData.datesWithActivity,
      };
    }),
  );

  return {
    date: filters.timetableDate ?? null,
    academicYear: filters.academicYear,
    batches: batches.filter((b) => b.planner.ready),
  };
}

export type MasterVsChangedReportFilter = {
  academicYear?: string;
  collegeId?: number;
  courseId?: number;
  branchId?: number;
  batch?: string;
  semester?: number;
  sectionName?: string | null;
  startDate?: string;
  endDate?: string;
  staffHrmsId?: string;
  subjectCode?: string;
  limit?: number;
};

export async function getMasterVsChangedTimetableReport(filters: MasterVsChangedReportFilter) {
  await ensureDailyTimetableTable();

  // 1. Build where conditions for activities
  const actConds: string[] = [];
  const actParams: unknown[] = [];

  if (filters.academicYear && filters.academicYear !== "all") {
    actConds.push("academic_year = ?");
    actParams.push(filters.academicYear);
  }
  if (filters.collegeId) {
    actConds.push("college_id = ?");
    actParams.push(filters.collegeId);
  }
  if (filters.courseId) {
    actConds.push("course_id = ?");
    actParams.push(filters.courseId);
  }
  if (filters.branchId) {
    actConds.push("branch_id = ?");
    actParams.push(filters.branchId);
  }
  if (filters.batch && filters.batch !== "all") {
    actConds.push("batch = ?");
    actParams.push(filters.batch);
  }
  if (filters.semester) {
    actConds.push("semester = ?");
    actParams.push(filters.semester);
  }
  if (filters.sectionName && filters.sectionName !== "all") {
    actConds.push("section_name = ?");
    actParams.push(filters.sectionName);
  }
  if (filters.startDate) {
    actConds.push("timetable_date >= ?");
    actParams.push(filters.startDate);
  }
  if (filters.endDate) {
    actConds.push("timetable_date <= ?");
    actParams.push(filters.endDate);
  }
  if (filters.staffHrmsId && filters.staffHrmsId !== "all") {
    actConds.push("(master_faculty_hrms_id = ? OR new_faculty_hrms_id = ?)");
    actParams.push(filters.staffHrmsId, filters.staffHrmsId);
  }
  if (filters.subjectCode && filters.subjectCode !== "all") {
    actConds.push("(master_subject_code = ? OR new_subject_code = ?)");
    actParams.push(filters.subjectCode, filters.subjectCode);
  }

  const actWhere = actConds.length > 0 ? `WHERE ${actConds.join(" AND ")}` : "";

  // 2. Query all matching activities
  const limit = Math.min(Math.max(Number(filters.limit) || 100, 1), 300);
  const activityRows = await queryAcademic<ActivityDbRow[]>(
    `
    SELECT *
    FROM ap_daily_timetable_activities
    ${actWhere}
    ORDER BY timetable_date DESC, id DESC
    LIMIT ${limit}
    `,
    actParams,
  );

  // 3. Query Master timetable entries matching scope
  const masterConds: string[] = ["p.status NOT IN ('superseded', 'archived')"];
  const masterParams: unknown[] = [];

  if (filters.academicYear && filters.academicYear !== "all") {
    masterConds.push("p.academic_year_label = ?");
    masterParams.push(filters.academicYear);
  }
  if (filters.collegeId) {
    masterConds.push("p.college_id = ?");
    masterParams.push(filters.collegeId);
  }
  if (filters.courseId) {
    masterConds.push("p.course_id = ?");
    masterParams.push(filters.courseId);
  }
  if (filters.branchId) {
    masterConds.push("p.branch_id = ?");
    masterParams.push(filters.branchId);
  }
  if (filters.batch && filters.batch !== "all") {
    masterConds.push("p.batch = ?");
    masterParams.push(filters.batch);
  }
  if (filters.semester) {
    masterConds.push("p.semester_number = ?");
    masterParams.push(filters.semester);
  }
  if (filters.sectionName && filters.sectionName !== "all") {
    masterConds.push("p.section_name = ?");
    masterParams.push(filters.sectionName);
  }
  if (filters.staffHrmsId && filters.staffHrmsId !== "all") {
    masterConds.push("sl.hrms_employee_id = ?");
    masterParams.push(filters.staffHrmsId);
  }
  if (filters.subjectCode && filters.subjectCode !== "all") {
    masterConds.push("e.subject_code = ?");
    masterParams.push(filters.subjectCode);
  }

  const masterRows = await queryAcademic<
    (RowDataPacket & {
      college_id: number;
      course_id: number;
      branch_id: number;
      batch: string;
      semester_number: number;
      section_name: string | null;
      subject_code: string | null;
      subject_name: string | null;
      faculty_hrms_id: string | null;
      faculty_name: string | null;
      master_periods: number;
    })[]
  >(
    `
    SELECT 
      p.college_id, p.course_id, p.branch_id, p.batch, p.semester_number, p.section_name,
      e.subject_code, e.subject_name,
      sl.hrms_employee_id as faculty_hrms_id, sl.display_name as faculty_name,
      COUNT(*) as master_periods
    FROM ap_timetable_plans p
    INNER JOIN ap_timetable_entries e ON e.plan_id = p.id
    LEFT JOIN ap_staff_link sl ON sl.id = e.faculty_staff_link_id
    WHERE ${masterConds.join(" AND ")}
    GROUP BY p.college_id, p.course_id, p.branch_id, p.batch, p.semester_number, p.section_name,
             e.subject_code, e.subject_name, sl.hrms_employee_id, sl.display_name
    `,
    masterParams,
  );

  // 4. Query Class sessions & attendance posts
  const sessConds: string[] = [];
  const sessParams: unknown[] = [];

  if (filters.academicYear && filters.academicYear !== "all") {
    sessConds.push("cs.academic_year_label = ?");
    sessParams.push(filters.academicYear);
  }
  if (filters.collegeId) {
    sessConds.push("cs.college_id = ?");
    sessParams.push(filters.collegeId);
  }
  if (filters.branchId) {
    sessConds.push("cs.branch_id = ?");
    sessParams.push(filters.branchId);
  } else if (filters.courseId) {
    const branchRows = await queryStudent<Array<RowDataPacket & { id: number }>>(
      "SELECT id FROM course_branches WHERE course_id = ?",
      [filters.courseId],
    );
    const branchIds = branchRows.map((r) => r.id);
    if (branchIds.length > 0) {
      sessConds.push(`cs.branch_id IN (${branchIds.map(() => "?").join(", ")})`);
      sessParams.push(...branchIds);
    }
  }
  if (filters.batch && filters.batch !== "all") {
    sessConds.push("cs.batch_label = ?");
    sessParams.push(filters.batch);
  }
  if (filters.semester) {
    sessConds.push("cs.semester_number = ?");
    sessParams.push(filters.semester);
  }
  if (filters.sectionName && filters.sectionName !== "all") {
    sessConds.push("cs.section_name = ?");
    sessParams.push(filters.sectionName);
  }
  if (filters.startDate) {
    sessConds.push("cs.session_date >= ?");
    sessParams.push(filters.startDate);
  }
  if (filters.endDate) {
    sessConds.push("cs.session_date <= ?");
    sessParams.push(filters.endDate);
  }
  if (filters.staffHrmsId && filters.staffHrmsId !== "all") {
    sessConds.push("sl.hrms_employee_id = ?");
    sessParams.push(filters.staffHrmsId);
  }
  if (filters.subjectCode && filters.subjectCode !== "all") {
    sessConds.push("cs.subject_code = ?");
    sessParams.push(filters.subjectCode);
  }

  const sessWhere = sessConds.length > 0 ? `WHERE ${sessConds.join(" AND ")}` : "";

  const sessionRows = await queryAcademic<
    (RowDataPacket & {
      subject_code: string | null;
      subject_name: string | null;
      faculty_hrms_id: string | null;
      faculty_name: string | null;
      total_sessions: number;
      conducted_sessions: number;
      total_present: number;
      total_marked: number;
    })[]
  >(
    `
    SELECT 
      cs.subject_code, cs.subject_name,
      sl.hrms_employee_id as faculty_hrms_id, sl.display_name as faculty_name,
      COUNT(DISTINCT cs.id) as total_sessions,
      COUNT(DISTINCT ap.id) as conducted_sessions,
      SUM(COALESCE(ap.present_count, 0)) as total_present,
      SUM(COALESCE(ap.present_count, 0) + COALESCE(ap.absent_count, 0)) as total_marked
    FROM ap_class_sessions cs
    LEFT JOIN ap_attendance_posts ap ON ap.class_session_id = cs.id
    LEFT JOIN ap_staff_link sl ON sl.id = cs.faculty_staff_link_id
    ${sessWhere}
    GROUP BY cs.subject_code, cs.subject_name, sl.hrms_employee_id, sl.display_name
    `,
    sessParams,
  );

  // 4b. Query period-by-period comparisons (Master vs Today)
  const compConds: string[] = [];
  const compParams: unknown[] = [];

  if (filters.academicYear && filters.academicYear !== "all") {
    compConds.push("cs.academic_year_label = ?");
    compParams.push(filters.academicYear);
  }
  if (filters.collegeId) {
    compConds.push("cs.college_id = ?");
    compParams.push(filters.collegeId);
  }
  if (filters.branchId) {
    compConds.push("cs.branch_id = ?");
    compParams.push(filters.branchId);
  } else if (filters.courseId) {
    const branchRows = await queryStudent<Array<RowDataPacket & { id: number }>>(
      "SELECT id FROM course_branches WHERE course_id = ?",
      [filters.courseId],
    );
    const branchIds = branchRows.map((r) => r.id);
    if (branchIds.length > 0) {
      compConds.push(`cs.branch_id IN (${branchIds.map(() => "?").join(", ")})`);
      compParams.push(...branchIds);
    }
  }
  if (filters.batch && filters.batch !== "all") {
    compConds.push("cs.batch_label = ?");
    compParams.push(filters.batch);
  }
  if (filters.semester) {
    compConds.push("cs.semester_number = ?");
    compParams.push(filters.semester);
  }
  if (filters.sectionName && filters.sectionName !== "all") {
    compConds.push("cs.section_name = ?");
    compParams.push(filters.sectionName);
  }
  if (filters.startDate) {
    compConds.push("cs.session_date >= ?");
    compParams.push(filters.startDate);
  }
  if (filters.endDate) {
    compConds.push("cs.session_date <= ?");
    compParams.push(filters.endDate);
  }
  if (filters.staffHrmsId && filters.staffHrmsId !== "all") {
    compConds.push("(sl.hrms_employee_id = ? OR sl_master.hrms_employee_id = ?)");
    compParams.push(filters.staffHrmsId, filters.staffHrmsId);
  }
  if (filters.subjectCode && filters.subjectCode !== "all") {
    compConds.push("(cs.subject_code = ? OR te.subject_code = ?)");
    compParams.push(filters.subjectCode, filters.subjectCode);
  }

  const compWhere = compConds.length > 0 ? `WHERE ${compConds.join(" AND ")}` : "";

  const comparisonRows = await queryAcademic<
    (RowDataPacket & {
      id: number;
      session_date: string;
      day_of_week: string;
      start_time: string;
      end_time: string;
      period_slot_id: number | null;
      batch: string | null;
      section_name: string | null;
      semester_number: number | null;
      actual_subject_code: string | null;
      actual_subject_name: string | null;
      actual_faculty_name: string | null;
      actual_faculty_hrms_id: string | null;
      master_subject_code: string | null;
      master_subject_name: string | null;
      master_faculty_name: string | null;
      master_faculty_hrms_id: string | null;
      attendance_post_id: number | null;
      present_count: number | null;
      absent_count: number | null;
    })[]
  >(
    `
    SELECT 
      cs.id,
      cs.session_date,
      cs.day_of_week,
      cs.start_time,
      cs.end_time,
      cs.period_slot_id,
      cs.batch_label as batch,
      cs.section_name,
      cs.semester_number,
      cs.subject_code as actual_subject_code,
      cs.subject_name as actual_subject_name,
      sl.display_name as actual_faculty_name,
      sl.hrms_employee_id as actual_faculty_hrms_id,
      COALESCE(te.subject_code, cs.subject_code) as master_subject_code,
      COALESCE(te.subject_name, cs.subject_name) as master_subject_name,
      COALESCE(sl_master.display_name, sl.display_name) as master_faculty_name,
      COALESCE(sl_master.hrms_employee_id, sl.hrms_employee_id) as master_faculty_hrms_id,
      ap.id as attendance_post_id,
      ap.present_count,
      ap.absent_count
    FROM ap_class_sessions cs
    LEFT JOIN ap_timetable_entries te ON te.id = cs.timetable_entry_id
    LEFT JOIN ap_staff_link sl_master ON sl_master.id = te.faculty_staff_link_id
    LEFT JOIN ap_staff_link sl ON sl.id = cs.faculty_staff_link_id
    LEFT JOIN ap_attendance_posts ap ON ap.class_session_id = cs.id
    ${compWhere}
    ORDER BY cs.session_date DESC, cs.start_time ASC
    LIMIT 200
    `,
    compParams,
  );

  const comparisons = comparisonRows.map((r) => {
    const isSubstitute = Boolean(
      r.actual_faculty_hrms_id &&
        r.master_faculty_hrms_id &&
        r.actual_faculty_hrms_id.trim() !== r.master_faculty_hrms_id.trim(),
    );
    const isSwap = Boolean(
      r.actual_subject_code &&
        r.master_subject_code &&
        r.actual_subject_code.trim().toUpperCase() !==
          r.master_subject_code.trim().toUpperCase(),
    );

    let varianceType: "UNCHANGED" | "FACULTY_SUBSTITUTE" | "SUBJECT_SWAP" | "BOTH" =
      "UNCHANGED";
    if (isSubstitute && isSwap) varianceType = "BOTH";
    else if (isSubstitute) varianceType = "FACULTY_SUBSTITUTE";
    else if (isSwap) varianceType = "SUBJECT_SWAP";

    const totalMarked = (r.present_count || 0) + (r.absent_count || 0);
    const attendancePct =
      totalMarked > 0 ? Math.round(((r.present_count || 0) / totalMarked) * 100) : null;

    return {
      id: r.id,
      date: String(r.session_date).slice(0, 10),
      dayOfWeek: r.day_of_week || "",
      time: `${r.start_time ? r.start_time.slice(0, 5) : ""} - ${r.end_time ? r.end_time.slice(0, 5) : ""}`,
      slotLabel: r.period_slot_id ? `P${r.period_slot_id}` : "Session",
      batch: r.batch || "Regular",
      sectionName: r.section_name || null,
      semester: r.semester_number || 1,
      masterSubjectCode: r.master_subject_code,
      masterSubjectName: r.master_subject_name,
      masterFacultyName: r.master_faculty_name,
      masterFacultyHrmsId: r.master_faculty_hrms_id,
      todaySubjectCode: r.actual_subject_code,
      todaySubjectName: r.actual_subject_name,
      todayFacultyName: r.actual_faculty_name,
      todayFacultyHrmsId: r.actual_faculty_hrms_id,
      varianceType,
      isConducted: Boolean(r.attendance_post_id),
      presentCount: r.present_count || 0,
      absentCount: r.absent_count || 0,
      attendancePct,
    };
  });

  // 5. Build Aggregates
  let totalMasterPeriods = 0;
  for (const m of masterRows) {
    totalMasterPeriods += Number(m.master_periods) || 0;
  }

  let totalScheduledSessions = 0;
  let totalConductedSessions = 0;
  let sumPresent = 0;
  let sumMarked = 0;
  for (const s of sessionRows) {
    totalScheduledSessions += Number(s.total_sessions) || 0;
    totalConductedSessions += Number(s.conducted_sessions) || 0;
    sumPresent += Number(s.total_present) || 0;
    sumMarked += Number(s.total_marked) || 0;
  }

  const attendanceAvgPct =
    sumMarked > 0 ? Math.round((sumPresent / sumMarked) * 100) : 0;

  // Process activities
  let facultySubstitutionsCount = 0;
  let subjectSwapsCount = 0;
  let revertedCount = 0;

  const subjectMap = new Map<
    string,
    {
      subjectCode: string;
      subjectName: string;
      masterWeeklyPeriods: number;
      totalConducted: number;
      timesChanged: number;
      timesSwappedOut: number;
      timesSwappedIn: number;
      facultyNames: Set<string>;
      totalPresent: number;
      totalMarked: number;
    }
  >();

  const facultyMap = new Map<
    string,
    {
      hrmsId: string;
      facultyName: string;
      masterAssignedPeriods: number;
      classesConducted: number;
      relievedCount: number;
      substituteTakenCount: number;
      subjects: Set<string>;
    }
  >();

  // Initialize from Master Rows
  for (const m of masterRows) {
    if (m.subject_code) {
      const code = m.subject_code.trim();
      const existing = subjectMap.get(code) || {
        subjectCode: code,
        subjectName: m.subject_name?.trim() || code,
        masterWeeklyPeriods: 0,
        totalConducted: 0,
        timesChanged: 0,
        timesSwappedOut: 0,
        timesSwappedIn: 0,
        facultyNames: new Set<string>(),
        totalPresent: 0,
        totalMarked: 0,
      };
      existing.masterWeeklyPeriods += Number(m.master_periods) || 0;
      if (m.faculty_name) existing.facultyNames.add(m.faculty_name.trim());
      subjectMap.set(code, existing);
    }

    if (m.faculty_hrms_id) {
      const hrms = m.faculty_hrms_id.trim();
      const existing = facultyMap.get(hrms) || {
        hrmsId: hrms,
        facultyName: m.faculty_name?.trim() || `Staff #${hrms}`,
        masterAssignedPeriods: 0,
        classesConducted: 0,
        relievedCount: 0,
        substituteTakenCount: 0,
        subjects: new Set<string>(),
      };
      existing.masterAssignedPeriods += Number(m.master_periods) || 0;
      if (m.subject_name) existing.subjects.add(m.subject_name.trim());
      facultyMap.set(hrms, existing);
    }
  }

  // Incorporate Session Rows (Conducted Classes)
  for (const s of sessionRows) {
    if (s.subject_code) {
      const code = s.subject_code.trim();
      const existing = subjectMap.get(code) || {
        subjectCode: code,
        subjectName: s.subject_name?.trim() || code,
        masterWeeklyPeriods: 0,
        totalConducted: 0,
        timesChanged: 0,
        timesSwappedOut: 0,
        timesSwappedIn: 0,
        facultyNames: new Set<string>(),
        totalPresent: 0,
        totalMarked: 0,
      };
      existing.totalConducted += Number(s.conducted_sessions) || 0;
      existing.totalPresent += Number(s.total_present) || 0;
      existing.totalMarked += Number(s.total_marked) || 0;
      if (s.faculty_name) existing.facultyNames.add(s.faculty_name.trim());
      subjectMap.set(code, existing);
    }

    if (s.faculty_hrms_id) {
      const hrms = s.faculty_hrms_id.trim();
      const existing = facultyMap.get(hrms) || {
        hrmsId: hrms,
        facultyName: s.faculty_name?.trim() || `Staff #${hrms}`,
        masterAssignedPeriods: 0,
        classesConducted: 0,
        relievedCount: 0,
        substituteTakenCount: 0,
        subjects: new Set<string>(),
      };
      existing.classesConducted += Number(s.conducted_sessions) || 0;
      if (s.subject_name) existing.subjects.add(s.subject_name.trim());
      facultyMap.set(hrms, existing);
    }
  }

  // Incorporate Daily Activities (Changes & Overrides)
  const recentChanges = activityRows.map((r) => {
    const isReverted = r.change_type === "REVERTED_TO_MASTER";
    const facChanged =
      !isReverted &&
      Boolean(
        r.new_faculty_hrms_id &&
          r.master_faculty_hrms_id &&
          r.new_faculty_hrms_id.trim() !== r.master_faculty_hrms_id.trim(),
      );
    const subChanged =
      !isReverted &&
      Boolean(
        r.new_subject_code &&
          r.master_subject_code &&
          r.new_subject_code.trim().toUpperCase() !==
            r.master_subject_code.trim().toUpperCase(),
      );

    if (isReverted) {
      revertedCount++;
    } else {
      if (facChanged) facultySubstitutionsCount++;
      if (subChanged) subjectSwapsCount++;
    }

    let varianceType: "FACULTY_SUBSTITUTE" | "SUBJECT_SWAP" | "BOTH" | "REVERTED" | "PERIOD_OVERRIDE" =
      "PERIOD_OVERRIDE";
    if (isReverted) varianceType = "REVERTED";
    else if (facChanged && subChanged) varianceType = "BOTH";
    else if (facChanged) varianceType = "FACULTY_SUBSTITUTE";
    else if (subChanged) varianceType = "SUBJECT_SWAP";

    if (r.master_subject_code) {
      const code = r.master_subject_code.trim();
      const sub = subjectMap.get(code);
      if (sub) {
        sub.timesChanged++;
        if (subChanged) sub.timesSwappedOut++;
      }
    }
    if (r.new_subject_code && subChanged) {
      const code = r.new_subject_code.trim();
      const sub = subjectMap.get(code) || {
        subjectCode: code,
        subjectName: r.new_subject_name?.trim() || code,
        masterWeeklyPeriods: 0,
        totalConducted: 0,
        timesChanged: 0,
        timesSwappedOut: 0,
        timesSwappedIn: 0,
        facultyNames: new Set<string>(),
        totalPresent: 0,
        totalMarked: 0,
      };
      sub.timesSwappedIn++;
      subjectMap.set(code, sub);
    }

    if (r.master_faculty_hrms_id && facChanged) {
      const hrms = r.master_faculty_hrms_id.trim();
      const fac = facultyMap.get(hrms);
      if (fac) fac.relievedCount++;
    }
    if (r.new_faculty_hrms_id && facChanged) {
      const hrms = r.new_faculty_hrms_id.trim();
      const fac = facultyMap.get(hrms) || {
        hrmsId: hrms,
        facultyName: r.new_faculty_name?.trim() || `Staff #${hrms}`,
        masterAssignedPeriods: 0,
        classesConducted: 0,
        relievedCount: 0,
        substituteTakenCount: 0,
        subjects: new Set<string>(),
      };
      fac.substituteTakenCount++;
      facultyMap.set(hrms, fac);
    }

    return {
      id: r.id,
      timetableDate: String(r.timetable_date).slice(0, 10),
      collegeId: r.college_id,
      courseId: r.course_id,
      branchId: r.branch_id,
      batch: r.batch,
      semester: r.semester,
      sectionName: r.section_name,
      slotLabel: r.slot_label || `Slot ${r.timing_slot_id}`,
      slotTime: r.slot_time || "",
      masterSubjectCode: r.master_subject_code,
      masterSubjectName: r.master_subject_name,
      masterFacultyHrmsId: r.master_faculty_hrms_id,
      masterFacultyName: r.master_faculty_name,
      newSubjectCode: r.new_subject_code,
      newSubjectName: r.new_subject_name,
      newFacultyHrmsId: r.new_faculty_hrms_id,
      newFacultyName: r.new_faculty_name,
      changeType: r.change_type,
      remarks: r.remarks,
      changedByName: r.changed_by_name,
      createdAt: r.created_at,
      varianceType,
    };
  });

  const totalChangesRecorded = activityRows.length;
  const overallChangeRatePct =
    totalScheduledSessions > 0
      ? Math.min(100, Math.round((totalChangesRecorded / totalScheduledSessions) * 100))
      : totalMasterPeriods > 0
        ? Math.min(100, Math.round((totalChangesRecorded / (totalMasterPeriods * 15)) * 100))
        : 0;

  const subjects = Array.from(subjectMap.values())
    .map((s) => ({
      subjectCode: s.subjectCode,
      subjectName: s.subjectName,
      masterWeeklyPeriods: s.masterWeeklyPeriods,
      totalConducted: s.totalConducted,
      timesChanged: s.timesChanged,
      timesSwappedOut: s.timesSwappedOut,
      timesSwappedIn: s.timesSwappedIn,
      facultyNames: Array.from(s.facultyNames),
      attendancePct:
        s.totalMarked > 0 ? Math.round((s.totalPresent / s.totalMarked) * 100) : 0,
    }))
    .sort((a, b) => b.timesChanged - a.timesChanged || b.masterWeeklyPeriods - a.masterWeeklyPeriods);

  const faculties = Array.from(facultyMap.values())
    .map((f) => ({
      hrmsId: f.hrmsId,
      facultyName: f.facultyName,
      masterAssignedPeriods: f.masterAssignedPeriods,
      classesConducted: f.classesConducted,
      relievedCount: f.relievedCount,
      substituteTakenCount: f.substituteTakenCount,
      netTeachingCount: f.classesConducted || Math.max(0, f.masterAssignedPeriods - f.relievedCount + f.substituteTakenCount),
      subjects: Array.from(f.subjects),
    }))
    .sort(
      (a, b) =>
        b.substituteTakenCount + b.relievedCount - (a.substituteTakenCount + a.relievedCount) ||
        b.masterAssignedPeriods - a.masterAssignedPeriods,
    );

  // 5. Query catalog of faculties and subjects across the academic scope (unfiltered by staffHrmsId or subjectCode)
  const scopeMasterConds = ["p.status NOT IN ('superseded', 'archived')"];
  const scopeMasterParams: unknown[] = [];

  if (filters.academicYear && filters.academicYear !== "all") {
    scopeMasterConds.push("p.academic_year_label = ?");
    scopeMasterParams.push(filters.academicYear);
  }
  if (filters.collegeId) {
    scopeMasterConds.push("p.college_id = ?");
    scopeMasterParams.push(filters.collegeId);
  }
  if (filters.courseId) {
    scopeMasterConds.push("p.course_id = ?");
    scopeMasterParams.push(filters.courseId);
  }
  if (filters.branchId) {
    scopeMasterConds.push("p.branch_id = ?");
    scopeMasterParams.push(filters.branchId);
  }
  if (filters.batch && filters.batch !== "all") {
    scopeMasterConds.push("p.batch = ?");
    scopeMasterParams.push(filters.batch);
  }

  const [catalogSubjectRows, catalogFacultyRows] = await Promise.all([
    queryAcademic<Array<RowDataPacket & { subject_code: string | null; subject_name: string | null }>>(
      `
      SELECT DISTINCT e.subject_code, e.subject_name
      FROM ap_timetable_plans p
      JOIN ap_timetable_entries e ON e.plan_id = p.id
      WHERE ${scopeMasterConds.join(" AND ")} AND e.subject_code IS NOT NULL AND e.subject_code != ''
      ORDER BY e.subject_name ASC
      `,
      scopeMasterParams,
    ),
    queryAcademic<Array<RowDataPacket & { hrms_employee_id: string | null; display_name: string | null }>>(
      `
      SELECT DISTINCT sl.hrms_employee_id, sl.display_name
      FROM ap_timetable_plans p
      JOIN ap_timetable_entries e ON e.plan_id = p.id
      JOIN ap_staff_link sl ON sl.id = e.faculty_staff_link_id
      WHERE ${scopeMasterConds.join(" AND ")} AND sl.hrms_employee_id IS NOT NULL
      ORDER BY sl.display_name ASC
      `,
      scopeMasterParams,
    ),
  ]);

  const catalogSubjectsMap = new Map<string, string>();
  for (const row of catalogSubjectRows) {
    if (row.subject_code) {
      catalogSubjectsMap.set(row.subject_code.trim(), row.subject_name?.trim() || row.subject_code.trim());
    }
  }
  for (const act of activityRows) {
    if (act.master_subject_code) {
      catalogSubjectsMap.set(act.master_subject_code.trim(), act.master_subject_name?.trim() || act.master_subject_code.trim());
    }
    if (act.new_subject_code) {
      catalogSubjectsMap.set(act.new_subject_code.trim(), act.new_subject_name?.trim() || act.new_subject_code.trim());
    }
  }

  const catalogFacultiesMap = new Map<string, string>();
  for (const row of catalogFacultyRows) {
    if (row.hrms_employee_id) {
      catalogFacultiesMap.set(row.hrms_employee_id.trim(), row.display_name?.trim() || `Staff #${row.hrms_employee_id}`);
    }
  }
  for (const act of activityRows) {
    if (act.master_faculty_hrms_id) {
      catalogFacultiesMap.set(act.master_faculty_hrms_id.trim(), act.master_faculty_name?.trim() || `Staff #${act.master_faculty_hrms_id}`);
    }
    if (act.new_faculty_hrms_id) {
      catalogFacultiesMap.set(act.new_faculty_hrms_id.trim(), act.new_faculty_name?.trim() || `Staff #${act.new_faculty_hrms_id}`);
    }
  }

  const catalogSubjects = Array.from(catalogSubjectsMap.entries())
    .map(([subjectCode, subjectName]) => ({ subjectCode, subjectName }))
    .sort((a, b) => a.subjectName.localeCompare(b.subjectName));

  const catalogFaculties = Array.from(catalogFacultiesMap.entries())
    .map(([hrmsId, facultyName]) => ({ hrmsId, facultyName }))
    .sort((a, b) => a.facultyName.localeCompare(b.facultyName));

  return {
    summary: {
      totalMasterPeriods,
      totalScheduledSessions,
      totalConductedSessions,
      totalChangesRecorded,
      facultySubstitutionsCount,
      subjectSwapsCount,
      revertedCount,
      overallChangeRatePct,
      attendanceAvgPct,
    },
    subjects,
    faculties,
    recentChanges,
    comparisons,
    catalogSubjects,
    catalogFaculties,
  };
}

