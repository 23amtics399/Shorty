import type { Metadata, Viewport } from 'next';
import './globals.css';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';

export const viewport: Viewport = {
  themeColor: '#0d0e14',
  width: 'device-width',
  initialScale: 1,
};

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'),
  alternates: {
    canonical: '/',
  },
  title: {
    default: 'Shorty — Fast, Free URL Shortener',
    template: '%s | Shorty',
  },
  description:
    'Shorty makes your long URLs short, trackable, and shareable. Create custom short links with analytics, QR codes, and expiration control.',
  keywords: ['url shortener', 'link shortener', 'short link', 'qr code', 'link analytics'],
  authors: [{ name: 'Shorty' }],
  creator: 'Shorty',
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://shorty.sji.one',
    siteName: 'Shorty',
    title: 'Shorty — Fast, Free URL Shortener',
    description:
      'Create short, trackable links in seconds. Custom aliases, QR codes, and expiration control.',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'Shorty — URL Shortener',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Shorty — Fast, Free URL Shortener',
    description: 'Create short, trackable links in seconds.',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true },
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head />
      <body>
        <Header />
        <main>{children}</main>
        <Footer />
      </body>
    </html>
  );
}
