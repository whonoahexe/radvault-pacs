'use client';

import { use } from 'react';
import dynamic from 'next/dynamic';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Monitor, Copy } from 'lucide-react';

const CornerstoneViewer = dynamic(
  () => import('@/components/viewer/cornerstone-viewer').then((m) => m.CornerstoneViewer),
  { ssr: false },
);

export default function StudyDetailPage({ params }: { params: Promise<{ uid: string }> }) {
  const { uid } = use(params);
  return (
    <div className="space-y-4 animate-in-fade">
      {/* Viewer header bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/15">
            <Monitor className="h-4 w-4 text-primary" />
          </div>
          <div>
            <h1 className="text-lg font-semibold tracking-tight">Diagnostic Viewer</h1>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="font-mono text-xs text-muted-foreground truncate max-w-[300px]">
                {uid}
              </span>
              <button
                type="button"
                onClick={() => navigator.clipboard.writeText(uid)}
                className="text-muted-foreground hover:text-foreground transition-colors"
                title="Copy Study UID"
              >
                <Copy className="h-3 w-3" />
              </button>
            </div>
          </div>
        </div>
        <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30">
          <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-current status-pulse" />
          Live
        </Badge>
      </div>

      <Separator className="bg-border/50" />

      {/* Viewer container */}
      <Card className="overflow-hidden border-border/50 bg-card/60 backdrop-blur-xl p-0">
        <div className="min-h-[calc(100vh-220px)]">
          <CornerstoneViewer studyUid={uid} />
        </div>
      </Card>
    </div>
  );
}
