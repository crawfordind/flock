import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@libsql/client", "@libsql/hrana-client", "libsql"],
};

export default nextConfig;
