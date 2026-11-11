/** @type {import('next').NextConfig} */
const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const nextConfig = {
  reactStrictMode: true,
  images: {
    formats: ['image/avif', 'image/webp'],
  },
  // Scene manifests reference rendered assets as /storage/... paths. The player runs
  // in an iframe on the web origin, so proxy those paths to the API.
  async rewrites() {
    return [
      { source: "/storage/:path*", destination: `${API_URL}/storage/:path*` },
    ];
  },
};

export default nextConfig;
