import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // Pin the workspace root explicitly so Turbopack does not climb up to
  // a stray pnpm-lock.yaml in $HOME.
  turbopack: {
    root: path.join(__dirname),
  },
};

export default nextConfig;
