"use client";

import { Check, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useActionState } from "react";

import { Turnstile } from "@/components/common/turnstile";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { submitSupportRequest, type SupportState } from "@/lib/actions/support";

export function SupportForm({
  defaultName,
  defaultEmail,
  page,
}: {
  defaultName: string;
  defaultEmail: string;
  page: string;
}) {
  const t = useTranslations("support");
  const [state, formAction, pending] = useActionState<SupportState, FormData>(submitSupportRequest, {
    status: "idle",
  });

  if (state.status === "sent") {
    return (
      <div className="animate-in fade-in zoom-in-95 space-y-2 py-10 text-center duration-500" role="status">
        <span className="bg-primary/10 text-primary mx-auto mb-4 flex size-14 items-center justify-center rounded-full">
          <Check className="size-7" aria-hidden />
        </span>
        <h2 className="font-heading text-xl">{t("sentTitle")}</h2>
        <p className="text-muted-foreground text-sm">{t("sentBody")}</p>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-5">
      {state.status === "error" ? (
        <Alert variant="destructive" role="alert">
          <AlertDescription>{t(`errors.${state.code}`)}</AlertDescription>
        </Alert>
      ) : null}
      <input type="hidden" name="page" value={page} />

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="support-name">{t("name")}</Label>
          <Input id="support-name" name="name" defaultValue={defaultName} autoComplete="name" maxLength={120} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="support-email" required>{t("email")}</Label>
          <Input
            id="support-email"
            name="email"
            type="email"
            defaultValue={defaultEmail}
            autoComplete="email"
            inputMode="email"
            required
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="support-subject" required>{t("subject")}</Label>
        <Input id="support-subject" name="subject" required minLength={2} maxLength={160} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="support-message" required>{t("message")}</Label>
        <Textarea id="support-message" name="message" rows={6} required minLength={5} maxLength={4000} placeholder={t("messageHint")} />
      </div>

      <Turnstile />

      <Button type="submit" size="lg" className="w-full sm:w-auto" disabled={pending}>
        {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
        {t("send")}
      </Button>
    </form>
  );
}
