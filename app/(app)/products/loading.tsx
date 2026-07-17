import { SkeletonCardGrid, SkeletonPageHeader } from "@/app/components/skeleton";

export default function Loading() {
  return (
    <div>
      <SkeletonPageHeader />
      <SkeletonCardGrid count={10} />
    </div>
  );
}
