'use client';

import { CornerstoneViewer } from '@/components/viewer/cornerstone-viewer';

export default function StudyDetailPage({ params }: { params: { uid: string } }) {
  return (
    <main className="space-y-4">
      <h1 className="text-2xl font-semibold text-slate-100">Diagnostic Viewer</h1>
      <p className="text-sm text-slate-400">Study UID: {params.uid}</p>
      <CornerstoneViewer studyUid={params.uid} />
    </main>
  );
}
