import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

const metadataOrigin = process.env.NEXT_PUBLIC_SITE_URL
  || (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : 'http://localhost:3000');

export const metadata: Metadata = {
  metadataBase: new URL(metadataOrigin),
  title: 'GI-Market Project Tracker',
  description: 'Shared project progress, milestones, and tasks for the GI-Market team and client.',
  openGraph: {
    title: 'GI-Market Project Tracker',
    description: 'Shared project progress for the team and client.',
    type: 'website',
    images: [{ url: '/og.png', width: 1740, height: 909, alt: 'GI-Market Project Tracker' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'GI-Market Project Tracker',
    description: 'Shared project progress for the team and client.',
    images: ['/og.png'],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
