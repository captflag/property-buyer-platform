import { LoadingRegion, PageHeaderSkeleton, TableSkeleton } from "@/components/ui/skeletons";

export default function Loading() {
  return (
    <LoadingRegion label="Preparing the progress report">
      <PageHeaderSkeleton />
      <div className="mx-auto flex max-w-4xl flex-col gap-6">
        <div className="skeleton h-24 w-full" />
        <TableSkeleton rows={6} columns={6} />
        <TableSkeleton rows={8} columns={5} />
      </div>
    </LoadingRegion>
  );
}
