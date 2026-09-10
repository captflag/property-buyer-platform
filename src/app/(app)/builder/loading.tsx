import { Card, CardContent } from "@/components/ui/card";
import { LoadingRegion, PageHeaderSkeleton, StatGridSkeleton } from "@/components/ui/skeletons";

export default function Loading() {
  return (
    <LoadingRegion label="Loading the site console">
      <PageHeaderSkeleton />
      <div className="flex flex-col gap-6">
        <StatGridSkeleton />
        <div className="grid gap-4 xl:grid-cols-[1.5fr_1fr]">
          <Card>
            <CardContent className="flex flex-col gap-4 pt-5">
              <div className="skeleton h-9 w-full" />
              <div className="skeleton h-28 w-full" />
              <div className="grid grid-cols-2 gap-3">
                <div className="skeleton h-9" />
                <div className="skeleton h-9" />
              </div>
              <div className="skeleton h-24 w-full" />
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex flex-col gap-4 pt-5">
              {Array.from({ length: 4 }, (_, i) => (
                <div key={i} className="flex flex-col gap-2">
                  <div className="skeleton h-3 w-2/3" />
                  <div className="skeleton h-2 w-full" />
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </LoadingRegion>
  );
}
