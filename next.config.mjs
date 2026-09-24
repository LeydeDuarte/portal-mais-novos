// Cabeçalhos de segurança em todas as páginas:
// - ninguém coloca o portal dentro de outro site (clickjacking)
// - HTTPS obrigatório (HSTS)
// - o navegador só carrega scripts/iframes de origens conhecidas (CSP)
const csp = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "img-src 'self' data: blob: https:",
  "media-src 'self' blob: https:",
  "font-src 'self' data:",
  "style-src 'self' 'unsafe-inline' https://accounts.google.com",
  // 'unsafe-inline' é exigido pelo Next (scripts de hidratação); 'wasm-unsafe-eval' para o leitor de PDF/OCR do painel
  "script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval' https://accounts.google.com https://cdn.jsdelivr.net",
  "worker-src 'self' blob: https://cdn.jsdelivr.net",
  "connect-src 'self' https:",
  'frame-src https://www.youtube.com https://www.youtube-nocookie.com https://www.instagram.com https://www.tiktok.com https://player.vimeo.com https://accounts.google.com',
  'upgrade-insecure-requests'
].join('; ');

const securityHeaders = [
  { key: 'Content-Security-Policy', value: csp },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(self), payment=(), usb=()' },
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin-allow-popups' }
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  compress: true,
  experimental: {
    // sharp (miniaturas das fotos) roda só no servidor
    serverComponentsExternalPackages: ['sharp']
  },
  async headers() {
    return [
      { source: '/:path*', headers: securityHeaders },
      // painel e APIs nunca em cache compartilhado nem no Google
      { source: '/painel/:path*', headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }, { key: 'Cache-Control', value: 'private, no-store' }] },
      { source: '/api/:path*', headers: [{ key: 'X-Robots-Tag', value: 'noindex' }] },
      { source: '/icons/:path*', headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }] },
      { source: '/pdfjs/:path*', headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }] }
    ];
  }
};

export default nextConfig;
