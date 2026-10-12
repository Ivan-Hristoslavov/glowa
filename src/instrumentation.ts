/**
 * Next.js calls `onRequestError` for every error thrown while rendering a page,
 * running a route handler or a server action - not for redirects or 404s. We
 * keep them in our own table so the platform console can show what is breaking
 * without a third-party account. Only the Node runtime has the database client.
 */
export async function onRequestError(
  error: unknown,
  request: { path: string; method: string },
) {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { recordError } = await import("@/lib/errors/record");
  const err = error as { message?: string; digest?: string };
  await recordError({
    source: "server",
    message: err?.message ?? String(error),
    path: request.path.split("?")[0],
    method: request.method,
    digest: err?.digest ?? null,
  });
}
