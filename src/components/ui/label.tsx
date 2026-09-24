"use client"

import * as React from "react"
import { cn } from "cn"
import { Label as LabelPrimitive } from "radix-ui"

function Label({
  className,
  required = false,
  children,
  ...props
}: React.ComponentProps<typeof LabelPrimitive.Root> & {
  /**
   * Marks the field as required with an asterisk. Visual only: the control
   * itself carries `required`, which is what assistive tech announces, so the
   * mark is hidden from screen readers rather than read out twice.
   */
  required?: boolean
}) {
  return (
    <LabelPrimitive.Root
      data-slot="label"
      className={cn(
        "flex items-center gap-2 text-sm leading-none font-medium select-none group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:opacity-50 peer-disabled:cursor-not-allowed peer-disabled:opacity-50",
        className
      )}
      {...props}
    >
      {children}
      {required ? (
        <span aria-hidden className="text-primary -ml-1.5 font-semibold">
          *
        </span>
      ) : null}
    </LabelPrimitive.Root>
  )
}

export { Label }
