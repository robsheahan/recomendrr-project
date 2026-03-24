'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Discover' },
  { href: '/saved', label: 'Saved' },
  { href: '/ratings', label: 'Ratings' },
  { href: '/profile', label: 'Taste Profile' },
];

export function DashboardNav() {
  const pathname = usePathname();

  return (
    <nav className="-mb-px flex gap-6">
      {NAV_ITEMS.map((item) => {
        const isActive = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`border-b-2 py-3 text-sm font-medium transition-colors ${
              isActive
                ? 'border-zinc-900 text-zinc-900 dark:border-zinc-50 dark:text-zinc-50'
                : 'border-transparent text-zinc-500 hover:border-zinc-300 hover:text-zinc-700 dark:text-zinc-400 dark:hover:border-zinc-600 dark:hover:text-zinc-200'
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
