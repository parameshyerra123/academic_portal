"use client";

import React from "react";
import { cn } from "@/lib/cn";

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Visual variant: default (light blue-gray), subtle (softer for card surfaces), circular, pill */
  variant?: "default" | "subtle" | "circular" | "pill";
  /** Whether shimmer motion is enabled (defaults to true) */
  animate?: boolean;
}

/**
 * Primitive Skeleton component with accessible role and premium light blue-gray shimmer.
 */
export function Skeleton({
  className,
  variant = "default",
  animate = true,
  ...props
}: SkeletonProps) {
  return (
    <div
      role="status"
      aria-label="Loading content…"
      className={cn(
        "relative overflow-hidden select-none",
        variant === "circular" && "rounded-full",
        variant === "pill" && "rounded-full",
        variant !== "circular" && variant !== "pill" && "rounded-md",
        variant === "subtle"
          ? "bg-slate-100/80"
          : "bg-slate-200/70",
        animate && (variant === "subtle" ? "portal-shimmer-subtle" : "portal-shimmer"),
        className
      )}
      {...props}
    >
      <span className="sr-only">Loading…</span>
    </div>
  );
}
