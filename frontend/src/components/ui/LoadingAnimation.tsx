"use client";

import React from "react";
import { GraduationCap } from "lucide-react";
import { cn } from "@/lib/cn";

export type LoadingAnimationProps = {
  /** Primary text label displayed underneath (defaults to "Loading Academic Portal…") */
  label?: string;
  /** Optional secondary subtitle */
  subtitle?: string;
  /** Size variant */
  size?: "sm" | "md" | "lg";
  /** Custom color override */
  color?: string;
  /** Optional container class name for styling/layout */
  className?: string;
  /** Whether to apply default centered container padding */
  center?: boolean;
  /** Visual style: "academic" (spinner + cap icon) or "dots" (bounce wave) */
  variant?: "academic" | "dots";
};

export function LoadingAnimation({
  label = "Loading Academic Portal…",
  subtitle = "Please wait while we fetch your data.",
  size = "md",
  color,
  className,
  center = true,
  variant = "academic",
}: LoadingAnimationProps) {
  if (variant === "dots") {
    const sizeStyles = {
      sm: { dot: "h-2 w-2", gap: "gap-1.5" },
      md: { dot: "h-3 w-3", gap: "gap-2.5" },
      lg: { dot: "h-4 w-4", gap: "gap-3" },
    }[size];

    return (
      <div
        className={cn(
          "flex flex-col items-center justify-center transition-opacity duration-300 portal-fade-in",
          center && "py-8 min-h-[120px] w-full",
          className
        )}
        role="status"
        aria-label={label || "Loading…"}
      >
        <div className={cn("flex items-center justify-center", sizeStyles.gap)}>
          <span
            className={cn(
              "rounded-full inline-block animate-dot-bounce",
              sizeStyles.dot,
              !color && "bg-navy-900 shadow-xs shadow-navy-900/30"
            )}
            style={{ backgroundColor: color, animationDelay: "0s" }}
          />
          <span
            className={cn(
              "rounded-full inline-block animate-dot-bounce",
              sizeStyles.dot,
              !color && "bg-brand-600 shadow-xs shadow-brand-600/30"
            )}
            style={{ backgroundColor: color, animationDelay: "0.18s" }}
          />
          <span
            className={cn(
              "rounded-full inline-block animate-dot-bounce",
              sizeStyles.dot,
              !color && "bg-cyan-600 shadow-xs shadow-cyan-600/30"
            )}
            style={{ backgroundColor: color, animationDelay: "0.36s" }}
          />
        </div>

        {label ? (
          <p className="mt-3 text-xs font-semibold text-navy-900 tracking-wide">
            {label}
          </p>
        ) : null}
      </div>
    );
  }

  // Academic themed circular spinner variant (default)
  const sizeMap = {
    sm: { outer: "h-10 w-10", inner: "h-7 w-7", icon: "h-3.5 w-3.5", badge: "h-6 w-6" },
    md: { outer: "h-14 w-14", inner: "h-10 w-10", icon: "h-4.5 w-4.5", badge: "h-8 w-8" },
    lg: { outer: "h-16 w-16", inner: "h-12 w-12", icon: "h-5 w-5", badge: "h-10 w-10" },
  }[size];

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center transition-opacity duration-300 portal-fade-in select-none",
        center && "py-8 min-h-[140px] w-full",
        className
      )}
      role="status"
      aria-label={label || "Loading…"}
    >
      <div className="relative flex items-center justify-center mb-3">
        {/* Subtle radial glow */}
        <div className="absolute inset-0 -m-2 rounded-full bg-blue-500/10 blur-sm pointer-events-none" />

        {/* Circular Outer Spinner */}
        <div
          className={cn(
            "rounded-full border-2 border-slate-200/90 border-t-navy-900 border-r-brand-600 portal-spin",
            sizeMap.outer
          )}
          style={color ? { borderTopColor: color } : undefined}
        />

        {/* Inner Counter Spinner Ring */}
        <div
          className={cn(
            "absolute rounded-full border border-transparent border-b-cyan-500 border-l-navy-800",
            sizeMap.inner
          )}
          style={{ animation: "portalSpin 1.4s linear infinite reverse" }}
        />

        {/* Academic Center Icon Badge */}
        <div
          className={cn(
            "absolute flex items-center justify-center rounded-full bg-gradient-to-br from-white to-blue-50/90 border border-blue-200/80 shadow-2xs",
            sizeMap.badge
          )}
        >
          <GraduationCap className={cn("text-navy-900 portal-pulse-slow", sizeMap.icon)} />
        </div>
      </div>

      {label ? (
        <h4 className="text-xs sm:text-sm font-bold text-navy-900 tracking-tight leading-snug">
          {label}
        </h4>
      ) : null}

      {subtitle ? (
        <p className="mt-0.5 text-[11px] sm:text-xs text-slate-500 font-medium max-w-xs">
          {subtitle}
        </p>
      ) : null}
    </div>
  );
}
