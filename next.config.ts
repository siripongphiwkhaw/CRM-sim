import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep sql.js (and its .wasm) out of the bundler so it loads from node_modules
  // at runtime, including inside the Vercel serverless function.
  serverExternalPackages: ["sql.js"],
  images: {
    // Demo product photography is referenced by URL rather than committed to
    // the repo. Only this one host is allowed.
    remotePatterns: [
      { protocol: "https", hostname: "images.pexels.com", pathname: "/photos/**" },
    ],
  },
  experimental: {
    serverActions: {
      // Receipt photos are downscaled client-side, but leave headroom for
      // multipart overhead and larger originals.
      bodySizeLimit: "6mb",
    },
  },
};

export default nextConfig;
