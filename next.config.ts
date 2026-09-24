import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

/**
 * Storage images are served by whichever Supabase the environment points at.
 * Deriving the host from the env - rather than writing one project ref down -
 * is what lets a local stack (`supabase start`) or a branch show uploaded
 * logos and covers at all.
 */
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL)
  : null;
const isLocalSupabase =
  supabaseUrl !== null && ["127.0.0.1", "localhost"].includes(supabaseUrl.hostname);

const nextConfig: NextConfig = {
  typedRoutes: true,
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "reaobqtmwmesmpgdkzwi.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
      ...(supabaseUrl
        ? [
            {
              protocol: supabaseUrl.protocol.replace(":", "") as "http" | "https",
              hostname: supabaseUrl.hostname,
              port: supabaseUrl.port,
              pathname: "/storage/v1/object/public/**",
            },
          ]
        : []),
    ],
    // Next 16 refuses to optimise images from private addresses. That is the
    // right default and stays on everywhere except a machine whose Supabase is
    // itself on localhost.
    dangerouslyAllowLocalIP: isLocalSupabase,
  },
  experimental: {
    optimizePackageImports: ["lucide-react"],
  },
};

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

export default withNextIntl(nextConfig);
