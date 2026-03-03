'use client';

import { useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { UserRole, WorklistStatus } from '@radvault/types';
import { api, type DicomStudy, type WorklistItemWithStudy } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
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

const MODALITIES = ['', 'CT', 'MR', 'US', 'CR', 'DX', 'MG', 'NM', 'PT'] as const;

function formatDateToDicom(date: string): string {
  return date.replaceAll('-', '');
}

function formatDicomDate(date: string | null | undefined): string {
  if (!date || date.length !== 8) {
    return '-';
  }

  return `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}`;
}

export default function StudiesPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const user = useAuthStore((state) => state.user);

  const [patientName, setPatientName] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [modality, setModality] = useState('');
  const [sortBy, setSortBy] = useState<'date_desc' | 'date_asc' | 'name_asc'>('date_desc');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const studyDate = useMemo(() => {
    if (!dateFrom || !dateTo) {
      return undefined;
    }

    return `${formatDateToDicom(dateFrom)}-${formatDateToDicom(dateTo)}`;
  }, [dateFrom, dateTo]);

  const studiesQuery = useQuery({
    queryKey: ['studies', { patientName, studyDate, modality, page, limit, sortBy }],
    queryFn: async () => {
      const datasets = await api.studies.query({
        PatientName: patientName || undefined,
        StudyDate: studyDate,
        ModalitiesInStudy: modality || undefined,
        page,
        limit,
      });

      const mapped = datasets.map((dataset) => api.dicom.toStudy(dataset));

      if (sortBy === 'date_asc') {
        mapped.sort((a, b) => (a.studyDate ?? '').localeCompare(b.studyDate ?? ''));
      } else if (sortBy === 'name_asc') {
        const getName = (s: DicomStudy) => {
          const tag = s.dicomTags?.['00100010'] as
            | { Value?: Array<{ Alphabetic?: string } | string> }
            | undefined;
          const first = tag?.Value?.[0];
          return (typeof first === 'string' ? first : (first?.Alphabetic ?? '')).toLowerCase();
        };
        mapped.sort((a, b) => getName(a).localeCompare(getName(b)));
      }
      // date_desc is the default API order, no re-sort needed

      return mapped;
    },
  });

  const worklistQuery = useQuery({
    queryKey: ['worklist-status-map'],
    queryFn: async () => {
      const response = await api.worklist.list({ page: 1, limit: 100 });
      const statusMap = new Map<string, WorklistItemWithStudy['status']>();
      response.data.forEach((item) => {
        statusMap.set(item.study.studyInstanceUid, item.status);
      });
      return statusMap;
    },
  });

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => api.studies.stow(file),
    onSuccess: async () => {
      setUploadError(null);
      await queryClient.invalidateQueries({ queryKey: ['studies'] });
      await queryClient.invalidateQueries({ queryKey: ['worklist-status-map'] });
    },
    onError: () => {
      setUploadError('Upload failed. Ensure this is a valid DICOM .dcm file and try again.');
    },
  });

  const canUpload = user?.role === UserRole.Admin || user?.role === UserRole.Technologist;
  const studies = studiesQuery.data ?? [];

  return (
    <main className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold text-slate-100">Studies</h1>
        {canUpload ? (
          <>
            <input
              ref={fileInputRef}
              type="file"
              accept=".dcm"
              className="hidden"
              onChange={async (event) => {
                const file = event.target.files?.[0];
                if (!file) {
                  return;
                }
                await uploadMutation.mutateAsync(file);
                event.target.value = '';
              }}
            />
            <Button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadMutation.isPending}
            >
              {uploadMutation.isPending ? 'Uploading...' : 'Upload DICOM'}
            </Button>
          </>
        ) : null}
      </div>

      <div className="grid grid-cols-1 gap-3 xl:grid-cols-6">
        <Input
          placeholder="Patient name"
          value={patientName}
          onChange={(event) => {
            setPatientName(event.target.value);
            setPage(1);
          }}
        />
        <Input
          type="date"
          value={dateFrom}
          onChange={(event) => {
            setDateFrom(event.target.value);
            setPage(1);
          }}
        />
        <Input
          type="date"
          value={dateTo}
          onChange={(event) => {
            setDateTo(event.target.value);
            setPage(1);
          }}
        />
        <Select
          value={modality}
          onValueChange={(value) => {
            setModality(value);
            setPage(1);
          }}
        >
          {MODALITIES.map((item) => (
            <SelectItem key={item || 'all'} value={item}>
              {item || 'All modalities'}
            </SelectItem>
          ))}
        </Select>
        <Select
          value={sortBy}
          onValueChange={(value) => {
            setSortBy(value as 'date_desc' | 'date_asc' | 'name_asc');
            setPage(1);
          }}
        >
          <SelectItem value="date_desc">Date (newest)</SelectItem>
          <SelectItem value="date_asc">Date (oldest)</SelectItem>
          <SelectItem value="name_asc">Patient (A-Z)</SelectItem>
        </Select>
        <Select
          value={String(limit)}
          onValueChange={(value) => {
            setLimit(Number(value));
            setPage(1);
          }}
        >
          <SelectItem value="10">10 / page</SelectItem>
          <SelectItem value="20">20 / page</SelectItem>
          <SelectItem value="50">50 / page</SelectItem>
        </Select>
      </div>

      {uploadError ? <p className="text-sm text-red-300">{uploadError}</p> : null}

      {studiesQuery.isLoading ? <p className="text-slate-300">Loading studies...</p> : null}
      {studiesQuery.error ? (
        <p className="text-slate-300">Unable to load studies right now.</p>
      ) : null}

      {!studiesQuery.isLoading && !studiesQuery.error && studies.length === 0 ? (
        <p className="text-slate-300">No studies found for the selected filters.</p>
      ) : null}

      {studies.length > 0 ? (
        <div className="overflow-x-auto rounded-md border border-slate-800">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Thumbnail</TableHead>
                <TableHead>Patient Name</TableHead>
                <TableHead>Study Date</TableHead>
                <TableHead>Modality</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Accession</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {studies.map((study: DicomStudy) => {
                const patientNameData = study.dicomTags?.['00100010'] as
                  | { Value?: Array<{ Alphabetic?: string } | string> }
                  | undefined;
                const firstPatientName = patientNameData?.Value?.[0];
                const patientNameValue =
                  typeof firstPatientName === 'string'
                    ? firstPatientName
                    : (firstPatientName?.Alphabetic ?? 'Unknown');

                const status =
                  worklistQuery.data?.get(study.studyInstanceUid) ?? WorklistStatus.Scheduled;

                return (
                  <TableRow
                    key={study.studyInstanceUid}
                    className="cursor-pointer"
                    onClick={() => router.push(`/studies/${study.studyInstanceUid}`)}
                  >
                    <TableCell>
                      {study.thumbnailPath ? (
                        <img
                          src={study.thumbnailPath}
                          alt="Study thumbnail"
                          className="h-10 w-10 rounded object-cover"
                        />
                      ) : (
                        <div className="grid h-10 w-10 place-items-center rounded border border-slate-700 text-xs text-slate-400">
                          N/A
                        </div>
                      )}
                    </TableCell>
                    <TableCell>{patientNameValue}</TableCell>
                    <TableCell>{formatDicomDate(study.studyDate)}</TableCell>
                    <TableCell>{study.modalitiesInStudy ?? '-'}</TableCell>
                    <TableCell>{study.studyDescription ?? '-'}</TableCell>
                    <TableCell>{study.accessionNumber ?? '-'}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{status}</Badge>
                    </TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={(event) => {
                          event.stopPropagation();
                          router.push(`/studies/${study.studyInstanceUid}`);
                        }}
                      >
                        Open
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      ) : null}

      <div className="flex items-center justify-end gap-2">
        <Button
          variant="outline"
          onClick={() => setPage((current) => Math.max(1, current - 1))}
          disabled={page === 1}
        >
          Previous
        </Button>
        <span className="text-sm text-slate-300">Page {page}</span>
        <Button
          variant="outline"
          onClick={() => setPage((current) => current + 1)}
          disabled={studies.length < limit}
        >
          Next
        </Button>
      </div>
    </main>
  );
}
