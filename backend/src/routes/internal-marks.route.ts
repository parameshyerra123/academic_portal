import { Router } from "express";
import type { AuthedRequest } from "../middleware/auth.middleware.js";
import { requirePermission, scopedFilters, statusFromAuthzError } from "../authz/require-permission.js";
import {
  getSubjectFacultyHierarchy,
  listAccessRules,
  saveAccessRule,
  deleteAccessRule,
  getFacultyAssignedSubjects,
  getStudentsForMarksEntry,
  saveMarksDraft,
  submitMarksForApproval,
  getInternalMarksSubmissions,
  processApprovalAction,
  forwardSubmissionToEms,
  getApprovalConfigs,
  saveApprovalConfigs,
  getInternalMarksAuditLogs,
  type AccessLevel,
  type InternalMarksStatus,
} from "../services/internal-marks.service.js";

export const internalMarksRouter = Router();

function num(val: unknown): number | undefined {
  if (typeof val !== "string" && typeof val !== "number") return undefined;
  if (val === "" || val === "all") return undefined;
  const n = Number(val);
  return Number.isFinite(n) ? n : undefined;
}

function str(val: unknown): string | undefined {
  if (typeof val !== "string" || val === "" || val === "all") return undefined;
  return val.trim();
}

/** Superadmin / HOD Hierarchy View */
internalMarksRouter.get(
  "/subjects-hierarchy",
  requirePermission("internal_marks_mgmt.view"),
  async (req: AuthedRequest, res, next) => {
    try {
      const collegeId = num(req.query.collegeId);
      const courseId = num(req.query.courseId);
      const branchId = num(req.query.branchId);
      const subjectId = num(req.query.subjectId);
      const facultyId = num(req.query.facultyId);

      scopedFilters(req, { collegeId, branchId });

      const data = await getSubjectFacultyHierarchy({
        collegeId,
        courseId,
        branchId,
        subjectId,
        facultyId,
      });

      res.json({ data });
    } catch (error) {
      const status = statusFromAuthzError(error);
      if (status === 401 || status === 403) {
        res.status(status).json({ message: (error as Error).message || "Forbidden" });
        return;
      }
      next(error);
    }
  }
);

/** List Access Rules */
internalMarksRouter.get(
  "/access-rules",
  requirePermission("internal_marks_mgmt.view"),
  async (req: AuthedRequest, res, next) => {
    try {
      const collegeId = num(req.query.collegeId);
      const courseId = num(req.query.courseId);
      const branchId = num(req.query.branchId);

      scopedFilters(req, { collegeId, branchId });

      const rules = await listAccessRules({ collegeId, courseId, branchId });
      res.json({ data: rules });
    } catch (error) {
      const status = statusFromAuthzError(error);
      if (status === 401 || status === 403) {
        res.status(status).json({ message: (error as Error).message || "Forbidden" });
        return;
      }
      next(error);
    }
  }
);

/** Create/Update Access Rule */
internalMarksRouter.post(
  "/access-rules",
  requirePermission("internal_marks_mgmt.edit"),
  async (req: AuthedRequest, res, next) => {
    try {
      if (!req.authUser) {
        res.status(401).json({ message: "Authentication required" });
        return;
      }

      const { accessLevel, collegeId, courseId, branchId, subjectId, facultyStaffLinkId, isEnabled } = req.body;

      if (!accessLevel || typeof isEnabled !== "boolean") {
        res.status(400).json({ message: "accessLevel and isEnabled are required" });
        return;
      }

      const result = await saveAccessRule(req.authUser.id, {
        accessLevel: accessLevel as AccessLevel,
        collegeId: num(collegeId),
        courseId: num(courseId),
        branchId: num(branchId),
        subjectId: num(subjectId),
        facultyStaffLinkId: num(facultyStaffLinkId),
        isEnabled: Boolean(isEnabled),
      });

      res.json(result);
    } catch (error) {
      next(error);
    }
  }
);

