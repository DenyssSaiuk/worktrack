'use client';

import { clsx } from 'clsx';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV = [
  { href: '/', label: 'Live' },
  { href: '/team', label: 'Team' },
  { href: '/reports', label: 'Reports' },
  { href: '/rules', label: 'Rules' },
  { href: '/users', label: 'Users' },
  { href: '/settings', label: 'Settings' },
];

export function Sidebar({ user }: { user: { fullName: string; email: string; role: string } }) {
  const pathname = usePathname();
  return (
    <aside className="flex w-56 flex-col border-r border-slate-200 bg-white p-4">
      <div className="mb-6">
        <div className="text-lg font-semibold">WorkTrack</div>
        <div className="text-xs text-slate-500">{user.fullName}</div>
        <div className="text-xs text-slate-400">{user.role}</div>
      </div>
      <nav className="flex flex-1 flex-col gap-1 text-sm">
        {NAV.map((n) => {
          const active = pathname === n.href || (n.href !== '/' && pathname?.startsWith(n.href));
          return (
            <Link
              key={n.href}
              href={n.href}
              className={clsx(
                'rounded-md px-3 py-1.5 transition',
                active
                  ? 'bg-brand-50 font-medium text-brand-700'
                  : 'text-slate-600 hover:bg-slate-50',
              )}
            >
              {n.label}
            </Link>
          );
        })}
      </nav>
      <form action="/api/auth/logout" method="post" className="mt-auto pt-4">
        <button className="btn-secondary w-full" type="submit">
          Sign out
        </button>
      </form>
    </aside>
  );
}
