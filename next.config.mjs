/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  async rewrites() {
    const backendUrl = process.env.BACKEND_INTERNAL_URL || process.env.NEXT_PUBLIC_API_URL || 'https://orderv2.botivate.in';
    const cleanBackendUrl = backendUrl.replace(/\/api\/v1\/?$/, '').replace(/\/+$/, '');
    return [
      {
        source: '/api/v1/:path*',
        destination: `${cleanBackendUrl}/api/v1/:path*`,
      },
    ];
  },
}

export default nextConfig
