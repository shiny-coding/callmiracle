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
      },
      {
        module: /node_modules\/@mapbox\/node-pre-gyp/,
        message: /.*\.html$/
      }
    ];

    // Ignore problematic bcrypt/node-pre-gyp files by excluding from resolution
    const originalResolveLoader = config.resolveLoader;
    config.resolveLoader = {
      ...originalResolveLoader,
      alias: {
        ...originalResolveLoader?.alias,
        'ignore-loader': false
      }
    };
    
    // Add rule to handle HTML files from node-pre-gyp
    config.module = config.module || {};
    config.module.rules = config.module.rules || [];
    config.module.rules.push({
      test: /\.html$/,
      issuer: /node_modules\/@mapbox\/node-pre-gyp/,
      type: 'asset/source'
    });
    
    // Exclude server-only packages from client bundle
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
        http: false,
        https: false,
        util: false,
        url: false,
        querystring: false,
        buffer: false,
        events: false,
      };
      config.externals = config.externals || [];
      config.externals.push(
        'ioredis',
        'bcrypt',
        'winston',
        'winston-daily-rotate-file',
        'winston-loki',
        '@colors/colors',
        'mongodb',
        'snappy',
        '@napi-rs/snappy-win32-x64-msvc',
        'graphql-redis-subscriptions',
        '@mapbox/node-pre-gyp'
      );
    }
    
    return config;
  },
  reactStrictMode: false,
  output: 'standalone',
  serverExternalPackages: ['winston-loki', 'snappy', '@napi-rs/snappy-win32-x64-msvc', 'ioredis', 'bcrypt', '@mapbox/node-pre-gyp'],
  images: {
    unoptimized: true,
    // remotePatterns not needed - all images are served from same origin
    // via API routes (/api/images/profiles, /api/images/groups)
    // Only add remotePatterns if you load images from external domains (CDN, S3, etc.)
  },
  async rewrites() {
    return [
      {
        source: '/profiles/:id',
        destination: '/api/images/profiles/:id',
      },
      {
        source: '/groups/:id',
        destination: '/api/images/groups/:id',
      },
    ];
  },
};
 
export default withNextIntl(nextConfig);