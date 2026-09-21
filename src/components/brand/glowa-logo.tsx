import { cn } from "@/lib/utils";

type GlowaMarkProps = {
  className?: string;
  /** Single-colour rendering for favicons, print and on-image placement. */
  monochrome?: boolean;
  title?: string;
};

/**
 * The GLOWA G. A geometric ring cut open on the right with a crossbar, where
 * the lower-left sweep is carried by the coral accent - the "flow" in an
 * otherwise engineered shape. Stroke geometry keeps it readable at 16px.
 */
export function GlowaMark({ className, monochrome, title }: GlowaMarkProps) {
  return (
    <svg
      viewBox="0 0 48 48"
      fill="none"
      role={title ? "img" : "presentation"}
      aria-hidden={title ? undefined : true}
      aria-label={title}
      className={cn("size-8", className)}
    >
      {title ? <title>{title}</title> : null}
      <path
        d="M35.5 14.4A15 15 0 1 0 39 24H28.5"
        stroke="currentColor"
        strokeWidth="7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {!monochrome && (
        <path
          d="M9.2 26.6A15 15 0 0 0 31.5 37"
          stroke="var(--glowa-coral)"
          strokeWidth="7"
          strokeLinecap="round"
        />
      )}
    </svg>
  );
}

type GlowaLogoProps = {
  className?: string;
  markClassName?: string;
  monochrome?: boolean;
  showTagline?: boolean;
  tagline?: string;
};

/** Mark + lowercase wordmark. The wordmark is never set in a script face. */
export function GlowaLogo({
  className,
  markClassName,
  monochrome,
  showTagline,
  tagline,
}: GlowaLogoProps) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <GlowaMark className={cn("size-8 shrink-0", markClassName)} monochrome={monochrome} />
      <span className="flex flex-col leading-none">
        <span className="text-[1.375rem] font-semibold tracking-tight lowercase">
          glowa
        </span>
        {showTagline && tagline ? (
          <span className="text-muted-foreground mt-1 text-[0.5rem] font-medium tracking-[0.22em] uppercase">
            {tagline}
          </span>
        ) : null}
      </span>
    </span>
  );
}
