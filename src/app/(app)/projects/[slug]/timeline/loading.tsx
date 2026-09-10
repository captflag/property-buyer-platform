import { Card, CardContent } from "@/components/ui/card";
import {
  GanttSkeleton,
  LoadingRegion,
  PageHeaderSkeleton,
  StatGridSkeleton,
} from "@/components/ui/skeletons";

export default function Loading() {
  return (
    <LoadingRegion label="Loading the project timeline">
      <PageHeaderSkeleton />
      <div className="flex flex-col gap-6">
        <StatGridSkeleton />
        <Card>
          <CardContent className="pt-5">
            <GanttSkeleton rows={10} />
          </CardContent>
        </Card>
      </div>
    </LoadingRegion>
  );
}
