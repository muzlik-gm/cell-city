"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Smartphone, Loader2, User, Mail, Lock, Phone, ArrowRight, Store, Building2, Users } from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

const MODES = [
  { key: "login" as const, label: "Sign In", subtitle: "Welcome back" },
  { key: "register" as const, label: "Create Account", subtitle: "New here?" },
  { key: "employee" as const, label: "Employee", subtitle: "Sign in to work" },
] as const;

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
    employeeEmail: "",
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
        await loginEmployee(form.businessHandle, form.employeeEmail, form.password);
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
      <div className="w-full max-w-[380px]">
        {/* Brand */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
          className="mb-8 flex flex-col items-center"
        >
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl gradient-emerald text-white shadow-lg">
            <Smartphone className="h-7 w-7" />
          </div>
          <h1 className="mt-4 text-2xl font-bold tracking-tight">Cell City</h1>
          <p className="mt-1 text-xs text-muted-foreground">Mobile Spare Parts Management</p>
        </motion.div>

        {/* Mode tabs */}
        <div className="mb-5 flex rounded-xl bg-muted p-1">
          {MODES.map((m) => (
            <button
              key={m.key}
              onClick={() => setMode(m.key)}
              className={`relative flex-1 rounded-lg py-2 text-xs font-semibold transition-colors ${
                mode === m.key ? "text-foreground" : "text-muted-foreground hover:text-foreground/70"
              }`}
            >
              {mode === m.key && (
                <motion.div
                  layoutId="authTab"
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                  className="absolute inset-0 rounded-lg bg-card shadow-soft"
                />
              )}
              <span className="relative">{m.label}</span>
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait">
          <motion.form
            key={mode}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
            onSubmit={submit}
            className="space-y-4 rounded-2xl border bg-card p-5 shadow-lg"
          >
            {/* Register fields */}
            {mode === "register" && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-3"
              >
                <div>
                  <Label className="mb-1 block text-xs font-medium">Full Name</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Bilal Ahmed" className="h-11 pl-10" required />
                  </div>
                </div>
                <div>
                  <Label className="mb-1 block text-xs font-medium">Username</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input value={form.username} onChange={(e) => set("username", e.target.value.toLowerCase())} placeholder="bilal" className="h-11 pl-10" required />
                  </div>
                </div>
                <div>
                  <Label className="mb-1 block text-xs font-medium">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} placeholder="bilal@example.com" className="h-11 pl-10" required />
                  </div>
                </div>
                <div>
                  <Label className="mb-1 block text-xs font-medium">Phone (optional)</Label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder="+92 300 1234567" className="h-11 pl-10" />
                  </div>
                </div>
              </motion.div>
            )}

            {/* Login fields */}
            {mode === "login" && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-3"
              >
                <div>
                  <Label className="mb-1 block text-xs font-medium">Username or Email</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={form.username || form.email}
                      onChange={(e) => set("username", e.target.value)}
                      placeholder="bilal or bilal@example.com"
                      className="h-11 pl-10"
                      required
                    />
                  </div>
                </div>
              </motion.div>
            )}

            {/* Employee fields */}
            {mode === "employee" && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-3"
              >
                <div className="rounded-lg bg-primary/5 p-3 text-xs text-muted-foreground">
                  <Users className="mb-1 h-4 w-4 text-primary" />
                  Sign in with your business handle, Gmail, and password.
                </div>
                <div>
                  <Label className="mb-1 block text-xs font-medium">Business Handle</Label>
                  <div className="relative">
                    <Building2 className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={form.businessHandle}
                      onChange={(e) => setForm((f) => ({ ...f, businessHandle: e.target.value.toLowerCase() }))}
                      placeholder="cell-city"
                      className="h-11 pl-10"
                      required
                    />
                  </div>
                </div>
                <div>
                  <Label className="mb-1 block text-xs font-medium">Gmail / Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      type="email"
                      value={form.employeeEmail}
                      onChange={(e) => setForm((f) => ({ ...f, employeeEmail: e.target.value.toLowerCase() }))}
                      placeholder="ali@gmail.com"
                      className="h-11 pl-10"
                      required
                    />
                  </div>
                </div>
              </motion.div>
            )}

            {/* Password */}
            <div>
              <Label className="mb-1 block text-xs font-medium">Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="password"
                  value={form.password}
                  onChange={(e) => set("password", e.target.value)}
                  placeholder={mode === "register" ? "Min 6 characters" : "Your password"}
                  className="h-11 pl-10"
                  required
                />
              </div>
            </div>

            {/* Submit */}
            <motion.div whileTap={{ scale: 0.97 }} transition={{ type: "spring", stiffness: 400, damping: 20 }}>
              <Button
                type="submit"
                size="lg"
                className="h-11 w-full gap-2 text-sm font-semibold active:scale-[0.98]"
                disabled={loading}
              >
                {loading ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> Please wait…</>
                ) : (
                  <>
                    {mode === "login" ? "Sign In" : mode === "register" ? "Create Account" : "Sign In to Work"}
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </Button>
            </motion.div>
          </motion.form>
        </AnimatePresence>

        {/* Footer links */}
        <p className="mt-5 text-center text-[11px] text-muted-foreground">
          {mode === "login" ? "New here? " : mode === "register" ? "Already have an account? " : "Business owner? "}
          <button
            onClick={() => setMode(mode === "register" ? "login" : "register")}
            className="font-semibold text-primary transition-colors hover:text-primary/80"
          >
            {mode === "register" ? "Sign in" : "Create an account"}
          </button>
          {mode !== "employee" && <span className="mx-1.5 text-muted-foreground/60">·</span>}
          {mode !== "employee" && (
            <button
              onClick={() => setMode("employee")}
              className="font-semibold text-primary transition-colors hover:text-primary/80"
            >
              Employee login
            </button>
          )}
        </p>
      </div>
    </div>
  );
}
