import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* Documents go straight from the browser to Vercel Blob (lib/documents.ts). */
  /* The reading plan route reads its HTML template at runtime. */
  outputFileTracingIncludes: { "/plan-de-lecture": ["./lib/reading-plan/template.html"] },
  /* A LinkedIn post may carry an image of up to 4 MB (lib/linkedin.ts); the default is 1 MB. */
  experimental: { serverActions: { bodySizeLimit: "5mb" } },
};

export default nextConfig;
