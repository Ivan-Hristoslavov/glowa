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

type AuthFormProps = {
  mode: "sign-in" | "sign-up";
  action: (state: AuthFormState, formData: FormData) => Promise<AuthFormState>;
  nextPath?: string;
};

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? <Loader2 className="size-4 animate-spin" /> : null}
      {label}
    </Button>
  );
}

export function AuthForm({ mode, action, nextPath }: AuthFormProps) {
  const t = useTranslations("auth");
  const isSignUp = mode === "sign-up";
  const [state, formAction] = useActionState<AuthFormState, FormData>(action, {
    status: "idle",
  });

  if (state.status === "check-email") {
    return (
      <div className="space-y-2 text-center">
        <h2 className="font-heading text-xl">{t("checkEmail")}</h2>
        <p className="text-muted-foreground text-sm">
          {t("checkEmailBody", { email: state.email ?? "" })}
        </p>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-5" noValidate>
      {nextPath ? <input type="hidden" name="next" value={nextPath} /> : null}

      {state.status === "error" && state.message ? (
        <Alert variant="destructive" role="alert">
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      ) : null}

      {isSignUp ? (
        <div className="space-y-2">
          <Label htmlFor="fullName">{t("fullName")}</Label>
          <Input
            id="fullName"
            name="fullName"
            autoComplete="name"
            required
            minLength={2}
          />
        </div>
      ) : null}

      <div className="space-y-2">
        <Label htmlFor="email">{t("email")}</Label>
        <Input
          id="email"
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          required
        />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="password">{t("password")}</Label>
          {!isSignUp ? (
            <Link
              href="/forgot-password"
              className="text-muted-foreground hover:text-foreground text-xs"
            >
              {t("forgotPassword")}
            </Link>
          ) : null}
        </div>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete={isSignUp ? "new-password" : "current-password"}
          required
          minLength={8}
        />
      </div>

      <SubmitButton label={isSignUp ? t("signUp") : t("signIn")} />

      <p className="text-muted-foreground text-center text-sm">
        {isSignUp ? t("hasAccount") : t("noAccount")}{" "}
        <Link
          href={isSignUp ? "/login" : "/signup"}
          className="text-primary font-medium underline-offset-4 hover:underline"
        >
          {isSignUp ? t("signIn") : t("signUp")}
        </Link>
      </p>
    </form>
  );
}
