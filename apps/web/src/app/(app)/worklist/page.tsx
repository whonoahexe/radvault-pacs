'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { UserRole, WorklistPriority, WorklistStatus } from '@radvault/types';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import {
  ClipboardList,
  Zap,
  AlertTriangle,
  Clock,
  ArrowRight,
  UserCheck,
  UserX,
  FileText,
  Inbox,
  AlertCircle,
} from 'lucide-react';

function formatDate(dateString: string | null): string {
  if (!dateString) {
    return '-';
  }

  return new Date(dateString).toISOString().slice(0, 10);
}

function priorityConfig(priority: WorklistPriority) {
  switch (priority) {
    case WorklistPriority.Stat:
      return {
        icon: Zap,
        className: 'bg-destructive/15 text-destructive border-destructive/30',
        rowClassName: 'border-l-2 border-l-destructive',
      };
    case WorklistPriority.Urgent:
      return {
        icon: AlertTriangle,
        className: 'bg-warning/15 text-warning border-warning/30',
        rowClassName: 'border-l-2 border-l-warning',
      };
    default:
      return {
        icon: Clock,
        className: 'bg-muted text-muted-foreground border-border',
        rowClassName: '',
      };
  }
}

function statusConfig(status: string) {
  switch (status) {
    case WorklistStatus.Final:
    case WorklistStatus.Amended:
      return 'bg-success/15 text-success border-success/30';
    case WorklistStatus.Preliminary:
      return 'bg-warning/15 text-warning border-warning/30';
    case WorklistStatus.InProgress:
      return 'bg-info/15 text-info border-info/30';
    case WorklistStatus.Scheduled:
      return 'bg-muted text-muted-foreground border-border';
    default:
      return 'bg-muted text-muted-foreground border-border';
  }
}

