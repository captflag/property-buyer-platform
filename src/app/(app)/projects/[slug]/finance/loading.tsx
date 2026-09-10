import { Card, CardContent } from "@/components/ui/card";
import {
  ChartSkeleton,
  LoadingRegion,
  PageHeaderSkeleton,
  StatGridSkeleton,
  TableSkeleton,
} from "@/components/ui/skeletons";

export default function Loading() {
  return (
    <LoadingRegion label="Loading project finances">
      <PageHeaderSkeleton />
      <div className="flex flex-col gap-6">
        <StatGridSkeleton />
        <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
          <Card>
            <CardContent className="pt-5">
              <ChartSkeleton height={200} />
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5">
              <ChartSkeleton height={140} />
            </CardContent>
          </Card>
        </div>
        <Card>
          <CardContent className="pt-5">
            <TableSkeleton rows={7} columns={6} />
          </CardContent>
        </Card>
      </div>
    </LoadingRegion>
  );
}
