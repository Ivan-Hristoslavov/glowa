import { Skeleton } from "@/components/ui/skeleton";

/**
 * The shape every admin screen loads into: a title, then either a row of
 * metric tiles or a list of cards.
 *
 * Eleven of the twelve dashboard routes had no `loading.tsx` at all, so on a
 * slow connection the previous screen simply froze while the next one was
 * fetched - the app looked broken rather than busy. A skeleton that matches
 * the real layout also stops the page jumping when the content lands.
 */
export function PageSkeleton({
  tiles = 0,
  rows = 4,
  rowHeight = "h-20",
}: {
  tiles?: number;
  rows?: number;
  rowHeight?: string;
}) {
  return (
    <div className="space-y-6" aria-hidden>
      <Skeleton className="h-9 w-48" />

      {tiles > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: tiles }).map((_, index) => (
            <Skeleton key={index} className="h-24 rounded-xl" />
          ))}
        </div>
      ) : null}

      <div className="space-y-3">
        {Array.from({ length: rows }).map((_, index) => (
          <Skeleton key={index} className={`${rowHeight} w-full rounded-xl`} />
        ))}
      </div>
    </div>
  );
}
