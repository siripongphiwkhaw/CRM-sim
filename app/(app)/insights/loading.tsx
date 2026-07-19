import { SkeletonPageHeader, SkeletonText } from "@/app/components/skeleton";

export default function Loading() {
  return (
    <div>
      <SkeletonPageHeader />
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-[14px] border border-[#dde5e8] bg-white p-4">
            <SkeletonText lines={4} />
          </div>
        ))}
      </div>
    </div>
  );
}
