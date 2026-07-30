import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '*.supabase.co' },
    ],
  },
  async headers() {
    return [
      {
        // Applies to every route. Kept deliberately conservative — no CSP here,
        // since a strict Content-Security-Policy needs careful, page-by-page
        // auditing of every inline script/style and third-party origin (Supabase,
        // web-push, etc.) to avoid silently breaking the app; these headers are
        // the well-understood, low-risk baseline that doesn't require that audit.
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'microphone=(), geolocation=()' },
        ],
      },
    ]
  },
}

export default nextConfig
