import { Star } from "lucide-react";

import { cn } from "@/lib/utils";

type RatingProps = {
  value: number | null | undefined;
  size?: "sm" | "md";
  className?: string;
  label?: string;
};

/** Five stars, filled to the nearest half. Decorative unless given a label. */
export function Rating({ value, size = "sm", className, label }: RatingProps) {
  const rating = typeof value === "number" ? Math.max(0, Math.min(5, value)) : 0;
  const px = size === "sm" ? "size-3.5" : "size-4";

  return (
    <span
      className={cn("inline-flex items-center gap-0.5", className)}
      role={label ? "img" : "presentation"}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      {[0, 1, 2, 3, 4].map((index) => {
        const fill = Math.max(0, Math.min(1, rating - index));
        return (
          <span key={index} className={cn("relative", px)}>
            <Star className={cn(px, "text-muted-foreground/35 absolute inset-0")} />
            <span
              className="absolute inset-0 overflow-hidden"
              style={{ width: `${fill * 100}%` }}
            >
              <Star className={cn(px, "fill-primary text-primary")} />
            </span>
          </span>
        );
      })}
    </span>
  );
}
