'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { UserRole } from '@radvault/types';
import { useAuthStore } from '@/store/auth.store';
import {
  ImageIcon,
  ClipboardList,
  FileText,
  ShieldCheck,
  LogOut,
  Activity,
  User,
} from 'lucide-react';

export default function AppLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, accessToken, hasHydrated, logout } = useAuthStore();

  useEffect(() => {
    if (hasHydrated && !accessToken) {
      router.replace('/login');
    }
  }, [accessToken, hasHydrated, router]);

  if (!hasHydrated) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <div className="flex items-center gap-3 text-muted-foreground">
          <Activity className="h-5 w-5 animate-pulse" />
          <span className="text-sm">Restoring session…</span>
        </div>
      </main>
    );
  }

  if (!accessToken) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <div className="flex items-center gap-3 text-muted-foreground">
          <Activity className="h-5 w-5 animate-pulse" />
          <span className="text-sm">Redirecting to login…</span>
        </div>
      </main>
    );
  }

  const links = [
    {
      label: 'Studies',
      href: '/studies',
      icon: ImageIcon,
      roles: [
        UserRole.Admin,
        UserRole.Radiologist,
        UserRole.Technologist,
        UserRole.ReferringPhysician,
      ],
    },
    {
      label: 'Worklist',
      href: '/worklist',
      icon: ClipboardList,
      roles: [UserRole.Admin, UserRole.Radiologist],
    },
    {
      label: 'Reports',
      href: '/reports',
      icon: FileText,
      roles: [UserRole.Admin, UserRole.Radiologist, UserRole.ReferringPhysician],
    },
    {
      label: 'Admin',
      href: '/admin',
      icon: ShieldCheck,
      roles: [UserRole.Admin],
    },
  ].filter((item) => (user ? item.roles.includes(user.role as UserRole) : false));

  return (
    <TooltipProvider delayDuration={0}>
      <div className="grid min-h-screen grid-cols-[260px_1fr]">
        {/* Sidebar */}
        <aside className="flex flex-col border-r border-sidebar-border bg-sidebar">
          {/* Brand */}
          <div className="flex h-16 items-center gap-3 px-5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
              <Activity className="h-4 w-4 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-sm font-semibold tracking-tight text-foreground">RadVault</h1>
              <p className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
                PACS
              </p>
            </div>
          </div>

          <Separator className="bg-sidebar-border" />

          {/* Navigation */}
          <nav className="flex-1 space-y-1 px-3 py-4">
            <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              Navigation
            </p>
            {links.map((link) => {
              const isActive = pathname.startsWith(link.href);
              const Icon = link.icon;
              return (
                <Tooltip key={link.href}>
                  <TooltipTrigger asChild>
                    <Link
                      href={link.href}
                      className={cn(
                        'group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200',
                        isActive
                          ? 'bg-primary/10 text-primary shadow-sm'
                          : 'text-sidebar-foreground hover:bg-muted hover:text-foreground',
                      )}
                    >
                      <Icon
                        className={cn(
                          'h-4 w-4 shrink-0 transition-colors',
                          isActive
                            ? 'text-primary'
                            : 'text-muted-foreground group-hover:text-foreground',
                        )}
                      />
                      {link.label}
                      {isActive && <div className="ml-auto h-1.5 w-1.5 rounded-full bg-primary" />}
                    </Link>
                  </TooltipTrigger>
                  <TooltipContent side="right" className="md:hidden">
                    {link.label}
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </nav>

          <Separator className="bg-sidebar-border" />

          {/* User identity + Logout */}
          <div className="p-3">
            <div className="flex items-center gap-3 rounded-lg border border-border/50 bg-card/40 px-3 py-3 backdrop-blur-sm">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
                <User className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">
                  {user?.fullName ?? 'Unknown User'}
                </p>
                <p className="truncate text-[11px] text-muted-foreground">
                  {user?.role ?? 'Unknown Role'}
                </p>
              </div>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                    onClick={async () => {
                      await logout();
                      router.replace('/login');
                    }}
                  >
                    <LogOut className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right">Sign out</TooltipContent>
              </Tooltip>
            </div>
          </div>
        </aside>

        {/* Main content area */}
        <main className="min-w-0 overflow-auto bg-background">
          <div className="mx-auto max-w-[1400px] p-6">{children}</div>
        </main>
      </div>
    </TooltipProvider>
  );
}