export default function WorklistPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const [statusFilter, setStatusFilter] = useState<WorklistStatus | ''>('');
  const [priorityFilter, setPriorityFilter] = useState<WorklistPriority | ''>('');

  const worklistQuery = useQuery({
    queryKey: ['worklist', { statusFilter, priorityFilter }],
    queryFn: () =>
      api.worklist.list({
        status: statusFilter || undefined,
        priority: priorityFilter || undefined,
        page: 1,
        limit: 100,
      }),
  });

  const usersQuery = useQuery({
    queryKey: ['admin-users-radiologists'],
    queryFn: () => api.admin.users({ page: 1, limit: 100, role: UserRole.Radiologist }),
    enabled: user?.role === UserRole.Admin,
  });

  const claimMutation = useMutation({
    mutationFn: (id: string) => api.worklist.status(id, WorklistStatus.InProgress),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['worklist'] });
    },
  });

  const unclaimMutation = useMutation({
    mutationFn: (id: string) => api.worklist.unclaim(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['worklist'] });
    },
  });

  const assignMutation = useMutation({
    mutationFn: ({ id, assignedTo }: { id: string; assignedTo: string }) =>
      api.worklist.assign(id, assignedTo),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['worklist'] });
    },
  });

  const rows = worklistQuery.data?.data ?? [];

  return (
    <div className="space-y-6 animate-in-fade">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/15">
          <ClipboardList className="h-4 w-4 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Worklist</h1>
          <p className="text-sm text-muted-foreground">Manage and prioritize reading assignments</p>
        </div>
      </div>

      {/* Filters */}
      <Card className="border-border/50 bg-card/60 p-4 backdrop-blur-xl">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Select
            value={statusFilter || '__all__'}
            onValueChange={(value) => setStatusFilter(value === '__all__' ? '' : value as WorklistStatus)}
          >
            <SelectTrigger>
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All statuses</SelectItem>
              {Object.values(WorklistStatus).map((status) => (
                <SelectItem key={status} value={status}>
                  {status}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={priorityFilter || '__all__'}
            onValueChange={(value) => setPriorityFilter(value === '__all__' ? '' : value as WorklistPriority)}
          >
            <SelectTrigger>
              <SelectValue placeholder="All priorities" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All priorities</SelectItem>
              {Object.values(WorklistPriority).map((priority) => (
                <SelectItem key={priority} value={priority}>
                  {priority}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </Card>

      {/* Loading */}
      {worklistQuery.isLoading ? (
        <Card className="border-border/50 bg-card/60 p-1 backdrop-blur-xl">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 border-b border-border/50 px-4 py-3 last:border-0">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-5 w-12 rounded-full" />
              <Skeleton className="h-5 w-16 rounded-full" />
              <Skeleton className="h-5 w-16 rounded-full" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-8 w-20 rounded-md" />
            </div>
          ))}
        </Card>
      ) : null}

      {/* Error */}
      {worklistQuery.error ? (
        <Card className="border-border/50 bg-card/60 p-12 text-center backdrop-blur-xl">
          <AlertCircle className="mx-auto h-10 w-10 text-muted-foreground/50" />
          <p className="mt-3 text-sm text-muted-foreground">Unable to load worklist right now.</p>
          <Button variant="outline" size="sm" className="mt-4" onClick={() => worklistQuery.refetch()}>
            Retry
          </Button>
        </Card>
      ) : null}

      {/* Empty */}
      {!worklistQuery.isLoading && !worklistQuery.error && rows.length === 0 ? (
        <Card className="border-border/50 bg-card/60 p-12 text-center backdrop-blur-xl">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-muted">
            <Inbox className="h-6 w-6 text-muted-foreground" />
          </div>
          <p className="mt-4 text-sm font-medium">No worklist items</p>
          <p className="mt-1 text-sm text-muted-foreground">
            No items match these filters. Try adjusting your selection.
          </p>
        </Card>
      ) : null}

      {/* Table */}
      {rows.length > 0 ? (
        <Card className="overflow-hidden border-border/50 bg-card/60 backdrop-blur-xl">
          <Table>
            <TableHeader>
              <TableRow className="border-border/50 hover:bg-transparent">
                <TableHead>Patient</TableHead>
                <TableHead>Study Date</TableHead>
                <TableHead>Modality</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Assigned To</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((item) => {
                const pConfig = priorityConfig(item.priority);
                const PriorityIcon = pConfig.icon;

                return (
                  <TableRow
                    key={item.id}
                    className={cn(
                      'group cursor-pointer border-border/30 transition-colors hover:bg-muted/50',
                      pConfig.rowClassName,
                    )}
                    onClick={() => router.push(`/studies/${item.study.studyInstanceUid}`)}
                  >
                    <TableCell className="font-medium">{item.study.patient.patientName}</TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {formatDate(item.study.studyDate)}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="bg-muted text-muted-foreground border-border">
                        {item.study.modalitiesInStudy ?? '-'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={pConfig.className}>
                        <PriorityIcon className="mr-1 h-3 w-3" />
                        {item.priority}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={statusConfig(item.status)}>
                        <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-current" />
                        {item.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {item.assignedTo ? (
                        <span className="flex items-center gap-1.5">
                          <UserCheck className="h-3.5 w-3.5 text-success" />
                          {item.assignedTo}
                        </span>
                      ) : (
                        <span className="text-muted-foreground/60">Unassigned</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div
                        className="flex flex-wrap items-center gap-2"
                        onClick={(event) => event.stopPropagation()}
                      >
                        {user?.role === UserRole.Radiologist ? (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 gap-1 text-xs"
                              disabled={
                                item.status !== WorklistStatus.Scheduled ||
                                (Boolean(item.assignedTo) && item.assignedTo !== user.id) ||
                                claimMutation.isPending
                              }
                              onClick={() => claimMutation.mutate(item.id)}
                            >
                              <UserCheck className="h-3 w-3" />
                              Claim
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 gap-1 text-xs"
                              disabled={
                                item.status !== WorklistStatus.InProgress ||
                                item.assignedTo !== user.id ||
                                unclaimMutation.isPending
                              }
                              onClick={() => unclaimMutation.mutate(item.id)}
                            >
                              <UserX className="h-3 w-3" />
                              Unclaim
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 gap-1 text-xs"
                              onClick={async () => {
                                const existing = await api.reports.list(item.studyId);
                                if (existing.length > 0) {
                                  router.push(`/reports/${existing[0].id}`);
                                  return;
                                }

                                const created = await api.reports.create({
                                  studyId: item.studyId,
                                  indication: '',
                                  technique: '',
                                  comparison: '',
                                  findings: '',
                                  impression: '',
                                });
                                router.push(`/reports/${created.id}`);
                              }}
                            >
                              <FileText className="h-3 w-3" />
                              Report
                            </Button>
                          </>
                        ) : null}

                        {user?.role === UserRole.Admin ? (
                          <Select
                            value=""
                            onValueChange={(value) => {
                              if (!value || value === '__placeholder__') {
                                return;
                              }
                              assignMutation.mutate({ id: item.id, assignedTo: value });
                            }}
                            disabled={assignMutation.isPending}
                          >
                            <SelectTrigger className="h-7 w-[140px] text-xs">
                              <SelectValue placeholder="Assign…" />
                            </SelectTrigger>
                            <SelectContent>
                              {(usersQuery.data?.data ?? []).map((radiologist) => (
                                <SelectItem key={radiologist.id} value={radiologist.id}>
                                  {radiologist.fullName}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : null}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      ) : null}
    </div>
  );
}
