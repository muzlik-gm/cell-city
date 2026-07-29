// Lightweight API client + React Query hooks factory.
// All requests use relative paths (gateway-friendly).

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

const BASE = "/api";

export async function apiFetch<T = unknown>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    credentials: "include", // Always send cookies with API requests
    headers: {
      "Content-Type": "application/json",
      ...(options.headers as Record<string, string>),
    },
  });
  if (!res.ok) {
    let msg = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      msg = body.error || msg;
    } catch {
      /* ignore */
    }
    throw new Error(msg);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const api = {
  get: <T>(path: string) => apiFetch<T>(path),
  post: <T>(path: string, body?: unknown) =>
    apiFetch<T>(path, { method: "POST", body: body ? JSON.stringify(body) : undefined }),
  put: <T>(path: string, body?: unknown) =>
    apiFetch<T>(path, { method: "PUT", body: body ? JSON.stringify(body) : undefined }),
  patch: <T>(path: string, body?: unknown) =>
    apiFetch<T>(path, { method: "PATCH", body: body ? JSON.stringify(body) : undefined }),
  del: <T>(path: string) => apiFetch<T>(path, { method: "DELETE" }),
};

// Generic list hook
export function useList<T>(key: string, path: string, enabled = true) {
  return useQuery({
    queryKey: [key, path],
    queryFn: () => api.get<T>(path),
    enabled,
    staleTime: 30_000,
  });
}

// Generic create hook
export function useCreate<T = unknown>(key: string, path: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: unknown) => api.post<T>(path, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [key] });
      toast.success("Created successfully");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpdate<T = unknown>(key: string, basePath: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: Record<string, unknown> & { id: string }) =>
      api.put<T>(`${basePath}/${id}`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [key] });
      toast.success("Updated successfully");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDelete(key: string, basePath: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.del(`${basePath}/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [key] });
      toast.success("Deleted successfully");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
