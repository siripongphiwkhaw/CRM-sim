import { SkeletonPageHeader, SkeletonStatCards, SkeletonText } from "@/app/components/skeleton";

export default function Loading() {
  return (
    <div>
      <SkeletonPageHeader />
      <SkeletonStatCards count={3} />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="rounded border border-[#e5e5e5] bg-white p-4">
            <SkeletonText lines={6} />
          </div>
        ))}
      </div>
    </div>
  );
}
