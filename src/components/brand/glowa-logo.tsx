import { cn } from "@/lib/utils";

type GlowaMarkProps = {
  className?: string;
  /** Single-colour rendering for favicons, print and on-image placement. */
  monochrome?: boolean;
  title?: string;
};

/**
 * The Lavena mark: a rounded "L" with a lavender leaf growing from it.
 *
 * Stroke and leaf only - no gradients, no masks - so it holds at 16px and
 * prints in one colour. (The component keeps its old name; renaming the file
 * would touch a hundred imports for no visible gain.)
 *
 * In monochrome the leaf is cut out of a single-colour stem with a mask, so
 * the mark still reads as two forms.
 */
export function GlowaMark({ className, monochrome, title }: GlowaMarkProps) {
  const maskId = "lavena-mark-leaf";
  const stem = "M15 6V32Q15 41 24 41H41";
  const leaf = "M24 24Q24 12 36 11Q36 24 24 24Z";

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
      {monochrome ? (
        <>
          <mask id={maskId}>
            <rect width="48" height="48" fill="white" />
            <path d={leaf} fill="black" stroke="black" strokeWidth="2.4" strokeLinejoin="round" />
          </mask>
          <path d={stem} stroke="currentColor" strokeWidth="8" strokeLinecap="round" mask={`url(#${maskId})`} />
          <path d={leaf} fill="currentColor" />
        </>
      ) : (
        <>
          <path d={stem} stroke="var(--glowa-coral)" strokeWidth="8" strokeLinecap="round" />
          <path d={leaf} fill="var(--glowa-lilac)" />
        </>
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
          lavena
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
