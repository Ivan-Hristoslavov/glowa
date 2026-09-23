import { PageSkeleton } from "@/components/common/page-skeleton";

export default function DashboardLoading() {
  return <PageSkeleton tiles={8} rows={3} rowHeight="h-16" />;
}
