import { getTranslations, setRequestLocale } from "next-intl/server";

import { PlatformDashboard } from "@/components/platform/platform-dashboard";
import {
  AuditLog,
  PeopleManager,
  ProblemsBoard,
  SalonModeration,
} from "@/components/platform/platform-tools";
import { Link } from "@/i18n/navigation";
import {
  getPlatformAudit,
  getPlatformContent,
  getPlatformOverview,
  getPlatformProblems,
  getPlatformUsers,
} from "@/lib/platform/overview";
import { cn } from "@/lib/utils";

const TABS = ["overview", "salons", "people", "problems", "audit"] as const;
type Tab = (typeof TABS)[number];

export async function generateMetadata() {
  const t = await getTranslations("platform");
  return { title: t("title") };
}

export default async function PlatformPage({
  params,
  searchParams,
}: PageProps<"/[locale]/platform">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const query = await searchParams;
  const tab = (TABS as readonly string[]).includes(String(query.tab)) ? (String(query.tab) as Tab) : "overview";
  const search = typeof query.q === "string" ? query.q.slice(0, 80) : "";
  const t = await getTranslations("platform");

  let body: React.ReactNode;
  if (tab === "salons") {
    const content = await getPlatformContent();
    body = content ? (
      <SalonModeration salons={content.salons} reviews={content.reviews} />
    ) : (
      <LoadError />
    );
  } else if (tab === "people") {
    const users = await getPlatformUsers(search);
    body = users ? <PeopleManager users={users} query={search} /> : <LoadError />;
  } else if (tab === "problems") {
    const problems = await getPlatformProblems();
    body = problems ? (
      <ProblemsBoard
        failed={problems.failed_messages}
        stuck={problems.stuck_messages}
        payments={problems.payments}
        summary={problems.summary}
      />
    ) : (
      <LoadError />
    );
  } else if (tab === "audit") {
    const entries = await getPlatformAudit();
    body = entries ? <AuditLog entries={entries} /> : <LoadError />;
  } else {
    const data = await getPlatformOverview(365);
    body = data ? <PlatformDashboard data={data} /> : <LoadError />;
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="font-heading text-3xl sm:text-4xl">{t("title")}</h1>
        <p className="text-muted-foreground max-w-2xl">{t("subtitle")}</p>
      </div>

      <nav aria-label={t("tabs.label")} className="-mx-1 overflow-x-auto px-1">
        <ul className="bg-muted inline-flex gap-1 rounded-full p-1">
          {TABS.map((value) => (
            <li key={value}>
              <Link
                href={value === "overview" ? "/platform" : `/platform?tab=${value}`}
                aria-current={tab === value ? "page" : undefined}
                className={cn(
                  "glowa-focus block rounded-full px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors",
                  tab === value ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {t(`tabs.${value}`)}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      {body}
    </div>
  );

  async function LoadError() {
    return <p className="glowa-card text-muted-foreground p-6 text-sm">{(await getTranslations("platform"))("loadError")}</p>;
  }
}
