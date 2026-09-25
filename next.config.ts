import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* Documents go straight from the browser to Vercel Blob (lib/documents.ts). */
  /* The reading plan route reads its HTML template at runtime. */
  outputFileTracingIncludes: { "/plan-de-lecture": ["./lib/reading-plan/template.html"] },
};

export default nextConfig;
