import { create } from 'zustand';

interface ViewerState {
  activeToolName: string;
  windowWidth: number;
  windowCenter: number;
  setActiveTool: (tool: string) => void;
  setWindowLevel: (width: number, center: number) => void;
}

export const useViewerStore = create<ViewerState>((set) => ({
  activeToolName: 'WindowLevel',
  windowWidth: 400,
  windowCenter: 40,
  setActiveTool: (tool: string) => set({ activeToolName: tool }),
  setWindowLevel: (width: number, center: number) =>
    set({ windowWidth: width, windowCenter: center }),
}));
