'use client';

import { use, useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ReportStatus, UserRole } from '@radvault/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { RichTextEditor } from '@/components/editor/rich-text-editor';
import dynamic from 'next/dynamic';

const CornerstoneViewer = dynamic(
  () => import('@/components/viewer/cornerstone-viewer').then((m) => m.CornerstoneViewer),
  { ssr: false },
);
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import {
  FileText,
  Save,
  CheckCircle2,
  PenLine,
  Clock,
  AlertCircle,
  User,
  Calendar,
  Stethoscope,
  Hash,
  ShieldAlert,
} from 'lucide-react';

function dateOrDash(value: string | null | undefined): string {
  if (!value) {
    return '-';
  }

  return new Date(value).toISOString().slice(0, 10);
}

function reportStatusConfig(status: string) {
  switch (status) {
    case 'FINAL':
      return {
        icon: CheckCircle2,
        className: 'bg-success/15 text-success border-success/30',
        label: 'Final',
      };
    case 'PRELIMINARY':
      return {
        icon: PenLine,
        className: 'bg-info/15 text-info border-info/30',
        label: 'Preliminary',
      };
    case 'AMENDED':
      return {
        icon: PenLine,
        className: 'bg-warning/15 text-warning border-warning/30',
        label: 'Amended',
      };
    default:
      return {
        icon: Clock,
        className: 'bg-muted text-muted-foreground border-border',
        label: 'Draft',
      };
  }
}

