import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* Documents go straight from the browser to Vercel Blob (lib/documents.ts). */
  /* The reading plan route reads its HTML template at runtime. */
  /* The marketing page composes visuals with fonts read at runtime (lib/marketing/compose.tsx). */
  outputFileTracingIncludes: {
    "/plan-de-lecture": ["./lib/reading-plan/template.html"],
    "/admin/marketing": ["./lib/marketing/fonts/**"],
    /* The share image reads the same fonts and Ben's photo (lib/og/share-image.tsx). */
    "/opengraph-image": ["./lib/marketing/fonts/**", "./lib/og/**"],
    "/twitter-image": ["./lib/marketing/fonts/**", "./lib/og/**"],
  },
  /* A LinkedIn post may carry an image of up to 4 MB (lib/linkedin.ts); the default is 1 MB. */
  experimental: { serverActions: { bodySizeLimit: "5mb" } },
};

export default nextConfig;
