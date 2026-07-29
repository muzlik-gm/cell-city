"use client";

import { create } from "zustand";
import { api } from "./api";

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  phone?: string | null;
  avatarUrl?: string | null;
  companies: { id: string; name: string; slug: string; rank: string; plan: string }[];
  activeCompany?: { id: string; name: string; slug: string; rank: string; plan: string } | null;
}

interface AuthState {
  user: AuthUser | null;
  loading: boolean;
  fetchUser: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  register: (opts: { companyName: string; ownerName: string; ownerEmail: string; ownerPassword: string; ownerPhone?: string }) => Promise<void>;
  logout: () => Promise<void>;
}

export const useAuth = create<AuthState>((set) => ({
  user: null,
  loading: true,
  fetchUser: async () => {
    try {
      const res = await api.get<{ user: AuthUser | null }>("/auth/me");
      set({ user: res.user, loading: false });
    } catch {
      set({ user: null, loading: false });
    }
  },
  login: async (email, password) => {
    const res = await api.post<{ user: AuthUser }>("/auth/login", { email, password });
    set({ user: res.user });
  },
  register: async (opts) => {
    const res = await api.post<{ user: AuthUser }>("/auth/register", opts);
    set({ user: res.user });
  },
  logout: async () => {
    await api.post("/auth/logout");
    set({ user: null });
  },
}));
