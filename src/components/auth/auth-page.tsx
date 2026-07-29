"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Smartphone, Loader2, Store, User, Mail, Lock, Phone, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

export function AuthPage() {
  const { login, register } = useAuth();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    companyName: "",
    ownerName: "",
    ownerEmail: "",
    ownerPassword: "",
    ownerPhone: "",
  });

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "login") {
        await login(form.ownerEmail, form.ownerPassword);
        toast.success("Welcome back!");
      } else {
        await register(form);
        toast.success("Company created! Welcome to Cell City.");
      }
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-emerald-50 via-background to-teal-50 p-4 dark:from-emerald-950/20 dark:via-background dark:to-teal-950/20">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="mb-8 flex flex-col items-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl gradient-emerald text-white shadow-lg">
            <Smartphone className="h-8 w-8" />
          </div>
          <h1 className="mt-4 text-3xl font-bold tracking-tight">Cell City</h1>
          <p className="mt-1 text-sm text-muted-foreground">Mobile Spare Parts Compatibility Search Engine</p>
        </div>

        {/* Mode toggle */}
        <div className="mb-6 grid grid-cols-2 gap-1 rounded-xl bg-muted p-1">
          <button
            onClick={() => setMode("login")}
            className={`rounded-lg py-2.5 text-sm font-semibold transition ${mode === "login" ? "bg-card text-foreground shadow-soft" : "text-muted-foreground"}`}
          >
            Sign In
          </button>
          <button
            onClick={() => setMode("register")}
            className={`rounded-lg py-2.5 text-sm font-semibold transition ${mode === "register" ? "bg-card text-foreground shadow-soft" : "text-muted-foreground"}`}
          >
            Create Company
          </button>
        </div>

        <AnimatePresence mode="wait">
          <motion.form
            key={mode}
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            onSubmit={submit}
            className="space-y-4 rounded-2xl border bg-card p-6 shadow-lg"
          >
            {mode === "register" && (
              <>
                <div>
                  <Label className="mb-1.5 block text-sm font-medium">Company Name</Label>
                  <div className="relative">
                    <Store className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={form.companyName}
                      onChange={(e) => set("companyName", e.target.value)}
                      placeholder="Cell City"
                      className="h-12 pl-10"
                      required
                    />
                  </div>
                </div>
                <div>
                  <Label className="mb-1.5 block text-sm font-medium">Your Name</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={form.ownerName}
                      onChange={(e) => set("ownerName", e.target.value)}
                      placeholder="Bilal Ahmed"
                      className="h-12 pl-10"
                      required
                    />
                  </div>
                </div>
              </>
            )}

            <div>
              <Label className="mb-1.5 block text-sm font-medium">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="email"
                  value={form.ownerEmail}
                  onChange={(e) => set("ownerEmail", e.target.value)}
                  placeholder="owner@cellcity.pk"
                  className="h-12 pl-10"
                  required
                />
              </div>
            </div>

            {mode === "register" && (
              <div>
                <Label className="mb-1.5 block text-sm font-medium">Phone (optional)</Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={form.ownerPhone}
                    onChange={(e) => set("ownerPhone", e.target.value)}
                    placeholder="+92 300 1234567"
                    className="h-12 pl-10"
                  />
                </div>
              </div>
            )}

            <div>
              <Label className="mb-1.5 block text-sm font-medium">Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="password"
                  value={form.ownerPassword}
                  onChange={(e) => set("ownerPassword", e.target.value)}
                  placeholder={mode === "register" ? "Min 6 characters" : "Your password"}
                  className="h-12 pl-10"
                  required
                />
              </div>
            </div>

            <Button type="submit" size="lg" className="h-12 w-full gap-2 text-base font-semibold" disabled={loading}>
              {loading ? (
                <><Loader2 className="h-5 w-5 animate-spin" /> {mode === "login" ? "Signing in…" : "Creating company…"}</>
              ) : (
                <>
                  {mode === "login" ? "Sign In" : "Create Company & Account"}
                  <ArrowRight className="h-5 w-5" />
                </>
              )}
            </Button>
          </motion.form>
        </AnimatePresence>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          {mode === "login" ? "New to Cell City? " : "Already have an account? "}
          <button
            onClick={() => setMode(mode === "login" ? "register" : "login")}
            className="font-semibold text-primary hover:underline"
          >
            {mode === "login" ? "Create a company" : "Sign in instead"}
          </button>
        </p>
      </div>
    </div>
  );
}
