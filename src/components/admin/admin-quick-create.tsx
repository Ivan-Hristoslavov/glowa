"use client";

import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Link, usePathname } from "@/i18n/navigation";

/**
 * "New appointment" from anywhere in the admin. On the calendar itself the
 * toolbar has its own button that opens the dialog in place, so this one
 * steps aside rather than offering a second, slower route to the same thing.
 */
export function AdminQuickCreate({ label }: { label: string }) {
  const pathname = usePathname();
  if (pathname.startsWith("/dashboard/calendar")) return null;

  return (
    <Button asChild size="sm" className="hidden rounded-full sm:inline-flex">
      <Link href="/dashboard/calendar?new=1">
        <Plus className="size-4" aria-hidden />
        {label}
      </Link>
    </Button>
  );
}
