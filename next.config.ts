import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep sql.js (and its .wasm) out of the bundler so it loads from node_modules
  // at runtime, including inside the Vercel serverless function.
  serverExternalPackages: ["sql.js"],
  experimental: {
    serverActions: {
      // Receipt photos are downscaled client-side, but leave headroom for
      // multipart overhead and larger originals.
      bodySizeLimit: "6mb",
    },
  },
};

export default nextConfig;
