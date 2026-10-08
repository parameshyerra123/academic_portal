import Link from "next/link";
import { cn } from "@/lib/cn";

type Props = {
  label: string;
  value: string | number;
  hint?: string;
  tone?: "default" | "success" | "warning" | "critical" | "info";
  onClickHref?: string;
  compact?: boolean;
  size?: "sm" | "md" | "lg";
  icon?: React.ReactNode;
  className?: string;
};

const toneBorderMap = {
  default: "border-border/80 bg-card",
  success: "border-emerald-200/90 bg-emerald-50/20",
  warning: "border-amber-200/90 bg-amber-50/20",
  critical: "border-rose-200/90 bg-rose-50/20",
  info: "border-blue-200/90 bg-blue-50/20",
};

const tonePillMap = {
  default: "bg-slate-400",
  success: "bg-emerald-500",
  warning: "bg-amber-500",
  critical: "bg-rose-500",
  info: "bg-blue-500",
};

const toneValueMap = {
  default: "text-navy-900",
  success: "text-emerald-900",
  warning: "text-amber-900",
  critical: "text-rose-900",
  info: "text-blue-900",
};

export function StatCard({
  label,
  value,
  hint,
  tone = "default",
  onClickHref,
  compact = false,
  size,
  icon,
  className,
}: Props) {
  const isCompact = compact || size === "sm";

  const cardContent = isCompact ? (
    <div
      className={cn(
        "group relative flex flex-col justify-between rounded-xl border p-2 sm:p-2.5 shadow-2xs transition-all hover:shadow-xs",
        toneBorderMap[tone],
        onClickHref && "cursor-pointer active:scale-[0.98]",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-1 min-w-0">
        <p className="truncate text-[9.5px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-500">
          {label}
        </p>
        {icon ? (
          <span className="text-slate-400 shrink-0">{icon}</span>
        ) : tone !== "default" ? (
          <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", tonePillMap[tone])} />
        ) : null}
      </div>
      <p
        className={cn(
          "mt-0.5 truncate text-base sm:text-xl font-black tracking-tight leading-tight text-navy-900",
          tone !== "default" && toneValueMap[tone],
        )}
      >
        {value}
      </p>
      {hint ? (
        <p className="mt-0.5 truncate text-[9px] sm:text-[10px] text-slate-400 leading-none print:hidden">
          {hint}
        </p>
      ) : null}
    </div>
  ) : (
    <div
      className={cn(
        "group relative rounded-xl sm:rounded-lg border bg-card p-2.5 sm:p-4 shadow-xs transition-all hover:shadow-sm print:p-1.5 print:shadow-none",
        toneBorderMap[tone],
        onClickHref && "cursor-pointer active:scale-[0.98]",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-1">
        <p className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-slate-500 print:text-[9.5px] truncate">
          {label}
        </p>
        {icon ? (
          <span className="text-slate-400 shrink-0">{icon}</span>
        ) : tone !== "default" ? (
          <span className={cn("h-2 w-2 rounded-full shrink-0", tonePillMap[tone])} />
        ) : null}
      </div>
      <p
        className={cn(
          "mt-0.5 sm:mt-1.5 text-lg sm:text-2xl font-bold text-navy-900 tracking-tight print:mt-0 print:text-sm truncate",
          tone !== "default" && toneValueMap[tone],
        )}
      >
        {value}
      </p>
      {hint ? (
        <p className="mt-0.5 sm:mt-1 text-[10px] sm:text-xs text-slate-500 print:hidden truncate">
          {hint}
        </p>
      ) : null}
    </div>
  );

  if (onClickHref) {
    return (
      <Link href={onClickHref} className="block">
        {cardContent}
      </Link>
    );
  }

  return cardContent;
}

