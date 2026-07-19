/* Loading-skeleton primitives composed by the per-route loading.tsx files. */

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-[#ecebea] ${className}`} />;
}

export function SkeletonText({ lines = 3 }: { lines?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} className={`h-3 ${i === lines - 1 ? "w-2/3" : "w-full"}`} />
      ))}
    </div>
  );
}

export function SkeletonPageHeader() {
  return (
    <div className="mb-4 rounded border border-[#dde5e8] bg-white p-4">
      <div className="flex items-center gap-3">
        <Skeleton className="h-10 w-10 rounded-lg" />
        <div className="space-y-2">
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-3 w-64 max-w-full" />
        </div>
      </div>
    </div>
  );
}

const STAT_GRID_COLS: Record<number, string> = {
  2: "lg:grid-cols-2",
  3: "lg:grid-cols-3",
  4: "lg:grid-cols-4",
  5: "lg:grid-cols-5",
};

export function SkeletonStatCards({ count = 4 }: { count?: number }) {
  const lgCols = STAT_GRID_COLS[Math.min(count, 5)] ?? "lg:grid-cols-4";
  return (
    <div className={`mb-4 grid grid-cols-2 gap-3 ${lgCols}`}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded border border-[#dde5e8] bg-white p-4">
          <Skeleton className="mb-2 h-3 w-20" />
          <Skeleton className="h-6 w-14" />
        </div>
      ))}
    </div>
  );
}

export function SkeletonTable({ rows = 8, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="rounded border border-[#dde5e8] bg-white p-4">
      <div className="mb-3 flex gap-4">
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={i} className="h-3 flex-1" />
        ))}
      </div>
      <div className="divide-y divide-[#eef3f5]">
        {Array.from({ length: rows }).map((_, r) => (
          <div key={r} className="flex gap-4 py-3">
            {Array.from({ length: cols }).map((_, c) => (
              <Skeleton key={c} className="h-4 flex-1" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function SkeletonCardGrid({ count = 8 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded border border-[#dde5e8] bg-white p-4">
          <Skeleton className="mx-auto mb-3 aspect-square w-24 rounded-lg" />
          <Skeleton className="mb-2 h-4 w-3/4" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      ))}
    </div>
  );
}
