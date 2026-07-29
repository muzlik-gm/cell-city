"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth-store";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Store, ArrowRight, Loader2, Building2 } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

export function BusinessOnboarding() {
  const { user, fetchUser } = useAuth();
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [handle, setHandle] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !handle) return;
    setLoading(true);
    try {
      await api.post("/business", { name, handle });
      // Refresh the auth session to pick up the new business
      await fetchUser();
      qc.invalidateQueries();
      toast.success("Business created! Welcome to your workspace.");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-emerald-50 via-background to-teal-50 p-4 dark:from-emerald-950/20 dark:via-background dark:to-teal-950/20">
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl gradient-emerald text-white shadow-lg">
            <Store className="h-8 w-8" />
          </div>
          <h1 className="mt-4 text-3xl font-bold tracking-tight">Create Your Business</h1>
          <p className="mt-1 text-center text-sm text-muted-foreground">
            Welcome, {user?.name}! Set up your spare parts business workspace.
          </p>
        </div>

        <form onSubmit={submit} className="space-y-4 rounded-2xl border bg-card p-6 shadow-lg">
          <div>
            <Label className="mb-1.5 block text-sm font-medium">Business Name</Label>
            <div className="relative">
              <Store className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  const h = e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
                  setHandle(h);
                }}
                placeholder="Cell City"
                className="h-12 pl-10"
                required
                maxLength={50}
              />
            </div>
          </div>
          <div>
            <Label className="mb-1.5 block text-sm font-medium">Business Handle</Label>
            <div className="relative">
              <Building2 className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={handle}
                onChange={(e) => setHandle(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                placeholder="cell-city"
                className="h-12 pl-10"
                required
                maxLength={40}
              />
            </div>
            <p className="mt-1.5 text-xs text-muted-foreground">
              Employees use this handle to sign in. Unique to your account.
            </p>
          </div>
          <Button type="submit" size="lg" className="h-12 w-full gap-2 text-base font-semibold" disabled={loading || !name || !handle}>
            {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <>
              Create Business <ArrowRight className="h-5 w-5" />
            </>}
          </Button>
        </form>
      </div>
    </div>
  );
}
