/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  webpack: (config) => {
    config.experiments = {
      ...(config.experiments ?? {}),
      asyncWebAssembly: true,
    };

    config.resolve = config.resolve ?? {};
    config.resolve.alias = {
      ...(config.resolve.alias ?? {}),
      '@icr/polyseg-wasm': false,
    };
    config.resolve.fallback = {
      ...(config.resolve.fallback ?? {}),
      fs: false,
    };

    return config;
  },
};

module.exports = nextConfig;
