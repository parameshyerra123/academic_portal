"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { LoadingAnimation } from "@/components/ui/LoadingAnimation";
import { DataErrorState } from "@/components/ui/DataErrorState";
import { EmptyState } from "@/components/ui/EmptyState";
import { Modal } from "@/components/ui/Modal";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/components/auth/AuthProvider";
import { InternalMarksEntryModal } from "./InternalMarksEntryModal";
import { BookOpen, CheckCircle, Clock, Edit3, Eye, FileText, Lock, XCircle, RotateCcw } from "lucide-react";

type AssignedSubject = {
  collegeId: number;
  collegeName: string;
  courseId: number;
  courseName: string;
  branchId: number;
  branchName: string;
  subjectId: number;
  subjectCode: string;
  subjectName: string;
  subjectType: string;
  semester: number | null;
  year: number | null;
  batch: string;
  accessStatus: "enabled" | "disabled";
  accessLevel: "college" | "course" | "branch" | "individual" | "none";
  submissionId: number | null;
  submissionStatus: "draft" | "submitted" | "pending_approval" | "approved" | "rejected" | "returned";
  currentApprovalLevel: number;
  maxMarks: number;
  lastUpdated: string | null;
};

type SubmissionItem = {
  id: number;
  collegeId: number;
  collegeName: string;
  courseId: number;
  courseName: string;
  branchId: number;
  branchName: string;
  subjectId: number;
  subjectCode: string;
  subjectName: string;
  facultyStaffLinkId: number;
  facultyName: string;
  maxMarks: number;
  status: "draft" | "submitted" | "pending_approval" | "approved" | "rejected" | "returned" | "forwarded_to_ems" | "ems_sync_failed";
  currentApprovalLevel: number;
  submittedAt: string | null;
  submittedByName?: string;
  studentCount: number;
  emsSyncStatus?: "not_synced" | "synced" | "failed";
  emsSyncedAt?: string | null;
  emsSyncedBy?: number | null;
  emsSyncError?: string | null;
  approvalHistory: Array<{
    id: number;
    approvalLevel: number;
    approverName: string;
    approverRoleKey: string;
    action: string;
    previousStatus: string;
    newStatus: string;
    comments: string | null;
    createdAt: string;
  }>;
};

