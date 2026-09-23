import { PageSkeleton } from "@/components/common/page-skeleton";

export default function PaymentsLoading() {
  return <PageSkeleton tiles={4} rows={5} rowHeight="h-16" />;
}
