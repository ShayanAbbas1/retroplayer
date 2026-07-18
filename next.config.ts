import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Dev runs on http://127.0.0.1 (Spotify bans localhost redirect URIs); Next treats that as cross-origin.
  allowedDevOrigins: ["127.0.0.1"],
};

export default nextConfig;
