"use server";

import { headers } from "next/headers";
import { z } from "zod";

import { recordError } from "@/lib/errors/record";
import { withinLimit } from "@/lib/rate-limit";

const schema = z.object({
  message: z.string().max(1000),
  path: z.string().max(300),
  digest: z.string().max(100).optional(),
});

/**
 * The error screen reports itself, so a failure that happened in the browser
 * and never reached the server is still seen. Rate limited, because anyone can
 * call a server action.
 */
export async function reportClientError(input: z.input<typeof schema>) {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return;
  if (!(await withinLimit("client-error", 20, 3600))) return;
  const agent = (await headers()).get("user-agent") ?? "";
  await recordError({
    source: "client",
    message: parsed.data.message,
    path: parsed.data.path,
    digest: parsed.data.digest ?? null,
    details: { userAgent: agent.slice(0, 200) },
  });
}
