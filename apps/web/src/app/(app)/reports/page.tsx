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
import { api } from '@/lib/api';

export default function ReportsIndexPage() {
  const reportsQuery = useQuery({
    queryKey: ['reports-index'],
    queryFn: () => api.reports.list(),
  });

  const reports = reportsQuery.data ?? [];

  return (
    <main className="space-y-4">
      <h1 className="text-2xl font-semibold text-slate-100">Reports</h1>

      {reportsQuery.isLoading ? <p className="text-slate-300">Loading reports...</p> : null}
      {reportsQuery.error ? <p className="text-slate-300">Unable to load reports.</p> : null}
      {!reportsQuery.isLoading && !reportsQuery.error && reports.length === 0 ? (
        <p className="text-slate-300">No reports available.</p>
      ) : null}

      {reports.length > 0 ? (
        <div className="overflow-x-auto rounded-md border border-slate-800">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Author</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {reports.map((report) => (
                <TableRow key={report.id}>
                  <TableCell>{report.id}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{report.status}</Badge>
                  </TableCell>
                  <TableCell>{report.author?.fullName ?? '-'}</TableCell>
                  <TableCell>{new Date(report.createdAt).toISOString().slice(0, 10)}</TableCell>
                  <TableCell>
                    <Link href={`/reports/${report.id}`}>
                      <Button variant="outline" size="sm">
                        Open
                      </Button>
                    </Link>
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
