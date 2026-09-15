import type { Metadata, Viewport } from 'next';
import './globals.css';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';

export const viewport: Viewport = {
  themeColor: '#0d0e14',
  width: 'device-width',
  initialScale: 1,
};

const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL && !process.env.NEXT_PUBLIC_APP_URL.includes('localhost')
    ? process.env.NEXT_PUBLIC_APP_URL
    : 'https://shorty.sji.one';

export const metadata: Metadata = {
  metadataBase: new URL(APP_URL),
  alternates: {
    canonical: '/',
  },
  title: {
    default: 'Shorty — Fast, Free URL Shortener',
    template: '%s | Shorty',
  },
  description:
    'Short links. Simple. Fast. Privacy-first URL shortener with real-time analytics, custom aliases, and QR codes.',
  keywords: ['url shortener', 'link shortener', 'short link', 'qr code', 'link analytics', 'custom alias'],
  authors: [{ name: 'Shorty' }],
  creator: 'Shorty',
  publisher: 'Shorty',
  manifest: '/site.webmanifest',
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/icon.svg', type: 'image/svg+xml' },
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [
      { url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    ],
    shortcut: '/favicon.ico',
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://shorty.sji.one',
    siteName: 'Shorty',
    title: 'Shorty — Fast, Free URL Shortener',
    description:
      'Short links. Simple. Fast. Privacy-first URL shortener with real-time analytics, custom aliases, and QR codes.',
    images: [
      {
        url: 'https://shorty.sji.one/og-image.png',
        width: 1200,
        height: 630,
        alt: 'Shorty — Fast, Free URL Shortener',
        type: 'image/png',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Shorty — Fast, Free URL Shortener',
    description:
      'Short links. Simple. Fast. Privacy-first URL shortener with real-time analytics, custom aliases, and QR codes.',
    images: ['https://shorty.sji.one/twitter-image.png'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true },
  },
};

const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'WebSite',
      '@id': 'https://shorty.sji.one/#website',
      url: 'https://shorty.sji.one',
      name: 'Shorty',
      description: 'Fast, privacy-first URL shortener with custom links and real-time analytics.',
    },
    {
      '@type': 'Organization',
      '@id': 'https://shorty.sji.one/#organization',
      name: 'Shorty',
      url: 'https://shorty.sji.one',
      logo: {
        '@type': 'ImageObject',
        url: 'https://shorty.sji.one/icon-512.png',
        width: 512,
        height: 512,
      },
    },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body>
        <Header />
        <main>{children}</main>
        <Footer />
      </body>
    </html>
  );
}
