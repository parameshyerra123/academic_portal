"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, GitMerge, Sparkles } from "lucide-react";
import { cn } from "@/lib/cn";

export type SectionMultiSelectFilterProps = {
  sections: string[];
  currentSection: string;
  onChangeSection: (sec: string) => void;
  onOpenCombine: (sections?: string[]) => void;
  disabled?: boolean;
};

export function SectionMultiSelectFilter({
  sections,
  currentSection,
  onChangeSection,
  onOpenCombine,
  disabled = false,
}: SectionMultiSelectFilterProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Take strictly the exact sections that this branch has
  const allSections = useMemo(() => {
    const list = Array.from(new Set(sections))
      .filter((s) => s && s.toLowerCase() !== "all")
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    return list;
  }, [sections]);

  // Close when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [open]);

  const handleSelectSection = (sec: string) => {
    onChangeSection(sec);
    setOpen(false);
  };

  const handleSelectCombine = () => {
    setOpen(false);
    // Pass current section and another section from allSections
    const main =
      currentSection && currentSection !== "all" && allSections.includes(currentSection)
        ? currentSection
        : allSections[0] ?? "A";
    const target = allSections.find((s) => s !== main) ?? "";
    onOpenCombine(target ? [main, target] : [main]);
  };

  return (
    <div ref={containerRef} className="relative w-full sm:w-auto">
      {/* Trigger Button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((prev) => !prev)}
        className={cn(
          "flex h-11 sm:h-9 w-full sm:w-auto sm:min-w-[150px] items-center justify-between gap-2 rounded-md border border-border bg-white px-3 text-sm text-foreground outline-none transition-all cursor-pointer",
          open ? "border-indigo-600 ring-2 ring-indigo-600/20" : "hover:border-slate-300",
          disabled && "opacity-60 cursor-not-allowed bg-slate-50",
        )}
      >
        <span className="truncate font-medium text-xs sm:text-sm text-navy-900">
          {currentSection === "all" ? "All Sections" : `Section ${currentSection}`}
        </span>
        <ChevronDown
          className={cn(
            "h-3.5 w-3.5 text-slate-400 transition-transform duration-150",
            open && "rotate-180 text-indigo-600",
          )}
        />
      </button>

      {/* Dropdown Menu */}
      {open && (
        <div className="absolute left-0 top-full z-50 mt-1.5 w-60 rounded-xl border border-border bg-white p-1.5 shadow-xl animate-in fade-in zoom-in-95 duration-100">
          <div className="space-y-0.5">
            {/* All Sections */}
            <button
              type="button"
              onClick={() => handleSelectSection("all")}
              className={cn(
                "w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-colors text-left cursor-pointer",
                currentSection === "all"
                  ? "bg-indigo-50/80 text-indigo-900 font-bold"
                  : "text-slate-700 hover:bg-slate-50 hover:text-navy-900",
              )}
            >
              <span>All Sections</span>
              {currentSection === "all" && <Check className="h-3.5 w-3.5 text-indigo-600" />}
            </button>

            {/* Individual Sections (only the exact sections the branch has) */}
            {allSections.map((sec) => {
              const isCurrent = currentSection === sec;
              return (
                <button
                  key={sec}
                  type="button"
                  onClick={() => handleSelectSection(sec)}
                  className={cn(
                    "w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-colors text-left cursor-pointer",
                    isCurrent
                      ? "bg-indigo-50/80 text-indigo-900 font-bold"
                      : "text-slate-700 hover:bg-slate-50 hover:text-navy-900",
                  )}
                >
                  <span className="flex items-center gap-2">
                    <span
                      className={cn(
                        "flex h-5 w-5 items-center justify-center rounded text-[11px] font-bold",
                        isCurrent
                          ? "bg-indigo-600 text-white"
                          : "bg-slate-100 text-slate-700 border border-slate-200",
                      )}
                    >
                      {sec}
                    </span>
                    <span>Section {sec}</span>
                  </span>
                  {isCurrent && <Check className="h-3.5 w-3.5 text-indigo-600" />}
                </button>
              );
            })}
          </div>

          {/* Special Combine Option - only if branch has multiple sections */}
          {allSections.length >= 2 && (
            <>
              <div className="my-1.5 border-t border-border/80" />
              <button
                type="button"
                onClick={handleSelectCombine}
                className="w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg bg-gradient-to-r from-indigo-50 to-purple-50 hover:from-indigo-100/90 hover:to-purple-100/90 border border-indigo-200/80 text-indigo-950 font-bold text-xs transition-all shadow-xs cursor-pointer group"
              >
                <div className="flex items-center gap-2">
                  <div className="flex h-6 w-6 items-center justify-center rounded-md bg-indigo-600 text-white shadow-xs group-hover:scale-105 transition-transform">
                    <GitMerge className="h-3.5 w-3.5" />
                  </div>
                  <div className="text-left">
                    <span className="block text-xs font-bold leading-tight">Combine Sections…</span>
                    <span className="block text-[10px] font-normal text-slate-500 leading-tight">
                      Sync schedule across {allSections.join(" & ")}
                    </span>
                  </div>
                </div>
                <Sparkles className="h-3.5 w-3.5 text-indigo-600 shrink-0" />
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
