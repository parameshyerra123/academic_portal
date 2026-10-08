import { cn } from "@/lib/cn";
import type { TimetablePeriod } from "./types";
import { buildCourseSectionLine, entryTypeLabel, formatTime12h } from "./utils";

type Props = {
  period: Extract<TimetablePeriod, { kind: "class" }>;
  compact?: boolean;
};

export function TimetableClassCard({ period, compact = false }: Props) {
  const entryLabel = entryTypeLabel(period.entryType);
  const isLab = period.entryType.toLowerCase() === "lab";
  const subject = period.subjectName ?? period.subjectCode ?? "Untitled subject";
  const contextLine = buildCourseSectionLine(period);

  return (
    <article
      className="rounded-xl border border-border/80 bg-white p-2.5 sm:p-3 shadow-2xs hover:shadow-xs transition-all flex flex-col justify-between"
      aria-label={`${subject}, ${formatTime12h(period.startTime)} to ${formatTime12h(period.endTime)}`}
    >
      <div>
        <div className="flex items-start justify-between gap-1 mb-1">
          <span
            className={cn(
              "inline-flex rounded px-1.5 py-0.2 text-[9px] font-extrabold uppercase tracking-wide",
              isLab ? "bg-purple-50 text-purple-700 border border-purple-200" : "bg-brand-50 text-brand-700 border border-brand-200",
            )}
          >
            {entryLabel}
          </span>
          <span className="text-[10px] font-medium text-slate-500">
            {formatTime12h(period.startTime)} – {formatTime12h(period.endTime)}
          </span>
        </div>

        <h4
          className={cn(
            "break-words font-bold leading-snug text-navy-900",
            compact ? "text-xs" : "text-sm",
          )}
        >
          {subject}
        </h4>

        {contextLine ? (
          <p className="mt-1 break-words text-[11px] font-medium text-slate-600">{contextLine}</p>
        ) : null}

        {period.roomLabel ? (
          <p className="mt-1 break-words text-[10px] text-slate-500">
            Room: <span className="font-semibold text-slate-700">{period.roomLabel}</span>
            {period.slotLabel ? ` • ${period.slotLabel}` : ""}
          </p>
        ) : period.slotLabel ? (
          <p className="mt-1 text-[10px] text-slate-400">{period.slotLabel}</p>
        ) : null}
      </div>
    </article>
  );
}
