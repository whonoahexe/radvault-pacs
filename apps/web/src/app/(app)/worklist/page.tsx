'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { UserRole, WorklistPriority, WorklistStatus } from '@radvault/types';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectItem } from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

function formatDate(dateString: string | null): string {
  if (!dateString) {
    return '-';
  }

  return new Date(dateString).toISOString().slice(0, 10);
}

function priorityVariant(priority: WorklistPriority): 'destructive' | 'outline' | 'secondary' {
  if (priority === WorklistPriority.Stat) {
    return 'destructive';
  }
  if (priority === WorklistPriority.Urgent) {
    return 'outline';
  }
  return 'secondary';
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
    <main className="space-y-4">
      <h1 className="text-2xl font-semibold text-slate-100">Worklist</h1>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Select
          value={statusFilter}
          onValueChange={(value) => setStatusFilter(value as WorklistStatus | '')}
        >
          <SelectItem value="">All statuses</SelectItem>
          {Object.values(WorklistStatus).map((status) => (
            <SelectItem key={status} value={status}>
              {status}
            </SelectItem>
          ))}
        </Select>

        <Select
          value={priorityFilter}
          onValueChange={(value) => setPriorityFilter(value as WorklistPriority | '')}
        >
          <SelectItem value="">All priorities</SelectItem>
          {Object.values(WorklistPriority).map((priority) => (
            <SelectItem key={priority} value={priority}>
              {priority}
            </SelectItem>
          ))}
        </Select>
      </div>

      {worklistQuery.isLoading ? <p className="text-slate-300">Loading worklist...</p> : null}
      {worklistQuery.error ? (
        <p className="text-slate-300">Unable to load worklist right now.</p>
      ) : null}
      {!worklistQuery.isLoading && !worklistQuery.error && rows.length === 0 ? (
        <p className="text-slate-300">No worklist items match these filters.</p>
      ) : null}

      {rows.length > 0 ? (
        <div className="overflow-x-auto rounded-md border border-slate-800">
          <Table>
            <TableHeader>
              <TableRow>
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
              {rows.map((item) => (
                <TableRow
                  key={item.id}
                  className="cursor-pointer"
                  onClick={() => router.push(`/studies/${item.study.studyInstanceUid}`)}
                >
                  <TableCell>{item.study.patient.patientName}</TableCell>
                  <TableCell>{formatDate(item.study.studyDate)}</TableCell>
                  <TableCell>{item.study.modalitiesInStudy ?? '-'}</TableCell>
                  <TableCell>
                    <Badge variant={priorityVariant(item.priority)}>{item.priority}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">{item.status}</Badge>
                  </TableCell>
                  <TableCell>{item.assignedTo ?? '-'}</TableCell>
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
                            disabled={
                              item.status !== WorklistStatus.Scheduled ||
                              (Boolean(item.assignedTo) && item.assignedTo !== user.id) ||
                              claimMutation.isPending
                            }
                            onClick={() => claimMutation.mutate(item.id)}
                          >
                            Claim
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={
                              item.status !== WorklistStatus.InProgress ||
                              item.assignedTo !== user.id ||
                              unclaimMutation.isPending
                            }
                            onClick={() => unclaimMutation.mutate(item.id)}
                          >
                            Unclaim
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
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
                            Report
                          </Button>
                        </>
                      ) : null}

                      {user?.role === UserRole.Admin ? (
                        <Select
                          value=""
                          onValueChange={(value) => {
                            if (!value) {
                              return;
                            }
                            assignMutation.mutate({ id: item.id, assignedTo: value });
                          }}
                          disabled={assignMutation.isPending}
                        >
                          <SelectItem value="">Assign...</SelectItem>
                          {(usersQuery.data?.data ?? []).map((radiologist) => (
                            <SelectItem key={radiologist.id} value={radiologist.id}>
                              {radiologist.fullName}
                            </SelectItem>
                          ))}
                        </Select>
                      ) : null}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : null}
    </main>
  );
}
