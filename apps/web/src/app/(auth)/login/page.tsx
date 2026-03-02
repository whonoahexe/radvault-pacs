'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ApiError } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';

export default function LoginPage() {
  const router = useRouter();
  const login = useAuthStore((state) => state.login);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <form
        className="w-full max-w-md rounded-xl border border-slate-700 bg-slate-950/70 p-8"
        onSubmit={async (event) => {
          event.preventDefault();
          setSubmitting(true);
          setError(null);

          try {
            await login(email.trim(), password);
            router.replace('/studies');
          } catch (error) {
            if (error instanceof ApiError) {
              setError(error.message);
            } else if (error instanceof Error && error.message) {
              setError(error.message);
            } else {
              setError('Unable to sign in. Please check your credentials and try again.');
            }
          } finally {
            setSubmitting(false);
          }
        }}
      >
        <h1 className="mb-6 text-2xl font-semibold text-slate-100">Sign in to RadVault</h1>

        <div className="space-y-4">
          <div>
            <label htmlFor="email" className="mb-1 block text-sm text-slate-300">
              Email
            </label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </div>

          <div>
            <label htmlFor="password" className="mb-1 block text-sm text-slate-300">
              Password
            </label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </div>
        </div>

        {error ? <p className="mt-4 text-sm text-red-300">{error}</p> : null}

        <Button className="mt-6 w-full" type="submit" disabled={submitting}>
          {submitting ? 'Signing in...' : 'Sign in'}
        </Button>

        <p className="mt-3 text-xs text-slate-400">
          Registration is disabled. Contact an administrator for access.
        </p>
      </form>
    </main>
  );
}
