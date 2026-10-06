"use client";

import { ExternalLink, Eye, EyeOff, RotateCcw, Search, ShieldBan, ShieldCheck, Trash2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link, useRouter } from "@/i18n/navigation";
import {
  removeSalonPhoto,
  retryMessage,
  setAccountBlocked,
  setReviewVisibility,
  setSalonStatus,
  type PlatformResult,
} from "@/lib/actions/platform";
import { formatPrice } from "@/lib/format";
import { pickLocalized } from "@/lib/localized";
import type {
  AuditEntry,
  ContentReview,
  ContentSalon,
  FailedMessage,
  PaymentProblem,
  PlatformUser,
} from "@/lib/platform/overview";
import type { Locale } from "@/i18n/routing";
import { cn } from "@/lib/utils";

const ZONE = "Europe/Sofia";

function useAct() {
  const t = useTranslations("platform");
  const router = useRouter();
  const [pending, start] = useTransition();
  /** Runs an action, says how it went, and refreshes the data on success. */
  function act(run: () => Promise<PlatformResult>, success = t("mod.done")) {
    start(async () => {
      const result = await run();
      if (!result.ok) {
        toast.error(t(`errors.${result.code}`));
        return;
      }
      toast.success(success);
      router.refresh();
    });
  }
  return { act, pending };
}

function useDate() {
  const locale = useLocale();
  return (iso: string | null, withTime = false) =>
    iso
      ? new Intl.DateTimeFormat(locale, {
          day: "numeric",
          month: "short",
          year: "numeric",
          timeZone: ZONE,
          ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
        }).format(new Date(iso))
      : "";
}

/** Ask for an optional reason; `null` means the admin cancelled. */
function askReason(message: string, prompt: string): string | null {
  if (!window.confirm(message)) return null;
  const reason = window.prompt(prompt, "");
  return reason === null ? null : reason.trim();
}

function Thumb({ src, label, onRemove, disabled }: { src: string; label: string; onRemove: () => void; disabled: boolean }) {
  const t = useTranslations("platform");
  return (
    <figure className="group relative overflow-hidden rounded-xl border">
      {/* eslint-disable-next-line @next/next/no-img-element -- remote user uploads of unknown size; moderation needs the original */}
      <img src={src} alt={label} loading="lazy" className="bg-muted aspect-[4/3] w-full object-cover" />
      <figcaption className="bg-card/90 absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 px-2 py-1.5 text-[0.7rem] backdrop-blur">
        <span className="truncate">{label}</span>
        <button
          type="button"
          onClick={onRemove}
          disabled={disabled}
          className="glowa-focus text-destructive hover:bg-destructive/10 inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 font-medium"
          aria-label={`${t("mod.removePhoto")}: ${label}`}
        >
          <Trash2 className="size-3" aria-hidden />
          {t("mod.removePhoto")}
        </button>
      </figcaption>
    </figure>
  );
}

