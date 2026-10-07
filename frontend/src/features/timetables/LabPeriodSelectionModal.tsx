"use client";

import { useMemo, useState, useEffect } from "react";
import {
  AlertTriangle,
  Check,
  Clock,
  FlaskConical,
  Sparkles,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";

export type AssignableSlot = {
  id: number;
  label: string;
  startTime: string;
  endTime: string;
};

export type ExistingSlotSummary = {
  slotId: number;
  subjectName?: string | null;
  subjectCode?: string | null;
  facultyName?: string | null;
  customLabel?: string | null;
};

export type LabPeriodSelectionModalProps = {
  isOpen: boolean;
  onClose: () => void;
  day: string;
  currentSlotId: number;
  assignableSlots: AssignableSlot[];
  existingSlotsSummary?: ExistingSlotSummary[];
  initialSelectedSlotIds?: number[];
  onConfirm: (selectedSlotIds: number[]) => void;
};

export function LabPeriodSelectionModal({
  isOpen,
  onClose,
  day,
  currentSlotId,
  assignableSlots,
  existingSlotsSummary = [],
  initialSelectedSlotIds = [],
  onConfirm,
}: LabPeriodSelectionModalProps) {
  // Find current slot index among assignable class periods
  const currentSlotIndex = useMemo(() => {
    return assignableSlots.findIndex((s) => s.id === currentSlotId);
  }, [assignableSlots, currentSlotId]);

  const currentSlot = useMemo(() => {
    return assignableSlots[currentSlotIndex] ?? null;
  }, [assignableSlots, currentSlotIndex]);

  // Subsequent slots starting from current slot
  const candidateSlots = useMemo(() => {
    if (currentSlotIndex < 0) return assignableSlots;
    return assignableSlots.slice(currentSlotIndex);
  }, [assignableSlots, currentSlotIndex]);

  // Internal selection state
  const [selectedIds, setSelectedIds] = useState<number[]>(() => {
    if (initialSelectedSlotIds.length > 0 && initialSelectedSlotIds.includes(currentSlotId)) {
      return initialSelectedSlotIds;
    }
    // Default to standard 3 periods if available, otherwise 2, otherwise 1
    const defaultBatch: number[] = [currentSlotId];
    if (candidateSlots[1]) defaultBatch.push(candidateSlots[1].id);
    if (candidateSlots[2]) defaultBatch.push(candidateSlots[2].id);
    return defaultBatch;
  });

  // Re-sync when modal opens or slot changes
  useEffect(() => {
    if (!isOpen) return;
    if (initialSelectedSlotIds.length > 0 && initialSelectedSlotIds.includes(currentSlotId)) {
      setSelectedIds(initialSelectedSlotIds);
    } else {
      // Standard lab recommendation: 3 periods (e.g. P2, P3, P4)
      const defaultBatch: number[] = [currentSlotId];
      if (candidateSlots[1]) defaultBatch.push(candidateSlots[1].id);
      if (candidateSlots[2]) defaultBatch.push(candidateSlots[2].id);
      setSelectedIds(defaultBatch);
    }
  }, [isOpen, currentSlotId, candidateSlots, initialSelectedSlotIds]);

  if (!isOpen) return null;

  // Toggle subsequent slot
  const handleToggleSlot = (slotId: number) => {
    if (slotId === currentSlotId) return; // Base slot cannot be unselected

    setSelectedIds((prev) => {
      if (prev.includes(slotId)) {
        // Removing slotId: also remove any subsequent selected slots to keep consecutive block
        const clickedIdx = candidateSlots.findIndex((s) => s.id === slotId);
        const filtered = prev.filter((id) => {
          const idx = candidateSlots.findIndex((s) => s.id === id);
          return idx < clickedIdx;
        });
        return filtered.includes(currentSlotId) ? filtered : [currentSlotId, ...filtered];
      } else {
        // Adding slotId: select all consecutive slots between currentSlot and slotId
        const clickedIdx = candidateSlots.findIndex((s) => s.id === slotId);
        const newIds = new Set(prev);
        for (let i = 0; i <= clickedIdx; i++) {
          newIds.add(candidateSlots[i].id);
        }
        return Array.from(newIds);
      }
    });
  };

  // Quick preset handlers
  const handleSetPresetCount = (count: number) => {
    const subset = candidateSlots.slice(0, Math.min(count, candidateSlots.length)).map((s) => s.id);
    setSelectedIds(subset);
  };

  const handleApply = () => {
    const finalIds = selectedIds.includes(currentSlotId)
      ? selectedIds
      : [currentSlotId, ...selectedIds];
    onConfirm(finalIds);
    onClose();
  };

  const selectedSlots = candidateSlots.filter((s) => selectedIds.includes(s.id));
  const selectedLabels = selectedSlots.map((s) => s.label);
  const startTime = selectedSlots[0]?.startTime || currentSlot?.startTime || "";
  const endTime = selectedSlots[selectedSlots.length - 1]?.endTime || currentSlot?.endTime || "";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <button
        type="button"
        className="absolute inset-0 bg-navy-950/60 backdrop-blur-xs transition-opacity"
        aria-label="Close dialog"
        onClick={onClose}
      />

      {/* Modal Dialog Card */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="lab-periods-title"
        className="relative z-10 flex w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl animate-in fade-in zoom-in-95 duration-150"
      >
        {/* Header */}
        <div className="border-b border-border bg-gradient-to-r from-purple-50/80 via-indigo-50/40 to-white px-6 py-4.5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-purple-600 text-white shadow-md shadow-purple-600/20">
                <FlaskConical className="h-5 w-5" />
              </div>
              <div>
                <h3 id="lab-periods-title" className="text-base sm:text-lg font-bold text-navy-900">
                  Select Consecutive Lab Periods
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {day} • Starting from Period {currentSlot?.label ?? "P"} ({currentSlot?.startTime}–{currentSlot?.endTime})
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
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-4.5 max-h-[75vh] overflow-y-auto">
          {/* Quick Preset Buttons */}
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-slate-600 block mb-2">
              Quick Duration Presets
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => handleSetPresetCount(1)}
                className={cn(
                  "p-2.5 rounded-xl border text-xs font-semibold text-center transition-all cursor-pointer",
                  selectedIds.length === 1
                    ? "border-purple-600 bg-purple-50 text-purple-950 ring-2 ring-purple-600/20 shadow-xs"
                    : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
                )}
              >
                <span className="block font-bold">1 Period</span>
                <span className="text-[10.5px] text-slate-500 font-normal">
                  {currentSlot?.label} only
                </span>
              </button>

              <button
                type="button"
                onClick={() => handleSetPresetCount(2)}
                disabled={candidateSlots.length < 2}
                className={cn(
                  "p-2.5 rounded-xl border text-xs font-semibold text-center transition-all cursor-pointer",
                  selectedIds.length === 2
                    ? "border-purple-600 bg-purple-50 text-purple-950 ring-2 ring-purple-600/20 shadow-xs"
                    : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
                  candidateSlots.length < 2 && "opacity-50 cursor-not-allowed",
                )}
              >
                <span className="block font-bold">2 Periods</span>
                <span className="text-[10.5px] text-slate-500 font-normal">
                  {candidateSlots[0]?.label} + {candidateSlots[1]?.label ?? ""}
                </span>
              </button>

              <button
                type="button"
                onClick={() => handleSetPresetCount(3)}
                disabled={candidateSlots.length < 3}
                className={cn(
                  "p-2.5 rounded-xl border text-xs font-semibold text-center transition-all cursor-pointer relative",
                  selectedIds.length === 3
                    ? "border-purple-600 bg-purple-50 text-purple-950 ring-2 ring-purple-600/20 shadow-xs"
                    : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
                  candidateSlots.length < 3 && "opacity-50 cursor-not-allowed",
                )}
              >
                <span className="absolute -top-2 right-2 rounded bg-purple-600 px-1.5 py-0.2 text-[9px] font-bold text-white uppercase shadow-xs">
                  Lab Block
                </span>
                <span className="block font-bold">3 Periods</span>
                <span className="text-[10.5px] text-slate-500 font-normal">
                  {candidateSlots[0]?.label}–{candidateSlots[2]?.label ?? ""}
                </span>
              </button>
            </div>
          </div>

          {/* Periods Checklist */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-600">
                Periods on {day}
              </label>
              <span className="text-[11px] text-purple-700 font-bold">
                {selectedIds.length} {selectedIds.length === 1 ? "Period" : "Periods"} Selected
              </span>
            </div>

            <div className="space-y-2">
              {candidateSlots.map((slot, idx) => {
                const isBase = slot.id === currentSlotId;
                const isSelected = selectedIds.includes(slot.id);
                const existing = existingSlotsSummary.find((e) => e.slotId === slot.id);

                return (
                  <button
                    key={slot.id}
                    type="button"
                    onClick={() => handleToggleSlot(slot.id)}
                    className={cn(
                      "w-full flex items-center justify-between p-3 rounded-xl border text-xs font-medium transition-all text-left cursor-pointer",
                      isSelected
                        ? "border-purple-500 bg-purple-50/70 text-purple-950 ring-1 ring-purple-500/30 shadow-xs"
                        : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50/80",
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={cn(
                          "flex h-5 w-5 shrink-0 items-center justify-center rounded border transition-colors",
                          isSelected
                            ? "bg-purple-600 border-purple-600 text-white"
                            : "border-slate-300 bg-white text-transparent",
                        )}
                      >
                        {isSelected && <Check className="h-3.5 w-3.5 stroke-[3]" />}
                      </div>

                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm text-navy-900">
                            Period {slot.label}
                          </span>
                          <span className="text-[11px] text-slate-500 font-mono flex items-center gap-1">
                            <Clock className="h-3 w-3 text-slate-400" />
                            {slot.startTime} – {slot.endTime}
                          </span>
                          {isBase && (
                            <span className="rounded bg-indigo-100 px-1.5 py-0.5 text-[10px] font-bold text-indigo-800">
                              Base Period
                            </span>
                          )}
                        </div>

                        {existing?.subjectName && !isBase && (
                          <p className="text-[10.5px] text-amber-700 flex items-center gap-1 mt-0.5">
                            <AlertTriangle className="h-3 w-3 shrink-0" />
                            <span>
                              Currently has: <strong>{existing.subjectName}</strong> (will be replaced by this lab)
                            </span>
                          </p>
                        )}
                      </div>
                    </div>

                    <span
                      className={cn(
                        "rounded-full px-2.5 py-0.5 text-[10.5px] font-bold shrink-0",
                        isSelected
                          ? "bg-purple-200/90 text-purple-900"
                          : "bg-slate-100 text-slate-600",
                      )}
                    >
                      {isSelected ? "Included" : "Unselected"}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Dynamic Summary Box */}
          <div className="rounded-xl border border-purple-200 bg-gradient-to-r from-purple-50 via-indigo-50/50 to-slate-50 p-3.5">
            <div className="flex items-center gap-2 text-xs font-bold text-purple-950">
              <FlaskConical className="h-4 w-4 text-purple-700" />
              <span>
                Lab Duration: {selectedLabels.join(", ")} ({selectedSlots.length} Periods • {startTime} – {endTime})
              </span>
            </div>
            <p className="text-[11px] text-slate-600 mt-1 pl-6">
              When you save, this lab subject, faculty, room, and lab batches will be assigned to all selected periods on {day}.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-border bg-slate-50/60 px-6 py-4 flex items-center justify-between gap-3">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>

          <Button
            type="button"
            onClick={handleApply}
            className="bg-purple-600 hover:bg-purple-700 text-white font-bold shadow-md shadow-purple-600/20 px-5 cursor-pointer"
          >
            Apply to {selectedLabels.join(", ")} ({selectedSlots.length} {selectedSlots.length === 1 ? "Period" : "Periods"})
          </Button>
        </div>
      </div>
    </div>
  );
}
