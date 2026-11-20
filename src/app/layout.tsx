import type { Metadata, Viewport } from 'next';
import { Archivo, Big_Shoulders, IBM_Plex_Mono } from 'next/font/google';
import { Shell } from '@/components/Shell';
import './globals.css';

// Fonts are downloaded at build time and served with the app, so they work offline.
const display = Big_Shoulders({ subsets: ['latin'], weight: ['700', '800'], variable: '--font-display' });
const body = Archivo({ subsets: ['latin'], weight: ['400', '500', '600'], variable: '--font-body' });
const num = IBM_Plex_Mono({ subsets: ['latin'], weight: ['400', '500'], variable: '--font-num' });

export const metadata: Metadata = {
  title: 'Nature Fitness',
  description: 'Offline gym log: sets, reps, weight, body stats and Evolt scans.',
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, title: 'Nature Fitness', statusBarStyle: 'default' },
  icons: {
    icon: [{ url: '/icons/favicon-32.png', sizes: '32x32', type: 'image/png' }, { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' }],
    apple: [{ url: '/icons/apple-touch-icon.png', sizes: '180x180' }],
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f4f6f7' },
    { media: '(prefers-color-scheme: dark)', color: '#181e24' },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable} ${num.variable}`}>
      <body>
        <Shell>{children}</Shell>
      </body>
    </html>
  );
}
