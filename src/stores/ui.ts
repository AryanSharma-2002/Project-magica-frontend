import { create } from "zustand";

/**
 * UI-only state: sidebar chrome, artifact panel, command palette.
 * Small cache; nothing here is the source of truth for server data.
 */
export type UiState = {
  /** Mobile sidebar sheet open/closed. */
  sidebarOpen: boolean;
  /** Desktop sidebar collapsed to a rail. */
  sidebarCollapsed: boolean;
  artifactPanelOpen: boolean;
  artifactSelectedUrl: string | null;
  commandPaletteOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  toggleSidebarCollapsed: () => void;
  setArtifactPanelOpen: (open: boolean) => void;
  /** Open the artifact panel, optionally focusing a specific asset url. */
  openArtifact: (url?: string | null) => void;
  closeArtifact: () => void;
  setCommandPaletteOpen: (open: boolean) => void;
};

export const useUiStore = create<UiState>((set) => ({
  sidebarOpen: false,
  sidebarCollapsed: false,
  artifactPanelOpen: false,
  artifactSelectedUrl: null,
  commandPaletteOpen: false,
  setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),
  setSidebarCollapsed: (sidebarCollapsed) => set({ sidebarCollapsed }),
  toggleSidebarCollapsed: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
  setArtifactPanelOpen: (artifactPanelOpen) => set({ artifactPanelOpen }),
  openArtifact: (url) => set({ artifactPanelOpen: true, artifactSelectedUrl: url ?? null }),
  closeArtifact: () => set({ artifactPanelOpen: false }),
  setCommandPaletteOpen: (commandPaletteOpen) => set({ commandPaletteOpen }),
}));
