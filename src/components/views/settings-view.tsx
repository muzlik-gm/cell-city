"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/shared/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useTheme } from "next-themes";
import { toast } from "sonner";
import { Settings as SettingsIcon, Building2, Users, Database, Palette, Save, Download, Sun, Moon, Monitor } from "lucide-react";
import { useMounted } from "@/hooks/use-mounted";

export function SettingsView() {
  const mounted = useMounted();
  const { theme, setTheme } = useTheme();

  const settings = useQuery({
    queryKey: ["settings"],
    queryFn: () => api.get<Record<string, string>>("/settings"),
  });

  // Keyed remount of the form body: the inner component initializes its form
  // state lazily from the fetched settings, avoiding setState-in-effect.
  return (
    <SettingsBody
      key={settings.data ? "loaded" : "loading"}
      initialSettings={settings.data}
      isLoading={settings.isLoading}
      mounted={mounted}
      currentTheme={theme}
      setTheme={setTheme}
    />
  );
}

function SettingsBody({
  initialSettings,
  isLoading,
  mounted,
  currentTheme,
  setTheme,
}: {
  initialSettings?: Record<string, string>;
  isLoading: boolean;
  mounted: boolean;
  currentTheme?: string;
  setTheme: (t: string) => void;
}) {
  const qc = useQueryClient();
  const [form, setForm] = useState<Record<string, string>>(() => initialSettings ?? {});

  const save = useMutation({
    mutationFn: (body: Record<string, string>) => api.put("/settings", body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["settings"] });
      toast.success("Settings saved");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const doBackup = async () => {
    try {
      const data = await api.get("/settings/backup");
      const blob = JSON.stringify(data, null, 2);
      const a = document.createElement("a");
      a.href = URL.createObjectURL(new Blob([blob], { type: "application/json" }));
      a.download = `partshub-backup-${Date.now()}.json`;
      a.click();
      toast.success("Backup downloaded");
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const users = useQuery({ queryKey: ["users"], queryFn: () => api.get<any[]>("/users") });

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));
  const theme = mounted ? currentTheme : undefined;

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <PageHeader title="Settings" description="Business info, users, backup & appearance" icon={SettingsIcon} />

      <Tabs defaultValue="business">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="business" className="gap-1.5"><Building2 className="h-4 w-4" /> Business</TabsTrigger>
          <TabsTrigger value="users" className="gap-1.5"><Users className="h-4 w-4" /> Users</TabsTrigger>
          <TabsTrigger value="backup" className="gap-1.5"><Database className="h-4 w-4" /> Backup</TabsTrigger>
          <TabsTrigger value="appearance" className="gap-1.5"><Palette className="h-4 w-4" /> Theme</TabsTrigger>
        </TabsList>

        {/* Business */}
        <TabsContent value="business" className="space-y-4">
          <Card className="p-5 shadow-soft">
            <h3 className="mb-4 text-sm font-semibold">Business Information</h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <Label className="mb-1.5 block text-xs">Business Name</Label>
                <Input value={form.business_name ?? ""} onChange={(e) => set("business_name", e.target.value)} />
              </div>
              <div>
                <Label className="mb-1.5 block text-xs">Phone</Label>
                <Input value={form.business_phone ?? ""} onChange={(e) => set("business_phone", e.target.value)} />
              </div>
              <div>
                <Label className="mb-1.5 block text-xs">Email</Label>
                <Input value={form.business_email ?? ""} onChange={(e) => set("business_email", e.target.value)} />
              </div>
              <div>
                <Label className="mb-1.5 block text-xs">Currency Symbol</Label>
                <Input value={form.currency_symbol ?? "Rs"} onChange={(e) => set("currency_symbol", e.target.value)} />
              </div>
              <div className="sm:col-span-2">
                <Label className="mb-1.5 block text-xs">Address</Label>
                <Input value={form.business_address ?? ""} onChange={(e) => set("business_address", e.target.value)} />
              </div>
            </div>
            <Button className="mt-4 gap-1.5" onClick={() => save.mutate(form)} disabled={save.isPending}>
              <Save className="h-4 w-4" /> Save
            </Button>
          </Card>
        </TabsContent>

        {/* Users */}
        <TabsContent value="users" className="space-y-4">
          <Card className="p-5 shadow-soft">
            <h3 className="mb-4 text-sm font-semibold">Users</h3>
            <div className="space-y-2">
              {(users.data ?? []).map((u) => (
                <div key={u.id} className="flex items-center gap-3 rounded-lg border p-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                    {u.name?.[0]?.toUpperCase() ?? "U"}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{u.name}</p>
                    <p className="text-xs text-muted-foreground">{u.email}</p>
                  </div>
                  <Badge variant="outline" className="text-xs">{u.role.replace("_", " ")}</Badge>
                </div>
              ))}
            </div>
          </Card>
        </TabsContent>

        {/* Backup */}
        <TabsContent value="backup" className="space-y-4">
          <Card className="p-5 shadow-soft">
            <h3 className="mb-2 text-sm font-semibold">Database Backup</h3>
            <p className="mb-4 text-xs text-muted-foreground">Download a full JSON backup of all your data (products, sales, purchases, customers, suppliers, settings).</p>
            <Button onClick={doBackup} className="gap-1.5">
              <Download className="h-4 w-4" /> Download Backup
            </Button>
          </Card>
        </TabsContent>

        {/* Appearance */}
        <TabsContent value="appearance" className="space-y-4">
          <Card className="p-5 shadow-soft">
            <h3 className="mb-4 text-sm font-semibold">Theme</h3>
            <div className="grid grid-cols-3 gap-3">
              {[
                { key: "light", label: "Light", icon: Sun },
                { key: "dark", label: "Dark", icon: Moon },
                { key: "system", label: "System", icon: Monitor },
              ].map((t) => {
                const Icon = t.icon;
                const active = mounted && theme === t.key;
                return (
                  <button
                    key={t.key}
                    onClick={() => setTheme(t.key)}
                    className={`flex flex-col items-center gap-2 rounded-xl border p-4 transition ${
                      active ? "border-primary bg-primary/5 ring-1 ring-primary" : "hover:border-muted-foreground/40"
                    }`}
                  >
                    <Icon className={`h-6 w-6 ${active ? "text-primary" : "text-muted-foreground"}`} />
                    <span className="text-xs font-medium">{t.label}</span>
                  </button>
                );
              })}
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
