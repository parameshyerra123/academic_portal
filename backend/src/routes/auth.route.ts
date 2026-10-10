import { Router } from "express";
import type { Response } from "express";
import type { AuthedRequest } from "../middleware/auth.middleware.js";
import { requireAuth } from "../middleware/auth.middleware.js";
import { loadAuthzContext } from "../authz/authorization.service.js";
import {
  clearSessionCookieOptions,
  getSessionCookieName,
  loginWithCredentials,
  revokeSessionToken,
  sessionCookieOptions,
} from "../services/auth.service.js";
import {
  getLoginThrottleRetryAfter,
  recordFailedLoginAttempt,
} from "../middleware/login-rate-limit.js";

import { ObjectId } from "mongodb";
import { getHrmsDb } from "../db/pools.js";

export const authRouter = Router();

const userPhotoCache = new Map<string, { photo: string | null; expiresAt: number }>();

async function getUserProfilePhoto(user: {
  id: number;
  hrmsEmployeeId: string | null;
  hrmsUserId: string;
  username: string;
}): Promise<string | null> {
  const cacheKey = `user-${user.id}-${user.hrmsEmployeeId || ""}-${user.hrmsUserId}`;
  const hit = userPhotoCache.get(cacheKey);
  if (hit && hit.expiresAt > Date.now()) {
    return hit.photo;
  }

  let photo: string | null = null;
  try {
    const db = await getHrmsDb();

    // 1. Try HRMS employees collection by emp_no / employeeId
    if (user.hrmsEmployeeId) {
      const trimmed = user.hrmsEmployeeId.trim();
      const orList: Record<string, unknown>[] = [
        { emp_no: trimmed },
        { employeeId: trimmed },
      ];
      if (/^\d+$/.test(trimmed)) {
        orList.push({ emp_no: Number(trimmed) }, { employeeId: Number(trimmed) });
      }
      const emp = await db.collection("employees").findOne(
        { $or: orList },
        { projection: { profilePhoto: 1, "dynamicFields.profilePhoto": 1 } },
      );
      if (emp) {
        photo =
          (typeof emp.profilePhoto === "string" && emp.profilePhoto.trim()) ||
          (typeof (emp.dynamicFields as Record<string, unknown> | undefined)?.profilePhoto === "string" &&
            String((emp.dynamicFields as Record<string, unknown>).profilePhoto).trim()) ||
          null;
      }
    }

    // 2. Try HRMS users collection by ObjectId or email/username
    if (!photo && user.hrmsUserId) {
      const uid = user.hrmsUserId.startsWith("employee:")
        ? user.hrmsUserId.slice("employee:".length)
        : user.hrmsUserId;
      if (ObjectId.isValid(uid)) {
        const u = await db.collection("users").findOne(
          { _id: new ObjectId(uid) },
          { projection: { profilePhoto: 1 } },
        );
        if (u && typeof u.profilePhoto === "string" && u.profilePhoto.trim()) {
          photo = u.profilePhoto.trim();
        }
      }
    }

    // 3. Fallback: Try employees collection by username if username looks like emp_no
    if (!photo && user.username && /^\d+$/.test(user.username)) {
      const emp = await db.collection("employees").findOne(
        { $or: [{ emp_no: user.username }, { emp_no: Number(user.username) }] },
        { projection: { profilePhoto: 1 } },
      );
      if (emp && typeof emp.profilePhoto === "string" && emp.profilePhoto.trim()) {
        photo = emp.profilePhoto.trim();
      }
    }
  } catch {
    // Graceful fallback if HRMS is temporarily unreachable
  }

  userPhotoCache.set(cacheKey, { photo, expiresAt: Date.now() + 5 * 60 * 1000 });
  return photo;
}

export async function sendCurrentUser(req: AuthedRequest, res: Response) {
  const user = req.authUser!;
  const authz = req.authz;
  const profilePhoto = await getUserProfilePhoto(user);

  res.json({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      username: user.username,
      hrmsEmployeeId: user.hrmsEmployeeId,
      hrmsUserId: user.hrmsUserId,
      profilePhoto: profilePhoto ?? null,
    },
    authorization: {
      roles: (authz?.roles ?? []).map((role) => ({
        roleKey: role.roleKey,
        label: role.label,
        collegeId: role.collegeId,
        branchId: role.branchId,
      })),
      permissions: authz?.permissions ?? [],
      scope: authz?.scope ?? {
        isGlobal: false,
        collegeIds: [],
        branchIds: [],
      },
    },
  });
}

authRouter.post("/login", async (req, res, next) => {
  try {
    const retryAfter = getLoginThrottleRetryAfter(req.ip);
    if (retryAfter != null) {
      res.setHeader("Retry-After", String(retryAfter));
      res.status(429).json({
        message: "Too many login attempts. Please try again later.",
      });
      return;
    }

    const identifier = String(req.body?.identifier ?? req.body?.email ?? "").trim();
    const password = String(req.body?.password ?? "");
    const result = await loginWithCredentials({
      identifier,
      password,
      ipAddress: req.ip,
      userAgent: req.get("user-agent"),
    });

    const authz = await loadAuthzContext(result.user.id);
    res.cookie(getSessionCookieName(), result.sessionToken, sessionCookieOptions(result.expiresAt));
    res.json({
      user: {
        id: result.user.id,
        name: result.user.name,
        email: result.user.email,
        username: result.user.username,
        hrmsEmployeeId: result.user.hrmsEmployeeId,
        hrmsUserId: result.user.hrmsUserId,
      },
      authorization: {
        roles: authz.roles.map((role) => ({
          roleKey: role.roleKey,
          label: role.label,
          collegeId: role.collegeId,
          branchId: role.branchId,
        })),
        permissions: authz.permissions,
        scope: authz.scope,
      },
      expiresAt: result.expiresAt.toISOString(),
    });
  } catch (error) {
    const status = (error as { status?: number }).status;
    if (status === 400 || status === 401 || status === 403) {
      if (status === 401) {
        const recorded = recordFailedLoginAttempt(req.ip);
        if (recorded.throttled) {
          res.setHeader("Retry-After", String(recorded.retryAfterSec));
          res.status(429).json({
            message: "Too many login attempts. Please try again later.",
          });
          return;
        }
      }
      res.status(status).json({
        message: error instanceof Error ? error.message : "Login failed",
      });
      return;
    }
    next(error);
  }
});

authRouter.post("/logout", async (req: AuthedRequest, res, next) => {
  try {
    await revokeSessionToken(req.sessionToken);
    res.cookie(getSessionCookieName(), "", clearSessionCookieOptions());
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

authRouter.get("/me", requireAuth, sendCurrentUser);
