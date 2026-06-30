/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // web-push uses Node's crypto and dynamic requires — keep it out of the bundler.
  serverExternalPackages: ['web-push'],
};

module.exports = nextConfig;
