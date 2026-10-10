import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Report Malicious Link',
  description: 'Report abusive, phishing, malware, or fraudulent links to the Shorty safety and moderation team.',
  alternates: { canonical: '/report' },
  openGraph: {
    title: 'Report Malicious Link',
    description: 'Report abusive, phishing, malware, or fraudulent links to the Shorty safety and moderation team.',
    url: 'https://shorty.sji.one/report',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Report Malicious Link',
    description: 'Report abusive, phishing, malware, or fraudulent links to the Shorty safety and moderation team.',
  },
};

export default function ReportLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
