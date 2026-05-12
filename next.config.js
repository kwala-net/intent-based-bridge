/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config) => {
    // Required for wagmi/viem in Next.js
    config.resolve.fallback = { fs: false, net: false, tls: false }
    return config
  },
}

module.exports = nextConfig
