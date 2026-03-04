'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Enums as csToolsEnums } from '@cornerstonejs/tools';
import dicomImageLoader from '@cornerstonejs/dicom-image-loader';
import { type DicomSeries, type DicomInstance, api } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import {
  createRenderingEngine,
  createToolGroup,
  createViewportInput,
  destroyToolGroup,
  initializeCornerstone,
  type ViewerToolMode,
} from '@/lib/cornerstone';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface CornerstoneViewerProps {
  studyUid: string;
  className?: string;
  showSeriesPanel?: boolean;
}

const PRESETS = [
  { label: 'Lung', lower: -1350, upper: 150 },
  { label: 'Bone', lower: -600, upper: 1400 },
  { label: 'Soft Tissue', lower: -160, upper: 240 },
  { label: 'Brain', lower: 0, upper: 80 },
] as const;

export function CornerstoneViewer({
  studyUid,
  className,
  showSeriesPanel = true,
}: CornerstoneViewerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const renderingEngineRef = useRef<ReturnType<typeof createRenderingEngine> | null>(null);
  const toolGroupIdRef = useRef(`toolgroup-${Math.random().toString(36).slice(2)}`);
  const viewportIdRef = useRef(`viewport-${Math.random().toString(36).slice(2)}`);
  const renderingEngineIdRef = useRef(`engine-${Math.random().toString(36).slice(2)}`);
  const [toolMode, setToolMode] = useState<ViewerToolMode>('pan');
  const [selectedSeriesUid, setSelectedSeriesUid] = useState<string | null>(null);
  const [isViewerInitialized, setIsViewerInitialized] = useState(false);
  const [viewerError, setViewerError] = useState<string | null>(null);
  const [isLoadingImage, setIsLoadingImage] = useState(false);

  const seriesQuery = useQuery({
    queryKey: ['viewer-series', studyUid],
    queryFn: async () => {
      const datasets = await api.studies.series(studyUid);
      return datasets.map((dataset) => api.dicom.toSeries(dataset, studyUid));
    },
  });

  useEffect(() => {
    if (!selectedSeriesUid && seriesQuery.data && seriesQuery.data.length > 0) {
      setSelectedSeriesUid(seriesQuery.data[0].seriesInstanceUid);
    }
  }, [selectedSeriesUid, seriesQuery.data]);

  const instancesQuery = useQuery({
    queryKey: ['viewer-instances', studyUid, selectedSeriesUid],
    queryFn: async () => {
      if (!selectedSeriesUid) {
        return [] as DicomInstance[];
      }
      const datasets = await api.studies.instances(studyUid, selectedSeriesUid);
      return datasets.map((dataset) => api.dicom.toInstance(dataset, selectedSeriesUid));
    },
    enabled: Boolean(selectedSeriesUid),
  });

  const wadoRoot = useMemo(() => {
    return process.env.NEXT_PUBLIC_ORTHANC_WADO_URL || `${window.location.origin}/api/dicom-web`;
  }, []);

  const imageIds = useMemo(() => {
    if (!selectedSeriesUid || !instancesQuery.data) {
      return [] as string[];
    }

    return instancesQuery.data.map((instance) => {
      return `wadors:${wadoRoot}/studies/${studyUid}/series/${selectedSeriesUid}/instances/${instance.sopInstanceUid}/frames/1`;
    });
  }, [instancesQuery.data, selectedSeriesUid, studyUid, wadoRoot]);

  useEffect(() => {
    const setup = async () => {
      if (!containerRef.current) {
        return;
      }

      await initializeCornerstone();

      const renderingEngine = createRenderingEngine(renderingEngineIdRef.current);
      renderingEngine.enableElement(
        createViewportInput(viewportIdRef.current, containerRef.current),
      );
      renderingEngineRef.current = renderingEngine;

      const toolGroup = createToolGroup(toolGroupIdRef.current);
      toolGroup.addViewport(viewportIdRef.current, renderingEngineIdRef.current);
      toolGroup.setToolActive('StackScroll', {
        bindings: [{ mouseButton: csToolsEnums.MouseBindings.Wheel }],
      });

      setToolMode('pan');
      setIsViewerInitialized(true);
    };

    void setup();

    return () => {
      renderingEngineRef.current?.destroy();
      destroyToolGroup(toolGroupIdRef.current);
    };
  }, []);

  useEffect(() => {
    if (!isViewerInitialized) {
      return;
    }

    const toolGroup = createToolGroup(toolGroupIdRef.current);

    toolGroup.setToolPassive('Pan');
    toolGroup.setToolPassive('Zoom');
    toolGroup.setToolPassive('Length');

    if (toolMode === 'pan') {
      toolGroup.setToolActive('Pan', {
        bindings: [{ mouseButton: csToolsEnums.MouseBindings.Primary }],
      });
    }
    if (toolMode === 'zoom') {
      toolGroup.setToolActive('Zoom', {
        bindings: [{ mouseButton: csToolsEnums.MouseBindings.Primary }],
      });
    }
    if (toolMode === 'length') {
      toolGroup.setToolActive('Length', {
        bindings: [{ mouseButton: csToolsEnums.MouseBindings.Primary }],
      });
    }
  }, [toolMode, isViewerInitialized]);

  useEffect(() => {
    const applyStack = async () => {
      if (!isViewerInitialized || !renderingEngineRef.current || imageIds.length === 0 || !selectedSeriesUid) {
        return;
      }

      setViewerError(null);
      setIsLoadingImage(true);

      // Fetch and register WADO-RS metadata so the decoder knows
      // pixel format (samplesPerPixel, rows, columns, bitsAllocated, etc.)
      let metadataRegistered = 0;
      try {
        const accessToken = useAuthStore.getState().accessToken;
        const metadataUrl = `${wadoRoot}/studies/${studyUid}/series/${selectedSeriesUid}/metadata`;
        const headers: Record<string, string> = { Accept: 'application/dicom+json' };
        if (accessToken) {
          headers.Authorization = `Bearer ${accessToken}`;
        }

        const metaResponse = await fetch(metadataUrl, { headers });
        if (metaResponse.ok) {
          const instanceMetadataList = await metaResponse.json();
          for (const instanceMeta of instanceMetadataList) {
            // SOP Instance UID = tag (0008,0018)
            const sopInstanceUid = instanceMeta['00080018']?.Value?.[0];
            if (sopInstanceUid) {
              const imageId = `wadors:${wadoRoot}/studies/${studyUid}/series/${selectedSeriesUid}/instances/${sopInstanceUid}/frames/1`;
              dicomImageLoader.wadors.metaDataManager.add(imageId, instanceMeta);
              metadataRegistered++;
            }
          }
        } else {
          console.warn(`WADO-RS metadata fetch returned ${metaResponse.status}. DICOM pixel data may not be available in the imaging server for this study.`);
          setViewerError(
            `This study does not have imaging data available (server returned ${metaResponse.status}). The study may only contain metadata without pixel data.`
          );
          setIsLoadingImage(false);
          return;
        }
      } catch (err) {
        console.error('Failed to fetch WADO-RS metadata:', err);
        setViewerError('Failed to connect to the imaging server. Please try refreshing the page.');
        setIsLoadingImage(false);
        return;
      }

      if (metadataRegistered === 0) {
        setViewerError('No image metadata could be loaded for this series. The DICOM data may be incomplete.');
        setIsLoadingImage(false);
        return;
      }

      try {
        const viewport = renderingEngineRef.current.getViewport(viewportIdRef.current) as unknown as {
          setStack: (ids: string[]) => Promise<void>;
          render: () => void;
        };

        await viewport.setStack(imageIds);
        viewport.render();
        setViewerError(null);
      } catch (err) {
        console.error('Failed to render DICOM image stack:', err);
        setViewerError('Failed to render the image. The DICOM data may be in an unsupported format.');
      } finally {
        setIsLoadingImage(false);
      }
    };

    void applyStack();
  }, [imageIds, selectedSeriesUid, studyUid, wadoRoot, isViewerInitialized]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!renderingEngineRef.current) {
        return;
      }

      if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') {
        return;
      }

      const viewport = renderingEngineRef.current.getViewport(viewportIdRef.current) as unknown as {
        getCurrentImageIdIndex: () => number;
        getImageIds: () => string[];
        setImageIdIndex: (index: number) => Promise<void>;
      };

      const current = viewport.getCurrentImageIdIndex();
      const imageIdList = viewport.getImageIds();
      const nextIndex =
        event.key === 'ArrowUp'
          ? Math.max(0, current - 1)
          : Math.min(imageIdList.length - 1, current + 1);

      void viewport.setImageIdIndex(nextIndex);
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const applyPreset = (preset: (typeof PRESETS)[number]) => {
    if (!renderingEngineRef.current) {
      return;
    }

    const viewport = renderingEngineRef.current.getViewport(viewportIdRef.current) as unknown as {
      setProperties: (properties: { voiRange: { lower: number; upper: number } }) => void;
      render: () => void;
    };

    viewport.setProperties({
      voiRange: {
        lower: preset.lower,
        upper: preset.upper,
      },
    });
    viewport.render();
  };

  return (
    <div
      className={cn(
        'grid h-full min-h-[520px] grid-cols-[240px_1fr] gap-3',
        !showSeriesPanel && 'grid-cols-1',
        className,
      )}
    >
      {showSeriesPanel ? (
        <aside className="overflow-y-auto rounded-md border border-slate-800 bg-slate-950/70 p-2">
          <p className="mb-2 text-sm font-medium text-slate-200">Series</p>
          {seriesQuery.isLoading ? (
            <p className="text-sm text-slate-400">Loading series...</p>
          ) : null}
          {seriesQuery.error ? (
            <p className="text-sm text-slate-400">Unable to load series.</p>
          ) : null}
          {seriesQuery.data?.length === 0 ? (
            <p className="text-sm text-slate-400">No series available.</p>
          ) : null}

          <div className="space-y-2">
            {(seriesQuery.data ?? []).map((series: DicomSeries) => (
              <button
                key={series.seriesInstanceUid}
                className={cn(
                  'w-full rounded-md border border-slate-800 px-3 py-2 text-left text-sm text-slate-200 hover:bg-slate-800',
                  selectedSeriesUid === series.seriesInstanceUid ? 'bg-slate-800' : '',
                )}
                onClick={() => setSelectedSeriesUid(series.seriesInstanceUid)}
              >
                <p>{series.seriesDescription ?? 'Unnamed series'}</p>
                <p className="text-xs text-slate-400">
                  {series.modality ?? 'N/A'} · {series.numberOfInstances} images
                </p>
              </button>
            ))}
          </div>
        </aside>
      ) : null}

      <section className="space-y-3">
        <div className="flex flex-wrap items-center gap-2 rounded-md border border-slate-800 bg-slate-950/70 p-2">
          {PRESETS.map((preset) => (
            <Button
              key={preset.label}
              size="sm"
              variant="outline"
              onClick={() => applyPreset(preset)}
            >
              {preset.label}
            </Button>
          ))}

          <div className="mx-2 h-5 w-px bg-slate-700" />

          <Button
            size="sm"
            variant={toolMode === 'pan' ? 'default' : 'outline'}
            onClick={() => setToolMode('pan')}
          >
            Pan
          </Button>
          <Button
            size="sm"
            variant={toolMode === 'zoom' ? 'default' : 'outline'}
            onClick={() => setToolMode('zoom')}
          >
            Zoom
          </Button>
          <Button
            size="sm"
            variant={toolMode === 'length' ? 'default' : 'outline'}
            onClick={() => setToolMode('length')}
          >
            Length
          </Button>
          <span className="ml-auto text-xs text-slate-400">
            Scroll: mouse wheel / ArrowUp / ArrowDown
          </span>
        </div>

        {instancesQuery.isLoading ? (
          <p className="text-sm text-slate-300">Loading images...</p>
        ) : null}
        {instancesQuery.error ? (
          <p className="text-sm text-slate-300">Unable to load image instances.</p>
        ) : null}
        {!instancesQuery.isLoading && imageIds.length === 0 ? (
          <p className="text-sm text-slate-300">No image frames available for this series.</p>
        ) : null}

        <div className="relative h-[680px] rounded-md border border-slate-800 bg-black">
          <div ref={containerRef} className="absolute inset-0" />
          {viewerError ? (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/80">
              <div className="max-w-md rounded-lg border border-red-800/50 bg-red-950/50 p-6 text-center">
                <p className="text-sm font-medium text-red-300">{viewerError}</p>
              </div>
            </div>
          ) : null}
          {isLoadingImage ? (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/60">
              <p className="text-sm text-slate-300 animate-pulse">Loading DICOM image...</p>
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}
