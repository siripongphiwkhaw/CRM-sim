import { SkeletonPageHeader, SkeletonStatCards, SkeletonText } from "@/app/components/skeleton";

export default function Loading() {
  return (
    <div>
      <SkeletonPageHeader />
      <SkeletonStatCards count={4} />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded border border-[#dde5e8] bg-white p-4">
            <SkeletonText lines={5} />
          </div>
        ))}
      </div>
    </div>
  );
}
