export type IconName = 'dumbbell' | 'calendar' | 'chart' | 'body' | 'list' | 'gear' | 'up' | 'down' | 'left' | 'right' | 'trash' | 'plus' | 'camera' | 'medal' | 'grip' | 'search' | 'edit' | 'x' | 'coach' | 'send';

const PATHS: Record<IconName, string> = {
  dumbbell: 'M6.5 6.5v11M17.5 6.5v11M3 9.5v5M21 9.5v5M6.5 12h11',
  calendar: 'M4 6.5h16v13.5H4zM4 10.5h16M8.5 3.5v5M15.5 3.5v5',
  chart: 'M4 20h16M6 16l4-5 3.5 3L19 7',
  body: 'M12 7.2a2.2 2.2 0 1 0 0-4.4 2.2 2.2 0 0 0 0 4.4zM6 10.5h12M12 10.5V15m0 0-3 6m3-6 3 6',
  list: 'M9 6.5h11M9 12h11M9 17.5h11M4.5 6.5h.01M4.5 12h.01M4.5 17.5h.01',
  gear: 'M12 15.2a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4zM19.4 13.5a7.6 7.6 0 0 0 0-3l2-1.6-2-3.4-2.4 1a7.5 7.5 0 0 0-2.6-1.5L14 2.5h-4l-.4 2.5A7.5 7.5 0 0 0 7 6.5l-2.4-1-2 3.4 2 1.6a7.6 7.6 0 0 0 0 3l-2 1.6 2 3.4 2.4-1a7.5 7.5 0 0 0 2.6 1.5l.4 2.5h4l.4-2.5a7.5 7.5 0 0 0 2.6-1.5l2.4 1 2-3.4z',
  up: 'M6 15l6-6 6 6',
  down: 'M6 9l6 6 6-6',
  left: 'M15 6l-6 6 6 6',
  right: 'M9 6l6 6-6 6',
  trash: 'M4.5 7h15M10 11v6M14 11v6M6.5 7l1 13h9l1-13M9.5 7V4h5v3',
  plus: 'M12 5v14M5 12h14',
  medal: 'M12 21a6 6 0 1 0 0-12 6 6 0 0 0 0 12zM12 18a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM8.5 9.8 6 3h4l2 4.5L14 3h4l-2.5 6.8',
  grip: 'M9 6h.01M15 6h.01M9 12h.01M15 12h.01M9 18h.01M15 18h.01',
  search: 'M10.5 17a6.5 6.5 0 1 0 0-13 6.5 6.5 0 0 0 0 13zM15.5 15.5 20 20',
  edit: 'M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4',
  x: 'M6 6l12 12M18 6 6 18',
  coach: 'M5 5.5h14v10H11l-4.5 3.5V15.5H5zM9 10.5h.01M12 10.5h.01M15 10.5h.01',
  send: 'M5 12h13M12 6l6 6-6 6',
  camera: 'M4 8h3.5L9 5.5h6L16.5 8H20v11H4zM12 16.5a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4z',
};

export function Icon({ name, size }: { name: IconName; size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={PATHS[name]} />
    </svg>
  );
}
