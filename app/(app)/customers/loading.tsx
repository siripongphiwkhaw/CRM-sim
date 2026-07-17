import { Skeleton, SkeletonPageHeader, SkeletonTable } from "@/app/components/skeleton";

export default function Loading() {
  return (
    <div>
      <SkeletonPageHeader />
      <div className="mb-4 flex items-center gap-2">
        <Skeleton className="h-8 w-full max-w-64" />
        <Skeleton className="h-8 w-24" />
      </div>
      <SkeletonTable rows={10} cols={6} />
    </div>
  );
}
