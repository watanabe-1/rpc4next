import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1"],
  ...(process.env.RPC4NEXT_BASE_PATH_FIXTURE === "1"
    ? {
        basePath: "/docs",
        distDir: ".next-base-path",
        async rewrites() {
          return [{ source: "/public-user/:userId", destination: "/api/users/:userId" }];
        },
      }
    : {}),
};

export default nextConfig;
