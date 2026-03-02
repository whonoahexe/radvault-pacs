'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AuditAction, UserRole } from '@radvault/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectItem } from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';

export default function AdminPage() {
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const [auditAction, setAuditAction] = useState<AuditAction | ''>('');

  const [createForm, setCreateForm] = useState({
    email: '',
    fullName: '',
    password: '',
    role: UserRole.Radiologist,
  });

  const usersQuery = useQuery({
    queryKey: ['admin-users'],
    queryFn: () => api.admin.users({ page: 1, limit: 100 }),
    enabled: user?.role === UserRole.Admin,
  });

  const auditQuery = useQuery({
    queryKey: ['admin-audit', auditAction],
    queryFn: () =>
      api.admin.auditLogs({
        action: auditAction || undefined,
        page: 1,
        limit: 50,
      }),
    enabled: user?.role === UserRole.Admin,
  });

  const createUserMutation = useMutation({
    mutationFn: () => api.admin.createUser(createForm),
    onSuccess: async () => {
      setCreateForm({ email: '', fullName: '', password: '', role: UserRole.Radiologist });
      await queryClient.invalidateQueries({ queryKey: ['admin-users'] });
    },
  });

  const toggleUserMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      api.admin.updateUser(id, { isActive: !isActive }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin-users'] });
    },
  });

  if (user?.role !== UserRole.Admin) {
    return <p className="text-slate-300">Administrator access is required for this page.</p>;
  }

  const users = usersQuery.data?.data ?? [];
  const audits = auditQuery.data?.data ?? [];

  return (
    <main className="space-y-6">
      <h1 className="text-2xl font-semibold text-slate-100">Admin</h1>

      <section className="space-y-3 rounded-md border border-slate-800 bg-slate-950/70 p-4">
        <h2 className="text-lg font-medium text-slate-100">Create user</h2>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <Input
            placeholder="Email"
            type="email"
            value={createForm.email}
            onChange={(event) =>
              setCreateForm((current) => ({ ...current, email: event.target.value }))
            }
          />
          <Input
            placeholder="Full name"
            value={createForm.fullName}
            onChange={(event) =>
              setCreateForm((current) => ({ ...current, fullName: event.target.value }))
            }
          />
          <Input
            placeholder="Password"
            type="password"
            value={createForm.password}
            onChange={(event) =>
              setCreateForm((current) => ({ ...current, password: event.target.value }))
            }
          />
          <Select
            value={createForm.role}
            onValueChange={(value) =>
              setCreateForm((current) => ({ ...current, role: value as UserRole }))
            }
          >
            {Object.values(UserRole).map((role) => (
              <SelectItem key={role} value={role}>
                {role}
              </SelectItem>
            ))}
          </Select>
        </div>

        <Button
          onClick={() => createUserMutation.mutate()}
          disabled={
            createUserMutation.isPending ||
            !createForm.email ||
            !createForm.fullName ||
            !createForm.password
          }
        >
          {createUserMutation.isPending ? 'Creating...' : 'Create user'}
        </Button>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-medium text-slate-100">Users</h2>
        {usersQuery.isLoading ? <p className="text-slate-300">Loading users...</p> : null}
        {usersQuery.error ? <p className="text-slate-300">Unable to load users.</p> : null}
        {!usersQuery.isLoading && !usersQuery.error && users.length === 0 ? (
          <p className="text-slate-300">No users found.</p>
        ) : null}

        {users.length > 0 ? (
          <div className="overflow-x-auto rounded-md border border-slate-800">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Active</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>{row.email}</TableCell>
                    <TableCell>{row.fullName}</TableCell>
                    <TableCell>{row.role}</TableCell>
                    <TableCell>
                      <Badge variant={row.isActive ? 'secondary' : 'outline'}>
                        {row.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          toggleUserMutation.mutate({ id: row.id, isActive: row.isActive })
                        }
                        disabled={toggleUserMutation.isPending}
                      >
                        {row.isActive ? 'Deactivate' : 'Reactivate'}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : null}
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-medium text-slate-100">Audit logs</h2>
          <Select
            value={auditAction}
            onValueChange={(value) => setAuditAction(value as AuditAction | '')}
          >
            <SelectItem value="">All actions</SelectItem>
            {Object.values(AuditAction).map((action) => (
              <SelectItem key={action} value={action}>
                {action}
              </SelectItem>
            ))}
          </Select>
        </div>

        {auditQuery.isLoading ? <p className="text-slate-300">Loading audit events...</p> : null}
        {auditQuery.error ? <p className="text-slate-300">Unable to load audit events.</p> : null}
        {!auditQuery.isLoading && !auditQuery.error && audits.length === 0 ? (
          <p className="text-slate-300">No audit events found.</p>
        ) : null}

        {audits.length > 0 ? (
          <div className="overflow-x-auto rounded-md border border-slate-800">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Time</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Resource</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {audits.map((event) => (
                  <TableRow key={event.id}>
                    <TableCell>{new Date(event.createdAt).toISOString()}</TableCell>
                    <TableCell>{event.action}</TableCell>
                    <TableCell>{event.userId ?? '-'}</TableCell>
                    <TableCell>
                      {event.resourceType ?? '-'} {event.resourceId ?? ''}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : null}
      </section>
    </main>
  );
}
