import type { ReactNode } from "react";

import { Reveal } from "@/components/motion/reveal";

/**
 * A template, unlike a layout, remounts on every navigation - which is what
 * lets each admin page arrive with the same short rise instead of snapping in.
 */
export default function DashboardTemplate({ children }: { children: ReactNode }) {
  return <Reveal>{children}</Reveal>;
}
