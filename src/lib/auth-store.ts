"use client";

import { create } from "zustand";
import { api } from "./api";

export interface AuthResult {
  type: "app_user" | "employee";
  id: string;
  username: string;
  name: string;
  email?: string;
  phone?: string | null;
  avatarUrl?: string | null;
  business?: {
    id: string;
    name: string;
    handle: string;
    plan: string;
  };
  rank?: string;
  businesses?: { id: string; name: string; handle: string; plan: string }[];
}

interface AuthState {
  user: AuthResult | null;
  loading: boolean;
  error: string | null;
  fetchUser: () => Promise<void>;
  registerAppUser: (opts: { username: string; email: string; password: string; name: string; phone?: string }) => Promise<AuthResult>;
  loginAppUser: (identifier: string, password: string) => Promise<AuthResult>;
  loginEmployee: (businessHandle: string, username: string, password: string) => Promise<AuthResult>;
  switchBusiness: (businessId: string) => Promise<void>;
  logout: () => Promise<void>;
  clearError: () => void;
}

export const useAuth = create<AuthState>((set, get) => ({
  user: null,
  loading: true,
  error: null,

  fetchUser: async () => {
    try {
      const res = await api.get<{ user: AuthResult | null }>("/auth/me");
      set({ user: res.user, loading: false, error: null });
    } catch (e) {
      set({ user: null, loading: false, error: (e as Error).message });
    }
  },

  registerAppUser: async (opts) => {
    try {
      const res = await api.post<{ user: AuthResult }>("/auth/register", opts);
      // Set user immediately from the response — don't rely on a separate fetch
      set({ user: res.user, error: null });
      return res.user;
    } catch (e) {
      const msg = (e as Error).message;
      set({ error: msg });
      throw new Error(msg);
    }
  },

  loginAppUser: async (identifier, password) => {
    try {
      const res = await api.post<{ user: AuthResult }>("/auth/login", { identifier, password });
      set({ user: res.user, error: null });
      return res.user;
    } catch (e) {
      const msg = (e as Error).message;
      set({ error: msg });
      throw new Error(msg);
    }
  },

  loginEmployee: async (businessHandle, username, password) => {
    try {
      const res = await api.post<{ user: AuthResult }>("/auth/employee-login", { businessHandle, username, password });
      set({ user: res.user, error: null });
      return res.user;
    } catch (e) {
      const msg = (e as Error).message;
      set({ error: msg });
      throw new Error(msg);
    }
  },

  switchBusiness: async (businessId) => {
    try {
      const res = await api.post<{ user: AuthResult }>("/auth/switch-business", { businessId });
      set({ user: res.user, error: null });
    } catch (e) {
      set({ error: (e as Error).message });
      throw e;
    }
  },

  logout: async () => {
    try {
      await api.post("/auth/logout");
    } catch {
      // ignore — cookie is cleared client-side anyway
    }
    set({ user: null, error: null });
  },

  clearError: () => set({ error: null }),
}));
