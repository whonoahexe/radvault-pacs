'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
import { api } from '@/lib/api';
import {
  FileText,
  ExternalLink,
  Inbox,
  AlertCircle,
  CheckCircle2,
  Clock,
  PenLine,
} from 'lucide-react';

function reportStatusConfig(status: string) {
  switch (status) {
    case 'FINAL':
      return {
        icon: CheckCircle2,
        className: 'bg-success/15 text-success border-success/30',
      };
    case 'PRELIMINARY':
      return {
        icon: PenLine,
        className: 'bg-info/15 text-info border-info/30',
      };
    case 'DRAFT':
      return {
        icon: Clock,
        className: 'bg-muted text-muted-foreground border-border',
      };
    case 'AMENDED':
      return {
        icon: PenLine,
        className: 'bg-warning/15 text-warning border-warning/30',
      };
    default:
      return {
        icon: Clock,
        className: 'bg-muted text-muted-foreground border-border',
      };
  }
}

export default function ReportsIndexPage() {
  const reportsQuery = useQuery({
    queryKey: ['reports-index'],
    queryFn: () => api.reports.list(),
  });

  const reports = reportsQuery.data ?? [];

  return (
    <div className="space-y-6 animate-in-fade">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/15">
          <FileText className="h-4 w-4 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Reports</h1>
          <p className="text-sm text-muted-foreground">View and manage radiology reports</p>
        </div>
      </div>

      {/* Loading */}
      {reportsQuery.isLoading ? (
        <Card className="border-border/50 bg-card/60 p-1 backdrop-blur-xl">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 border-b border-border/50 px-4 py-3 last:border-0">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-5 w-20 rounded-full" />
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-8 w-16 rounded-md" />
            </div>
          ))}
        </Card>
      ) : null}

      {/* Error */}
      {reportsQuery.error ? (
        <Card className="border-border/50 bg-card/60 p-12 text-center backdrop-blur-xl">
          <AlertCircle className="mx-auto h-10 w-10 text-muted-foreground/50" />
          <p className="mt-3 text-sm text-muted-foreground">Unable to load reports.</p>
          <Button variant="outline" size="sm" className="mt-4" onClick={() => reportsQuery.refetch()}>
            Retry
          </Button>
        </Card>
      ) : null}

      {/* Empty */}
      {!reportsQuery.isLoading && !reportsQuery.error && reports.length === 0 ? (
        <Card className="border-border/50 bg-card/60 p-12 text-center backdrop-blur-xl">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-muted">
            <Inbox className="h-6 w-6 text-muted-foreground" />
          </div>
          <p className="mt-4 text-sm font-medium">No reports available</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Reports will appear here once studies have been read.
          </p>
        </Card>
      ) : null}

      {/* Table */}
      {reports.length > 0 ? (
        <Card className="overflow-hidden border-border/50 bg-card/60 backdrop-blur-xl">
          <Table>
            <TableHeader>
              <TableRow className="border-border/50 hover:bg-transparent">
                <TableHead>ID</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Author</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="w-[80px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {reports.map((report) => {
                const sc = reportStatusConfig(report.status);
                const StatusIcon = sc.icon;

                return (
                  <TableRow
                    key={report.id}
                    className="group border-border/30 transition-colors hover:bg-muted/50"
                  >
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {report.id.slice(0, 8)}…
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={sc.className}>
                        <StatusIcon className="mr-1 h-3 w-3" />
                        {report.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{report.author?.fullName ?? '-'}</TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {new Date(report.createdAt).toISOString().slice(0, 10)}
                    </TableCell>
                    <TableCell>
                      <Link href={`/reports/${report.id}`}>
                        <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-xs opacity-0 transition-opacity group-hover:opacity-100">
                          <ExternalLink className="h-3.5 w-3.5" />
                          Open
                        </Button>
                      </Link>
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
