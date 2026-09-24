import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { CalendarBoard } from "@/components/admin/calendar/calendar-board";
import {
  WaitlistPanel,
  type WaitlistView,
} from "@/components/admin/waitlist-panel";
import type {
  CalendarAppointment,
  CalendarService,
  CalendarStaff,
} from "@/components/admin/calendar/types";
import type { Locale } from "@/i18n/routing";
import { pickLocalized } from "@/lib/localized";
import {
  canManage,
  getActiveMembership,
  getBusinessWorkspace,
  listAppointmentsInRange,
  listWaitlist,
} from "@/lib/queries/business";
import { createClient } from "@/lib/supabase/server";
import {
  addDaysToKey,
  instantFromZoned,
  startOfWeekKey,
  zonedDateKey,
} from "@/lib/timezone";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.calendar");
  return { title: t("title"), robots: { index: false, follow: false } };
}

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function minutesFromTime(value: string) {
  const [hh, mm] = value.split(":").map(Number);
  return (hh ?? 0) * 60 + (mm ?? 0);
}

export default async function CalendarPage({
  params,
  searchParams,
}: PageProps<"/[locale]/dashboard/calendar">) {
  const { locale } = await params;
  setRequestLocale(locale);

  const membership = await getActiveMembership();
  if (!membership) return null;

  const workspace = await getBusinessWorkspace(membership.businessId);
  const timezone = workspace.business?.timezone ?? "Europe/Sofia";
  const activeLocale = locale as Locale;
  const waitlistT = await getTranslations("waitlist");
  const calendarT = await getTranslations("admin.calendar");

  const sp = await searchParams;
  const view = firstParam(sp.view) === "week" ? "week" : "day";
  const requested = firstParam(sp.date);
  const dateKey =
    requested && /^\d{4}-\d{2}-\d{2}$/.test(requested)
      ? requested
      : zonedDateKey(new Date(), timezone);

  const weekStart = startOfWeekKey(dateKey);
  const weekKeys = Array.from({ length: 7 }, (_, index) => addDaysToKey(weekStart, index));
  const days = view === "week" ? weekKeys : [dateKey];

  // Query by instant, so the range always matches the salon's local days.
  const from = instantFromZoned(days[0], 0, timezone);
  const to = instantFromZoned(addDaysToKey(days[days.length - 1], 1), 0, timezone);

  const supabase = await createClient();
  const [appointments, waitlistRows, { data: timeOff }] = await Promise.all([
    listAppointmentsInRange(membership.businessId, from, to),
    listWaitlist(membership.businessId),
    supabase
      .from("staff_time_off")
      .select("id, staff_profile_id, starts_at, ends_at, reason")
      .gte("ends_at", from.toISOString())
      .lt("starts_at", to.toISOString()),
  ]);

  const staffIds = new Set(workspace.staff.map((member) => member.id));

  const staff: CalendarStaff[] = workspace.staff.map((member) => ({
    id: member.id,
    displayName: member.display_name,
    color: member.color,
    avatarUrl: member.avatar_url,
    isBookable: member.is_bookable,
    hours: (member.staff_working_hours ?? []).map((window) => ({
      dayOfWeek: window.day_of_week,
      startMinutes: minutesFromTime(window.starts_at),
      endMinutes: minutesFromTime(window.ends_at),
    })),
  }));

  const services: CalendarService[] = workspace.services
    .filter((service) => service.is_active)
    .map((service) => ({
      id: service.id,
      name: pickLocalized(service.name, activeLocale),
      durationMinutes: service.duration_minutes,
      priceCents: service.price_cents,
      currency: service.currency,
      staffIds: (service.service_staff ?? []).map((row) => row.staff_profile_id),
    }));

  const calendarAppointments: CalendarAppointment[] = appointments.map((appointment) => ({
    id: appointment.id,
    startsAt: appointment.starts_at,
    endsAt: appointment.ends_at,
    status: appointment.status,
    staffProfileId: appointment.staff_profile_id,
    serviceName:
      pickLocalized(appointment.services?.name, activeLocale) ||
      pickLocalized(appointment.service_name_snapshot, activeLocale),
    customerName: appointment.customer_name,
    customerPhone: appointment.customer_phone,
    priceCents: appointment.price_cents,
    depositCents: appointment.deposit_cents,
    depositStatus: appointment.deposit_status,
    currency: appointment.currency,
    internalNotes: appointment.internal_notes,
    customerNotes: appointment.customer_notes,
    bufferBeforeMinutes: appointment.services?.buffer_before_minutes ?? 0,
    bufferAfterMinutes: appointment.services?.buffer_after_minutes ?? 0,
  }));

  const waitlist: WaitlistView[] = (waitlistRows ?? []).map((row) => ({
    id: row.id,
    status: row.status,
    // A waitlist entry always belongs to an account, so a missing name means
    // the profile has none rather than that this is a walk-in.
    customerName: row.profiles?.full_name ?? "—",
    serviceName: row.services ? pickLocalized(row.services.name, activeLocale) : null,
    staffName: row.staff_profiles?.display_name ?? null,
    fromDate: row.from_date,
    toDate: row.to_date,
    note: row.note,
    createdAt: row.created_at,
  }));

  return (
    <div data-fullwidth className="space-y-8">
      <h1 className="sr-only">{calendarT("title")}</h1>
      <CalendarBoard
      openNew={firstParam(sp.new) === "1"}
      businessId={membership.businessId}
      timezone={timezone}
      locale={activeLocale}
      canManage={canManage(membership.role)}
      view={view}
      dateKey={dateKey}
      weekKeys={weekKeys}
      staff={staff}
      services={services}
      locations={workspace.locations.map((location) => ({
        id: location.id,
        name: location.name,
      }))}
      appointments={calendarAppointments}
      // RLS already limits time off to this business; the filter keeps a
      // multi-business member's rows from leaking into the wrong calendar.
      blocks={(timeOff ?? [])
        .filter((row) => staffIds.has(row.staff_profile_id))
        .map((row) => ({
          id: row.id,
          staffProfileId: row.staff_profile_id,
          startsAt: row.starts_at,
          endsAt: row.ends_at,
          reason: row.reason,
        }))}
      />

      <section className="space-y-3">
        <h2 className="font-heading text-xl">{waitlistT("listTitle")}</h2>
        <WaitlistPanel
          businessId={membership.businessId}
          entries={waitlist}
          canManage={canManage(membership.role)}
          locale={locale}
        />
      </section>
    </div>
  );
}
