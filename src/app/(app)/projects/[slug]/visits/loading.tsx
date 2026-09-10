import { LoadingRegion, PageHeaderSkeleton } from "@/components/ui/skeletons";

export default function Loading() {
  return (
    <LoadingRegion label="Loading site visits">
      <PageHeaderSkeleton />
      <div className="grid gap-4 xl:grid-cols-[1.3fr_1fr]">
        <div className="skeleton h-80 w-full" />
        <div className="skeleton h-56 w-full" />
      </div>
    </LoadingRegion>
  );
}
