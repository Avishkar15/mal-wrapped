/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    domains: ['cdn.myanimelist.net', 'api.myanimelist.net'],
    unoptimized: true,
  },
}

module.exports = nextConfig

