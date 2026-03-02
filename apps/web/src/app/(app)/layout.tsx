import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';

export default function AppLayout({ children }: { children: ReactNode }) {
  const cookieStore = cookies();
  const token = cookieStore.get('accessToken')?.value || cookieStore.get('token')?.value;

  if (!token) {
    redirect('/login');
  }

  return <>{children}</>;
}
