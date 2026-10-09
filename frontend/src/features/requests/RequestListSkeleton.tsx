import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { TableSkeleton } from "@/components/ui/TableSkeleton";

export function RequestListSkeleton({ rows = 4 }: { rows?: number }) {
  return <TableSkeleton columns={6} rows={rows} showHeader />;
}

export function RequestDetailSkeleton() {
  return (
    <div className="space-y-4 portal-fade-in">
      <Card className="p-4 sm:p-5">
        <div className="mb-4 flex gap-2">
          <Skeleton className="h-6 w-20 rounded-md" />
          <Skeleton className="h-6 w-28 rounded-md" variant="subtle" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="space-y-2">
              <Skeleton className="h-3 w-20 rounded" />
              <Skeleton className="h-4 w-full rounded" variant="subtle" />
            </div>
          ))}
        </div>
        <div className="mt-4 space-y-2 border-t border-border pt-4">
          <Skeleton className="h-3 w-24 rounded" />
          <Skeleton className="h-16 w-full rounded-lg" variant="subtle" />
        </div>
      </Card>
      <Card className="p-4 sm:p-5">
        <div className="mb-3">
          <Skeleton className="h-4 w-32 rounded" />
        </div>
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton key={index} className="h-14 rounded-lg" variant="subtle" />
          ))}
        </div>
      </Card>
    </div>
  );
}
