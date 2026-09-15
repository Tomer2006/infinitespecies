import type { NextConfig } from 'next'

const config: NextConfig = {
  turbopack: { root: process.cwd() },
  trailingSlash: true,
}

export default config
