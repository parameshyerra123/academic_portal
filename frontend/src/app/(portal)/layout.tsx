import { AppShell } from "@/components/layout/AppShell";
import { AuthProvider } from "@/components/auth/AuthProvider";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { PathPermissionGuard } from "@/components/auth/PathPermissionGuard";
import { LoadingProvider } from "@/context/LoadingContext";

export default function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthProvider>
      <RequireAuth>
        <LoadingProvider>
          <AppShell>
            <PathPermissionGuard>{children}</PathPermissionGuard>
          </AppShell>
        </LoadingProvider>
      </RequireAuth>
    </AuthProvider>
  );
}
