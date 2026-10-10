"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";
import { apiFetch } from "@/lib/api";

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ""}${parts[parts.length - 1][0] ?? ""}`.toUpperCase();
}

export type FacultyAvatarProps = {
  name: string;
  photo?: string | null;
  /** When photo is not provided upfront, pass hrmsEmployeeId to lazy-fetch from /faculty/:id/photo */
  hrmsEmployeeId?: string | null;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  className?: string;
};

const sizeClass = {
  xs: "h-6 w-6 text-[10px]",
  sm: "h-8 w-8 text-xs",
  md: "h-10 w-10 text-sm",
  lg: "h-14 w-14 text-base",
  xl: "h-20 w-20 text-xl",
} as const;

function AvatarFallback({
  name,
  size,
  className,
}: {
  name: string;
  size: keyof typeof sizeClass;
  className?: string;
}) {
  return (
    <div
      className={cn(
        sizeClass[size],
        "flex shrink-0 select-none items-center justify-center rounded-full bg-navy-900 font-bold text-white shadow-2xs",
        className,
      )}
      aria-hidden
      title={name}
    >
      {initials(name)}
    </div>
  );
}

export function FacultyAvatar({
  name,
  photo,
  hrmsEmployeeId,
  size = "sm",
  className,
}: FacultyAvatarProps) {
  const [failed, setFailed] = useState(false);
  const [lazyPhoto, setLazyPhoto] = useState<string | null>(null);

  useEffect(() => {
    setFailed(false);
    setLazyPhoto(null);
  }, [hrmsEmployeeId, photo]);

  useEffect(() => {
    if (photo || !hrmsEmployeeId) return;
    let cancelled = false;
    async function load() {
      try {
        const response = await apiFetch(`/faculty/${encodeURIComponent(String(hrmsEmployeeId))}/photo`, {
          cache: "force-cache",
        });
        if (!response.ok) return;
        const body = (await response.json()) as { photo?: string | null };
        if (!cancelled && body.photo) {
          setLazyPhoto(body.photo);
        }
      } catch {
        // Fall back to initials
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [photo, hrmsEmployeeId]);

  const src = photo || lazyPhoto;

  if (!src || failed) {
    return <AvatarFallback name={name} size={size} className={className} />;
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element -- images hosted on secure external S3 bucket from HRMS
    <img
      src={src}
      alt={name}
      title={name}
      onError={() => setFailed(true)}
      className={cn(
        sizeClass[size],
        "shrink-0 select-none rounded-full object-cover border border-slate-200/90 shadow-2xs",
        className,
      )}
    />
  );
}
