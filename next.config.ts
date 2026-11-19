import type { NextConfig } from 'next';

// Everything, uploads and sign-in included, goes to this site's own routes.
const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "connect-src 'self'",
  "frame-src 'self'",
  "frame-ancestors 'self'",
  "form-action 'self'",
  "object-src 'none'",
  "base-uri 'self'",
].join('; ');

export default {
  // .members is read from disk at request time; make sure it ships with the server functions
  outputFileTracingIncludes: { '/**': ['./.members'] },
  async headers() {
    if (process.env.NODE_ENV !== 'production') return []; // dev tooling needs eval
    return [
      {
        // Files are left out: the browser's PDF and image viewers do not need the page policy
        source: '/((?!Content/).*)',
        headers: [{ key: 'Content-Security-Policy', value: csp }],
      },
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        ],
      },
      {
        // Uploads never overwrite, so a path always holds the same file
        source: '/Content/:path*',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=86400' }],
      },
    ];
  },
} satisfies NextConfig;
