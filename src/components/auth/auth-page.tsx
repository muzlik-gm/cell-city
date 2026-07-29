"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Smartphone, Loader2, User, Mail, Lock, Phone, ArrowRight, Store, Building2, Users } from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

export function AuthPage() {
  const { registerAppUser, loginAppUser, loginEmployee } = useAuth();
  const [mode, setMode] = useState<"login" | "register" | "employee">("login");
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    username: "",
    email: "",
    name: "",
    phone: "",
    password: "",
    businessHandle: "",
    employeeUsername: "",
  });

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "login") {
        await loginAppUser(form.username || form.email, form.password);
        toast.success("Welcome back!");
      } else if (mode === "register") {
        await registerAppUser(form);
        toast.success("Account created! Let's set up your business.");
      } else {
        await loginEmployee(form.businessHandle, form.employeeUsername, form.password);
        toast.success("Welcome to work!");
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
        <div className="mb-8 flex flex-col items-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl gradient-emerald text-white shadow-lg">
            <Smartphone className="h-8 w-8" />
          </div>
          <h1 className="mt-4 text-3xl font-bold tracking-tight">Cell City</h1>
          <p className="mt-1 text-sm text-muted-foreground">Mobile Spare Parts Compatibility Search Engine</p>
        </div>

        {/* Mode toggle */}
        <div className="mb-6 grid grid-cols-3 gap-1 rounded-xl bg-muted p-1">
          <button onClick={() => setMode("login")} className={`rounded-lg py-2.5 text-xs font-semibold transition ${mode === "login" ? "bg-card text-foreground shadow-soft" : "text-muted-foreground"}`}>Sign In</button>
          <button onClick={() => setMode("register")} className={`rounded-lg py-2.5 text-xs font-semibold transition ${mode === "register" ? "bg-card text-foreground shadow-soft" : "text-muted-foreground"}`}>Create Account</button>
          <button onClick={() => setMode("employee")} className={`rounded-lg py-2.5 text-xs font-semibold transition ${mode === "employee" ? "bg-card text-foreground shadow-soft" : "text-muted-foreground"}`}>Employee</button>
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
                  <Label className="mb-1.5 block text-sm font-medium">Full Name</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Bilal Ahmed" className="h-12 pl-10" required />
                  </div>
                </div>
                <div>
                  <Label className="mb-1.5 block text-sm font-medium">Username</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input value={form.username} onChange={(e) => set("username", e.target.value.toLowerCase())} placeholder="bilal" className="h-12 pl-10" required />
                  </div>
                </div>
                <div>
                  <Label className="mb-1.5 block text-sm font-medium">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} placeholder="bilal@example.com" className="h-12 pl-10" required />
                  </div>
                </div>
                <div>
                  <Label className="mb-1.5 block text-sm font-medium">Phone (optional)</Label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder="+92 300 1234567" className="h-12 pl-10" />
                  </div>
                </div>
              </>
            )}

            {mode === "login" && (
              <div>
                <Label className="mb-1.5 block text-sm font-medium">Username or Email</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input value={form.username || form.email} onChange={(e) => set("username", e.target.value)} placeholder="bilal or bilal@example.com" className="h-12 pl-10" required />
                </div>
              </div>
            )}

            {mode === "employee" && (
              <>
                <div className="rounded-lg bg-primary/5 p-3 text-xs text-muted-foreground">
                  <Users className="mb-1 h-4 w-4 text-primary" />
                  Employees sign in with their business handle, username, and password provided by their manager.
                </div>
                <div>
                  <Label className="mb-1.5 block text-sm font-medium">Business Handle</Label>
                  <div className="relative">
                    <Building2 className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input value={form.businessHandle} onChange={(e) => set("businessHandle", e.target.value.toLowerCase())} placeholder="cell-city" className="h-12 pl-10" required />
                  </div>
                </div>
                <div>
                  <Label className="mb-1.5 block text-sm font-medium">Employee Username</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input value={form.employeeUsername} onChange={(e) => set("employeeUsername", e.target.value.toLowerCase())} placeholder="ali" className="h-12 pl-10" required />
                  </div>
                </div>
              </>
            )}

            <div>
              <Label className="mb-1.5 block text-sm font-medium">Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input type="password" value={form.password} onChange={(e) => set("password", e.target.value)} placeholder={mode === "register" ? "Min 6 characters" : "Your password"} className="h-12 pl-10" required />
              </div>
            </div>

            <Button type="submit" size="lg" className="h-12 w-full gap-2 text-base font-semibold" disabled={loading}>
              {loading ? <><Loader2 className="h-5 w-5 animate-spin" /> Please wait…</> : <>
                {mode === "login" ? "Sign In" : mode === "register" ? "Create Account" : "Sign In to Work"}
                <ArrowRight className="h-5 w-5" />
              </>}
            </Button>
          </motion.form>
        </AnimatePresence>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          {mode === "login" ? "New here? " : mode === "register" ? "Already have an account? " : "Are you a business owner? "}
          <button onClick={() => setMode(mode === "register" ? "login" : "register")} className="font-semibold text-primary hover:underline">
            {mode === "register" ? "Sign in" : "Create an account"}
          </button>
          {mode !== "employee" && (
            <span className="mx-1">·</span>
          )}
          {mode !== "employee" && (
            <button onClick={() => setMode("employee")} className="font-semibold text-primary hover:underline">Employee login</button>
          )}
        </p>
      </div>
    </div>
  );
}
