<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# GLOWA

Before changing anything, read `PROJECT_CONTEXT.md` at the repo root: it holds
the architecture, data model, design system, conventions and open TODOs. Update
it at the end of every task.

Hard rules for this repo:

1. Inspect what exists before modifying it. Do not rewrite working code.
2. Every database change is a migration in `supabase/migrations/`, committed
   here. Never change the schema by hand in the dashboard.
3. RLS is designed before a table is exposed. Policies use `TO authenticated`
   plus an ownership predicate, `(select auth.uid())`, and both `USING` and
   `WITH CHECK` on updates.
4. Identify the caller with `supabase.auth.getClaims()`, never `getSession()`.
5. No secrets in source control, in generated docs, or in `NEXT_PUBLIC_` vars.
6. No hard-coded UI strings. Everything goes through `messages/{bg,en,ro}.json`,
   and business content is stored as `{"bg","en","ro"}` jsonb.
7. Use `Link` / `useRouter` / `redirect` from `@/i18n/navigation` inside
   localized routes.
8. Booking availability is computed server-side with transactional safeguards.
9. Never invent traction, revenue, review counts or customer numbers. Demo
   content is flagged `is_demo` and slugged `demo-`.
10. TypeScript strict, accessible components, responsive layouts. Run
    `npm run check` and `npm run build` before calling work done.
