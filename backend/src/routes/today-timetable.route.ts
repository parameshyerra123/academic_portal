import { Router } from "express";
import type { AuthedRequest } from "../middleware/auth.middleware.js";
import {
  requirePermission,
  scopedFilters,
  statusFromAuthzError,
} from "../authz/require-permission.js";
import {
  getDailyTimetableData,
  getAllBatchesDailyTimetableData,
  listDailyTimetableActivities,
  recordDailyTimetableChange,
  getMasterVsChangedTimetableReport,
  declareDailyTimetableHoliday,
} from "../services/today-timetable.service.js";

export const todayTimetableRouter = Router();

function num(value: unknown) {
  if (typeof value !== "string" && typeof value !== "number") return undefined;
  if (value === "" || value === "all") return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

function str(value: unknown) {
  if (typeof value !== "string" || value === "" || value === "all") return undefined;
  return value.trim();
}

function sendAuthzError(res: import("express").Response, error: unknown, next: import("express").NextFunction) {
  const status = statusFromAuthzError(error);
  if (status === 401 || status === 403) {
    res.status(status).json({ message: (error as Error).message || "Forbidden" });
    return;
  }
  next(error);
}

// GET /api/today-timetable/all-batches
todayTimetableRouter.get("/all-batches", requirePermission("today_timetable.view", "timetable.view"), async (req: AuthedRequest, res, next) => {
  try {
    const scoped = scopedFilters(req, {
      collegeId: num(req.query.collegeId),
      branchId: num(req.query.branchId),
    });

    const collegeId = scoped.collegeId;
    const courseId = num(req.query.courseId);
    const branchId = scoped.branchId;
    const academicYear = str(req.query.academicYear);
    const timetableDate = str(req.query.date);

    if (!collegeId || !branchId || !academicYear) {
      res.json({
        date: timetableDate ?? null,
        academicYear: academicYear ?? null,
        batches: [],
      });
      return;
    }

    const data = await getAllBatchesDailyTimetableData({
      collegeId,
      courseId,
      branchId,
      academicYear,
      timetableDate,
    });

    res.json(data);
  } catch (error) {
    sendAuthzError(res, error, next);
  }
});

// GET /api/today-timetable
todayTimetableRouter.get("/", requirePermission("today_timetable.view", "timetable.view"), async (req: AuthedRequest, res, next) => {
  try {
    const scoped = scopedFilters(req, {
      collegeId: num(req.query.collegeId),
      branchId: num(req.query.branchId),
    });

    const collegeId = scoped.collegeId;
    const courseId = num(req.query.courseId);
    const branchId = scoped.branchId;
    const batch = str(req.query.batch);
    const semester = num(req.query.semester);
    const academicYear = str(req.query.academicYear);
    const sectionName = str(req.query.section);
    const timetableDate = str(req.query.date);

    if (!collegeId || !courseId || !branchId || !batch || !semester || !academicYear) {
      res.json({
        date: timetableDate ?? null,
        overrides: {},
        datesWithActivity: [],
      });
      return;
    }

    const data = await getDailyTimetableData({
      collegeId,
      courseId,
      branchId,
      batch,
      semester,
      sectionName,
      academicYear,
      timetableDate,
    });

    res.json(data);
  } catch (error) {
    sendAuthzError(res, error, next);
  }
});

// POST /api/today-timetable/override
todayTimetableRouter.post("/override", requirePermission("today_timetable.edit", "timetable.edit"), async (req: AuthedRequest, res, next) => {
  try {
    const body = req.body || {};
    const scoped = scopedFilters(req, {
      collegeId: num(body.collegeId),
      branchId: num(body.branchId),
    });

    const collegeId = scoped.collegeId;
    const courseId = num(body.courseId);
    const branchId = scoped.branchId;
    const batch = str(body.batch);
    const semester = num(body.semester);
    const academicYear = str(body.academicYear);
    const timetableDate = str(body.date || body.timetableDate);
    const timingSlotId = num(body.slotId || body.timingSlotId);

    if (!collegeId || !courseId || !branchId || !batch || !semester || !academicYear || !timetableDate || !timingSlotId) {
      res.status(400).json({ message: "Missing required parameters for daily timetable override" });
      return;
    }

    // Role or Permission validation: users with today_timetable.edit or standard leadership roles can change timetable
    const hasEditPermission = req.authz?.permissions?.includes("today_timetable.edit") || req.authz?.permissions?.includes("timetable.edit");
    const userRoleKeys = (req.authz?.roleKeys ?? []).map((k) => k.toLowerCase().replace(/[\s-]/g, "_"));
    const allowedRoles = ["super_admin", "superadmin", "principal", "vice_principal", "viceprincipal", "hod", "hods"];
    const canChange = Boolean(hasEditPermission) || allowedRoles.some((role) => userRoleKeys.includes(role));
    if (!canChange) {
      res.status(403).json({
        message: "You are not authorized to edit Today's Timetable. Access can be granted in User Management.",
      });
      return;
    }

    // Past date validation: previous days are view-only
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    if (timetableDate < todayStr) {
      res.status(400).json({
        message: "Past days timetable cannot be changed. Previous days are view-only.",
      });
      return;
    }

    const targetSlotIds: number[] =
      Array.isArray(body.slotIds) && body.slotIds.length > 0
        ? (body.slotIds as unknown[])
            .map((id) => Number(id))
            .filter((id) => !isNaN(id) && id > 0)
        : timingSlotId
          ? [timingSlotId]
          : [];

    if (targetSlotIds.length === 0) {
      res.status(400).json({ message: "Invalid timing slot ID" });
      return;
    }

    let lastResult: unknown = null;
    for (const tSlotId of targetSlotIds) {
      lastResult = await recordDailyTimetableChange({
        timetableDate,
        collegeId,
        courseId,
        branchId,
        batch,
        semester,
        sectionName: str(body.section || body.sectionName),
        academicYear,
        timingSlotId: tSlotId,
        slotLabel: str(body.slotLabel),
        slotTime: str(body.slotTime),

        masterSubjectId: num(body.masterSubjectId),
        masterSubjectCode: str(body.masterSubjectCode),
        masterSubjectName: str(body.masterSubjectName),
        masterFacultyHrmsId: str(body.masterFacultyHrmsId),
        masterFacultyName: str(body.masterFacultyName),

        newSubjectId: num(body.newSubjectId),
        newSubjectCode: str(body.newSubjectCode),
        newSubjectName: str(body.newSubjectName),
        newFacultyHrmsId: str(body.newFacultyHrmsId),
        newFacultyName: str(body.newFacultyName),

        remarks: str(body.remarks),
        changeType: body.changeType === "REVERTED_TO_MASTER" ? "REVERTED_TO_MASTER" : "PERIOD_CHANGE",
        actorUserId: req.authUser?.id,
        actorName: req.authUser?.name || req.authUser?.username || "Authorized User",
      });
    }

    res.json(lastResult ?? { success: true });
  } catch (error) {
    sendAuthzError(res, error, next);
  }
});

// POST /api/today-timetable/holiday
todayTimetableRouter.post("/holiday", requirePermission("today_timetable.edit", "timetable.edit", "attendance_calendar.edit"), async (req: AuthedRequest, res, next) => {
  try {
    const body = req.body || {};
    const timetableDate = str(body.date || body.timetableDate);
    const title = str(body.title);

    if (!timetableDate || !title) {
      res.status(400).json({ message: "Date and holiday title are required." });
      return;
    }

    // Role or Permission validation: users with today_timetable.edit or standard leadership roles
    const hasEditPermission =
      req.authz?.permissions?.includes("today_timetable.edit") ||
      req.authz?.permissions?.includes("timetable.edit") ||
      req.authz?.permissions?.includes("attendance_calendar.edit");
    const userRoleKeys = (req.authz?.roleKeys ?? []).map((k) => k.toLowerCase().replace(/[\s-]/g, "_"));
    const allowedRoles = ["super_admin", "superadmin", "principal", "vice_principal", "viceprincipal", "hod", "hods"];
    const canChange = Boolean(hasEditPermission) || allowedRoles.some((role) => userRoleKeys.includes(role));
    if (!canChange) {
      res.status(403).json({
        message: "You are not authorized to declare holidays. Access can be granted in User Management.",
      });
      return;
    }

    // Past date check:
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    if (timetableDate < todayStr) {
      res.status(400).json({
        message: "Past dates cannot be marked as holidays. Previous days are view-only.",
      });
      return;
    }

    const parseNumArray = (arr: unknown): number[] => {
      if (!Array.isArray(arr)) return [];
      return arr.map((item) => Number(item)).filter((n) => Number.isFinite(n) && n > 0);
    };

    const parseStrArray = (arr: unknown): string[] => {
      if (!Array.isArray(arr)) return [];
      return arr.map((item) => String(item).trim()).filter(Boolean);
    };

    const result = await declareDailyTimetableHoliday({
      timetableDate,
      academicYear: str(body.academicYear),
      title,
      remarks: str(body.remarks),
      holidayMode: body.holidayMode === "SLOTS" ? "SLOTS" : "FULL_DAY",
      slotIds: parseNumArray(body.slotIds),
      collegeIds: parseNumArray(body.collegeIds),
      courseIds: parseNumArray(body.courseIds),
      branchIds: parseNumArray(body.branchIds),
      years: parseNumArray(body.years),
      semesters: parseNumArray(body.semesters),
      sections: parseStrArray(body.sections),
      actorUserId: req.authUser?.id,
      actorName: req.authUser?.name || req.authUser?.username || "Authorized User",
    });

    res.json(result);
  } catch (error) {
    sendAuthzError(res, error, next);
  }
});

// GET /api/today-timetable/activities
todayTimetableRouter.get("/activities", requirePermission("today_timetable.view", "timetable.view"), async (req: AuthedRequest, res, next) => {
  try {
    const scoped = scopedFilters(req, {
      collegeId: num(req.query.collegeId),
      branchId: num(req.query.branchId),
    });

    const activities = await listDailyTimetableActivities({
      collegeId: scoped.collegeId,
      courseId: num(req.query.courseId),
      branchId: scoped.branchId,
      batch: str(req.query.batch),
      semester: num(req.query.semester),
      sectionName: str(req.query.section),
      academicYear: str(req.query.academicYear),
      timetableDate: str(req.query.date),
      limit: num(req.query.limit) || 100,
    });

    res.json({ activities });
  } catch (error) {
    sendAuthzError(res, error, next);
  }
});

// GET /api/today-timetable/master-vs-changed-report
todayTimetableRouter.get(
  "/master-vs-changed-report",
  requirePermission("today_timetable.view", "timetable.view"),
  async (req: AuthedRequest, res, next) => {
    try {
      const scoped = scopedFilters(req, {
        collegeId: num(req.query.collegeId),
        branchId: num(req.query.branchId),
      });

      const report = await getMasterVsChangedTimetableReport({
        academicYear: str(req.query.academicYear),
        collegeId: scoped.collegeId,
        courseId: num(req.query.courseId),
        branchId: scoped.branchId,
        batch: str(req.query.batch),
        year: num(req.query.year),
        semester: num(req.query.semester),
        sectionName: str(req.query.sectionName) || str(req.query.section),
        startDate: str(req.query.startDate),
        endDate: str(req.query.endDate),
        staffHrmsId: str(req.query.staffHrmsId),
        subjectCode: str(req.query.subjectCode),
        limit: num(req.query.limit) || 150,
      });

      res.json(report);
    } catch (error) {
      sendAuthzError(res, error, next);
    }
  },
);
