import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  // Shared logic is published as TypeScript source (packages/core).
  transpilePackages: ["@et/core"],
  partialPrefetching: true,
  // Development only: the phone app's web build (`expo start --web`) calls this API from
  // another origin. Production needs no CORS, because the phone app isn't a browser.
  ...(process.env.NODE_ENV === "development"
    ? {
        async headers() {
          return [
            {
              source: "/api/v1/:path*",
              headers: [
                { key: "Access-Control-Allow-Origin", value: "*" },
                { key: "Access-Control-Allow-Methods", value: "GET,POST,PUT,PATCH,DELETE,OPTIONS" },
                { key: "Access-Control-Allow-Headers", value: "Authorization,Content-Type,X-Time-Zone" },
              ],
            },
          ];
        },
      }
    : {}),
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
