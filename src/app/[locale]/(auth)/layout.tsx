import { GlowaLogo } from "@/components/brand/glowa-logo";
import { LocaleSwitcher } from "@/components/layout/locale-switcher";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { Link } from "@/i18n/navigation";

export default function AuthLayout({ children }: LayoutProps<"/[locale]">) {
  return (
    <div className="relative flex min-h-dvh flex-col">
      <div
        aria-hidden
        className="bg-brand-soft/40 pointer-events-none absolute -top-36 -right-24 size-80 rounded-full blur-3xl"
      />
      <header className="relative flex items-center justify-between px-4 py-5 sm:px-8">
        <Link href="/" className="glowa-focus rounded-md" aria-label="glowa">
          <GlowaLogo />
        </Link>
        <div className="flex items-center gap-1">
          <LocaleSwitcher />
          <ThemeToggle />
        </div>
      </header>
      <main className="relative flex flex-1 items-center justify-center px-4 py-10 sm:px-6">
        <div className="glowa-card w-full max-w-md p-6 sm:p-8">{children}</div>
      </main>
    </div>
  );
}