export function SalonModeration({ salons, reviews }: { salons: ContentSalon[]; reviews: ContentReview[] }) {
  const t = useTranslations("platform");
  const locale = useLocale() as Locale;
  const { act, pending } = useAct();
  const date = useDate();

  return (
    <div className="space-y-8">
      <section className="space-y-4">
        <div>
          <h2 className="font-heading text-xl">{t("mod.salonsTitle")}</h2>
          <p className="text-muted-foreground mt-1 max-w-2xl text-sm">{t("mod.salonsHelp")}</p>
        </div>
        {salons.length === 0 ? (
          <p className="glowa-card text-muted-foreground p-6 text-sm">{t("mod.noSalons")}</p>
        ) : (
          <ul className="space-y-4">
            {salons.map((salon) => {
              const suspended = salon.status === "suspended";
              const photos: Array<{ kind: "logo" | "cover" | "gallery"; url: string; label: string }> = [
                ...(salon.logo_url ? [{ kind: "logo" as const, url: salon.logo_url, label: t("mod.logo") }] : []),
                ...(salon.cover_url ? [{ kind: "cover" as const, url: salon.cover_url, label: t("mod.cover") }] : []),
                ...salon.gallery.map((url, index) => ({ kind: "gallery" as const, url, label: `${t("mod.gallery")} ${index + 1}` })),
              ];
              return (
                <li key={salon.id} className="glowa-card space-y-4 p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="flex flex-wrap items-center gap-2">
                        <span className="font-heading text-lg">{salon.name}</span>
                        {suspended ? <Badge variant="destructive">{t("mod.suspended")}</Badge> : null}
                      </p>
                      <p className="text-muted-foreground mt-0.5 text-xs">
                        {date(salon.created_at)} · {pickLocalized(salon.description, locale) || "—"}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button asChild variant="ghost" size="sm" className="rounded-full">
                        <Link href={`/business/${salon.slug}`}>
                          <ExternalLink className="size-4" aria-hidden />
                          {t("mod.viewPage")}
                        </Link>
                      </Button>
                      <Button
                        variant={suspended ? "outline" : "destructive"}
                        size="sm"
                        className="rounded-full"
                        disabled={pending}
                        onClick={() => {
                          const reason = askReason(
                            t(suspended ? "mod.confirmRestore" : "mod.confirmSuspend", { name: salon.name }),
                            t("mod.reasonPrompt"),
                          );
                          if (reason === null) return;
                          act(() =>
                            setSalonStatus({
                              businessId: salon.id,
                              status: suspended ? "active" : "suspended",
                              reason,
                            }),
                          );
                        }}
                      >
                        {suspended ? <ShieldCheck className="size-4" aria-hidden /> : <ShieldBan className="size-4" aria-hidden />}
                        {suspended ? t("mod.restore") : t("mod.suspend")}
                      </Button>
                    </div>
                  </div>

                  {photos.length === 0 ? (
                    <p className="text-muted-foreground text-sm">{t("mod.noPhotos")}</p>
                  ) : (
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                      {photos.map((photo) => (
                        <Thumb
                          key={photo.kind + photo.url}
                          src={photo.url}
                          label={photo.label}
                          disabled={pending}
                          onRemove={() => {
                            const reason = askReason(t("mod.confirmPhoto"), t("mod.reasonPrompt"));
                            if (reason === null) return;
                            act(() =>
                              removeSalonPhoto({ businessId: salon.id, kind: photo.kind, url: photo.url, reason }),
                            );
                          }}
                        />
                      ))}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="space-y-4">
        <h2 className="font-heading text-xl">{t("mod.reviewsTitle")}</h2>
        {reviews.length === 0 ? (
          <p className="glowa-card text-muted-foreground p-6 text-sm">{t("mod.noReviews")}</p>
        ) : (
          <ul className="grid gap-3 lg:grid-cols-2">
            {reviews.map((review) => {
              const hidden = review.status === "hidden";
              return (
                <li key={review.id} className={cn("glowa-card space-y-2 p-4", hidden && "opacity-60")}>
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="font-medium">
                      {review.business_name} · {"★".repeat(review.rating)}
                      <span className="text-muted-foreground">{"★".repeat(5 - review.rating)}</span>
                    </span>
                    <span className="text-muted-foreground">{date(review.created_at)}</span>
                  </div>
                  <p className="text-sm leading-relaxed">{review.comment || <span className="text-muted-foreground">{t("mod.noComment")}</span>}</p>
                  {review.response ? (
                    <p className="bg-muted/60 rounded-lg px-3 py-2 text-xs">
                      <span className="text-muted-foreground">{t("mod.reply")}: </span>
                      {review.response}
                    </p>
                  ) : null}
                  <div className="flex items-center justify-between">
                    {hidden ? <Badge variant="outline">{t("mod.hidden")}</Badge> : <span />}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="rounded-full"
                      disabled={pending}
                      onClick={() => {
                        const reason = hidden ? "" : askReason(t("mod.confirmReview"), t("mod.reasonPrompt"));
                        if (reason === null) return;
                        act(() =>
                          setReviewVisibility({
                            reviewId: review.id,
                            businessId: review.business_id,
                            status: hidden ? "published" : "hidden",
                            reason,
                          }),
                        );
                      }}
                    >
                      {hidden ? <Eye className="size-4" aria-hidden /> : <EyeOff className="size-4" aria-hidden />}
                      {hidden ? t("mod.showReview") : t("mod.hideReview")}
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

export function PeopleManager({ users, query }: { users: PlatformUser[]; query: string }) {
  const t = useTranslations("platform");
  const { act, pending } = useAct();
  const date = useDate();
  const [now] = useState(() => Date.now());

  return (
    <section className="space-y-4">
      <div>
        <h2 className="font-heading text-xl">{t("people.title")}</h2>
        <p className="text-muted-foreground mt-1 max-w-2xl text-sm">{t("people.help")}</p>
      </div>
      <form method="get" className="flex max-w-xl gap-2">
        <input type="hidden" name="tab" value="people" />
        <label className="relative block flex-1">
          <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" aria-hidden />
          <input
            type="search"
            name="q"
            defaultValue={query}
            placeholder={t("people.search")}
            aria-label={t("people.search")}
            className="glowa-focus bg-background h-10 w-full rounded-full border pr-3 pl-9 text-sm"
          />
        </label>
        <Button type="submit" className="rounded-full">
          {t("people.searchButton")}
        </Button>
      </form>

      {users.length === 0 ? (
        <p className="glowa-card text-muted-foreground p-6 text-sm">{t("people.empty")}</p>
      ) : (
        <div className="glowa-card overflow-x-auto p-1">
          <table className="w-full min-w-[820px] text-left text-sm">
            <thead className="text-muted-foreground text-xs">
              <tr className="border-b">
                {(["account", "salons", "bookings", "joined", "lastSeen", "status"] as const).map((key) => (
                  <th key={key} scope="col" className="px-4 py-3 font-medium">
                    {t(`people.${key}`)}
                  </th>
                ))}
                <th scope="col" className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {users.map((user) => {
                const blocked = Boolean(user.banned_until && new Date(user.banned_until).getTime() > now);
                return (
                  <tr key={user.id} className="hover:bg-muted/40 border-b last:border-0">
                    <td className="px-4 py-3">
                      <p className="font-medium">{user.full_name || "—"}</p>
                      <p className="text-muted-foreground text-xs">{user.email}</p>
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {user.salons.length === 0
                        ? "—"
                        : user.salons.map((s) => `${s.name} (${s.role})`).join(", ")}
                    </td>
                    <td className="px-4 py-3 tabular-nums">{user.bookings}</td>
                    <td className="px-4 py-3 text-xs whitespace-nowrap">{date(user.created_at)}</td>
                    <td className="px-4 py-3 text-xs whitespace-nowrap">
                      {user.last_sign_in_at ? date(user.last_sign_in_at) : t("people.never")}
                    </td>
                    <td className="px-4 py-3">
                      {user.is_platform_admin ? (
                        <Badge variant="outline">{t("people.platformAdmin")}</Badge>
                      ) : (
                        <Badge variant={blocked ? "destructive" : "secondary"} className="font-normal">
                          {blocked ? t("people.blocked") : t("people.active")}
                        </Badge>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {user.is_platform_admin ? null : (
                        <Button
                          variant="ghost"
                          size="sm"
                          className={cn("rounded-full", !blocked && "text-destructive hover:text-destructive")}
                          disabled={pending}
                          onClick={() => {
                            const reason = askReason(
                              t(blocked ? "people.confirmUnblock" : "people.confirmBlock", { email: user.email ?? "" }),
                              t("mod.reasonPrompt"),
                            );
                            if (reason === null) return;
                            act(() => setAccountBlocked({ userId: user.id, blocked: !blocked, reason }));
                          }}
                        >
                          {blocked ? <ShieldCheck className="size-4" aria-hidden /> : <ShieldBan className="size-4" aria-hidden />}
                          {blocked ? t("people.unblock") : t("people.block")}
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export function ProblemsBoard({
  failed,
  stuck,
  payments,
  summary,
}: {
  failed: FailedMessage[];
  stuck: number;
  payments: PaymentProblem[];
  summary: { failed_messages_7d: number; sent_messages_7d: number };
}) {
  const t = useTranslations("platform");
  const locale = useLocale();
  const { act, pending } = useAct();
  const date = useDate();

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h2 className="font-heading text-xl">{t("problems.title")}</h2>
        <p className="text-muted-foreground text-sm">
          {t("problems.summary", { sent: summary.sent_messages_7d, failed: summary.failed_messages_7d })}
        </p>
        {stuck > 0 ? (
          <p className="bg-warning/15 text-foreground rounded-xl px-4 py-3 text-sm" role="status">
            {t("problems.stuck", { count: stuck })}
          </p>
        ) : null}
      </div>

      <section className="space-y-3">
        <h3 className="font-heading text-lg">{t("problems.failedTitle")}</h3>
        {failed.length === 0 ? (
          <p className="glowa-card text-muted-foreground p-6 text-sm">{t("problems.noFailed")}</p>
        ) : (
          <div className="glowa-card overflow-x-auto p-1">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="text-muted-foreground text-xs">
                <tr className="border-b">
                  {(["eventLabel", "salon", "error", "attempts", "when"] as const).map((key) => (
                    <th key={key} scope="col" className="px-4 py-3 font-medium">
                      {t(`problems.${key}`)}
                    </th>
                  ))}
                  <th scope="col" className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {failed.map((message) => (
                  <tr key={message.id} className="hover:bg-muted/40 border-b last:border-0">
                    <td className="px-4 py-3">{t.has(`problems.event.${message.event}`) ? t(`problems.event.${message.event}`) : message.event}</td>
                    <td className="px-4 py-3 text-xs">{message.business_name ?? "—"}</td>
                    <td className="text-destructive px-4 py-3 text-xs">{message.error ?? "—"}</td>
                    <td className="px-4 py-3 tabular-nums">{message.attempts}</td>
                    <td className="px-4 py-3 text-xs whitespace-nowrap">{date(message.updated_at, true)}</td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        className="rounded-full"
                        disabled={pending}
                        onClick={() => act(() => retryMessage(message.id), t("problems.retried"))}
                      >
                        <RotateCcw className="size-4" aria-hidden />
                        {t("problems.retry")}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h3 className="font-heading text-lg">{t("problems.paymentsTitle")}</h3>
        {payments.length === 0 ? (
          <p className="glowa-card text-muted-foreground p-6 text-sm">{t("problems.noPayments")}</p>
        ) : (
          <div className="glowa-card overflow-x-auto p-1">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="text-muted-foreground text-xs">
                <tr className="border-b">
                  {(["kind", "salon", "amount", "error", "when"] as const).map((key) => (
                    <th key={key} scope="col" className="px-4 py-3 font-medium">
                      {t(`problems.${key}`)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {payments.map((payment) => (
                  <tr key={payment.id} className="border-b last:border-0">
                    <td className="px-4 py-3">{t("problems.paymentStatus", { kind: payment.kind, status: payment.status })}</td>
                    <td className="px-4 py-3 text-xs">{payment.business_name ?? "—"}</td>
                    <td className="px-4 py-3 tabular-nums">{formatPrice(payment.amount_cents, payment.currency, locale as never)}</td>
                    <td className="text-destructive px-4 py-3 text-xs">{payment.reason ?? "—"}</td>
                    <td className="px-4 py-3 text-xs whitespace-nowrap">{date(payment.created_at, true)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

export function AuditLog({ entries }: { entries: AuditEntry[] }) {
  const t = useTranslations("platform");
  const date = useDate();
  return (
    <section className="space-y-4">
      <div>
        <h2 className="font-heading text-xl">{t("audit.title")}</h2>
        <p className="text-muted-foreground mt-1 text-sm">{t("audit.help")}</p>
      </div>
      {entries.length === 0 ? (
        <p className="glowa-card text-muted-foreground p-6 text-sm">{t("audit.empty")}</p>
      ) : (
        <ul className="glowa-card divide-y">
          {entries.map((entry) => {
            const reason = typeof entry.details?.reason === "string" ? entry.details.reason : "";
            const url = typeof entry.details?.url === "string" ? entry.details.url : "";
            return (
              <li key={entry.id} className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 px-5 py-3 text-sm">
                <div className="min-w-0">
                  <p className="font-medium">{t("audit.action", { action: entry.action })}</p>
                  <p className="text-muted-foreground truncate text-xs">
                    {entry.target_type} · {entry.target_id}
                    {entry.details?.to ? ` → ${String(entry.details.to)}` : ""}
                    {url ? ` · ${url}` : ""}
                    {reason ? ` · ${t("audit.reason", { reason })}` : ""}
                  </p>
                </div>
                <p className="text-muted-foreground text-xs whitespace-nowrap">
                  {entry.admin_email ?? "—"} · {date(entry.created_at, true)}
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
