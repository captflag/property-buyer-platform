import { CardListSkeleton, LoadingRegion, PageHeaderSkeleton } from "@/components/ui/skeletons";

export default function Loading() {
  return (
    <LoadingRegion label="Loading your move-in plan">
      <PageHeaderSkeleton />
      <div className="skeleton h-28 w-full" />
      <CardListSkeleton items={6} />
    </LoadingRegion>
  );
}
