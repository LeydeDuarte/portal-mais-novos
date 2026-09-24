import type { Metadata, Viewport } from 'next';
import { cookies } from 'next/headers';
import { verifySession } from '@/lib/session';
import RegistrarApp from '@/components/RegistrarApp';
import { Playfair_Display, Inter } from 'next/font/google';
import './globals.css';
import { SITE_URL, SITE_NAME } from '@/lib/seo';
import ProtecaoImagens from '@/components/ProtecaoImagens';

// Nunca reaproveitar respostas antigas do banco em nenhuma página
export const fetchCache = 'default-no-store';

const playfair = Playfair_Display({
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  variable: '--font-playfair'
});

const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-inter'
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${SITE_NAME} — Imóveis à venda em Goiânia`,
    template: `%s | ${SITE_NAME}`
  },
  description:
    'Imóveis à venda em Goiânia com fotos e vídeos: apartamentos, casas em condomínio, coberturas e lançamentos. Atendimento especializado em financiamento e crédito imobiliário.',
  openGraph: {
    siteName: SITE_NAME,
    type: 'website',
    locale: 'pt_BR'
  },
  robots: {
    index: true,
    follow: true
  }
};

export const viewport: Viewport = { themeColor: '#257CFF' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  // App (PWA) só para a equipe: o manifesto e o service worker só vão para quem
  // está logado como admin, analista ou corretor — o público não vê "Instalar app".
  const equipe = !!verifySession(cookies().get('mn_staff')?.value);
  return (
    <html lang="pt-BR" className={`${playfair.variable} ${inter.variable}`}>
      <head>
        {equipe && (
          <>
            <link rel="manifest" href="/manifest.webmanifest" />
            <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
            <meta name="apple-mobile-web-app-capable" content="yes" />
            <meta name="mobile-web-app-capable" content="yes" />
            <meta name="apple-mobile-web-app-title" content="Mais Novos" />
            <meta name="apple-mobile-web-app-status-bar-style" content="default" />
          </>
        )}
      </head>
      <body className="font-sans antialiased">
        <ProtecaoImagens />
        {equipe && <RegistrarApp />}
        {children}
      </body>
    </html>
  );
}
