import type { Metadata, Viewport } from 'next';
import { Geist } from 'next/font/google';
import { Shell } from '@/components/Shell';
import './globals.css';

// Fonts are downloaded at build time and served with the app, so they work offline.
const sans = Geist({ subsets: ['latin'], variable: '--font-sans' });

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
    { media: '(prefers-color-scheme: light)', color: '#fafaf8' },
    { media: '(prefers-color-scheme: dark)', color: '#0e0e0c' },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={sans.variable}>
      <body>
        <Shell>{children}</Shell>
      </body>
    </html>
  );
}
