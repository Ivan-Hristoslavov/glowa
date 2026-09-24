import { NextResponse, type NextRequest } from "next/server";

import { routing, type Locale } from "@/i18n/routing";
import { renderCampaign, renderNotification } from "@/lib/notifications/render";
import type { NotificationEvent } from "@/lib/notifications/types";

const EVENTS: NotificationEvent[] = [
  "booking_confirmation",
  "reminder",
  "reschedule",
  "cancellation",
  "review_request",
  "waitlist_offer",
];

/**
 * Renders every email template with invented sample data, for looking at them
 * in a browser while working on the design. Development only: in a production
 * build this route answers 404 and renders nothing.
 *
 *   /api/dev/email-preview?event=reminder&locale=en
 *   /api/dev/email-preview?event=marketing
 */
export async function GET(request: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return new NextResponse(null, { status: 404 });
  }

  const params = request.nextUrl.searchParams;
  const locale = (routing.locales as readonly string[]).includes(params.get("locale") ?? "")
    ? (params.get("locale") as Locale)
    : routing.defaultLocale;
  const event = params.get("event") ?? "booking_confirmation";

  const startsAt = new Date(Date.now() + 26 * 3_600_000);
  startsAt.setMinutes(30, 0, 0);
  const endsAt = new Date(startsAt.getTime() + 75 * 60_000);

  const rendered =
    event === "marketing"
      ? await renderCampaign({
          locale,
          businessName: "Hair Lab Sofia",
          businessSlug: "demo-hair-lab-sofia",
          subject: "Есенни цветове в Hair Lab",
          body: "Новата ни есенна палитра е тук. Запазете час до края на октомври и ще получите безплатна маска за коса към всяко боядисване.",
          unsubscribeUrl: `${request.nextUrl.origin}/${locale}/unsubscribe/sample`,
          businessCoverUrl: "/brand/cover-hair-lab.webp",
        })
      : await renderNotification({
          locale,
          event: (EVENTS as string[]).includes(event)
            ? (event as NotificationEvent)
            : "booking_confirmation",
          businessName: "Hair Lab Sofia",
          businessSlug: "demo-hair-lab-sofia",
          businessTimezone: "Europe/Sofia",
          businessPhone: "+359 88 123 4567",
          googleReviewUrl: null,
          serviceName: { bg: "Подстригване и оформяне", en: "Cut and finish", ro: "Tuns și styling" },
          staffName: "Мария",
          customerName: "Елена",
          startsAt: startsAt.toISOString(),
          endsAt: endsAt.toISOString(),
          priceCents: 3000,
          currency: "EUR",
          locationName: "Hair Lab · Център",
          locationAddress: "ул. Гурко 24, София",
          appointmentId: "00000000-0000-4000-8000-000000000000",
          businessCoverUrl: "/brand/cover-hair-lab.webp",
        });

  return new NextResponse(rendered.html, {
    headers: { "content-type": "text/html; charset=utf-8", "x-robots-tag": "noindex" },
  });
}
