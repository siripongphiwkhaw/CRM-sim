import { SkeletonPageHeader, SkeletonTable, SkeletonText } from "@/app/components/skeleton";

export default function Loading() {
  return (
    <div>
      <SkeletonPageHeader />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <SkeletonTable rows={4} cols={3} />
        </div>
        <div className="rounded border border-[#dde5e8] bg-white p-4">
          <SkeletonText lines={6} />
        </div>
      </div>
    </div>
  );
}
