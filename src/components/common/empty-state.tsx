import type { LucideIcon } from "lucide-react";
import Image from "next/image";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type EmptyStateProps = {
  icon: LucideIcon;
  title: string;
  body?: string;
  action?: ReactNode;
  className?: string;
  /**
   * Generated illustration for this state. The icon stays as the fallback, so
   * a surface without dedicated art still reads as designed rather than broken.
   */
  image?: string;
};

/**
 * Empty is a state worth designing, not a blank area: a mark or an
 * illustration, a sentence that says what would fill it, and the action that
 * gets you there.
 */
export function EmptyState({
  icon: Icon,
  title,
  body,
  action,
  className,
  image,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "border-border/70 flex flex-col items-center gap-3 rounded-xl border border-dashed px-6 py-12 text-center",
        className,
      )}
    >
      {image ? (
        <Image
          src={image}
          alt=""
          width={168}
          height={168}
          className="size-36 rounded-xl object-cover sm:size-40"
        />
      ) : (
        <span className="bg-secondary text-secondary-foreground flex size-12 items-center justify-center rounded-full">
          <Icon className="size-5" aria-hidden />
        </span>
      )}

      <div className="space-y-1">
        <p className="font-heading text-lg">{title}</p>
        {body ? (
          <p className="text-muted-foreground mx-auto max-w-sm text-sm">{body}</p>
        ) : null}
      </div>
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}
