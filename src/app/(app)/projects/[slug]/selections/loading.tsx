import {
  CardListSkeleton,
  LoadingRegion,
  PageHeaderSkeleton,
  StatGridSkeleton,
} from "@/components/ui/skeletons";

export default function Loading() {
  return (
    <LoadingRegion label="Loading your selections">
      <PageHeaderSkeleton />
      <StatGridSkeleton />
      <CardListSkeleton items={6} />
    </LoadingRegion>
  );
}
