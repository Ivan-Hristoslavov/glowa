import { useTranslations } from "next-intl";

import { Badge } from "@/components/ui/badge";
import type { Database } from "@/types/database";

type Status = Database["public"]["Enums"]["appointment_status"];

const VARIANT: Record<Status, "default" | "secondary" | "outline" | "destructive"> = {
  pending: "secondary",
  confirmed: "default",
  completed: "outline",
  cancelled: "destructive",
  no_show: "destructive",
};

export function AppointmentStatusBadge({ status }: { status: Status }) {
  const t = useTranslations("bookings.status");
  return <Badge variant={VARIANT[status]}>{t(status)}</Badge>;
}
