import { Card, CardContent } from "@/components/ui/card";
import { LoadingRegion, PageHeaderSkeleton } from "@/components/ui/skeletons";

export default function Loading() {
  return (
    <LoadingRegion label="Loading settings">
      <PageHeaderSkeleton />
      <div className="flex max-w-3xl flex-col gap-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Card key={i}>
            <CardContent className="flex flex-col gap-3 pt-5">
              <div className="skeleton h-3 w-32" />
              <div className="skeleton h-2.5 w-64" />
              <div className="skeleton h-16 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    </LoadingRegion>
  );
}
