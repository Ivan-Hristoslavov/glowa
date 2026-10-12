import "server-only";

import type { z } from "zod";

import { fail } from "@/lib/api/http";

/** Reads a small JSON body and checks it. Returns the data or the 4xx to send. */
export async function readBody<T extends z.ZodType>(
  request: Request,
  schema: T,
): Promise<z.infer<T> | Response> {
  const text = await request.text();
  if (text.length > 32_000) return fail(413, "too_large", "The request body is too large.");

  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return fail(400, "invalid_json", "The body must be valid JSON.");
  }

  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    return fail(422, "invalid_request", "Some fields are missing or wrong.", {
      issues: parsed.error.issues.slice(0, 10).map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      })),
    });
  }
  return parsed.data;
}
