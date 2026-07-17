import { SkeletonPageHeader, SkeletonTable } from "@/app/components/skeleton";

export default function Loading() {
  return (
    <div>
      <SkeletonPageHeader />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <SkeletonTable rows={6} cols={3} />
        <SkeletonTable rows={6} cols={3} />
      </div>
    </div>
  );
}
