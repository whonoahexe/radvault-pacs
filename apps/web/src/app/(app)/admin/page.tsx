'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AuditAction, UserRole } from '@radvault/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import {
  ShieldCheck,
  UserPlus,
  Users,
  ScrollText,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Inbox,
  Mail,
  Lock,
  UserIcon,
  ShieldAlert,
} from 'lucide-react';

function roleConfig(role: string) {
  switch (role) {
    case UserRole.Admin:
      return 'bg-destructive/15 text-destructive border-destructive/30';
    case UserRole.Radiologist:
      return 'bg-primary/15 text-primary border-primary/30';
    case UserRole.Technologist:
      return 'bg-info/15 text-info border-info/30';
    case UserRole.ReferringPhysician:
      return 'bg-success/15 text-success border-success/30';
    default:
      return 'bg-muted text-muted-foreground border-border';
  }
}

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
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Card className="border-border/50 bg-card/60 p-8 text-center backdrop-blur-xl">
          <ShieldAlert className="mx-auto h-10 w-10 text-muted-foreground/50" />
          <p className="mt-3 text-sm text-muted-foreground">
            Administrator access is required for this page.
          </p>
        </Card>
      </div>
    );
  }

  const users = usersQuery.data?.data ?? [];
  const audits = auditQuery.data?.data ?? [];

  return (
    <div className="space-y-8 animate-in-fade">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/15">
          <ShieldCheck className="h-4 w-4 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Administration</h1>
          <p className="text-sm text-muted-foreground">Manage users, roles, and audit logs</p>
        </div>
      </div>

      {/* Create User */}
      <Card className="border-border/50 bg-card/60 backdrop-blur-xl">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2">
            <UserPlus className="h-4 w-4 text-primary" />
            <CardTitle className="text-base">Create User</CardTitle>
          </div>
          <CardDescription>Add a new user to the system</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="create-email">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="create-email"
                  placeholder="user@hospital.org"
                  type="email"
                  className="pl-9"
                  value={createForm.email}
                  onChange={(event) =>
                    setCreateForm((current) => ({ ...current, email: event.target.value }))
                  }
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-name">Full name</Label>
              <div className="relative">
                <UserIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="create-name"
                  placeholder="Dr. Jane Smith"
                  className="pl-9"
                  value={createForm.fullName}
                  onChange={(event) =>
                    setCreateForm((current) => ({ ...current, fullName: event.target.value }))
                  }
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-password">Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="create-password"
                  placeholder="••••••••"
                  type="password"
                  className="pl-9"
                  value={createForm.password}
                  onChange={(event) =>
                    setCreateForm((current) => ({ ...current, password: event.target.value }))
                  }
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <Select
                value={createForm.role}
                onValueChange={(value) =>
                  setCreateForm((current) => ({ ...current, role: value as UserRole }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.values(UserRole).map((role) => (
                    <SelectItem key={role} value={role}>
                      {role}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <Button
            className="mt-4 gap-1.5"
            onClick={() => createUserMutation.mutate()}
            disabled={
              createUserMutation.isPending ||
              !createForm.email ||
              !createForm.fullName ||
              !createForm.password
            }
          >
            <UserPlus className="h-4 w-4" />
            {createUserMutation.isPending ? 'Creating…' : 'Create user'}
          </Button>
        </CardContent>
      </Card>

      {/* Users Table */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-primary" />
          <h2 className="text-lg font-semibold tracking-tight">Users</h2>
        </div>

        {usersQuery.isLoading ? (
          <Card className="border-border/50 bg-card/60 p-1 backdrop-blur-xl">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 border-b border-border/50 px-4 py-3 last:border-0">
                <Skeleton className="h-4 w-36" />
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-5 w-20 rounded-full" />
                <Skeleton className="h-5 w-16 rounded-full" />
                <Skeleton className="h-8 w-24 rounded-md" />
              </div>
            ))}
          </Card>
        ) : null}
        {usersQuery.error ? (
          <Card className="border-border/50 bg-card/60 p-12 text-center backdrop-blur-xl">
            <AlertCircle className="mx-auto h-10 w-10 text-muted-foreground/50" />
            <p className="mt-3 text-sm text-muted-foreground">Unable to load users.</p>
          </Card>
        ) : null}
        {!usersQuery.isLoading && !usersQuery.error && users.length === 0 ? (
          <Card className="border-border/50 bg-card/60 p-12 text-center backdrop-blur-xl">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <Inbox className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="mt-4 text-sm font-medium">No users found</p>
          </Card>
        ) : null}

        {users.length > 0 ? (
          <Card className="overflow-hidden border-border/50 bg-card/60 backdrop-blur-xl">
            <Table>
              <TableHeader>
                <TableRow className="border-border/50 hover:bg-transparent">
                  <TableHead>Email</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[120px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((row) => (
                  <TableRow key={row.id} className="group border-border/30 transition-colors hover:bg-muted/50">
                    <TableCell className="font-mono text-xs">{row.email}</TableCell>
                    <TableCell className="font-medium">{row.fullName}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={roleConfig(row.role)}>
                        {row.role}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={
                          row.isActive
                            ? 'bg-success/15 text-success border-success/30'
                            : 'bg-muted text-muted-foreground border-border'
                        }
                      >
                        {row.isActive ? (
                          <CheckCircle2 className="mr-1 h-3 w-3" />
                        ) : (
                          <XCircle className="mr-1 h-3 w-3" />
                        )}
                        {row.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        variant={row.isActive ? 'ghost' : 'outline'}
                        className="h-7 gap-1 text-xs"
                        onClick={() =>
                          toggleUserMutation.mutate({ id: row.id, isActive: row.isActive })
                        }
                        disabled={toggleUserMutation.isPending}
                      >
                        {row.isActive ? (
                          <>
                            <XCircle className="h-3 w-3" />
                            Deactivate
                          </>
                        ) : (
                          <>
                            <CheckCircle2 className="h-3 w-3" />
                            Reactivate
                          </>
                        )}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        ) : null}
      </div>

      <Separator className="bg-border/50" />

      {/* Audit Logs */}
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <ScrollText className="h-4 w-4 text-primary" />
            <h2 className="text-lg font-semibold tracking-tight">Audit Logs</h2>
          </div>
          <Select
            value={auditAction || '__all__'}
            onValueChange={(value) => setAuditAction(value === '__all__' ? '' : value as AuditAction)}
          >
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="All actions" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All actions</SelectItem>
              {Object.values(AuditAction).map((action) => (
                <SelectItem key={action} value={action}>
                  {action}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {auditQuery.isLoading ? (
          <Card className="border-border/50 bg-card/60 p-1 backdrop-blur-xl">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 border-b border-border/50 px-4 py-3 last:border-0">
                <Skeleton className="h-4 w-36" />
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-32" />
              </div>
            ))}
          </Card>
        ) : null}
        {auditQuery.error ? (
          <Card className="border-border/50 bg-card/60 p-12 text-center backdrop-blur-xl">
            <AlertCircle className="mx-auto h-10 w-10 text-muted-foreground/50" />
            <p className="mt-3 text-sm text-muted-foreground">Unable to load audit events.</p>
          </Card>
        ) : null}
        {!auditQuery.isLoading && !auditQuery.error && audits.length === 0 ? (
          <Card className="border-border/50 bg-card/60 p-12 text-center backdrop-blur-xl">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <Inbox className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="mt-4 text-sm font-medium">No audit events found</p>
          </Card>
        ) : null}

        {audits.length > 0 ? (
          <Card className="overflow-hidden border-border/50 bg-card/60 backdrop-blur-xl">
            <Table>
              <TableHeader>
                <TableRow className="border-border/50 hover:bg-transparent">
                  <TableHead>Time</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Resource</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {audits.map((event) => (
                  <TableRow key={event.id} className="border-border/30 transition-colors hover:bg-muted/50">
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {new Date(event.createdAt).toISOString().replace('T', ' ').slice(0, 19)}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="bg-muted text-muted-foreground border-border">
                        {event.action}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {event.userId ?? '-'}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {event.resourceType ?? '-'} {event.resourceId ? event.resourceId.slice(0, 8) + '…' : ''}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        ) : null}
      </div>
    </div>
  );
}
