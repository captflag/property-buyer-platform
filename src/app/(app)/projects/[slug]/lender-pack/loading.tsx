import { LoadingRegion, TableSkeleton } from "@/components/ui/skeletons";

export default function Loading() {
  return (
    <LoadingRegion label="Preparing the lender pack">
      <div className="skeleton h-24 w-full" />
      <TableSkeleton rows={8} columns={5} />
    </LoadingRegion>
  );
}
