import type { SVGProps } from "react";

import { cn } from "@/lib/utils";

/**
 * The GLOWA icon family.
 *
 * Hand-drawn rather than generated: at 20-24px a raster icon is mush, and these
 * need to inherit `currentColor` so they work on cream, on ink and on a photo.
 * They share one language with the G mark - 1.75 stroke, round caps, geometric
 * shapes with a single flowing curve - so the row reads as one set rather than
 * a grab-bag from an icon library.
 */
type IconProps = SVGProps<SVGSVGElement> & { className?: string };

function Icon({ className, children, ...props }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={cn("size-6", className)}
      {...props}
    >
      {children}
    </svg>
  );
}

/** Online booking: a day, claimed. */
export function IconBooking(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="3" y="5" width="18" height="16" rx="3" />
      <path d="M8 3v4M16 3v4M3 10h18" />
      <path d="M9 15.5c1.2 1.6 2 2.4 2 2.4s1.6-3 4-4.4" />
    </Icon>
  );
}

/** Calendar and team: columns of a shared schedule. */
export function IconTeamCalendar(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="3" y="4" width="18" height="17" rx="3" />
      <path d="M3 9h18M9 9v12M15 9v12" />
      <path d="M5.5 12.5h1.5M11 14h2M16.8 11.5h1.7" />
    </Icon>
  );
}

/** Client base: a person and the history kept about them. */
export function IconClients(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3.5 19.5c.6-3.1 2.8-4.8 5.5-4.8 1 0 1.9.2 2.7.7" />
      <path d="M14.5 14h6M14.5 17.5h6M14.5 21h3.5" />
    </Icon>
  );
}

/** Payments: a card with the flowing curve of the mark. */
export function IconPayments(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="2.5" y="6" width="19" height="13" rx="3" />
      <path d="M2.5 10.5h19" />
      <path d="M6.5 15.5h3.5" />
      <path d="M21.5 15.5c-2.4 0-3.6-1-3.6-1" />
    </Icon>
  );
}

/** Marketing: a message leaving, on a curve. */
export function IconMarketing(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M21 3.5 10.5 14" />
      <path d="M21 3.5 14.6 21c-.2.6-1 .6-1.2 0l-2.6-6.4-6.4-2.6c-.6-.2-.6-1 0-1.2L21 3.5Z" />
    </Icon>
  );
}

/** Analytics: magnitude, and a trend that is not a straight line. */
export function IconAnalytics(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M3.5 20.5h17" />
      <path d="M7 20.5v-5M12 20.5v-9M17 20.5v-3.5" />
      <path d="M4.5 9.5c3-4.5 6.5-1.5 9-4" />
    </Icon>
  );
}

/** AI assistant: a spark, off-centre so it reads as light, not a star rating. */
export function IconAssistant(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M11 3.5 12.6 8 17 9.6l-4.4 1.6L11 15.7 9.4 11.2 5 9.6 9.4 8 11 3.5Z" />
      <path d="M17.8 15.2l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7.7-2Z" />
    </Icon>
  );
}

export const FEATURE_ICONS = {
  booking: IconBooking,
  teamCalendar: IconTeamCalendar,
  clients: IconClients,
  payments: IconPayments,
  marketing: IconMarketing,
  analytics: IconAnalytics,
  assistant: IconAssistant,
} as const;

export type FeatureIconKey = keyof typeof FEATURE_ICONS;
