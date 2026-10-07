"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  ArrowRight,
  Check,
  CheckCircle2,
  Copy,
  GitMerge,
  Layers,
  Sparkles,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { apiFetch } from "@/lib/api";
import { cn } from "@/lib/cn";

export type CombineSectionsModalProps = {
  isOpen: boolean;
  onClose: () => void;
  availableSections: string[];
  initialTickedSections?: string[];
  currentSection?: string;
  context: {
    collegeId?: number | "all";
    courseId?: number | "all";
    branchId?: number | "all";
    academicYear?: string;
    batch?: string | "all";
    year?: number | "all";
    semester?: number | "all";
    collegeName?: string;
    courseName?: string;
    branchName?: string;
  };
  onSuccess: (mainSection: string, targetSections: string[]) => void;
};

export function CombineSectionsModal({
  isOpen,
  onClose,
  availableSections,
  initialTickedSections = [],
  currentSection = "all",
  context,
  onSuccess,
}: CombineSectionsModalProps) {
  // Strictly use the exact sections that this branch has
  const defaultSections = useMemo(() => {
    const combined = [...availableSections, ...initialTickedSections];
    const filtered = Array.from(new Set(combined))
      .filter((s) => s && s.toLowerCase() !== "all")
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    return filtered.length > 0 ? filtered : ["A", "B"];
  }, [availableSections, initialTickedSections]);

  const [mainSection, setMainSection] = useState<string>("A");
  const [targetSections, setTargetSections] = useState<string[]>(["B"]);
  const [autoPublish, setAutoPublish] = useState<boolean>(true);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Sync state whenever modal opens or context changes
  useEffect(() => {
    if (!isOpen) return;

    // Pick main section: prefer currentSection (if valid in branch), else first available
    let initialMain = defaultSections[0] ?? "A";
    if (currentSection && currentSection !== "all" && defaultSections.includes(currentSection)) {
      initialMain = currentSection;
    } else if (defaultSections.includes("B")) {
      initialMain = "B";
    }
    setMainSection(initialMain);

    // Pick target section(s): prefer initialTicked (excluding main), or first other section in branch
    const fromInit = initialTickedSections.filter(
      (s) => s && s !== "all" && s !== initialMain && defaultSections.includes(s),
    );
    if (fromInit.length > 0) {
      setTargetSections(fromInit);
    } else {
      const candidate = defaultSections.find((s) => s !== initialMain);
      setTargetSections(candidate ? [candidate] : []);
    }

    setError(null);
  }, [isOpen, currentSection, defaultSections, initialTickedSections]);

  if (!isOpen) return null;

  const handleSelectMain = (sec: string) => {
    setMainSection(sec);
    // If newly selected main was in targets, remove it and select another branch target
    setTargetSections((prev) => {
      const filtered = prev.filter((s) => s !== sec);
      if (filtered.length === 0) {
        const nextTarget = defaultSections.find((s) => s !== sec);
        return nextTarget ? [nextTarget] : [];
      }
      return filtered;
    });
  };

  const handleToggleTarget = (sec: string) => {
    if (sec === mainSection) return;
    setTargetSections((prev) => {
      if (prev.includes(sec)) {
        if (prev.length <= 1) return prev; // Keep at least one target
        return prev.filter((s) => s !== sec);
      }
      return [...prev, sec];
    });
  };

  const handleExecuteCombine = async () => {
    if (!mainSection) {
      setError("Please select the Main (Source) section.");
      return;
    }
    if (targetSections.length === 0) {
      setError(`Please select which section to combine with Section ${mainSection}.`);
      return;
    }

    const collegeId = context.collegeId && context.collegeId !== "all" ? Number(context.collegeId) : null;
    const courseId = context.courseId && context.courseId !== "all" ? Number(context.courseId) : null;
    const branchId = context.branchId && context.branchId !== "all" ? Number(context.branchId) : null;
    const batch = context.batch && context.batch !== "all" ? String(context.batch) : null;
    const academicYear = context.academicYear;
    const semester = context.semester != null && context.semester !== "all" ? Number(context.semester) : null;

    if (!collegeId || !courseId || !branchId || !batch || !academicYear || semester == null) {
      setError("Incomplete filter context. Please ensure College, Course, Branch, Batch, and Semester are selected.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await apiFetch("/timetables/combine-sections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          collegeId,
          courseId,
          branchId,
          academicYear,
          batch,
          year: context.year !== "all" && context.year != null ? Number(context.year) : undefined,
          semester,
          mainSection,
          targetSections,
          publish: autoPublish,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || "Failed to combine sections.");
      }

      onSuccess(mainSection, targetSections);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error combining sections");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <button
        type="button"
        className="absolute inset-0 bg-navy-950/60 backdrop-blur-xs transition-opacity"
        aria-label="Close dialog"
        onClick={onClose}
      />

      {/* Modal Card */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="combine-sections-modal-title"
        className="relative z-10 flex w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl animate-in fade-in zoom-in-95 duration-150"
      >
        {/* Header */}
        <div className="border-b border-border bg-gradient-to-r from-indigo-50/80 via-purple-50/40 to-white px-6 py-4.5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-md shadow-indigo-600/20">
                <GitMerge className="h-5 w-5" />
              </div>
              <div>
                <h3 id="combine-sections-modal-title" className="text-base sm:text-lg font-bold text-navy-900">
                  Combine Section Timetables
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Synchronize identical timetable schedules between sections.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Context Banner */}
          <div className="mt-3 flex flex-wrap items-center gap-1.5 text-[11px] font-medium text-slate-600 bg-white/90 border border-slate-200/90 rounded-lg px-3 py-1.5 shadow-xs">
            <span className="font-bold text-navy-900">{context.branchName || "Branch"}</span>
            <span>•</span>
            <span>Batch {context.batch}</span>
            <span>•</span>
            <span>Year {context.year ?? 1}</span>
            <span>•</span>
            <span>Sem {context.semester ?? 1}</span>
            <span>•</span>
            <span>AY {context.academicYear}</span>
          </div>
        </div>

        {/* Card Body */}
        <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
          {error && (
            <div className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 p-3.5 text-xs text-red-800 animate-in fade-in">
              <AlertCircle className="h-4 w-4 shrink-0 text-red-600 mt-0.5" />
              <div className="flex-1 font-medium">{error}</div>
            </div>
          )}

          {/* Step 1: Main (Source) Section */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <span className="flex h-4.5 w-4.5 items-center justify-center rounded-full bg-indigo-600 text-white text-[10px] font-bold">
                  1
                </span>
                Main Section (Source Timetable)
              </label>
              <span className="text-[11px] text-indigo-700 font-semibold">
                Copy from Section {mainSection}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {defaultSections.map((sec) => {
                const isMain = sec === mainSection;
                return (
                  <button
                    key={`main-${sec}`}
                    type="button"
                    onClick={() => handleSelectMain(sec)}
                    className={cn(
                      "flex items-center justify-between p-3 rounded-xl border text-sm font-semibold transition-all cursor-pointer text-left",
                      isMain
                        ? "border-indigo-600 bg-indigo-50/80 text-indigo-950 ring-2 ring-indigo-600/20 shadow-xs"
                        : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50",
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className={cn(
                          "flex h-4 w-4 items-center justify-center rounded-full border transition-all",
                          isMain ? "border-indigo-600 bg-indigo-600" : "border-slate-300 bg-white",
                        )}
                      >
                        {isMain && <div className="h-1.5 w-1.5 rounded-full bg-white" />}
                      </div>
                      <span>Section {sec}</span>
                    </div>
                    {isMain && (
                      <span className="rounded bg-indigo-200/80 px-1.5 py-0.5 text-[10px] font-bold text-indigo-900">
                        Main
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Step 2: Target Section(s) to Combine */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <span className="flex h-4.5 w-4.5 items-center justify-center rounded-full bg-purple-600 text-white text-[10px] font-bold">
                  2
                </span>
                Combine With (Target Sections)
              </label>
              <span className="text-[11px] text-purple-700 font-semibold">
                {targetSections.length} selected
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {defaultSections.map((sec) => {
                const isMain = sec === mainSection;
                const isTarget = targetSections.includes(sec);

                if (isMain) {
                  return (
                    <div
                      key={`target-${sec}`}
                      className="flex items-center justify-between p-3 rounded-xl border border-dashed border-slate-200 bg-slate-50 text-slate-400 text-sm font-semibold cursor-not-allowed select-none opacity-60"
                      title="This is currently your Main section"
                    >
                      <span>Section {sec}</span>
                      <span className="text-[10px] uppercase font-bold text-slate-400">Source</span>
                    </div>
                  );
                }

                return (
                  <button
                    key={`target-${sec}`}
                    type="button"
                    onClick={() => handleToggleTarget(sec)}
                    className={cn(
                      "flex items-center justify-between p-3 rounded-xl border text-sm font-semibold transition-all cursor-pointer text-left",
                      isTarget
                        ? "border-purple-500 bg-purple-50/80 text-purple-950 ring-2 ring-purple-500/20 shadow-xs"
                        : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50",
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className={cn(
                          "flex h-4 w-4 items-center justify-center rounded border transition-colors",
                          isTarget ? "bg-purple-600 border-purple-600 text-white" : "border-slate-300 bg-white",
                        )}
                      >
                        {isTarget && <Check className="h-3 w-3 stroke-[3]" />}
                      </div>
                      <span>Section {sec}</span>
                    </div>
                    {isTarget && (
                      <span className="rounded bg-purple-200/80 px-1.5 py-0.5 text-[10px] font-bold text-purple-900">
                        Combine
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Live Sync Flow Banner */}
          <div className="rounded-xl border border-indigo-100 bg-gradient-to-r from-indigo-50/70 via-purple-50/40 to-slate-50 p-3.5">
            <div className="flex items-center justify-between gap-2 text-xs flex-wrap sm:flex-nowrap">
              <div className="flex items-center gap-2 font-bold text-indigo-900">
                <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-indigo-600 text-white text-xs shadow-xs">
                  {mainSection}
                </span>
                <span>Section {mainSection}</span>
              </div>

              <div className="flex items-center gap-1.5 text-indigo-600 font-semibold text-[11px] px-2 py-0.5 rounded-full bg-white border border-indigo-100 shadow-xs">
                <span>Copy Schedule</span>
                <ArrowRight className="h-3.5 w-3.5 text-indigo-600" />
              </div>

              <div className="flex items-center gap-1.5 flex-wrap">
                {targetSections.map((ts) => (
                  <div
                    key={ts}
                    className="flex items-center gap-1.5 rounded-lg border border-purple-200 bg-white px-2.5 py-1 font-bold text-purple-900 shadow-xs"
                  >
                    <span className="flex h-5 w-5 items-center justify-center rounded bg-purple-100 text-purple-800 text-[10px] font-bold">
                      {ts}
                    </span>
                    <span>Section {ts}</span>
                  </div>
                ))}
              </div>
            </div>

            <p className="text-[11px] text-slate-600 mt-2.5 border-t border-indigo-100/70 pt-2 flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-indigo-600 shrink-0" />
              <span>
                Copies all 6 days of periods, subjects, assigned faculty, rooms, parallel lab batch splits, and rotations.
              </span>
            </p>
          </div>

          {/* Auto Publish Option */}
          <label className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50/80 p-3.5 cursor-pointer select-none hover:bg-slate-50 transition-colors">
            <div className="flex items-center gap-2.5">
              <input
                type="checkbox"
                checked={autoPublish}
                onChange={(e) => setAutoPublish(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-600 cursor-pointer"
              />
              <div>
                <span className="text-xs font-bold text-navy-900 block">
                  Publish combined section timetable immediately
                </span>
                <span className="text-[11px] text-slate-500 block">
                  Makes Section {targetSections.join(", ")} live and visible right away.
                </span>
              </div>
            </div>
            <span
              className={cn(
                "rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase",
                autoPublish ? "bg-emerald-100 text-emerald-800" : "bg-slate-200 text-slate-600",
              )}
            >
              {autoPublish ? "Auto Publish" : "Draft"}
            </span>
          </label>
        </div>

        {/* Footer */}
        <div className="border-t border-border bg-slate-50/60 px-6 py-4 flex items-center justify-between gap-3">
          <Button type="button" variant="secondary" onClick={onClose} disabled={loading}>
            Cancel
          </Button>

          <Button
            type="button"
            onClick={handleExecuteCombine}
            disabled={loading || targetSections.length === 0 || !mainSection}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold shadow-md shadow-indigo-600/20 px-5 cursor-pointer"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                Combining…
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <Copy className="h-4 w-4" />
                Combine Section {mainSection} → {targetSections.join(", ")}
              </span>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
