import { Card, CardContent } from "@/components/ui/card";
import {
  ChartSkeleton,
  LoadingRegion,
  PageHeaderSkeleton,
  StatGridSkeleton,
} from "@/components/ui/skeletons";

export default function Loading() {
  return (
    <LoadingRegion label="Loading analytics">
      <PageHeaderSkeleton />
      <div className="flex flex-col gap-6">
        <StatGridSkeleton />
        <Card>
          <CardContent className="pt-5">
            <ChartSkeleton height={240} />
          </CardContent>
        </Card>
        <div className="grid gap-4 lg:grid-cols-3">
          {Array.from({ length: 3 }, (_, i) => (
            <Card key={i}>
              <CardContent className="flex flex-col gap-3 pt-5">
                <div className="skeleton h-2.5 w-28" />
                <div className="skeleton h-9 w-24" />
                <div className="skeleton h-2 w-full" />
                <div className="skeleton h-2 w-4/5" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </LoadingRegion>
  );
}
