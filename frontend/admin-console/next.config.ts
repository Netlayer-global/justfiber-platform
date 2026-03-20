import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  experimental: {
    esmExternals: "loose",
  },
};

export default nextConfig;
