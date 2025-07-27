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
    config.ignoreWarnings = [
      {
        module: /node_modules\/@whatwg-node\/fetch/,
        message: /Critical dependency: the request of a dependency is an expression/
      }
    ];
    
    // Exclude ioredis from client bundle
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        stream: false,
        net: false,
        tls: false,
        crypto: false,
        fs: false,
        path: false,
        os: false,
      };
      config.externals = config.externals || [];
      config.externals.push('ioredis');
    }
    
    return config;
  },
  reactStrictMode: false,
  output: 'standalone',
  serverExternalPackages: ['winston-loki', 'snappy', '@napi-rs/snappy-win32-x64-msvc', 'ioredis'],
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