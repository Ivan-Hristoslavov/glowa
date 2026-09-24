"use client";

import { Check, Eye, EyeOff, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useActionState, useEffect, useId, useRef, useState, useTransition } from "react";

import type { AuthFormState } from "@/app/[locale]/(auth)/actions";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

type Mode = "sign-in" | "sign-up";

type AuthFormProps = {
  mode: Mode;
  action: (state: AuthFormState, formData: FormData) => Promise<AuthFormState>;
  nextPath?: string;
  /**
   * Inline use (the booking funnel): the form never navigates. The mode
   * switch is a local toggle instead of a link to the other page, the chosen
   * mode travels in the form data so one action serves both tabs, and
   * `onSignedIn` runs when the action reports a session.
   */
  inline?: {
    onSignedIn: () => void;
  };
};

type FieldErrors = Partial<Record<"fullName" | "email" | "password", string>>;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/**
 * Sign-in and sign-up.
 *
 * The form is submitted through `onSubmit` rather than `<form action>`. React
 * resets an uncontrolled form after an action completes, which here meant a
 * too-short password wiped the name and email too, and the next attempt was
 * sent empty and failed with a generic error. Found by filling the form in as
 * a person would, not by reading it.
 *
 * Validation runs in the browser first and names the field that is wrong; the
 * server still validates everything, because the browser is not a trust
 * boundary.
 */
