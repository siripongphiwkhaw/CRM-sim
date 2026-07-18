import { SkeletonPageHeader, SkeletonStatCards, SkeletonTable } from "@/app/components/skeleton";

export default function Loading() {
  return (
    <div>
      <SkeletonPageHeader />
      <SkeletonStatCards count={4} />
      <SkeletonTable rows={6} cols={5} />
    </div>
  );
}
