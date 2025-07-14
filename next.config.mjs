import createNextIntlPlugin from 'next-intl/plugin';
 
const withNextIntl = createNextIntlPlugin();

/** @type {import('next').NextConfig} */
const nextConfig = {
  // save this just in case
  productionBrowserSourceMaps: true,
  webpack: (config, { isServer }) => {
    if (config.mode !== 'development') {
      config.devtool = 'source-map';
    }
    return config;
  },
  reactStrictMode: false,
  output: 'standalone',
  serverExternalPackages: ['winston-loki', 'snappy', '@napi-rs/snappy-win32-x64-msvc'],
  images: {
    unoptimized: true,
    remotePatterns: [
      {
        protocol: 'http',
        hostname: 'localhost',
        pathname: '/profiles/**',
      },
    ],
  }
};
 
export default withNextIntl(nextConfig);