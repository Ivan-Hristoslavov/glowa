import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { Fragment, type ReactNode } from "react";

import { CookieSettingsButton } from "@/components/legal/cookie-consent";
import { Link } from "@/i18n/navigation";
import { localeHrefLang, routing, type Locale } from "@/i18n/routing";
import { loadLegalContent } from "@/lib/legal/content";
import {
  LEGAL_DOCS,
  LEGAL_EFFECTIVE_DATE,
  LEGAL_ENTITY,
  type LegalDoc,
} from "@/lib/legal/entity";
import { alternatesFor } from "@/lib/seo/structured-data";
import { cn } from "@/lib/utils";

export function generateStaticParams() {
  return routing.locales.flatMap((locale) => LEGAL_DOCS.map((doc) => ({ locale, doc })));
}

function isDoc(value: string): value is LegalDoc {
  return (LEGAL_DOCS as readonly string[]).includes(value);
}

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/legal/[doc]">): Promise<Metadata> {
  const { locale, doc } = await params;
  if (!isDoc(doc)) return {};
  const content = await loadLegalContent(locale as Locale);
  return {
    title: content.docs[doc].title,
    description: content.docs[doc].description,
    alternates: alternatesFor(`/${locale}/legal/${doc}`),
  };
}

/** Fills `{company}` and friends; an empty field says so instead of guessing. */
function fill(text: string, pending: string) {
  return text.replace(/\{(\w+)\}/g, (match, key: string) => {
    if (!(key in LEGAL_ENTITY)) return match;
    return LEGAL_ENTITY[key as keyof typeof LEGAL_ENTITY] ?? pending;
  });
}

/** Web addresses and the contact email become links; everything else is text. */
function linkify(text: string): ReactNode {
  const parts = text.split(/((?:https?:\/\/|www\.)[^\s,;)]+[^\s,;.)]|[\w.+-]+@[\w-]+\.[\w.]+\w)/g);
  return parts.map((part, index) => {
    if (index % 2 === 0) return <Fragment key={index}>{part}</Fragment>;
    const href = part.includes("@")
      ? `mailto:${part}`
      : part.startsWith("http")
        ? part
        : `https://${part}`;
    return (
      <a
        key={index}
        href={href}
        className="text-foreground underline decoration-1 underline-offset-2"
        {...(part.includes("@") ? {} : { target: "_blank", rel: "noopener noreferrer" })}
      >
        {part}
      </a>
    );
  });
}

export default async function LegalPage({ params }: PageProps<"/[locale]/legal/[doc]">) {
  const { locale, doc } = await params;
  if (!isDoc(doc)) notFound();
  setRequestLocale(locale);

  const content = await loadLegalContent(locale as Locale);
  const t = await getTranslations("footer");
  const document = content.docs[doc];
  const pending = content.meta.pending;
  const date = new Intl.DateTimeFormat(localeHrefLang[locale as Locale], {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${LEGAL_EFFECTIVE_DATE}T12:00:00Z`));

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
      <div className="grid gap-10 lg:grid-cols-[15rem_1fr] lg:gap-14">
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <nav aria-label={content.meta.otherDocs} className="space-y-1">
            <p className="text-muted-foreground mb-3 text-xs font-semibold tracking-[0.18em] uppercase">
              {content.meta.otherDocs}
            </p>
            {LEGAL_DOCS.map((key) => (
              <Link
                key={key}
                href={`/legal/${key}`}
                aria-current={key === doc ? "page" : undefined}
                className={cn(
                  "glowa-focus block rounded-lg px-3 py-2 text-sm transition-colors",
                  key === doc
                    ? "bg-primary/10 text-primary font-medium"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                {content.docs[key].title}
              </Link>
            ))}
            <CookieSettingsButton className="glowa-focus text-muted-foreground hover:bg-muted hover:text-foreground block w-full rounded-lg px-3 py-2 text-left text-sm transition-colors" />
          </nav>

          {document.sections.length > 3 ? (
            <nav aria-label={content.meta.toc} className="mt-8 hidden lg:block">
              <p className="text-muted-foreground mb-3 text-xs font-semibold tracking-[0.18em] uppercase">
                {content.meta.toc}
              </p>
              <ol className="border-border/70 space-y-1.5 border-l pl-3">
                {document.sections.map((section) => (
                  <li key={section.id}>
                    <a
                      href={`#${section.id}`}
                      className="text-muted-foreground hover:text-foreground glowa-focus block rounded text-xs leading-snug"
                    >
                      {section.heading}
                    </a>
                  </li>
                ))}
              </ol>
            </nav>
          ) : null}
        </aside>

        <article className="max-w-3xl">
          <header className="border-border/70 border-b pb-8">
            <h1 className="font-heading text-3xl leading-tight sm:text-4xl">{document.title}</h1>
            <p className="text-muted-foreground mt-3 text-sm">
              {content.meta.updated.replace("{date}", date)}
            </p>
            {document.intro.map((paragraph, index) => (
              <p key={index} className="mt-5 leading-relaxed text-pretty">
                {linkify(fill(paragraph, pending))}
              </p>
            ))}
          </header>

          <div className="space-y-9 pt-8">
            {document.sections.map((section) => (
              <section key={section.id} id={section.id} className="scroll-mt-24">
                <h2 className="font-heading text-xl">{section.heading}</h2>
                {section.body.map((paragraph, index) => (
                  <p
                    key={index}
                    className="text-muted-foreground mt-3 leading-relaxed text-pretty"
                  >
                    {linkify(fill(paragraph, pending))}
                  </p>
                ))}
                {section.list ? (
                  <ul className="text-muted-foreground mt-3 space-y-2">
                    {section.list.map((item, index) => (
                      <li key={index} className="flex gap-3 leading-relaxed">
                        <span className="bg-primary mt-2.5 size-1.5 shrink-0 rounded-full" aria-hidden />
                        <span>{linkify(fill(item, pending))}</span>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </section>
            ))}
          </div>

          <p className="border-border/70 text-muted-foreground mt-12 border-t pt-6 text-sm">
            {linkify(fill(content.meta.contactCta, pending))}{" "}
            <Link href="/" className="text-foreground underline underline-offset-2">
              {t("backHome")}
            </Link>
          </p>
        </article>
      </div>
    </main>
  );
}