export function FacultyInternalMarksView() {
  const { hasPermission, hasAnyPermission } = useAuth();
  const canEdit = hasAnyPermission("internal_marks.edit", "internal_marks.view", "examinations.view");

  const [activeTab, setActiveTab] = useState<"my_subjects" | "pending_approvals">("my_subjects");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [staffLinkId, setStaffLinkId] = useState<number | null>(null);
  const [assignedSubjects, setAssignedSubjects] = useState<AssignedSubject[]>([]);
  const [pendingSubmissions, setPendingSubmissions] = useState<SubmissionItem[]>([]);
  const [maxApprovalLevel, setMaxApprovalLevel] = useState<number>(1);
  const [forwardingBusyId, setForwardingBusyId] = useState<number | null>(null);

  // Active modal for marks entry
  const [entryModal, setEntryModal] = useState<{
    open: boolean;
    subject?: AssignedSubject | SubmissionItem;
    readOnly?: boolean;
  }>({ open: false });

  // Active approval dialog
  const [approvalDialog, setApprovalDialog] = useState<{
    open: boolean;
    submissionId?: number;
    action?: "approve" | "reject" | "return";
    comments: string;
    busy: boolean;
  }>({ open: false, comments: "", busy: false });

  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      if (activeTab === "my_subjects") {
        const res = await apiFetch("/internal-marks/faculty-subjects");
        if (!res.ok) throw new Error("Failed to load assigned subjects");
        const body = await res.json();
        setStaffLinkId(body.staffLinkId);
        setAssignedSubjects(body.subjects || []);
      } else if (activeTab === "pending_approvals") {
        const [subRes, cfgRes] = await Promise.all([
          apiFetch("/internal-marks/submissions"),
          apiFetch("/internal-marks/approval-configs"),
        ]);
        if (!subRes.ok) throw new Error("Failed to load submissions for approval");
        const subBody = await subRes.json();
        setPendingSubmissions(subBody.data || []);

        if (cfgRes.ok) {
          const cfgBody = await cfgRes.json();
          const configs: Array<{ levelNumber: number; isActive: boolean }> = cfgBody.data || [];
          const activeLevels = configs.filter((c) => c.isActive).map((c) => c.levelNumber);
          if (activeLevels.length > 0) {
            setMaxApprovalLevel(Math.max(...activeLevels));
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load internal marks data");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, [activeTab]);

  // Handle Approver Action (Approve / Reject / Return)
  async function handleConfirmApprovalAction() {
    if (!approvalDialog.submissionId || !approvalDialog.action) return;

    if (approvalDialog.action !== "approve" && !approvalDialog.comments.trim()) {
      alert("Please enter comments explaining the reason for rejection/return.");
      return;
    }

    setApprovalDialog((prev) => ({ ...prev, busy: true }));
    try {
      const res = await apiFetch(`/internal-marks/submissions/${approvalDialog.submissionId}/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: approvalDialog.action,
          comments: approvalDialog.comments.trim(),
        }),
      });

      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.message || "Failed to process approval action");
      }

      setApprovalDialog({ open: false, comments: "", busy: false });
      await loadData();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to process action");
      setApprovalDialog((prev) => ({ ...prev, busy: false }));
    }
  }

  // Handle Forward to EMS / Retry Forward to EMS
  async function handleForwardToEms(submissionId: number) {
    if (
      !confirm(
        "Are you sure you want to Forward these internal marks to the EMS Database? This will update the EMS database and lock local marks editing."
      )
    ) {
      return;
    }

    setForwardingBusyId(submissionId);
    try {
      const res = await apiFetch(`/internal-marks/submissions/${submissionId}/forward-to-ems`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      const body = await res.json();
      if (!res.ok || !body.success) {
        throw new Error(body.error || body.message || "Failed to forward internal marks to EMS");
      }

      alert(body.message || "Internal marks forwarded and synced to EMS successfully!");
      await loadData();
    } catch (err) {
      alert(err instanceof Error ? err.message : "EMS Sync Failed");
      await loadData();
    } finally {
      setForwardingBusyId(null);
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Internal Marks"
        description="View assigned subjects, enter student internal marks, submit for multi-level approval, and review pending submissions."
      />

      {/* Tabs */}
      <div className="flex border-b border-border">
        <button
          type="button"
          onClick={() => setActiveTab("my_subjects")}
          className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition ${
            activeTab === "my_subjects"
              ? "border-brand-600 text-brand-600"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          <BookOpen className="h-4 w-4" />
          My Assigned Subjects
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("pending_approvals")}
          className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition ${
            activeTab === "pending_approvals"
              ? "border-brand-600 text-brand-600"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          <Clock className="h-4 w-4" />
          Submissions & Approvals ({pendingSubmissions.length})
        </button>
      </div>

      {/* Tab 1: My Assigned Subjects */}
      {activeTab === "my_subjects" && (
        <div className="space-y-4">
          {loading ? (
            <LoadingAnimation label="Loading your assigned subjects..." />
          ) : error ? (
            <DataErrorState message={error} />
          ) : assignedSubjects.length === 0 ? (
            <EmptyState
              title="No assigned subjects found"
              description="No subject assignments found for your faculty profile in the current academic term."
            />
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {assignedSubjects.map((sub) => {
                const isUploadEnabled = sub.accessStatus === "enabled";
                const isDraftOrReturn =
                  sub.submissionStatus === "draft" ||
                  sub.submissionStatus === "returned" ||
                  sub.submissionStatus === "rejected";

                return (
                  <Card key={`${sub.branchId}-${sub.subjectId}`} className="flex flex-col justify-between p-4 space-y-4 hover:border-brand-300 transition shadow-xs">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-xs font-semibold uppercase text-brand-700 bg-brand-50 px-2 py-0.5 rounded">
                          {sub.subjectCode}
                        </span>
                        <StatusBadge status={sub.submissionStatus} />
                      </div>

                      <h3 className="font-semibold text-navy-900 text-base leading-snug">
                        {sub.subjectName}
                      </h3>

                      <div className="text-xs text-slate-500 space-y-0.5">
                        <div><span className="font-medium text-slate-700">College:</span> {sub.collegeName}</div>
                        <div><span className="font-medium text-slate-700">Course & Branch:</span> {sub.courseName} • {sub.branchName}</div>
                        {sub.year && sub.semester ? (
                          <div><span className="font-medium text-slate-700">Year / Sem:</span> Year {sub.year}, Sem {sub.semester}</div>
                        ) : null}
                      </div>

                      <div className="flex items-center justify-between pt-2 text-xs border-t border-border">
                        <span className="text-slate-500">Upload Access:</span>
                        {isUploadEnabled ? (
                          <span className="inline-flex items-center gap-1 font-semibold text-green-700">
                            <CheckCircle className="h-3.5 w-3.5" />
                            Enabled ({sub.accessLevel})
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 font-semibold text-red-600">
                            <Lock className="h-3.5 w-3.5" />
                            Disabled
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="pt-2">
                      {isUploadEnabled ? (
                        canEdit && isDraftOrReturn ? (
                          <Button
                            className="w-full justify-center bg-brand-600 text-white hover:bg-brand-700"
                            onClick={() =>
                              setEntryModal({
                                open: true,
                                subject: sub,
                                readOnly: false,
                              })
                            }
                          >
                            <Edit3 className="h-4 w-4 mr-1.5" />
                            {sub.submissionStatus === "returned"
                              ? "Correct & Resubmit Marks"
                              : "Enter Marks"}
                          </Button>
                        ) : (
                          <Button
                            variant="secondary"
                            className="w-full justify-center"
                            onClick={() =>
                              setEntryModal({
                                open: true,
                                subject: sub,
                                readOnly: true,
                              })
                            }
                          >
                            <Eye className="h-4 w-4 mr-1.5" />
                            View Marks
                          </Button>
                        )
                      ) : (
                        <div className="flex items-center justify-center gap-1.5 rounded-md bg-slate-100 py-2 text-xs font-semibold text-slate-500">
                          <Lock className="h-3.5 w-3.5" />
                          No Upload Access
                        </div>
                      )}
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Pending Submissions & Approvals */}
      {activeTab === "pending_approvals" && (
        <Card className="p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-semibold text-navy-900">Submitted Internal Marks Packages</h3>
              <p className="text-xs text-slate-500">Review internal marks submissions awaiting approval or monitor submission history.</p>
            </div>
            <Button size="sm" variant="secondary" onClick={() => void loadData()}>
              Refresh
            </Button>
          </div>

          {loading ? (
            <LoadingAnimation />
          ) : pendingSubmissions.length === 0 ? (
            <EmptyState title="No submissions found" description="No internal marks submissions matching your access scope." />
          ) : (
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-500 border-b border-border">
                  <tr>
                    <th className="px-4 py-3">Subject & Code</th>
                    <th className="px-4 py-3">Faculty & Scope</th>
                    <th className="px-4 py-3">Students</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Submitted At</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border text-xs">
                  {pendingSubmissions.map((sub) => (
                    <tr key={sub.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 align-top">
                        <div className="font-semibold text-navy-900">{sub.subjectName}</div>
                        <div className="font-mono text-slate-500">{sub.subjectCode}</div>
                      </td>

                      <td className="px-4 py-3 align-top">
                        <div className="font-medium text-slate-800">{sub.facultyName}</div>
                        <div className="text-slate-500">{sub.collegeName} • {sub.branchName}</div>
                      </td>

                      <td className="px-4 py-3 align-top font-semibold text-slate-800">
                        {sub.studentCount} Students
                      </td>

                      <td className="px-4 py-3 align-top">
                        <StatusBadge status={sub.status} />
                        <div className="text-[11px] text-slate-500 mt-1">Level {sub.currentApprovalLevel} Approval</div>
                      </td>

                      <td className="px-4 py-3 align-top text-slate-500">
                        {sub.submittedAt || "—"}
                      </td>

                      <td className="px-4 py-3 align-top text-right space-x-1">
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() =>
                            setEntryModal({
                              open: true,
                              subject: sub,
                              readOnly: true,
                            })
                          }
                        >
                          <Eye className="h-3.5 w-3.5 mr-1" />
                          View
                        </Button>

                        {canEdit && (sub.status === "pending_approval" || sub.status === "approved" || sub.status === "ems_sync_failed") && (
                          <>
                            {sub.status === "ems_sync_failed" ? (
                              <Button
                                size="sm"
                                className="bg-amber-600 text-white hover:bg-amber-700"
                                disabled={forwardingBusyId === sub.id}
                                onClick={() => void handleForwardToEms(sub.id)}
                              >
                                <RotateCcw className="h-3.5 w-3.5 mr-1" />
                                {forwardingBusyId === sub.id ? "Syncing..." : "Retry Forward to EMS"}
                              </Button>
                            ) : sub.status === "approved" || sub.currentApprovalLevel >= maxApprovalLevel ? (
                              <Button
                                size="sm"
                                className="bg-indigo-600 text-white hover:bg-indigo-700"
                                disabled={forwardingBusyId === sub.id}
                                onClick={() => void handleForwardToEms(sub.id)}
                              >
                                <CheckCircle className="h-3.5 w-3.5 mr-1" />
                                {forwardingBusyId === sub.id ? "Forwarding..." : "Forward to EMS"}
                              </Button>
                            ) : (
                              <Button
                                size="sm"
                                className="bg-green-600 text-white hover:bg-green-700"
                                onClick={() =>
                                  setApprovalDialog({
                                    open: true,
                                    submissionId: sub.id,
                                    action: "approve",
                                    comments: "Approved",
                                    busy: false,
                                  })
                                }
                              >
                                <CheckCircle className="h-3.5 w-3.5 mr-1" />
                                Approve
                              </Button>
                            )}

                            {sub.status === "pending_approval" && (
                              <Button
                                size="sm"
                                variant="secondary"
                                className="text-amber-700 border-amber-300 hover:bg-amber-50"
                                onClick={() =>
                                  setApprovalDialog({
                                    open: true,
                                    submissionId: sub.id,
                                    action: "return",
                                    comments: "",
                                    busy: false,
                                  })
                                }
                              >
                                <RotateCcw className="h-3.5 w-3.5 mr-1" />
                                Return
                              </Button>
                            )}
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {/* Marks Entry Modal */}
      {entryModal.open && entryModal.subject && (
        <InternalMarksEntryModal
          collegeId={entryModal.subject.collegeId}
          courseId={entryModal.subject.courseId}
          branchId={entryModal.subject.branchId}
          subjectId={entryModal.subject.subjectId}
          facultyStaffLinkId={
            "facultyStaffLinkId" in entryModal.subject
              ? entryModal.subject.facultyStaffLinkId
              : staffLinkId || 0
          }
          subjectCode={entryModal.subject.subjectCode}
          subjectName={entryModal.subject.subjectName}
          year={"year" in entryModal.subject ? entryModal.subject.year : undefined}
          semester={"semester" in entryModal.subject ? entryModal.subject.semester : undefined}
          batch={"batch" in entryModal.subject ? entryModal.subject.batch : undefined}
          readOnly={entryModal.readOnly}
          onClose={() => setEntryModal({ open: false })}
          onSaved={() => void loadData()}
        />
      )}

      {/* Approver Action Modal */}
      {approvalDialog.open && (
        <Modal
          title={`${approvalDialog.action === "approve" ? "Approve" : approvalDialog.action === "return" ? "Return for Correction" : "Reject"} Internal Marks Submission`}
          onClose={() => setApprovalDialog({ open: false, comments: "", busy: false })}
        >
          <div className="space-y-4">
            <p className="text-xs text-slate-600">
              Provide comments or decision notes for this approval workflow step:
            </p>
            <textarea
              className="w-full rounded-md border border-border p-2.5 text-xs outline-none focus:border-brand-600 min-h-[90px]"
              placeholder="Enter approval / rejection comments..."
              value={approvalDialog.comments}
              onChange={(e) =>
                setApprovalDialog((prev) => ({ ...prev, comments: e.target.value }))
              }
            />
            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="secondary"
                onClick={() => setApprovalDialog({ open: false, comments: "", busy: false })}
              >
                Cancel
              </Button>
              <Button
                disabled={approvalDialog.busy}
                onClick={() => void handleConfirmApprovalAction()}
                className={
                  approvalDialog.action === "approve"
                    ? "bg-green-600 text-white hover:bg-green-700"
                    : "bg-amber-600 text-white hover:bg-amber-700"
                }
              >
                {approvalDialog.busy
                  ? "Processing..."
                  : approvalDialog.action === "approve"
                  ? "Confirm Approval"
                  : "Confirm Action"}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
