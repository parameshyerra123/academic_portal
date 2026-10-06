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

    const result = await recordDailyTimetableChange({
      timetableDate,
      collegeId,
      courseId,
      branchId,
      batch,
      semester,
      sectionName: str(body.section || body.sectionName),
      academicYear,
      timingSlotId,
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
