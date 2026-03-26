/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  basePath: '/integrapp',
  assetPrefix: '/integrapp',
  images: {
    unoptimized: true,
    remotePatterns: [
      {
        protocol: "https",
        hostname: "storage.googleapis.com",
      },
    ],
  },
};

export default nextConfig;
