import { FeedSkeleton, LoadingRegion, PageHeaderSkeleton } from "@/components/ui/skeletons";

export default function Loading() {
  return (
    <LoadingRegion label="Loading site updates">
      <PageHeaderSkeleton />
      <div className="grid gap-6 lg:grid-cols-[1fr_260px]">
        <FeedSkeleton />
        <div className="hidden lg:block">
          <div className="skeleton h-56 w-full" />
        </div>
      </div>
    </LoadingRegion>
  );
}
