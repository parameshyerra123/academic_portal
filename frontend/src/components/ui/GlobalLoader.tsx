"use client";

import React from "react";
import { GraduationCap } from "lucide-react";
import { cn } from "@/lib/cn";

export interface GlobalLoaderProps {
  /** Primary message title (defaults to "Loading Academic Portal…") */
  title?: string;
  /** Secondary subtitle message (defaults to "Please wait while we fetch your data.") */
  subtitle?: string;
  /** Presentation variant: 'fullscreen', 'overlay', or 'inline' */
  variant?: "fullscreen" | "overlay" | "inline";
  /** Optional custom icon override */
  icon?: React.ReactNode;
  /** Optional container class name */
  className?: string;
}

export function GlobalLoader({
  title = "Loading Academic Portal…",
  subtitle = "Please wait while we fetch your data.",
  variant = "inline",
  icon,
  className,
}: GlobalLoaderProps) {
  const isFullScreen = variant === "fullscreen";
  const isOverlay = variant === "overlay";

  const content = (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "flex flex-col items-center justify-center text-center select-none portal-fade-in",
        isFullScreen && "p-6 sm:p-8 max-w-sm w-full mx-auto",
        isOverlay && "p-6 rounded-2xl bg-card/95 border border-border/80 shadow-lg max-w-sm w-full mx-4 backdrop-blur-sm",
        variant === "inline" && "py-8 px-4 w-full",
        className
      )}
    >
      {/* Academic Branding Icon with Dual Circular Spinner */}
      <div className="relative flex items-center justify-center mb-4">
        {/* Outer subtle glow */}
        <div className="absolute inset-0 -m-3 rounded-full bg-blue-500/10 blur-md pointer-events-none" />

        {/* Outer animated spinner ring */}
        <div className="h-16 w-16 rounded-full border-2 border-slate-200/80 border-t-navy-900 border-r-brand-600 portal-spin" />

        {/* Inner reverse spinner ring */}
        <div
          className="absolute h-12 w-12 rounded-full border border-transparent border-b-cyan-500 border-l-navy-800"
          style={{ animation: "portalSpin 1.4s linear infinite reverse" }}
        />

        {/* Central Academic Icon Badge */}
        <div className="absolute flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-white to-blue-50/80 border border-blue-200/90 shadow-2xs">
          {icon ? (
            icon
          ) : (
            <GraduationCap className="h-5 w-5 text-navy-900 portal-pulse-slow" />
          )}
        </div>
      </div>

      {/* Primary Message */}
      <h3 className="text-sm sm:text-base font-bold text-navy-900 tracking-tight leading-snug">
        {title}
      </h3>

      {/* Secondary Message */}
      {subtitle ? (
        <p className="mt-1 text-xs text-slate-500 font-medium max-w-xs leading-relaxed">
          {subtitle}
        </p>
      ) : null}

      {/* Minimal subtle progress bar indicator */}
      <div className="mt-4 h-1 w-28 overflow-hidden rounded-full bg-slate-200/70">
        <div className="h-full w-full rounded-full bg-gradient-to-r from-navy-900 via-brand-600 to-navy-900 portal-shimmer" />
      </div>
    </div>
  );

  if (isFullScreen) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-background">
        {content}
      </div>
    );
  }

  if (isOverlay) {
    return (
      <div className="fixed inset-0 z-40 flex items-center justify-center bg-navy-950/20 backdrop-blur-xs transition-opacity duration-200">
        {content}
      </div>
    );
  }

  return content;
}
