import { Check, ShieldCheck } from "lucide-react";
import Image from "next/image";

import { categoryImages, showcaseAssets } from "@/lib/brand-assets";

/**
 * Three arched frames - the outline of a salon mirror, which is GLOWA's
 * signature shape - staggered in height, with two small notes of what booking
 * here is like. Decorative: the words it carries are repeated in the copy
 * around it, so the whole group is hidden from assistive tech.
 */
export function ArchCollage({ labels }: { labels: { instant: string; refund: string } }) {
  return (
    <div aria-hidden className="absolute inset-0">
      <div className="bg-primary/15 absolute top-1/2 left-1/2 size-80 -translate-x-1/2 -translate-y-1/2 rounded-full blur-2xl" />

      <div className="absolute top-16 left-[4%] h-[19rem] w-[10.5rem] overflow-hidden rounded-t-full rounded-b-[1.75rem] border-4 border-white shadow-[var(--shadow-lift)]">
        <Image src={categoryImages.nails} alt="" fill sizes="170px" className="object-cover" />
      </div>
      <div className="absolute top-0 left-1/2 h-[26rem] w-[14.5rem] -translate-x-1/2 overflow-hidden rounded-t-full rounded-b-[2rem] border-4 border-white shadow-[var(--shadow-pop)]">
        <Image
          src={showcaseAssets.gallery[0]}
          alt=""
          fill
          priority
          sizes="240px"
          className="object-cover"
        />
      </div>
      <div className="absolute top-24 right-[4%] h-[20rem] w-[11rem] overflow-hidden rounded-t-full rounded-b-[1.75rem] border-4 border-white shadow-[var(--shadow-lift)]">
        <Image src={categoryImages.skincare} alt="" fill sizes="180px" className="object-cover" />
      </div>

      <div className="bg-card absolute top-10 right-[2%] flex items-center gap-2 rounded-full border px-3.5 py-2 text-sm font-medium shadow-[var(--shadow-lift)]">
        <span className="bg-success/15 text-success flex size-6 items-center justify-center rounded-full">
          <Check className="size-3.5" />
        </span>
        {labels.instant}
      </div>
      <div className="bg-card absolute bottom-20 left-0 flex max-w-[15rem] items-center gap-2 rounded-2xl border px-3.5 py-2.5 text-sm font-medium shadow-[var(--shadow-lift)]">
        <span className="bg-primary/12 text-primary flex size-7 shrink-0 items-center justify-center rounded-full">
          <ShieldCheck className="size-4" />
        </span>
        {labels.refund}
      </div>
    </div>
  );
}
