/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config, { isServer }) => {
    return config;
  },
  images: {
    remotePatterns: [],
  },
};

export default nextConfig;
