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

type Section = { href: string; label: string };
type Tab = { href: string; label: string; icon: IconName; sections?: Section[] };

// Four tabs. Progress and Workouts each hold a few screens, switched with a segmented control at the top.
const NAV: Tab[] = [
  { href: '/', label: 'Today', icon: 'dumbbell' },
  { href: '/coach/', label: 'Coach', icon: 'coach' },
  { href: '/progress/', label: 'Progress', icon: 'chart', sections: [
    { href: '/progress/', label: 'Lifts' },
    { href: '/ranks/', label: 'Ranks' },
    { href: '/body/', label: 'Body' },
  ] },
  { href: '/history/', label: 'Workouts', icon: 'calendar', sections: [
    { href: '/history/', label: 'History' },
    { href: '/program/', label: 'Program' },
  ] },
];

function isActive(path: string, href: string) {
  if (href === '/') return path === '/';
  return path.startsWith(href.replace(/\/$/, ''));
}

function tabFor(path: string) {
  return NAV.find((t) => (t.sections ? t.sections.some((s) => isActive(path, s.href)) : isActive(path, t.href)));
}

/** Remembers the last screen opened inside each tab, so tapping the tab returns there. */
const lastSection: Record<string, string> = {};

function SubTabs({ tab, path }: { tab: Tab; path: string }) {
  if (!tab.sections) return null;
  return (
    <nav className="subtabs" aria-label={tab.label}>
      {tab.sections.map((s) => (
        <Link key={s.href} href={s.href} replace aria-current={isActive(path, s.href) ? 'page' : undefined}>{s.label}</Link>
      ))}
    </nav>
  );
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
  const tab = tabFor(path);
  if (tab?.sections) lastSection[tab.href] = path;
  const link = (t: Tab) => (t.sections && tab !== t ? lastSection[t.href] ?? t.href : t.href);

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
          <Link key={n.href} href={link(n)} aria-current={tab === n ? 'page' : undefined}>
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
          {tab?.sections && <SubTabs tab={tab} path={path} />}
          <div className="page" key={path}>{children}</div>
        </main>
      </div>
      <nav className="tabbar" aria-label="Main">
        {NAV.map((n) => (
          <Link key={n.href} href={link(n)} aria-current={tab === n ? 'page' : undefined}>
            <Icon name={n.icon} />
            {n.label}
            {n.href === '/coach/' && unread && <span className="navdot" aria-label="New reply" />}
          </Link>
        ))}
      </nav>
    </div>
  );
}
