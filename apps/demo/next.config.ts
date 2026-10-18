import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The library ships pre-built ESM; transpiling it keeps the "use client"
  // boundaries explicit for the App Router.
  transpilePackages: ["agent-approval-machine"],
};

export default nextConfig;
