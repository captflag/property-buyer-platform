import { LoadingRegion, PageHeaderSkeleton } from "@/components/ui/skeletons";

export default function Loading() {
  return (
    <LoadingRegion label="Loading this week's digest">
      <PageHeaderSkeleton />
      <div className="skeleton h-96 w-full max-w-3xl" />
    </LoadingRegion>
  );
}
