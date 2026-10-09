"use client";

import React from "react";
import { cn } from "@/lib/cn";

export interface InlineLoaderProps {
  /** Optional message displayed next to the spinner */
  label?: string;
  /** Size variant */
  size?: "xs" | "sm" | "md" | "lg";
  /** Optional custom class name */
  className?: string;
}

const sizeConfig = {
  xs: { ring: "h-3.5 w-3.5 border", text: "text-[11px]" },
  sm: { ring: "h-4 w-4 border-[1.5px]", text: "text-xs" },
  md: { ring: "h-5 w-5 border-2", text: "text-xs font-medium" },
  lg: { ring: "h-7 w-7 border-2", text: "text-sm font-medium" },
};

export function InlineLoader({
  label,
  size = "sm",
  className,
}: InlineLoaderProps) {
  const cfg = sizeConfig[size];

  return (
    <div
      role="status"
      aria-label={label || "Loading…"}
      className={cn("inline-flex items-center gap-2 select-none text-slate-500", className)}
    >
      <div
        className={cn(
          "rounded-full border-slate-200 border-t-navy-900 border-r-brand-600 portal-spin shrink-0",
          cfg.ring
        )}
      />
      {label ? <span className={cn(cfg.text, "truncate")}>{label}</span> : null}
      <span className="sr-only">{label || "Loading…"}</span>
    </div>
  );
}
