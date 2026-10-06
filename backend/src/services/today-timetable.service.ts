import type { RowDataPacket } from "mysql2";
import { executeAcademic, queryAcademic, queryStudent } from "../db/pools.js";
import { getTimetablePlanner } from "./timetables.service.js";

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
        overrides[r.timing_slot_id] = {
          slotId: r.timing_slot_id,
          slotLabel: r.slot_label || "",
          slotTime: r.slot_time || "",
          subjectId: r.new_subject_id != null ? String(r.new_subject_id) : "",
          subjectCode: r.new_subject_code || "",
          subjectName: r.new_subject_name || "",
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

