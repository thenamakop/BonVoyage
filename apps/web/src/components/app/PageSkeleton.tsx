import { Skeleton } from '../ui/Skeleton';

/**
 * #124: shown where a lazily loaded page goes while its code arrives on a first
 * load or a reload. The AppShell header stays in place above it.
 */
export function PageSkeleton() {
  return (
    <div role="status" aria-label="Loading page" className="space-y-3">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-32" />
    </div>
  );
}
