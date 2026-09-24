"use client";

import { Command } from "cmdk";
import {
  CalendarPlus,
  Copy,
  ExternalLink,
  FileImage,
  Moon,
  Search,
  Sun,
  UserRound,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { ADMIN_LINKS } from "@/components/admin/admin-nav";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { useRouter } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/client";

type ClientHit = { id: string; full_name: string | null; phone: string | null; email: string | null };

/**
 * Ctrl/⌘ + K from any admin page: jump to a page, find a client by name or
 * phone, or do the handful of things people do most - add an appointment,
 * copy the booking link to paste into Instagram, make a flyer.
 *
 * Client search runs in the browser against `business_clients`, so RLS keeps
 * it to the salons this person belongs to.
 */
export function CommandMenu({ slug }: { slug: string }) {
  const t = useTranslations("admin.command");
  const nav = useTranslations("admin.nav");
  const locale = useLocale();
  const router = useRouter();
  const { resolvedTheme, setTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [clients, setClients] = useState<ClientHit[]>([]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((current) => !current);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    const term = query.trim();
    if (term.length < 2) return;
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      const supabase = createClient();
      const like = `%${term.replace(/[%_,()]/g, " ")}%`;
      const { data } = await supabase
        .from("business_clients")
        .select("id, full_name, phone, email")
        .or(`full_name.ilike.${like},phone.ilike.${like},email.ilike.${like}`)
        .order("last_visit_at", { ascending: false, nullsFirst: false })
        .limit(6);
      if (!cancelled) setClients(data ?? []);
    }, 180);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [query]);

  function run(action: () => void) {
    setOpen(false);
    setQuery("");
    action();
  }

  const itemClass =
    "flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-sm aria-selected:bg-accent aria-selected:text-accent-foreground";
  const groupClass =
    "[&_[cmdk-group-heading]]:text-muted-foreground px-2 py-1 [&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[0.7rem] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:tracking-wide [&_[cmdk-group-heading]]:uppercase";

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="glowa-focus text-muted-foreground hover:text-foreground hover:border-primary/40 bg-card flex h-9 items-center gap-2 rounded-full border px-3 text-sm transition-colors"
        aria-label={t("open")}
      >
        <Search className="size-4" aria-hidden />
        <span className="hidden md:inline">{t("placeholderShort")}</span>
        <kbd className="bg-muted hidden rounded px-1.5 py-0.5 font-sans text-[0.65rem] font-medium md:inline">
          Ctrl K
        </kbd>
      </button>

      <Dialog
        open={open}
        onOpenChange={(value) => {
          setOpen(value);
          if (!value) setQuery("");
        }}
      >
        <DialogContent className="overflow-hidden rounded-3xl p-0 sm:max-w-lg" showCloseButton={false}>
          <DialogTitle className="sr-only">{t("open")}</DialogTitle>
          <Command label={t("open")} shouldFilter className="flex flex-col">
            <div className="flex items-center gap-2 border-b px-4">
              <Search className="text-muted-foreground size-4 shrink-0" aria-hidden />
              <Command.Input
                value={query}
                onValueChange={(value) => {
                  setQuery(value);
                  if (value.trim().length < 2) setClients([]);
                }}
                placeholder={t("placeholder")}
                className="placeholder:text-muted-foreground h-13 w-full bg-transparent py-4 text-base outline-none"
              />
            </div>
            <Command.List className="max-h-[60dvh] overflow-y-auto py-2">
              <Command.Empty className="text-muted-foreground px-4 py-8 text-center text-sm">
                {t("empty")}
              </Command.Empty>

              {clients.length > 0 ? (
                <Command.Group heading={t("clients")} className={groupClass}>
                  {clients.map((client) => (
                    <Command.Item
                      key={client.id}
                      value={`client ${client.full_name ?? ""} ${client.phone ?? ""} ${client.email ?? ""} ${query}`}
                      onSelect={() => run(() => router.push(`/dashboard/clients/${client.id}`))}
                      className={itemClass}
                    >
                      <UserRound className="text-muted-foreground size-4" aria-hidden />
                      <span className="min-w-0 flex-1 truncate">{client.full_name ?? client.email}</span>
                      {client.phone ? (
                        <span className="text-muted-foreground text-xs tabular-nums">{client.phone}</span>
                      ) : null}
                    </Command.Item>
                  ))}
                </Command.Group>
              ) : null}

              <Command.Group heading={t("actions")} className={groupClass}>
                <Command.Item
                  onSelect={() => run(() => router.push("/dashboard/calendar"))}
                  className={itemClass}
                >
                  <CalendarPlus className="text-primary size-4" aria-hidden />
                  {t("newAppointment")}
                </Command.Item>
                <Command.Item
                  onSelect={() =>
                    run(() => {
                      // Read at click time: there is no `window` during the
                      // server render of this component.
                      const bookingUrl = `${window.location.origin}/${locale}/business/${slug}`;
                      void navigator.clipboard
                        .writeText(bookingUrl)
                        .then(() => toast.success(t("copied")));
                    })
                  }
                  className={itemClass}
                >
                  <Copy className="text-primary size-4" aria-hidden />
                  {t("copyLink")}
                </Command.Item>
                <Command.Item
                  onSelect={() => run(() => router.push("/dashboard/growth/flyer"))}
                  className={itemClass}
                >
                  <FileImage className="text-primary size-4" aria-hidden />
                  {t("flyer")}
                </Command.Item>
                <Command.Item
                  onSelect={() => run(() => router.push(`/business/${slug}`))}
                  className={itemClass}
                >
                  <ExternalLink className="text-primary size-4" aria-hidden />
                  {t("publicPage")}
                </Command.Item>
                <Command.Item
                  onSelect={() => run(() => setTheme(resolvedTheme === "dark" ? "light" : "dark"))}
                  className={itemClass}
                >
                  {resolvedTheme === "dark" ? (
                    <Sun className="text-primary size-4" aria-hidden />
                  ) : (
                    <Moon className="text-primary size-4" aria-hidden />
                  )}
                  {t("toggleTheme")}
                </Command.Item>
              </Command.Group>

              <Command.Group heading={t("pages")} className={groupClass}>
                {ADMIN_LINKS.map(({ href, key, icon: Icon }) => (
                  <Command.Item
                    key={href}
                    value={`${nav(key)} ${key}`}
                    onSelect={() => run(() => router.push(href))}
                    className={itemClass}
                  >
                    <Icon className="text-muted-foreground size-4" aria-hidden />
                    {nav(key)}
                  </Command.Item>
                ))}
              </Command.Group>
            </Command.List>
            <div className="text-muted-foreground flex items-center justify-between border-t px-4 py-2 text-[0.7rem]">
              <span>{t("hint")}</span>
              <kbd className="bg-muted rounded px-1.5 py-0.5 font-sans">Esc</kbd>
            </div>
          </Command>
        </DialogContent>
      </Dialog>
    </>
  );
}
