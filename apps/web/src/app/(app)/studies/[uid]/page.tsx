'use client';

import { use } from 'react';
import { CornerstoneViewer } from '@/components/viewer/cornerstone-viewer';

export default function StudyDetailPage({ params }: { params: Promise<{ uid: string }> }) {
  const { uid } = use(params);
  return (
    <main className="space-y-4">
      <h1 className="text-2xl font-semibold text-slate-100">Diagnostic Viewer</h1>
      <p className="text-sm text-slate-400">Study UID: {uid}</p>
      <CornerstoneViewer studyUid={uid} />
    </main>
  );
}
