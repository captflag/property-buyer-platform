import { Card, CardContent } from "@/components/ui/card";
import { LoadingRegion, PageHeaderSkeleton, StatGridSkeleton } from "@/components/ui/skeletons";

export default function Loading() {
  return (
    <LoadingRegion label="Loading quality and issues">
      <PageHeaderSkeleton />
      <div className="flex flex-col gap-6">
        <StatGridSkeleton />
        <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
          <Card>
            <CardContent className="flex flex-col gap-5 pt-5">
              {Array.from({ length: 4 }, (_, i) => (
                <div key={i} className="flex flex-col gap-2">
                  <div className="skeleton h-4 w-2/3" />
                  <div className="skeleton h-2.5 w-full" />
                  <div className="skeleton h-2.5 w-4/5" />
                </div>
              ))}
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex flex-col gap-3 pt-5">
              {Array.from({ length: 6 }, (_, i) => (
                <div key={i} className="skeleton h-8 w-full" />
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </LoadingRegion>
  );
}
