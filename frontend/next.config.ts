import type { NextConfig } from "next";
import path from "node:path";

// Proxy /api/* to the backend so requests are same-origin from the browser.
// Without this, the auth cookie set by Render is third-party relative to the
// Vercel host and modern browsers drop it on the next request.
const apiTarget = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, '') || 'http://localhost:4000';

const nextConfig: NextConfig = {
  turbopack: {
    root: path.join(__dirname),
  },
  async rewrites() {
    return [
      { source: '/api/:path*', destination: `${apiTarget}/api/:path*` },
    ];
  },
};

export default nextConfig;
