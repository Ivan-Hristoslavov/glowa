"use client";

import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useRouter } from "@/i18n/navigation";
import { localeLabels, routing, type Locale } from "@/i18n/routing";
import { createBusiness } from "@/lib/actions/business";
import { BUSINESS_CATEGORIES, type BusinessCategory } from "@/lib/business-categories";
import { resolveViewerTimeZone } from "@/lib/format";

const CURRENCIES = ["EUR", "RON"] as const;
const TIMEZONES = [
  "Europe/Sofia",
  "Europe/Bucharest",
  "Europe/Athens",
  "Europe/Berlin",
  "Europe/London",
  "UTC",
];

export function OnboardingForm({ defaultLocale }: { defaultLocale: Locale }) {
  const t = useTranslations("admin.onboarding");
  const categories = useTranslations("categories");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const detected = resolveViewerTimeZone();
  const [name, setName] = useState("");
  const [category, setCategory] = useState<BusinessCategory>("hair_salon");
  const [city, setCity] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [timezone, setTimezone] = useState(
    detected && TIMEZONES.includes(detected) ? detected : "Europe/Sofia",
  );
  const [currency, setCurrency] = useState<string>("EUR");
  const [locale, setLocale] = useState<Locale>(defaultLocale);

  const zones = [...new Set([...TIMEZONES, timezone])];

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    startTransition(async () => {
      const result = await createBusiness({
        name,
        category,
        city,
        address,
        phone,
        timezone,
        currency,
        locale,
      });

      if (!result.ok) {
        toast.error(
          result.code === "name_required" ? t("errors.name_required") : t("errors.generic"),
        );
        return;
      }

      router.push("/dashboard");
      router.refresh();
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="business-name">{t("name")}</Label>
        <Input
          id="business-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder={t("namePlaceholder")}
          required
          minLength={2}
          autoFocus
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="business-category">{t("category")}</Label>
          <Select
            value={category}
            onValueChange={(value) => setCategory(value as BusinessCategory)}
          >
            <SelectTrigger id="business-category">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {BUSINESS_CATEGORIES.map((value) => (
                <SelectItem key={value} value={value}>
                  {categories(value)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="business-city">{t("city")}</Label>
          <Input
            id="business-city"
            value={city}
            onChange={(event) => setCity(event.target.value)}
            autoComplete="address-level2"
          />
        </div>

        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="business-address">{t("address")}</Label>
          <Input
            id="business-address"
            value={address}
            onChange={(event) => setAddress(event.target.value)}
            autoComplete="street-address"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="business-phone">{t("phone")}</Label>
          <Input
            id="business-phone"
            type="tel"
            inputMode="tel"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            autoComplete="tel"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="business-timezone">{t("timezone")}</Label>
          <Select value={timezone} onValueChange={setTimezone}>
            <SelectTrigger id="business-timezone">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {zones.map((zone) => (
                <SelectItem key={zone} value={zone}>
                  {zone}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="business-currency">{t("currency")}</Label>
          <Select value={currency} onValueChange={setCurrency}>
            <SelectTrigger id="business-currency">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CURRENCIES.map((value) => (
                <SelectItem key={value} value={value}>
                  {value}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="business-locale">{t("language")}</Label>
          <Select value={locale} onValueChange={(value) => setLocale(value as Locale)}>
            <SelectTrigger id="business-locale">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {routing.locales.map((value) => (
                <SelectItem key={value} value={value}>
                  {localeLabels[value]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Button type="submit" size="lg" disabled={isPending}>
        {isPending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
        {isPending ? t("creating") : t("create")}
      </Button>
    </form>
  );
}
