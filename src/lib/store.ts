// Central UI state store (Zustand): active view, sidebar, global search, command palette.

import { create } from "zustand";
import type { ViewKey } from "./types";

interface AppState {
  view: ViewKey;
  setView: (v: ViewKey) => void;

  sidebarCollapsed: boolean;
  toggleSidebar: () => void;

  commandOpen: boolean;
  setCommandOpen: (o: boolean) => void;

  // context params (e.g. open product id, model id for compatibility)
  contextId: string | null;
  setContextId: (id: string | null) => void;

  // global search query
  search: string;
  setSearch: (s: string) => void;

  // mobile sidebar open
  mobileNavOpen: boolean;
  setMobileNavOpen: (o: boolean) => void;
}

export const useAppStore = create<AppState>((set) => ({
  view: "home",
  setView: (v) => set({ view: v, contextId: null }),

  sidebarCollapsed: false,
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),

  commandOpen: false,
  setCommandOpen: (o) => set({ commandOpen: o }),

  contextId: null,
  setContextId: (id) => set({ contextId: id }),

  search: "",
  setSearch: (s) => set({ search: s }),

  mobileNavOpen: false,
  setMobileNavOpen: (o) => set({ mobileNavOpen: o }),
}));

// Keyboard shortcuts: Cmd/Ctrl+K opens command palette
if (typeof window !== "undefined") {
  window.addEventListener("keydown", (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
      e.preventDefault();
      useAppStore.getState().setCommandOpen(true);
    }
  });
}
