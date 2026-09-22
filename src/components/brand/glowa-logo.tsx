import { cn } from "@/lib/utils";

type GlowaMarkProps = {
  className?: string;
  /** Single-colour rendering for favicons, print and on-image placement. */
  monochrome?: boolean;
  title?: string;
};

/**
 * The GLOWA mark, reconstructed from the brand reference in the brief.
 *
 * It is a squared coral spiral - flat top and bottom edges joined by half-turns
 * on the left and right, which is what gives it a rounded-square silhouette
 * rather than the two stacked circles a plain "S" would make - crossed by two
 * near-horizontal pointed leaves.
 *
 * The geometry was measured off the reference rather than eyeballed: the leaf
 * bounding boxes and the spiral's extents match it to within half a unit of
 * this 48-unit grid. The reference is a soft raster, so this is a faithful
 * reconstruction, not a pixel trace.
 *
 * In monochrome the leaves are punched out of the spiral with a mask, so the
 * mark still reads as two forms when there is only one colour available.
 */
export function GlowaMark({ className, monochrome, title }: GlowaMarkProps) {
  const maskId = "glowa-mark-leaves";

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
          {/* The mask is stroked as well as filled, which opens a gap around
              each leaf. Without it the leaves merge into the spiral and the
              mark collapses into a plain S. */}
          <mask id={maskId}>
            <rect width="48" height="48" fill="white" />
            <g fill="black" stroke="black" strokeWidth="2.6" strokeLinejoin="round">
              <path d="M19 21.5Q31 13.8 43.4 18.8Q31 25.4 19 21.5Z" />
              <path d="M26.6 26.3Q14.6 34 2.2 29Q14.6 22.4 26.6 26.3Z" />
            </g>
          </mask>
          <path
            d="M33 7.8H17A8.2 8.2 0 0 0 17 24.2H31A8.2 8.2 0 0 1 31 40.6H14"
            stroke="currentColor"
            strokeWidth="9.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            mask={`url(#${maskId})`}
          />
          <path d="M19 21.5Q31 13.8 43.4 18.8Q31 25.4 19 21.5Z" fill="currentColor" />
          <path d="M26.6 26.3Q14.6 34 2.2 29Q14.6 22.4 26.6 26.3Z" fill="currentColor" />
        </>
      ) : (
        <>
          <path
            d="M33 7.8H17A8.2 8.2 0 0 0 17 24.2H31A8.2 8.2 0 0 1 31 40.6H14"
            stroke="var(--glowa-coral)"
            strokeWidth="9.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path d="M19 21.5Q31 13.8 43.4 18.8Q31 25.4 19 21.5Z" fill="currentColor" />
          <path d="M26.6 26.3Q14.6 34 2.2 29Q14.6 22.4 26.6 26.3Z" fill="currentColor" />
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
