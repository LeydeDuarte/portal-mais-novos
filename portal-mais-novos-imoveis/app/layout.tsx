import type { Metadata, Viewport } from 'next';
import { cookies, headers } from 'next/headers';
import { ehHostApp } from '@/lib/dominios';
import { verifySession } from '@/lib/session';
import RegistrarApp from '@/components/RegistrarApp';
import { Poppins, Inter } from 'next/font/google';
import './globals.css';
import { SITE_URL, SITE_NAME } from '@/lib/seo';
import ProtecaoImagens from '@/components/ProtecaoImagens';
import AtualizarVersao from '@/components/AtualizarVersao';
import SurgirAoRolar from '@/components/SurgirAoRolar';
import { GtmHead, GtmBody } from '@/components/GoogleTagManager';

// Nunca reaproveitar respostas antigas do banco em nenhuma página
export const fetchCache = 'default-no-store';

// Títulos: Poppins (substituiu a fonte com serifa em todo o site)
const playfair = Poppins({
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  variable: '--font-playfair',
  display: 'swap'
});

const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-inter'
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'Os Mais Novos Imóveis à Venda estão aqui | Goiânia',
    template: `%s | ${SITE_NAME}`
  },
  description:
    'Os Mais Novos Imóveis à venda em Goiânia: lançamentos, apartamentos e casas em condomínio. Atendimento especializado em financiamento e crédito imobiliário.',
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
  const noApp = ehHostApp(headers().get('host'));
  const equipe = noApp || !!verifySession(cookies().get('mn_staff')?.value);
  return (
    <html lang="pt-BR" className={`${playfair.variable} ${inter.variable}`}>
      <head>
        {!equipe && <GtmHead />}
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
        {!equipe && <GtmBody />}
        <ProtecaoImagens />
        <AtualizarVersao />
        <SurgirAoRolar />
        {equipe && <RegistrarApp />}
        {children}
      </body>
    </html>
  );
}
