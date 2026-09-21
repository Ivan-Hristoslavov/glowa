"use client";

import { CalendarPlus, Download, ExternalLink } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type AddToCalendarProps = {
  googleUrl: string;
  icsUrl: string;
};

/**
 * The stateless half of the calendar story: no account, no OAuth, works for
 * every provider. Connected two-way sync is a separate, opt-in flow.
 */
export function AddToCalendar({ googleUrl, icsUrl }: AddToCalendarProps) {
  const t = useTranslations("bookings");

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline">
          <CalendarPlus className="size-4" aria-hidden />
          {t("addToCalendar")}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuItem asChild>
          <a href={googleUrl} target="_blank" rel="noopener noreferrer">
            <ExternalLink className="size-4" aria-hidden />
            {t("google")}
          </a>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <a href={icsUrl} download>
            <Download className="size-4" aria-hidden />
            {t("downloadIcs")}
          </a>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
