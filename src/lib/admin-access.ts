import type { BusinessRole } from "@/lib/queries/business";

/**
 * Which part of the admin each role may open.
 *
 * The roles were always described this way (owner and admin administer, a
 * manager runs the calendar, services and clients, a stylist reads the team
 * calendar) but only the *buttons* followed it: a stylist could still open the
 * subscription page, the revenue analytics and the whole client list, and see
 * "choose a plan" buttons. This is the one table both the menu and the pages
 * read, so the two cannot disagree. Row-level security remains the enforcement
 * for data; this is what keeps the interface honest.
 */
export type AdminSection =
  | "dashboard"
  | "calendar"
  | "timeOff"
  | "clients"
  | "services"
  | "staff"
  | "payments"
  | "reviews"
  | "marketing"
  | "growth"
  | "analytics"
  | "assistant"
  | "billing"
  | "settings";

const STAFF: readonly AdminSection[] = ["dashboard", "calendar", "timeOff"];
const ADMIN_ONLY: readonly AdminSection[] = ["billing", "payments", "settings"];

export function canOpenSection(role: BusinessRole, section: AdminSection) {
  if (role === "owner" || role === "admin") return true;
  if (role === "manager") return !ADMIN_ONLY.includes(section);
  return STAFF.includes(section);
}
