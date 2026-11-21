'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';
import { ensureSeed } from '@/lib/db';
import { startSync } from '@/lib/sync';
import { useCoachUnread, useSyncState } from '@/lib/hooks';
import { startCoach } from '@/lib/coach';
import { Icon, type IconName } from './Icon';
import { haptic } from '@/lib/haptics';

const NAV: { href: string; label: string; icon: IconName }[] = [
  { href: '/', label: 'Today', icon: 'dumbbell' },
  { href: '/coach/', label: 'Coach', icon: 'coach' },
  { href: '/history/', label: 'History', icon: 'calendar' },
  { href: '/progress/', label: 'Progress', icon: 'chart' },
  { href: '/ranks/', label: 'Ranks', icon: 'medal' },
  { href: '/body/', label: 'Body', icon: 'body' },
  { href: '/program/', label: 'Program', icon: 'list' },
];

function isActive(path: string, href: string) {
  if (href === '/') return path === '/';
  return path.startsWith(href.replace(/\/$/, ''));
}

export function SyncPill() {
  const s = useSyncState();
  let cls = '', text = '';
  switch (s.status) {
    case 'off': text = 'On this device'; break;
    case 'signed-out': text = 'Sync off'; break;
    case 'needs-code': cls = 'err'; text = 'Enter code to sync'; break;
    case 'offline': text = 'Offline, saved here'; break;
    case 'syncing': cls = 'busy'; text = 'Syncing'; break;
    case 'idle': cls = 'ok'; text = s.pending ? `${s.pending} to sync` : 'Synced'; break;
    case 'error': cls = 'err'; text = 'Sync failed'; break;
  }
  return (
    <Link href="/settings/" className={`syncpill ${cls}`} title={text} aria-label={text}>
      <span className="dot" aria-hidden />
      <span className="t">{text}</span>
    </Link>
  );
}

export function Shell({ children }: { children: ReactNode }) {
  const path = usePathname() || '/';
  const unread = useCoachUnread() && !isActive(path, '/coach/');

  useEffect(() => {
    void ensureSeed().then(startSync).then(startCoach);
    if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }
    // Ask the browser not to clear the local database under storage pressure.
    navigator.storage?.persist?.().catch(() => {});
    // A light haptic tick on every button press.
    const onClick = (e: MouseEvent) => {
      const t = (e.target as Element | null)?.closest?.('button, [role="button"]');
      if (t && !(t as HTMLButtonElement).disabled && !t.closest('label[for="nf-haptic"]')) haptic();
    };
    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, []);

  return (
    <div className="shell">
      <nav className="sidebar" aria-label="Main">
        <div className="logo-row">
          <img src="/icons/icon-192.png" alt="" />
          <div className="logo">Nature Fitness</div>
        </div>
        {NAV.map((n) => (
          <Link key={n.href} href={n.href} aria-current={isActive(path, n.href) ? 'page' : undefined}>
            <Icon name={n.icon} />
            {n.label}
            {n.href === '/coach/' && unread && <span className="navdot" aria-label="New reply" />}
          </Link>
        ))}
        <div className="spacer" />
        <Link href="/settings/" aria-current={isActive(path, '/settings/') ? 'page' : undefined}>
          <Icon name="gear" />
          Settings
        </Link>
      </nav>
      <div>
        <main className="main">
          <div className="topbar">
            <Link href="/" className="brand tab-only"><img src="/icons/icon-192.png" alt="" />Nature Fitness</Link>
            <div className="topbar-right">
              <SyncPill />
              <Link href="/settings/" className="iconbtn tab-only" aria-label="Settings">
                <Icon name="gear" />
              </Link>
            </div>
          </div>
          <div className="page" key={path}>{children}</div>
        </main>
      </div>
      <nav className="tabbar" aria-label="Main">
        {NAV.map((n) => (
          <Link key={n.href} href={n.href} aria-current={isActive(path, n.href) ? 'page' : undefined}>
            <Icon name={n.icon} />
            {n.label}
            {n.href === '/coach/' && unread && <span className="navdot" aria-label="New reply" />}
          </Link>
        ))}
      </nav>
    </div>
  );
}
