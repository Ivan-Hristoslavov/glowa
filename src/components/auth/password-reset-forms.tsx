"use client";

import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import type { AuthFormState } from "@/app/[locale]/(auth)/actions";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Link } from "@/i18n/navigation";

type Action = (state: AuthFormState, formData: FormData) => Promise<AuthFormState>;

function SubmitButton({ label, pendingLabel }: { label: string; pendingLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
      {pending ? pendingLabel : label}
    </Button>
  );
}

export function ForgotPasswordForm({ action }: { action: Action }) {
  const t = useTranslations("auth");
  const [state, formAction] = useActionState<AuthFormState, FormData>(action, {
    status: "idle",
  });

  // The confirmation is deliberately the same whether or not the address has an
  // account, so this screen cannot be used to discover who is registered.
  if (state.status === "check-email") {
    return (
      <div className="space-y-3 text-center">
        <h2 className="font-heading text-xl">{t("resetSent")}</h2>
        <p className="text-muted-foreground text-sm">
          {t("resetSentBody", { email: state.email ?? "" })}
        </p>
        <Button asChild variant="outline" className="mt-2">
          <Link href="/login">{t("backToLogin")}</Link>
        </Button>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-5" noValidate>
      {state.status === "error" && state.message ? (
        <Alert variant="destructive" role="alert">
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      ) : null}

      <div className="space-y-2">
        <Label htmlFor="reset-email" required>{t("email")}</Label>
        <Input
          id="reset-email"
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          required
          autoFocus
        />
      </div>

      <SubmitButton label={t("sendReset")} pendingLabel={t("sending")} />

      <p className="text-center text-sm">
        <Link
          href="/login"
          className="text-muted-foreground hover:text-foreground underline-offset-4 hover:underline"
        >
          {t("backToLogin")}
        </Link>
      </p>
    </form>
  );
}

export function ResetPasswordForm({ action }: { action: Action }) {
  const t = useTranslations("auth");
  const [state, formAction] = useActionState<AuthFormState, FormData>(action, {
    status: "idle",
  });

  return (
    <form action={formAction} className="space-y-5" noValidate>
      {state.status === "error" && state.message ? (
        <Alert variant="destructive" role="alert">
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      ) : null}

      <div className="space-y-2">
        <Label htmlFor="new-password" required>{t("newPassword")}</Label>
        <Input
          id="new-password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          autoFocus
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="confirm-password" required>{t("confirmPassword")}</Label>
        <Input
          id="confirm-password"
          name="confirm"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
        />
      </div>

      <SubmitButton label={t("updatePassword")} pendingLabel={t("updating")} />
    </form>
  );
}
