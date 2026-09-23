"use client";

import { BellRing, Check, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useTransition } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useRouter } from "@/i18n/navigation";
import { resolveWaitlistEntry } from "@/lib/actions/waitlist";

export type WaitlistView = {
  id: string;
  status: string;
  customerName: string;
  serviceName: string | null;
  staffName: string | null;
  fromDate: string;
  toDate: string;
  note: string | null;
  createdAt: string;
};

/**
 * Who is waiting, oldest first - the same order the offer trigger uses, so
 * what the salon sees is what the system will actually do.
 */
export function WaitlistPanel({
  businessId,
  entries,
  canManage,
  dateFormatter,
}: {
  businessId: string;
  entries: WaitlistView[];
  canManage: boolean;
  dateFormatter: Intl.DateTimeFormat;
}) {
  const t = useTranslations("waitlist");
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function resolve(entryId: string, status: "booked" | "expired") {
    startTransition(async () => {
      const result = await resolveWaitlistEntry(businessId, entryId, status);
      if (!result.ok) {
        toast.error(t(`errors.${result.code}`));
        return;
      }
      router.refresh();
    });
  }

  if (entries.length === 0) {
    return (
      <p className="text-muted-foreground border-border/70 rounded-xl border border-dashed p-4 text-sm">
        {t("empty")}
      </p>
    );
  }

  return (
    <ul className="glowa-card divide-border/70 divide-y">
      {entries.map((entry) => (
        <li key={entry.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 p-4">
          <BellRing className="text-muted-foreground size-4 shrink-0" aria-hidden />

          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{entry.customerName}</p>
            <p className="text-muted-foreground truncate text-xs">
              {dateFormatter.format(new Date(entry.fromDate))} –{" "}
              {dateFormatter.format(new Date(entry.toDate))}
              {entry.serviceName ? ` · ${entry.serviceName}` : ""}
              {entry.staffName ? ` · ${entry.staffName}` : ""}
            </p>
            {entry.note ? (
              <p className="text-muted-foreground mt-1 truncate text-xs italic">
                {entry.note}
              </p>
            ) : null}
          </div>

          <Badge variant={entry.status === "offered" ? "secondary" : "outline"}>
            {t(`statusLabel.${entry.status}`)}
          </Badge>

          {canManage ? (
            <div className="flex gap-1">
              <Button
                variant="ghost"
                size="icon"
                disabled={pending}
                aria-label={t("statusLabel.booked")}
                onClick={() => resolve(entry.id, "booked")}
              >
                <Check className="size-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                disabled={pending}
                aria-label={t("statusLabel.expired")}
                onClick={() => resolve(entry.id, "expired")}
              >
                <X className="size-4" />
              </Button>
            </div>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
