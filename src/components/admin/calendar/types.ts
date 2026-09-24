import type { Database } from "@/types/database";

export type DepositStatus = Database["public"]["Enums"]["deposit_status"];

export type CalendarStaff = {
  id: string;
  displayName: string;
  color: string;
  avatarUrl: string | null;
  isBookable: boolean;
  /** Working windows, minutes from local midnight, keyed by day of week. */
  hours: Array<{ dayOfWeek: number; startMinutes: number; endMinutes: number }>;
};

export type CalendarService = {
  id: string;
  name: string;
  durationMinutes: number;
  priceCents: number;
  currency: string;
  staffIds: string[];
};

export type CalendarAppointment = {
  id: string;
  startsAt: string;
  endsAt: string;
  status: "pending" | "confirmed" | "completed" | "cancelled" | "no_show";
  staffProfileId: string | null;
  serviceName: string;
  customerName: string | null;
  customerPhone: string | null;
  priceCents: number;
  depositCents: number;
  depositStatus: DepositStatus;
  currency: string;
  internalNotes: string | null;
  customerNotes: string | null;
  bufferBeforeMinutes: number;
  bufferAfterMinutes: number;
};

export type CalendarBlock = {
  id: string;
  staffProfileId: string;
  startsAt: string;
  endsAt: string;
  reason: string | null;
};

export type CalendarLocation = { id: string; name: string };
