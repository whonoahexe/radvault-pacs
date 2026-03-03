'use client';

import { use, useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ReportStatus, UserRole } from '@radvault/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { RichTextEditor } from '@/components/editor/rich-text-editor';
import dynamic from 'next/dynamic';

const CornerstoneViewer = dynamic(
  () => import('@/components/viewer/cornerstone-viewer').then((m) => m.CornerstoneViewer),
  { ssr: false },
);
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';

function dateOrDash(value: string | null | undefined): string {
  if (!value) {
    return '-';
  }

  return new Date(value).toISOString().slice(0, 10);
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
  }, [reportQuery.data]);

  const updateMutation = useMutation({
    mutationFn: () => api.reports.update(id, formState),
    onSuccess: async (updated) => {
      const snapshot = {
        indication: updated.indication ?? '',
        technique: updated.technique ?? '',
        comparison: updated.comparison ?? '',
        findings: updated.findings ?? '',
        impression: updated.impression ?? '',
      };

      setLastSavedSnapshot(JSON.stringify(snapshot));
      await queryClient.invalidateQueries({ queryKey: ['report', id] });
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

    const intervalId = window.setInterval(() => {
      if (isDirty && !updateMutation.isPending) {
        updateMutation.mutate();
      }
    }, 30_000);

    return () => window.clearInterval(intervalId);
  }, [canEdit, isDirty, reportQuery.data?.status, updateMutation]);

  if (user?.role === UserRole.Technologist) {
    return <p className="text-slate-300">You do not have permission to access reporting.</p>;
  }

  const report = reportQuery.data;
  const context = worklistContextQuery.data;

  return (
    <main className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-slate-100">Reporting</h1>
        <Badge variant="secondary">{report?.status ?? 'Loading'}</Badge>
      </div>

      {reportQuery.isLoading ? <p className="text-slate-300">Loading report...</p> : null}
      {reportQuery.error ? <p className="text-slate-300">Unable to load report.</p> : null}

      {report ? (
        <div className="grid min-h-[760px] grid-cols-2 gap-3">
          <section className="rounded-md border border-slate-800 p-2">
            {context?.study.studyInstanceUid ? (
              <CornerstoneViewer
                studyUid={context.study.studyInstanceUid}
                showSeriesPanel={false}
              />
            ) : (
              <div className="grid h-full place-items-center text-sm text-slate-400">
                Study viewer unavailable for this report.
              </div>
            )}
          </section>

          <section className="space-y-3 rounded-md border border-slate-800 bg-slate-950/70 p-3">
            <div className="rounded-md border border-slate-800 p-3 text-sm text-slate-300">
              <p className="font-medium text-slate-100">Study context</p>
              <p>Patient: {context?.study.patient.patientName ?? '-'}</p>
              <p>DOB: {dateOrDash(context?.study.patient.patientBirthDate)}</p>
              <p>Study Date: {dateOrDash(context?.study.studyDate)}</p>
              <p>Modality: {context?.study.modalitiesInStudy ?? '-'}</p>
              <p>Accession: {context?.study.accessionNumber ?? '-'}</p>
            </div>

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
                <label className="mb-1 block text-sm text-slate-300">{label}</label>
                <RichTextEditor
                  value={formState[key]}
                  onChange={(html) => setFormState((current) => ({ ...current, [key]: html }))}
                  disabled={!canEdit || report.status !== ReportStatus.Draft}
                  placeholder={placeholder}
                />
              </div>
            ))}

            <div className="flex flex-wrap items-center gap-2">
              {canEdit ? (
                <>
                  <Button
                    variant="outline"
                    onClick={() => signMutation.mutate(ReportStatus.Preliminary)}
                    disabled={
                      report.status !== ReportStatus.Draft &&
                      report.status !== ReportStatus.Preliminary
                    }
                  >
                    Sign Preliminary
                  </Button>

                  <Button
                    variant="outline"
                    onClick={() => signMutation.mutate(ReportStatus.Final)}
                    disabled={report.status !== ReportStatus.Preliminary}
                  >
                    Sign Final
                  </Button>

                  {report.status === ReportStatus.Final ? (
                    <Button variant="outline" onClick={() => amendMutation.mutate()}>
                      Amend
                    </Button>
                  ) : null}
                </>
              ) : null}

              <span className="ml-auto text-xs text-slate-400">
                {updateMutation.isPending
                  ? 'Saving draft...'
                  : isDirty
                    ? 'Draft changes pending autosave'
                    : 'Draft saved'}
              </span>
            </div>
          </section>
        </div>
      ) : null}
    </main>
  );
}
