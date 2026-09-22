import type { LucideIcon } from "lucide-react";
import Image from "next/image";
import type { ReactNode } from "react";

import type { EmptyStateArt } from "@/lib/brand-assets";
import { cn } from "@/lib/utils";

type EmptyStateProps = {
  icon: LucideIcon;
  title: string;
  body?: string;
  action?: ReactNode;
  className?: string;
  /**
   * Generated illustration for this state, with a version drawn for each
   * theme. The icon stays as the fallback, so a surface without dedicated art
   * still reads as designed rather than broken.
   */
  art?: EmptyStateArt;
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
  art,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "border-border/70 flex flex-col items-center gap-3 rounded-xl border border-dashed px-6 py-12 text-center",
        className,
      )}
    >
      {art ? (
        // Both versions ship and CSS picks one, so the server and the client
        // render the same markup and there is no theme flash.
        <>
          <Image
            src={art.light}
            alt=""
            width={168}
            height={168}
            className="size-36 rounded-xl object-cover sm:size-40 dark:hidden"
          />
          <Image
            src={art.dark}
            alt=""
            width={168}
            height={168}
            className="hidden size-36 rounded-xl object-cover sm:size-40 dark:block"
          />
        </>
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
