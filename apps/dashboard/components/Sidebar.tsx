'use client';

import { clsx } from 'clsx';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

type Role = 'employee' | 'manager' | 'admin';
type NavItem = { href: string; label: string; roles: Role[] };

const NAV: NavItem[] = [
  { href: '/workday', label: 'My Workday', roles: ['employee', 'manager', 'admin'] },
  { href: '/', label: 'Live', roles: ['manager', 'admin'] },
  { href: '/team', label: 'Team', roles: ['manager', 'admin'] },
  { href: '/review', label: 'Review', roles: ['manager', 'admin'] },
  { href: '/reports', label: 'Reports', roles: ['manager', 'admin'] },
  { href: '/rules', label: 'Rules', roles: ['admin'] },
  { href: '/users', label: 'Users', roles: ['admin'] },
  { href: '/settings', label: 'Settings', roles: ['admin'] },
];

export function Sidebar({ user }: { user: { fullName: string; email: string; role: string } }) {
  const pathname = usePathname();
  const role = user.role as Role;
  const visible = NAV.filter((n) => n.roles.includes(role));
  return (
    <aside className="flex w-56 flex-col border-r border-slate-200 bg-white p-4">
      <div className="mb-6">
        <div className="text-lg font-semibold">WorkTrack</div>
        <div className="text-xs text-slate-500">{user.fullName}</div>
        <div className="text-xs text-slate-400">{user.role}</div>
      </div>
      <nav className="flex flex-1 flex-col gap-1 text-sm">
        {visible.map((n) => {
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
