"use client";

import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAppStore } from "@/lib/store";
import { useMounted } from "@/hooks/use-mounted";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCurrency, initials } from "@/lib/format";
import {
  Users,
  X,
  Loader2,
  Phone,
  UserPlus,
  ShoppingCart,
  Wrench,
  ArrowLeft,
  ChevronRight,
} from "lucide-react";

/**
 * Customer quick-search — a Google-Search-like lookup for the home hero.
 *
 * Debounced (200ms) search of `/api/customers?q=`. Results appear in a
 * dropdown: avatar initials, name, phone, and outstanding balance (if any).
 * Clicking a customer reveals two quick-action buttons — "New Sale" and
 * "New Repair" — so you can start a transaction in two clicks. Prefills the
 * customer id into the store's contextId for the target view to consume.
 * Empty state offers a shortcut to Settings to add a new customer.
 */

interface Customer {
  id: string;
  name: string;
  phone?: string | null;
  company?: string | null;
  outstandingBalance?: number;
  _count?: { sales: number; repairJobs: number };
}

export function CustomerQuickSearch() {
  const mounted = useMounted();
  const setView = useAppStore((s) => s.setView);
  const setContextId = useAppStore((s) => s.setContextId);

  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [open, setOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Debounce 200ms
  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 200);
    return () => clearTimeout(t);
  }, [query]);

  // Click-outside closes the dropdown + deselects
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
        setSelectedId(null);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["customer-quick-search", debounced],
    queryFn: () =>
      api.get<Customer[]>(`/customers?q=${encodeURIComponent(debounced)}`),
    enabled: mounted && debounced.length > 0,
    staleTime: 30_000,
  });

  const results = data ?? [];
  const hasResults = results.length > 0;
  const showDropdown = open && debounced.length > 0;
  const selected =
    results.find((c) => c.id === selectedId) ?? null;

  const reset = () => {
    setQuery("");
    setDebounced("");
    setSelectedId(null);
    setOpen(false);
  };

  const startFlow = (view: "sales" | "repairs", customerId: string) => {
    setView(view);
    // setView resets contextId, so set it AFTER to prefill the target view.
    setContextId(customerId);
    reset();
  };

  return (
    <div ref={containerRef} className="relative mx-auto w-full max-w-2xl">
      {/* Search input */}
      <div className="relative">
        <Users className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-primary" />
        <Input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setSelectedId(null);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder="Find a customer — name, phone, or company…"
          className="h-12 rounded-xl border-2 pl-10 pr-10 text-sm shadow-soft focus-visible:border-primary"
          autoComplete="off"
          aria-label="Quick customer search"
        />
        {isFetching && debounced ? (
          <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
        ) : query ? (
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setDebounced("");
              setSelectedId(null);
            }}
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-muted-foreground transition hover:bg-muted"
            aria-label="Clear customer search"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        ) : null}
      </div>

      {/* Dropdown */}
      {showDropdown && (
        <Card className="absolute z-30 mt-2 max-h-[22rem] w-full overflow-hidden p-0 shadow-lg">
          {isLoading ? (
            <div className="space-y-1 p-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className="flex h-12 items-center gap-3 rounded-lg px-2"
                >
                  <div className="h-8 w-8 shrink-0 animate-pulse rounded-full bg-muted/60" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-3 w-1/3 animate-pulse rounded bg-muted/60" />
                    <div className="h-2.5 w-1/4 animate-pulse rounded bg-muted/40" />
                  </div>
                </div>
              ))}
            </div>
          ) : !hasResults ? (
            <div className="flex flex-col items-center gap-2 px-4 py-6 text-center">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                <Users className="h-5 w-5" />
              </span>
              <p className="text-sm font-semibold">No customers found</p>
              <p className="text-xs text-muted-foreground">
                Try a different name or phone number.
              </p>
              <button
                type="button"
                onClick={() => {
                  setView("settings");
                  reset();
                }}
                className="mt-1 inline-flex items-center gap-1.5 rounded-lg bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary transition hover:bg-primary/20"
              >
                <UserPlus className="h-3.5 w-3.5" />
                Add customer
              </button>
            </div>
          ) : selected ? (
            /* Selected-customer panel with quick actions */
            <div className="p-2">
              <button
                type="button"
                onClick={() => setSelectedId(null)}
                className="mb-2 flex w-full items-center gap-3 rounded-lg p-2 text-left transition hover:bg-accent/40"
              >
                <ArrowLeft className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="text-xs font-medium text-muted-foreground">
                  Back to results
                </span>
              </button>

              <div className="flex items-center gap-3 rounded-lg bg-primary/5 p-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/15 text-sm font-bold text-primary">
                  {initials(selected.name) || "?"}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">
                    {selected.name}
                  </p>
                  <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                    {selected.phone && (
                      <span className="flex items-center gap-1">
                        <Phone className="h-3 w-3" />
                        {selected.phone}
                      </span>
                    )}
                    {Number(selected.outstandingBalance ?? 0) > 0 && (
                      <Badge
                        variant="outline"
                        className="border-rose-500/30 bg-rose-500/10 text-[10px] font-semibold text-rose-600 dark:text-rose-400"
                      >
                        Due {formatCurrency(selected.outstandingBalance ?? 0)}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>

              <div className="mt-2 grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  onClick={() => startFlow("sales", selected.id)}
                  className="h-10 gap-1.5 rounded-lg text-sm font-semibold shadow-soft"
                >
                  <ShoppingCart className="h-4 w-4" />
                  New Sale
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => startFlow("repairs", selected.id)}
                  className="h-10 gap-1.5 rounded-lg text-sm font-semibold"
                >
                  <Wrench className="h-4 w-4" />
                  New Repair
                </Button>
              </div>
            </div>
          ) : (
            <ul className="max-h-[22rem] divide-y overflow-y-auto">
              {results.slice(0, 8).map((c) => {
                const due = Number(c.outstandingBalance ?? 0);
                return (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(c.id)}
                      className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition hover:bg-accent/40"
                    >
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                        {initials(c.name) || "?"}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">
                          {c.name}
                          {c.company && (
                            <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                              · {c.company}
                            </span>
                          )}
                        </p>
                        <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                          {c.phone ? (
                            <span className="flex items-center gap-1">
                              <Phone className="h-3 w-3" />
                              {c.phone}
                            </span>
                          ) : (
                            <span>No phone</span>
                          )}
                        </div>
                      </div>
                      {due > 0 && (
                        <Badge
                          variant="outline"
                          className="shrink-0 border-rose-500/30 bg-rose-500/10 text-[10px] font-semibold text-rose-600 dark:text-rose-400"
                        >
                          Due {formatCurrency(due)}
                        </Badge>
                      )}
                      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/50" />
                    </button>
                  </li>
                );
              })}
              {results.length > 8 && (
                <li className="px-3 py-2 text-center text-[11px] text-muted-foreground">
                  +{results.length - 8} more — refine your search
                </li>
              )}
            </ul>
          )}
        </Card>
      )}
    </div>
  );
}
