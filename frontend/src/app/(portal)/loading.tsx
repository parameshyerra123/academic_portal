import { PageSkeleton } from "@/components/ui/PageSkeleton";

export default function PortalModuleLoading() {
  return <PageSkeleton showFilterBar showStats={false} columns={5} rows={6} />;
}
