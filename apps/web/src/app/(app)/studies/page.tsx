'use client';

import { useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { UserRole, WorklistStatus } from '@radvault/types';
import { api, type DicomStudy, type WorklistItemWithStudy } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DatePicker } from '@/components/ui/date-picker';
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
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Upload,
  Search,
  ChevronLeft,
  ChevronRight,
  ImageIcon,
  Eye,
  AlertCircle,
  Inbox,
} from 'lucide-react';

const MODALITIES = ['', 'CT', 'MR', 'US', 'CR', 'DX', 'MG', 'NM', 'PT'] as const;

function formatDateToDicom(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}${month}${day}`;
}

function formatDicomDate(date: string | null | undefined): string {
  if (!date || date.length !== 8) {
    return '-';
  }

  return `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}`;
}

function modalityColor(mod: string | null | undefined): string {
  switch (mod) {
    case 'CT':
      return 'bg-blue-500/15 text-blue-400 border-blue-500/30';
    case 'MR':
      return 'bg-violet-500/15 text-violet-400 border-violet-500/30';
    case 'US':
      return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
    case 'CR':
    case 'DX':
      return 'bg-amber-500/15 text-amber-400 border-amber-500/30';
    case 'MG':
      return 'bg-pink-500/15 text-pink-400 border-pink-500/30';
    case 'NM':
    case 'PT':
      return 'bg-orange-500/15 text-orange-400 border-orange-500/30';
    default:
      return 'bg-muted text-muted-foreground border-border';
  }
}

function statusColor(status: string): string {
  switch (status) {
    case WorklistStatus.Final:
      return 'bg-success/15 text-success border-success/30';
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

function TableSkeleton() {
  return (
    <Card className="border-border/50 bg-card/60 backdrop-blur-xl">
      <div className="p-1">
        <div className="space-y-0">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="flex items-center gap-4 border-b border-border/50 px-4 py-3 last:border-0"
            >
              <Skeleton className="h-10 w-10 rounded-md" />
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-5 w-12 rounded-full" />
              <Skeleton className="h-4 w-40 flex-1" />
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-5 w-16 rounded-full" />
              <Skeleton className="h-8 w-16 rounded-md" />
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}

export default function StudiesPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const user = useAuthStore((state) => state.user);

  const [patientName, setPatientName] = useState('');
  const [dateFrom, setDateFrom] = useState<Date | undefined>();
  const [dateTo, setDateTo] = useState<Date | undefined>();
  const [modality, setModality] = useState('');
  const [sortBy, setSortBy] = useState<'date_desc' | 'date_asc' | 'name_asc'>('date_desc');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);

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

  const handleUploadFile = async (file: File) => {
    await uploadMutation.mutateAsync(file);
  };

  const handleDrop = async (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragOver(false);

    if (!canUpload || uploadMutation.isPending) {
      return;
    }

    const file = event.dataTransfer.files?.[0];
    if (!file) {
      return;
    }

    await handleUploadFile(file);
  };

  const canUpload = user?.role === UserRole.Admin || user?.role === UserRole.Technologist;
  const studies = studiesQuery.data ?? [];

  return (
    <div
      className="space-y-6 animate-in-fade"
      onDrop={(event) => {
        void handleDrop(event);
      }}
      onDragOver={(event) => {
        if (!canUpload) {
          return;
        }
        event.preventDefault();
      }}
      onDragEnter={(event) => {
        if (!canUpload) {
          return;
        }
        event.preventDefault();
        setIsDragOver(true);
      }}
      onDragLeave={(event) => {
        if (!canUpload) {
          return;
        }
        if (event.currentTarget.contains(event.relatedTarget as Node | null)) {
          return;
        }
        setIsDragOver(false);
      }}
    >
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Studies</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Browse and manage DICOM imaging studies
          </p>
        </div>
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
                await handleUploadFile(file);
                event.target.value = '';
              }}
            />
            <Button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadMutation.isPending}
              className="gap-2"
            >
              <Upload className="h-4 w-4" />
              {uploadMutation.isPending ? 'Uploading…' : 'Upload DICOM'}
            </Button>
          </>
        ) : null}
      </div>

      {canUpload ? (
        <Card
          className={[
            'border-border/50 bg-card/60 p-4 text-sm text-muted-foreground backdrop-blur-xl transition-colors',
            isDragOver ? 'border-primary bg-primary/5 text-foreground' : '',
          ].join(' ')}
        >
          Drop a `.dcm` file anywhere on this page to upload.
        </Card>
      ) : null}

      {/* Filter Bar */}
      <Card className="border-border/50 bg-card/60 p-4 backdrop-blur-xl">
        <div className="flex flex-wrap items-end gap-3">
          <div className="relative min-w-[260px] flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Patient name…"
              className="pl-9"
              value={patientName}
              onChange={(event) => {
                setPatientName(event.target.value);
                setPage(1);
              }}
            />
          </div>
          <div className="w-[170px] space-y-1">
            <p className="text-xs text-muted-foreground">From</p>
            <DatePicker
              className="w-[170px]"
              value={dateFrom}
              maxDate={dateTo}
              placeholder="From date"
              onChange={(date) => {
                setDateFrom(date);
                setPage(1);
              }}
            />
          </div>
          <div className="w-[170px] space-y-1">
            <p className="text-xs text-muted-foreground">To</p>
            <DatePicker
              className="w-[170px]"
              value={dateTo}
              minDate={dateFrom}
              placeholder="To date"
              onChange={(date) => {
                setDateTo(date);
                setPage(1);
              }}
            />
          </div>
          <div className="w-[180px]">
            <Select
              value={modality}
              onValueChange={(value) => {
                setModality(value === '__all__' ? '' : value);
                setPage(1);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="All modalities" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">All modalities</SelectItem>
                {MODALITIES.filter(Boolean).map((item) => (
                  <SelectItem key={item} value={item}>
                    {item}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="w-[180px]">
            <Select
              value={sortBy}
              onValueChange={(value) => {
                setSortBy(value as 'date_desc' | 'date_asc' | 'name_asc');
                setPage(1);
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="date_desc">Date (newest)</SelectItem>
                <SelectItem value="date_asc">Date (oldest)</SelectItem>
                <SelectItem value="name_asc">Patient (A-Z)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="w-[140px]">
            <Select
              value={String(limit)}
              onValueChange={(value) => {
                setLimit(Number(value));
                setPage(1);
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="10">10 / page</SelectItem>
                <SelectItem value="20">20 / page</SelectItem>
                <SelectItem value="50">50 / page</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button
            variant="ghost"
            className="h-9"
            onClick={() => {
              setDateFrom(undefined);
              setDateTo(undefined);
              setPage(1);
            }}
            disabled={!dateFrom && !dateTo}
          >
            Clear dates
          </Button>
        </div>
      </Card>

      {uploadError ? (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {uploadError}
        </div>
      ) : null}

      {/* Loading skeleton */}
      {studiesQuery.isLoading ? <TableSkeleton /> : null}

      {/* Error state */}
      {studiesQuery.error ? (
        <Card className="border-border/50 bg-card/60 p-12 text-center backdrop-blur-xl">
          <AlertCircle className="mx-auto h-10 w-10 text-muted-foreground/50" />
          <p className="mt-3 text-sm text-muted-foreground">Unable to load studies right now.</p>
          <Button
            variant="outline"
            size="sm"
            className="mt-4"
            onClick={() => studiesQuery.refetch()}
          >
            Retry
          </Button>
        </Card>
      ) : null}

      {/* Empty state */}
      {!studiesQuery.isLoading && !studiesQuery.error && studies.length === 0 ? (
        <Card className="border-border/50 bg-card/60 p-12 text-center backdrop-blur-xl">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-muted">
            <Inbox className="h-6 w-6 text-muted-foreground" />
          </div>
          <p className="mt-4 text-sm font-medium">No studies found</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Try adjusting your filters or upload a new DICOM file.
          </p>
        </Card>
      ) : null}

      {/* Data Table */}
      {studies.length > 0 ? (
        <Card className="overflow-hidden border-border/50 bg-card/60 backdrop-blur-xl">
          <Table>
            <TableHeader>
              <TableRow className="border-border/50 hover:bg-transparent">
                <TableHead className="w-[60px]">Thumb</TableHead>
                <TableHead>Patient Name</TableHead>
                <TableHead>Study Date</TableHead>
                <TableHead>Modality</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Accession</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[80px]">Actions</TableHead>
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
                    className="group cursor-pointer border-border/30 transition-colors hover:bg-muted/50"
                    onClick={() => router.push(`/studies/${study.studyInstanceUid}`)}
                  >
                    <TableCell>
                      {study.thumbnailPath ? (
                        <img
                          src={study.thumbnailPath}
                          alt="Study thumbnail"
                          className="h-10 w-10 rounded-md border border-border/50 object-cover"
                        />
                      ) : (
                        <div className="flex h-10 w-10 items-center justify-center rounded-md border border-border/50 bg-muted/50">
                          <ImageIcon className="h-4 w-4 text-muted-foreground" />
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="font-medium">{patientNameValue}</TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {formatDicomDate(study.studyDate)}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={modalityColor(study.modalitiesInStudy)}>
                        {study.modalitiesInStudy ?? '-'}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate text-muted-foreground">
                      {study.studyDescription ?? '-'}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {study.accessionNumber ?? '-'}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={statusColor(status)}>
                        <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-current" />
                        {status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 w-8 p-0 opacity-0 transition-opacity group-hover:opacity-100"
                        onClick={(event) => {
                          event.stopPropagation();
                          router.push(`/studies/${study.studyInstanceUid}`);
                        }}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      ) : null}

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Page {page}
          {studies.length > 0 ? ` · ${studies.length} results` : ''}
        </p>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((current) => Math.max(1, current - 1))}
            disabled={page === 1}
            className="gap-1"
          >
            <ChevronLeft className="h-4 w-4" />
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((current) => current + 1)}
            disabled={studies.length < limit}
            className="gap-1"
          >
            Next
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
