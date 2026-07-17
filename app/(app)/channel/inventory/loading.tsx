import { SkeletonPageHeader, SkeletonStatCards, SkeletonTable } from "@/app/components/skeleton";

export default function Loading() {
  return (
    <div>
      <SkeletonPageHeader />
      <SkeletonStatCards count={3} />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <SkeletonTable rows={6} cols={4} />
        <SkeletonTable rows={6} cols={4} />
      </div>
    </div>
  );
}
