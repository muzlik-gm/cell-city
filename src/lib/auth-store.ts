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
  fetchUser: () => Promise<void>;
  registerAppUser: (opts: { username: string; email: string; password: string; name: string; phone?: string }) => Promise<void>;
  loginAppUser: (identifier: string, password: string) => Promise<void>;
  loginEmployee: (businessHandle: string, username: string, password: string) => Promise<void>;
  switchBusiness: (businessId: string) => Promise<void>;
  logout: () => Promise<void>;
}

export const useAuth = create<AuthState>((set) => ({
  user: null,
  loading: true,
  fetchUser: async () => {
    try {
      const res = await api.get<{ user: AuthResult | null }>("/auth/me");
      set({ user: res.user, loading: false });
    } catch {
      set({ user: null, loading: false });
    }
  },
  registerAppUser: async (opts) => {
    const res = await api.post<{ user: AuthResult }>("/auth/register", opts);
    set({ user: res.user });
  },
  loginAppUser: async (identifier, password) => {
    const res = await api.post<{ user: AuthResult }>("/auth/login", { identifier, password });
    set({ user: res.user });
  },
  loginEmployee: async (businessHandle, username, password) => {
    const res = await api.post<{ user: AuthResult }>("/auth/employee-login", { businessHandle, username, password });
    set({ user: res.user });
  },
  switchBusiness: async (businessId) => {
    const res = await api.post<{ user: AuthResult }>("/auth/switch-business", { businessId });
    set({ user: res.user });
  },
  logout: async () => {
    await api.post("/auth/logout");
    set({ user: null });
  },
}));
