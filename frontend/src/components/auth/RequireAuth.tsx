"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/AuthProvider";

import { GlobalLoader } from "@/components/ui/GlobalLoader";

export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
    }
  }, [loading, user, router]);

  if (loading) {
    return (
      <GlobalLoader
        variant="fullscreen"
        title="Loading Academic Portal…"
        subtitle="Please wait while we verify your session data."
      />
    );
  }

  if (!user) {
    return (
      <GlobalLoader
        variant="fullscreen"
        title="Redirecting to login…"
        subtitle="Please sign in to access the Academic Portal."
      />
    );
  }

  return <>{children}</>;
}
