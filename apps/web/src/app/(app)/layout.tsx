'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { UserRole } from '@radvault/types';
import { useAuthStore } from '@/store/auth.store';

export default function AppLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, accessToken, logout } = useAuthStore();

  useEffect(() => {
    if (!accessToken) {
      router.replace('/login');
    }
  }, [accessToken, router]);

  if (!accessToken) {
    return (
      <main className="flex min-h-screen items-center justify-center text-slate-300">
        Redirecting to login...
      </main>
    );
  }

  const links = [
    {
      label: 'Studies',
      href: '/studies',
      roles: [
        UserRole.Admin,
        UserRole.Radiologist,
        UserRole.Technologist,
        UserRole.ReferringPhysician,
      ],
    },
    { label: 'Worklist', href: '/worklist', roles: [UserRole.Admin, UserRole.Radiologist] },
    {
      label: 'Reports',
      href: '/reports',
      roles: [UserRole.Admin, UserRole.Radiologist, UserRole.ReferringPhysician],
    },
    { label: 'Admin', href: '/admin', roles: [UserRole.Admin] },
  ].filter((item) => (user ? item.roles.includes(user.role as UserRole) : false));

  return (
    <div className="grid min-h-screen grid-cols-[260px_1fr]">
      <aside className="border-r border-slate-800 bg-slate-950/90 p-4">
        <h1 className="mb-6 text-xl font-semibold text-slate-100">RadVault PACS</h1>
        <nav className="space-y-2">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                'block rounded-md px-3 py-2 text-sm text-slate-300 hover:bg-slate-800 hover:text-slate-100',
                pathname.startsWith(link.href) ? 'bg-slate-800 text-slate-100' : '',
              )}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="mt-8 rounded-md border border-slate-800 p-3 text-sm text-slate-300">
          <p className="font-medium text-slate-100">{user?.fullName ?? 'Unknown User'}</p>
          <p className="text-xs text-slate-400">{user?.role ?? 'Unknown Role'}</p>
          <Button
            variant="outline"
            className="mt-3 w-full"
            onClick={async () => {
              await logout();
              router.replace('/login');
            }}
          >
            Logout
          </Button>
        </div>
      </aside>

      <main className="min-w-0 p-6">{children}</main>
    </div>
  );
}
