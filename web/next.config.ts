import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  // A stray package-lock.json in the home folder makes Next guess the wrong project root.
  turbopack: { root: import.meta.dirname },
};

export default nextConfig;
