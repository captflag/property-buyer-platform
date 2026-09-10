import { CardListSkeleton, LoadingRegion, PageHeaderSkeleton } from "@/components/ui/skeletons";

export default function Loading() {
  return (
    <LoadingRegion label="Loading the document library">
      <PageHeaderSkeleton />
      <CardListSkeleton items={9} />
    </LoadingRegion>
  );
}
