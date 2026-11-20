import type { NextConfig } from 'next';

// Static export: the whole app is plain files, so it can be cached by the
// service worker and run with no server and no connection.
const nextConfig: NextConfig = {
  output: 'export',
  trailingSlash: true,
  images: { unoptimized: true },
};

export default nextConfig;
