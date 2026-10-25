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
      {
        // Lets any other origin (specifically: the separate Rentivo marketing
        // website repo/deployment) read this file with a plain client-side
        // `fetch()`. It's already fully public — anyone can open this URL
        // directly in a browser — this only affects whether JS on another
        // site is allowed to read the response, not who can see it.
        source: '/app-version.json',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Cache-Control', value: 'public, max-age=60, must-revalidate' },
        ],
      },
    ]
  },
}

export default nextConfig
