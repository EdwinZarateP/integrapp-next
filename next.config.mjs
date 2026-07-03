/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  basePath: '/integrapp',
  assetPrefix: '/integrapp',
  trailingSlash: true,
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