export function AuthForm({ mode: initialMode, action, nextPath, inline }: AuthFormProps) {
  const t = useTranslations("auth");
  const legal = useTranslations("legal");
  const [mode, setMode] = useState<Mode>(initialMode);
  const isSignUp = mode === "sign-up";

  const [state, formAction, isPending] = useActionState<AuthFormState, FormData>(
    action,
    { status: "idle" },
  );
  const [, startTransition] = useTransition();

  const [values, setValues] = useState({ fullName: "", email: "", password: "" });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [showPassword, setShowPassword] = useState(false);

  const formRef = useRef<HTMLFormElement>(null);
  const id = useId();
  const onSignedIn = inline?.onSignedIn;

  useEffect(() => {
    if (state.status === "signed-in") onSignedIn?.();
  }, [state, onSignedIn]);

  function validate(): FieldErrors {
    const next: FieldErrors = {};
    if (isSignUp && values.fullName.trim().length < 2) next.fullName = t("fieldErrors.name");
    if (!EMAIL.test(values.email.trim())) next.email = t("fieldErrors.email");
    if (values.password.length < 8) next.password = t("fieldErrors.password");
    return next;
  }

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const found = validate();
    setErrors(found);
    const firstInvalid = (["fullName", "email", "password"] as const).find((key) => found[key]);
    if (firstInvalid) {
      formRef.current
        ?.querySelector<HTMLInputElement>(`[name="${firstInvalid}"]`)
        ?.focus();
      return;
    }
    const formData = new FormData(event.currentTarget);
    startTransition(() => formAction(formData));
  }

  function update(key: keyof typeof values, value: string) {
    setValues((current) => ({ ...current, [key]: value }));
    // Clear a field's complaint as soon as it is being fixed.
    if (errors[key]) setErrors((current) => ({ ...current, [key]: undefined }));
  }

  if (state.status === "check-email") {
    return (
      <div className="animate-in fade-in zoom-in-95 space-y-2 text-center duration-500">
        <span className="bg-primary/10 text-primary mx-auto mb-4 flex size-14 items-center justify-center rounded-full">
          <Check className="size-7" aria-hidden />
        </span>
        <h2 className="font-heading text-xl">{t("checkEmail")}</h2>
        <p className="text-muted-foreground text-sm">
          {t("checkEmailBody", { email: state.email ?? "" })}
        </p>
      </div>
    );
  }

  const otherHref = nextPath
    ? `${isSignUp ? "/login" : "/signup"}?next=${encodeURIComponent(nextPath)}`
    : isSignUp
      ? "/login"
      : "/signup";

  return (
    <form ref={formRef} onSubmit={onSubmit} className="space-y-5" noValidate>
      {nextPath ? <input type="hidden" name="next" value={nextPath} /> : null}
      {inline ? <input type="hidden" name="mode" value={mode} /> : null}

      {inline ? (
        <div
          role="tablist"
          aria-label={t("signIn")}
          className="bg-muted grid grid-cols-2 gap-1 rounded-full p-1 text-sm"
        >
          {(["sign-in", "sign-up"] as const).map((option) => (
            <button
              key={option}
              type="button"
              role="tab"
              aria-selected={mode === option}
              onClick={() => {
                setMode(option);
                setErrors({});
              }}
              className={cn(
                "glowa-focus rounded-full px-3 py-1.5 font-medium transition-all duration-300",
                mode === option
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {option === "sign-in" ? t("haveAccountTab") : t("newAccountTab")}
            </button>
          ))}
        </div>
      ) : null}

      {state.status === "error" && state.message ? (
        <Alert variant="destructive" role="alert" className="animate-in fade-in slide-in-from-top-1">
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      ) : null}

      {isSignUp ? (
        <Field
          id={`${id}-name`}
          label={t("fullName")}
          error={errors.fullName}
        >
          <Input
            id={`${id}-name`}
            name="fullName"
            autoComplete="name"
            value={values.fullName}
            onChange={(event) => update("fullName", event.target.value)}
            aria-invalid={Boolean(errors.fullName)}
            aria-describedby={errors.fullName ? `${id}-name-error` : undefined}
            className="h-11"
          />
        </Field>
      ) : null}

      <Field id={`${id}-email`} label={t("email")} error={errors.email}>
        <Input
          id={`${id}-email`}
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          value={values.email}
          onChange={(event) => update("email", event.target.value)}
          aria-invalid={Boolean(errors.email)}
          aria-describedby={errors.email ? `${id}-email-error` : undefined}
          className="h-11"
        />
      </Field>

      <Field
        id={`${id}-password`}
        label={t("password")}
        error={errors.password}
        aside={
          !isSignUp && !inline ? (
            <Link
              href="/forgot-password"
              className="text-muted-foreground hover:text-foreground text-xs"
            >
              {t("forgotPassword")}
            </Link>
          ) : null
        }
        hint={
          isSignUp && !errors.password ? (
            <span
              className={cn(
                "inline-flex items-center gap-1 transition-colors",
                values.password.length >= 8 ? "text-success" : undefined,
              )}
            >
              {values.password.length >= 8 ? <Check className="size-3.5" aria-hidden /> : null}
              {t("passwordHint")}
            </span>
          ) : null
        }
      >
        <div className="relative">
          <Input
            id={`${id}-password`}
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete={isSignUp ? "new-password" : "current-password"}
            value={values.password}
            onChange={(event) => update("password", event.target.value)}
            aria-invalid={Boolean(errors.password)}
            aria-describedby={errors.password ? `${id}-password-error` : undefined}
            className="h-11 pr-11"
          />
          <button
            type="button"
            onClick={() => setShowPassword((current) => !current)}
            aria-label={showPassword ? t("hidePassword") : t("showPassword")}
            aria-pressed={showPassword}
            className="text-muted-foreground hover:text-foreground glowa-focus absolute top-1/2 right-1.5 flex size-8 -translate-y-1/2 items-center justify-center rounded-md transition-colors"
          >
            {showPassword ? (
              <EyeOff className="size-4" aria-hidden />
            ) : (
              <Eye className="size-4" aria-hidden />
            )}
          </button>
        </div>
      </Field>

      <Button type="submit" size="lg" className="h-11 w-full" disabled={isPending}>
        {isPending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
        {isSignUp ? t("signUp") : t("signIn")}
      </Button>

      {/* GDPR art. 13: say what applies at the moment data is collected. New
          tab, so reading the terms does not throw away the form. */}
      {isSignUp ? (
        <p className="text-muted-foreground text-center text-xs leading-relaxed text-pretty">
          {legal.rich("signupNotice", {
            terms: (chunks) => (
              <Link href="/legal/terms" target="_blank" className="text-foreground underline underline-offset-2">
                {chunks}
              </Link>
            ),
            privacy: (chunks) => (
              <Link href="/legal/privacy" target="_blank" className="text-foreground underline underline-offset-2">
                {chunks}
              </Link>
            ),
          })}
        </p>
      ) : null}

      {!inline ? (
        <p className="text-muted-foreground text-center text-sm">
          {isSignUp ? t("hasAccount") : t("noAccount")}{" "}
          <Link
            href={otherHref}
            className="text-primary font-medium underline-offset-4 hover:underline"
          >
            {isSignUp ? t("signIn") : t("signUp")}
          </Link>
        </p>
      ) : null}
    </form>
  );
}

function Field({
  id,
  label,
  error,
  hint,
  aside,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  hint?: React.ReactNode;
  aside?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label htmlFor={id}>{label}</Label>
        {aside}
      </div>
      {children}
      {error ? (
        <p
          id={`${id}-error`}
          className="text-destructive animate-in fade-in slide-in-from-top-1 text-xs"
        >
          {error}
        </p>
      ) : hint ? (
        <p className="text-muted-foreground text-xs">{hint}</p>
      ) : null}
    </div>
  );
}
