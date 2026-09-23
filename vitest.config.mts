import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

/**
 * Unit tests only: pure modules, no React renderer and no database. The
 * database invariants live in `supabase/tests/` as pgTAP and run against a
 * local stack, because asserting them anywhere else would be asserting a mock.
 */
export default defineConfig({
  resolve: {
    tsconfigPaths: true,
    alias: {
      "server-only": fileURLToPath(
        new URL("./test/server-only-stub.ts", import.meta.url),
      ),
    },
  },
  test: {
    environment: "node",
    // The public env is validated at import time, by design, so the unit
    // tests need placeholder values. These are not secrets and never reach a
    // network call: nothing under test makes one.
    env: {
      NEXT_PUBLIC_SUPABASE_URL: "https://test.supabase.co",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test",
      NEXT_PUBLIC_SITE_URL: "https://glowa.test",
    },
    include: ["src/**/*.test.ts"],
    restoreMocks: true,
    unstubGlobals: true,
    unstubEnvs: true,
  },
});
