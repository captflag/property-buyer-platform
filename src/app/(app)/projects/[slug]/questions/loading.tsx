import { FeedSkeleton, LoadingRegion, PageHeaderSkeleton } from "@/components/ui/skeletons";

export default function Loading() {
  return (
    <LoadingRegion label="Loading questions">
      <PageHeaderSkeleton />
      <FeedSkeleton items={3} />
    </LoadingRegion>
  );
}
