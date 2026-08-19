import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

const appRoot = dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  cacheComponents: true,
  turbopack: {
    root: appRoot,
  },
  experimental: {
    instantNavigationDevToolsToggle: true,
    serverActions: {
      allowedOrigins: ["propertia.brandn.dev"],
    },
  },
};

export default nextConfig;