export default function ReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const canEdit = user?.role === UserRole.Radiologist;

  const reportQuery = useQuery({
    queryKey: ['report', id],
    queryFn: () => api.reports.get(id),
  });

  const worklistContextQuery = useQuery({
    queryKey: ['report-study-context', reportQuery.data?.studyId],
    queryFn: async () => {
      const worklist = await api.worklist.list({ page: 1, limit: 100 });
      return worklist.data.find((item) => item.studyId === reportQuery.data?.studyId) ?? null;
    },
    enabled: Boolean(reportQuery.data?.studyId),
  });

  const [formState, setFormState] = useState({
    indication: '',
    technique: '',
    comparison: '',
    findings: '',
    impression: '',
  });
  const [lastSavedSnapshot, setLastSavedSnapshot] = useState('');
  const [saveState, setSaveState] = useState<'unsaved' | 'saving' | 'saved' | 'error'>('saved');

  useEffect(() => {
    if (!reportQuery.data) {
      return;
    }

    const snapshot = {
      indication: reportQuery.data.indication ?? '',
      technique: reportQuery.data.technique ?? '',
      comparison: reportQuery.data.comparison ?? '',
      findings: reportQuery.data.findings ?? '',
      impression: reportQuery.data.impression ?? '',
    };

    setFormState(snapshot);
    setLastSavedSnapshot(JSON.stringify(snapshot));
    setSaveState('saved');
  }, [reportQuery.data]);

  const updateMutation = useMutation({
    mutationFn: () => api.reports.update(id, formState),
    onMutate: () => {
      setSaveState('saving');
    },
    onSuccess: async (updated) => {
      const snapshot = {
        indication: updated.indication ?? '',
        technique: updated.technique ?? '',
        comparison: updated.comparison ?? '',
        findings: updated.findings ?? '',
        impression: updated.impression ?? '',
      };

      setLastSavedSnapshot(JSON.stringify(snapshot));
      setSaveState('saved');
      await queryClient.invalidateQueries({ queryKey: ['report', id] });
    },
    onError: () => {
      setSaveState('error');
    },
  });

  const signMutation = useMutation({
    mutationFn: (status: ReportStatus.Preliminary | ReportStatus.Final) =>
      api.reports.sign(id, status),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['report', id] });
      await queryClient.invalidateQueries({ queryKey: ['worklist'] });
    },
  });

  const handleSign = async (status: ReportStatus.Preliminary | ReportStatus.Final) => {
    if (updateMutation.isPending || signMutation.isPending) {
      return;
    }

    if (reportQuery.data?.status === ReportStatus.Draft && isDirty) {
      await updateMutation.mutateAsync();
    }

    signMutation.mutate(status);
  };

  const amendMutation = useMutation({
    mutationFn: () =>
      api.reports.amend(id, {
        findings: formState.findings,
        impression: formState.impression,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['report', id] });
      await queryClient.invalidateQueries({ queryKey: ['worklist'] });
    },
  });

  const isDirty = useMemo(
    () => JSON.stringify(formState) !== lastSavedSnapshot,
    [formState, lastSavedSnapshot],
  );

  useEffect(() => {
    if (!canEdit || reportQuery.data?.status !== ReportStatus.Draft) {
      return;
    }

    if (isDirty && saveState !== 'saving') {
      setSaveState('unsaved');
    }
  }, [canEdit, isDirty, reportQuery.data?.status, saveState]);

  useEffect(() => {
    if (!canEdit || reportQuery.data?.status !== ReportStatus.Draft) {
      return;
    }

    if (!isDirty || updateMutation.isPending) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      updateMutation.mutate();
    }, 1200);

    return () => window.clearTimeout(timeoutId);
  }, [canEdit, isDirty, reportQuery.data?.status, updateMutation]);

  if (user?.role === UserRole.Technologist) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Card className="border-border/50 bg-card/60 p-8 text-center backdrop-blur-xl">
          <ShieldAlert className="mx-auto h-10 w-10 text-muted-foreground/50" />
          <p className="mt-3 text-sm text-muted-foreground">
            You do not have permission to access reporting.
          </p>
        </Card>
      </div>
    );
  }

  const report = reportQuery.data;
  const context = worklistContextQuery.data;
  const sc = reportStatusConfig(report?.status ?? 'DRAFT');
  const StatusIcon = sc.icon;

  return (
    <div className="space-y-5 animate-in-fade">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/15">
            <FileText className="h-4 w-4 text-primary" />
          </div>
          <div>
            <h1 className="text-lg font-semibold tracking-tight">Report Editor</h1>
            <p className="font-mono text-xs text-muted-foreground">{id.slice(0, 8)}…</p>
          </div>
        </div>
        <Badge variant="outline" className={sc.className}>
          <StatusIcon className="mr-1 h-3 w-3" />
          {report?.status ?? 'Loading'}
        </Badge>
      </div>

      {/* Loading */}
      {reportQuery.isLoading ? (
        <div className="grid min-h-[500px] grid-cols-2 gap-4">
          <Skeleton className="rounded-xl" />
          <div className="space-y-4">
            <Skeleton className="h-20 rounded-xl" />
            <Skeleton className="h-32 rounded-xl" />
            <Skeleton className="h-32 rounded-xl" />
          </div>
        </div>
      ) : null}

      {/* Error */}
      {reportQuery.error ? (
        <Card className="border-border/50 bg-card/60 p-12 text-center backdrop-blur-xl">
          <AlertCircle className="mx-auto h-10 w-10 text-muted-foreground/50" />
          <p className="mt-3 text-sm text-muted-foreground">Unable to load report.</p>
          <Button
            variant="outline"
            size="sm"
            className="mt-4"
            onClick={() => reportQuery.refetch()}
          >
            Retry
          </Button>
        </Card>
      ) : null}

      {report ? (
        <div className="grid min-h-[760px] grid-cols-1 gap-4 lg:grid-cols-2">
          {/* Left — Viewer */}
          <Card className="overflow-hidden border-border/50 bg-card/60 p-0 backdrop-blur-xl">
            {context?.study.studyInstanceUid ? (
              <CornerstoneViewer
                studyUid={context.study.studyInstanceUid}
                showSeriesPanel={false}
              />
            ) : (
              <div className="flex h-full min-h-[400px] flex-col items-center justify-center gap-3 text-muted-foreground">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                  <AlertCircle className="h-6 w-6" />
                </div>
                <p className="text-sm">Study viewer unavailable for this report.</p>
              </div>
            )}
          </Card>

          {/* Right — Editor panel */}
          <div className="space-y-4">
            {/* Study context card */}
            <Card className="border-border/50 bg-card/60 p-4 backdrop-blur-xl">
              <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Study Context
              </p>
              <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <User className="h-3.5 w-3.5" />
                  <span>Patient</span>
                </div>
                <span className="font-medium">{context?.study.patient.patientName ?? '-'}</span>

                <div className="flex items-center gap-2 text-muted-foreground">
                  <Calendar className="h-3.5 w-3.5" />
                  <span>DOB</span>
                </div>
                <span>{dateOrDash(context?.study.patient.patientBirthDate)}</span>

                <div className="flex items-center gap-2 text-muted-foreground">
                  <Calendar className="h-3.5 w-3.5" />
                  <span>Study Date</span>
                </div>
                <span>{dateOrDash(context?.study.studyDate)}</span>

                <div className="flex items-center gap-2 text-muted-foreground">
                  <Stethoscope className="h-3.5 w-3.5" />
                  <span>Modality</span>
                </div>
                <span>{context?.study.modalitiesInStudy ?? '-'}</span>

                <div className="flex items-center gap-2 text-muted-foreground">
                  <Hash className="h-3.5 w-3.5" />
                  <span>Accession</span>
                </div>
                <span className="font-mono text-xs">{context?.study.accessionNumber ?? '-'}</span>
              </div>
            </Card>

            {/* Editor fields */}
            <Card className="border-border/50 bg-card/60 p-4 backdrop-blur-xl">
              <div className="space-y-4">
                {(
                  [
                    ['Indication', 'indication', 'Enter indication…'],
                    ['Technique', 'technique', 'Enter technique…'],
                    ['Comparison', 'comparison', 'Enter comparison…'],
                    ['Findings', 'findings', 'Enter findings…'],
                    ['Impression', 'impression', 'Enter impression…'],
                  ] as const
                ).map(([label, key, placeholder]) => (
                  <div key={key}>
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                      {label}
                    </label>
                    <RichTextEditor
                      value={formState[key]}
                      onChange={(html) => setFormState((current) => ({ ...current, [key]: html }))}
                      disabled={!canEdit || report.status !== ReportStatus.Draft}
                      placeholder={placeholder}
                    />
                  </div>
                ))}
              </div>
            </Card>

            {/* Action bar */}
            <Card className="border-border/50 bg-card/60 p-4 backdrop-blur-xl">
              <div className="flex flex-wrap items-center gap-2">
                {canEdit ? (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5"
                      onClick={() => void handleSign(ReportStatus.Preliminary)}
                      disabled={
                        updateMutation.isPending ||
                        signMutation.isPending ||
                        (report.status !== ReportStatus.Draft &&
                          report.status !== ReportStatus.Preliminary)
                      }
                    >
                      <PenLine className="h-3.5 w-3.5" />
                      Sign Preliminary
                    </Button>

                    <Button
                      size="sm"
                      className="gap-1.5"
                      onClick={() => void handleSign(ReportStatus.Final)}
                      disabled={
                        updateMutation.isPending ||
                        signMutation.isPending ||
                        report.status !== ReportStatus.Preliminary
                      }
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Sign Final
                    </Button>

                    {report.status === ReportStatus.Final ? (
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1.5"
                        onClick={() => amendMutation.mutate()}
                      >
                        <PenLine className="h-3.5 w-3.5" />
                        Amend
                      </Button>
                    ) : null}
                  </>
                ) : null}

                <div className="ml-auto flex items-center gap-2">
                  {updateMutation.isPending || saveState === 'saving' ? (
                    <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Save className="h-3 w-3 animate-pulse" />
                      Saving…
                    </span>
                  ) : saveState === 'error' ? (
                    <span className="flex items-center gap-1.5 text-xs text-destructive">
                      <AlertCircle className="h-3 w-3" />
                      Save failed
                    </span>
                  ) : isDirty ? (
                    <span className="flex items-center gap-1.5 text-xs text-warning">
                      <Clock className="h-3 w-3" />
                      Unsaved changes
                    </span>
                  ) : (
                    <span className="flex items-center gap-1.5 text-xs text-success">
                      <CheckCircle2 className="h-3 w-3" />
                      Saved
                    </span>
                  )}
                </div>
              </div>
            </Card>
          </div>
        </div>
      ) : null}
    </div>
  );
}
