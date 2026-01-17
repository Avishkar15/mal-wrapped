/** @type {import('next').NextConfig} */

const {i18n} = require('./next-i18next.config.js');

const nextConfig = {
  reactStrictMode: true,
  images: {
    domains: ['cdn.myanimelist.net', 'api.myanimelist.net'],
    unoptimized: true,
  },
  i18n,
}

module.exports = nextConfig

