import { z } from "zod";

/**
 * Public env. Next.js inlines `process.env.NEXT_PUBLIC_*` at build time only
 * when it is referenced literally, so these must not be read dynamically.
 */
const publicSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
  NEXT_PUBLIC_SITE_URL: z.url().default("http://localhost:3000"),
});

const parsedPublic = publicSchema.safeParse({
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
});

if (!parsedPublic.success) {
  throw new Error(
    `Missing or invalid public environment variables:\n${z.prettifyError(parsedPublic.error)}\nCopy .env.example to .env.local and fill it in.`,
  );
}

export const publicEnv = parsedPublic.data;

/**
 * Server-only secrets. Read lazily so that importing this module from a
 * Client Component never trips the check, and so a missing optional
 * integration key only fails the feature that needs it.
 */
export function requireServerEnv<K extends ServerEnvKey>(key: K): string {
  const value = serverEnvSource[key];
  if (!value) {
    throw new Error(
      `Missing server environment variable ${key}. Add it to .env.local (never to the repository).`,
    );
  }
  return value;
}

const serverEnvSource = {
  SUPABASE_SECRET_KEY: process.env.SUPABASE_SECRET_KEY,
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
  RESEND_API_KEY: process.env.RESEND_API_KEY,
  RESEND_FROM: process.env.RESEND_FROM,
  RESEND_REPLY_TO: process.env.RESEND_REPLY_TO,
  CRON_SECRET: process.env.CRON_SECRET,
  VAPID_PRIVATE_KEY: process.env.VAPID_PRIVATE_KEY,
  VAPID_SUBJECT: process.env.VAPID_SUBJECT,
} satisfies Record<string, string | undefined>;

export type ServerEnvKey = keyof typeof serverEnvSource;