/** Delete Access Rule */
internalMarksRouter.delete(
  "/access-rules/:id",
  requirePermission("internal_marks_mgmt.edit"),
  async (req: AuthedRequest, res, next) => {
    try {
      if (!req.authUser) {
        res.status(401).json({ message: "Authentication required" });
        return;
      }

      const id = Number(req.params.id);
      if (!id) {
        res.status(400).json({ message: "Invalid rule ID" });
        return;
      }

      const result = await deleteAccessRule(req.authUser.id, id);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }
);

/** Faculty Assigned Subjects */
internalMarksRouter.get(
  "/faculty-subjects",
  requirePermission("internal_marks.view"),
  async (req: AuthedRequest, res, next) => {
    try {
      if (!req.authUser) {
        res.status(401).json({ message: "Authentication required" });
        return;
      }

      const result = await getFacultyAssignedSubjects(
        req.authUser.id,
        req.authUser.hrmsEmployeeId
      );

      res.json(result);
    } catch (error) {
      next(error);
    }
  }
);

/** Student Marks Entry List */
internalMarksRouter.get(
  "/students",
  requirePermission("internal_marks.view"),
  async (req: AuthedRequest, res, next) => {
    try {
      const collegeId = num(req.query.collegeId);
      const courseId = num(req.query.courseId);
      const branchId = num(req.query.branchId);
      const subjectId = num(req.query.subjectId);
      const facultyStaffLinkId = num(req.query.facultyStaffLinkId);
      const batch = str(req.query.batch);
      const semester = num(req.query.semester);
      const year = num(req.query.year);

      if (!collegeId || !courseId || !branchId || !subjectId || !facultyStaffLinkId) {
        res.status(400).json({
          message: "collegeId, courseId, branchId, subjectId, and facultyStaffLinkId are required",
        });
        return;
      }

      scopedFilters(req, { collegeId, branchId });

      const data = await getStudentsForMarksEntry({
        collegeId,
        courseId,
        branchId,
        subjectId,
        facultyStaffLinkId,
        year,
        batch,
        semester,
      });

      res.json({ data });
    } catch (error) {
      const status = statusFromAuthzError(error);
      if (status === 401 || status === 403) {
        res.status(status).json({ message: (error as Error).message || "Forbidden" });
        return;
      }
      next(error);
    }
  }
);

/** Save Draft Marks */
internalMarksRouter.post(
  "/draft",
  requirePermission("internal_marks.edit"),
  async (req: AuthedRequest, res, next) => {
    try {
      if (!req.authUser) {
        res.status(401).json({ message: "Authentication required" });
        return;
      }

      const {
        collegeId,
        courseId,
        branchId,
        subjectId,
        facultyStaffLinkId,
        batch,
        semesterNumber,
        maxMarks,
        entries,
      } = req.body;

      if (
        !collegeId ||
        !courseId ||
        !branchId ||
        !subjectId ||
        !facultyStaffLinkId ||
        !Array.isArray(entries)
      ) {
        res.status(400).json({ message: "Missing required marks draft fields" });
        return;
      }

      const result = await saveMarksDraft(req.authUser.id, {
        collegeId: Number(collegeId),
        courseId: Number(courseId),
        branchId: Number(branchId),
        subjectId: Number(subjectId),
        facultyStaffLinkId: Number(facultyStaffLinkId),
        batch: str(batch),
        semesterNumber: num(semesterNumber),
        maxMarks: Number(maxMarks) || 30,
        entries,
      });

      res.json(result);
    } catch (error) {
      next(error);
    }
  }
);

/** Submit Marks for Approval */
internalMarksRouter.post(
  "/submit",
  requirePermission("internal_marks.edit"),
  async (req: AuthedRequest, res, next) => {
    try {
      if (!req.authUser) {
        res.status(401).json({ message: "Authentication required" });
        return;
      }

      const { submissionId, comments } = req.body;
      if (!submissionId) {
        res.status(400).json({ message: "submissionId is required" });
        return;
      }

      const result = await submitMarksForApproval(req.authUser.id, {
        submissionId: Number(submissionId),
        comments: str(comments),
      });

      res.json(result);
    } catch (error) {
      next(error);
    }
  }
);

/** Get Submissions for Approvers & Tracking */
internalMarksRouter.get(
  "/submissions",
  requirePermission("internal_marks.view"),
  async (req: AuthedRequest, res, next) => {
    try {
      const collegeId = num(req.query.collegeId);
      const courseId = num(req.query.courseId);
      const branchId = num(req.query.branchId);
      const subjectId = num(req.query.subjectId);
      const status = str(req.query.status) as InternalMarksStatus | undefined;

      scopedFilters(req, { collegeId, branchId });

      const submissions = await getInternalMarksSubmissions({
        collegeId,
        courseId,
        branchId,
        subjectId,
        status,
        userRoleKeys: req.authz?.roleKeys,
      });

      res.json({ data: submissions });
    } catch (error) {
      const status = statusFromAuthzError(error);
      if (status === 401 || status === 403) {
        res.status(status).json({ message: (error as Error).message || "Forbidden" });
        return;
      }
      next(error);
    }
  }
);

/** Approve / Reject / Return Submission */
internalMarksRouter.post(
  "/submissions/:id/action",
  requirePermission("internal_marks.edit"),
  async (req: AuthedRequest, res, next) => {
    try {
      if (!req.authUser) {
        res.status(401).json({ message: "Authentication required" });
        return;
      }

      const submissionId = Number(req.params.id);
      const { action, comments } = req.body;

      if (!submissionId || !["approve", "reject", "return", "forward_to_ems"].includes(action)) {
        res.status(400).json({ message: "Valid submission ID and action (approve, reject, return, forward_to_ems) are required" });
        return;
      }

      const roleKey = req.authz?.roleKeys?.[0] || "staff";

      const result = await processApprovalAction(req.authUser.id, roleKey, {
        submissionId,
        action,
        comments: str(comments),
      });

      res.json(result);
    } catch (error) {
      next(error);
    }
  }
);

/** Forward Approved Submission to EMS Database */
internalMarksRouter.post(
  "/submissions/:id/forward-to-ems",
  requirePermission("internal_marks.edit"),
  async (req: AuthedRequest, res, next) => {
    try {
      if (!req.authUser) {
        res.status(401).json({ message: "Authentication required" });
        return;
      }

      const submissionId = Number(req.params.id);
      if (!submissionId) {
        res.status(400).json({ message: "Valid submission ID is required" });
        return;
      }

      const roleKey = req.authz?.roleKeys?.[0] || "staff";
      const result = await forwardSubmissionToEms(req.authUser.id, roleKey, submissionId);

      if (!result.success && result.error) {
        res.status(400).json(result);
        return;
      }

      res.json(result);
    } catch (error) {
      next(error);
    }
  }
);

/** Approval Workflows Configuration */
internalMarksRouter.get(
  "/approval-configs",
  requirePermission("internal_marks_mgmt.view"),
  async (req: AuthedRequest, res, next) => {
    try {
      const collegeId = num(req.query.collegeId);
      const configs = await getApprovalConfigs(collegeId);
      res.json({ data: configs });
    } catch (error) {
      next(error);
    }
  }
);

internalMarksRouter.post(
  "/approval-configs",
  requirePermission("internal_marks_mgmt.edit"),
  async (req: AuthedRequest, res, next) => {
    try {
      if (!req.authUser) {
        res.status(401).json({ message: "Authentication required" });
        return;
      }

      const { collegeId, levels } = req.body;
      if (!Array.isArray(levels)) {
        res.status(400).json({ message: "levels array is required" });
        return;
      }

      const result = await saveApprovalConfigs(
        req.authUser.id,
        num(collegeId) ?? null,
        levels
      );

      res.json(result);
    } catch (error) {
      next(error);
    }
  }
);

/** Audit Logs */
internalMarksRouter.get(
  "/audit-logs",
  requirePermission("internal_marks_mgmt.view"),
  async (req: AuthedRequest, res, next) => {
    try {
      const collegeId = num(req.query.collegeId);
      const subjectId = num(req.query.subjectId);

      const logs = await getInternalMarksAuditLogs({ collegeId, subjectId });
      res.json({ data: logs });
    } catch (error) {
      next(error);
    }
  }
);
