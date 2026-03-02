import { init as coreInit, RenderingEngine, Enums, type Types } from '@cornerstonejs/core';
import dicomImageLoader from '@cornerstonejs/dicom-image-loader';
import {
  addTool,
  init as toolsInit,
  LengthTool,
  PanTool,
  StackScrollTool,
  ToolGroupManager,
  ZoomTool,
} from '@cornerstonejs/tools';
import { useAuthStore } from '@/store/auth.store';

let initialized = false;
let toolsRegistered = false;

export type ViewerToolMode = 'pan' | 'zoom' | 'length';

export async function initializeCornerstone(): Promise<void> {
  if (initialized) {
    return;
  }

  await coreInit();
  dicomImageLoader.init({
    beforeSend: () => {
      const accessToken = useAuthStore.getState().accessToken;
      if (!accessToken) {
        return {} as Record<string, string>;
      }

      return {
        Authorization: `Bearer ${accessToken}`,
      } as Record<string, string>;
    },
  });
  await toolsInit();

  if (!toolsRegistered) {
    addTool(PanTool);
    addTool(ZoomTool);
    addTool(StackScrollTool);
    addTool(LengthTool);
    toolsRegistered = true;
  }

  initialized = true;
}

export function createRenderingEngine(renderingEngineId: string): RenderingEngine {
  return new RenderingEngine(renderingEngineId);
}

export function createViewportInput(
  viewportId: string,
  element: HTMLDivElement,
): Types.PublicViewportInput {
  return {
    viewportId,
    type: Enums.ViewportType.STACK,
    element,
  };
}

export function createToolGroup(toolGroupId: string) {
  const existing = ToolGroupManager.getToolGroup(toolGroupId);
  if (existing) {
    return existing;
  }

  const toolGroup = ToolGroupManager.createToolGroup(toolGroupId);
  if (!toolGroup) {
    throw new Error('Failed to create Cornerstone tool group');
  }

  toolGroup.addTool(PanTool.toolName);
  toolGroup.addTool(ZoomTool.toolName);
  toolGroup.addTool(StackScrollTool.toolName);
  toolGroup.addTool(LengthTool.toolName);

  return toolGroup;
}

export function destroyToolGroup(toolGroupId: string): void {
  ToolGroupManager.destroyToolGroup(toolGroupId);
}
