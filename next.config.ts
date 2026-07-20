import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
