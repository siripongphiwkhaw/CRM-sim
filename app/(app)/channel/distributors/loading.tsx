import { SkeletonPageHeader, SkeletonTable } from "@/app/components/skeleton";

export default function Loading() {
  return (
    <div>
      <SkeletonPageHeader />
      <SkeletonTable rows={8} cols={6} />
    </div>
  );
}
