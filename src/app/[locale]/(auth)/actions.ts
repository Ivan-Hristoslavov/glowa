"use server";

import { getLocale, getTranslations } from "next-intl/server";
import type { Route } from "next";
import { revalidatePath } from "next/cache";
import { redirect as nextRedirect } from "next/navigation";
import { z } from "zod";

import { redirect } from "@/i18n/navigation";
import { publicEnv } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

export type AuthFormState = {
  status: "idle" | "error" | "check-email";
  message?: string;
  email?: string;
};

const credentialsSchema = z.object({
  email: z.email(),
  password: z.string().min(8),
});

const signUpSchema = credentialsSchema.extend({
  fullName: z.string().trim().min(2).max(120),
});

/**
 * `redirect` throws, but next-intl types it as returning void, so the compiler
 * still wants a tail return on these actions.
 */
const unreachable = { status: "idle" } as const satisfies AuthFormState;

/** Only same-origin relative paths may be used as a post-login destination. */
function safeNextPath(value: FormDataEntryValue | null) {
  const raw = typeof value === "string" ? value : "";
  return raw.startsWith("/") && !raw.startsWith("//") ? raw : null;
}

export async function signInAction(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const locale = await getLocale();
  const t = await getTranslations("auth.errors");

  const parsed = credentialsSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { status: "error", message: t("invalidCredentials") };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error) {
    return { status: "error", message: t("invalidCredentials") };
  }

  revalidatePath("/", "layout");
  const next = safeNextPath(formData.get("next"));
  if (next) {
    // The proxy stored an already locale-prefixed path, so bypass i18n routing.
    nextRedirect(next as Route);
  }
  redirect({ href: "/profile", locale });
  return unreachable;
}

export async function signUpAction(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const locale = await getLocale();
  const t = await getTranslations("auth.errors");

  const parsed = signUpSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    fullName: formData.get("fullName"),
  });

  if (!parsed.success) {
    const tooShort = parsed.error.issues.some((i) => i.path[0] === "password");
    return { status: "error", message: tooShort ? t("weakPassword") : t("generic") };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { full_name: parsed.data.fullName, locale },
      emailRedirectTo: `${publicEnv.NEXT_PUBLIC_SITE_URL}/auth/confirm?next=/${locale}/profile`,
    },
  });

  if (error) {
    const alreadyRegistered =
      error.code === "user_already_exists" || error.status === 422;
    return {
      status: "error",
      message: alreadyRegistered ? t("emailInUse") : t("generic"),
    };
  }

  // With email confirmation on, there is no session yet.
  if (!data.session) {
    return { status: "check-email", email: parsed.data.email };
  }

  revalidatePath("/", "layout");
  redirect({ href: "/profile", locale });
  return unreachable;
}

export async function signOutAction() {
  const locale = await getLocale();
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect({ href: "/", locale });
}
