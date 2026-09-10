import { LoadingRegion, PageHeaderSkeleton } from "@/components/ui/skeletons";

export default function Loading() {
  return (
    <LoadingRegion label="Loading photographs">
      <PageHeaderSkeleton />
      <div className="flex flex-col gap-6">
        <div className="skeleton aspect-[16/10] w-full" />
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 12 }, (_, i) => (
            <div key={i} className="skeleton aspect-[4/3] w-full" />
          ))}
        </div>
      </div>
    </LoadingRegion>
  );
}
