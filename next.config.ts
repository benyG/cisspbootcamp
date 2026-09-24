import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Preparation documents are uploaded through a Server Action (lib/documents.ts).
  experimental: { serverActions: { bodySizeLimit: "10mb" } },
};

export default nextConfig;
