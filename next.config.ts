import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  output: 'export',
  images: { unoptimized: true },
  // Dev only: lets a phone on the local network load the dev server (and its hot reload) from this Mac's address.
  allowedDevOrigins: ['10.1.1.248'],
  turbopack: {
    rules: {
      '*.css': {
        loaders: ['@tailwindcss/turbopack'],
        as: '*.css',
      },
    },
  },
}

export default nextConfig
