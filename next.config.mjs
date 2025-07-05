import createNextIntlPlugin from 'next-intl/plugin';
 
const withNextIntl = createNextIntlPlugin();


/** @type {import('next').NextConfig} */
const nextConfig = {
  // save this just in case
  productionBrowserSourceMaps: true,
  webpack: (config) => {
    config.devtool = 'source-map';
    return config;
  },
  reactStrictMode: false,
  output: 'standalone',
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