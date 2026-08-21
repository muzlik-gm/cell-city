"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  Smartphone, Loader2, User, Mail, Lock, Phone, ArrowRight, 
  Store, Building2, Users, Sparkles, Zap, Shield
} from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

const MODES = [
  { key: "login" as const, label: "Sign In", subtitle: "Welcome back" },
  { key: "register" as const, label: "Create Account", subtitle: "Get started free" },
  { key: "employee" as const, label: "Employee", subtitle: "Team access" },
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
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background p-4">
      {/* Background decorations */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {/* Gradient orbs */}
        <div className="absolute -top-40 -right-40 h-[500px] w-[500px] rounded-full bg-primary/10 blur-[120px]" />
        <div className="absolute -bottom-40 -left-40 h-[400px] w-[400px] rounded-full bg-chart-3/10 blur-[100px]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[600px] w-[600px] rounded-full bg-chart-2/5 blur-[150px] opacity-30" />
        
        {/* Grid pattern */}
        <div className="absolute inset-0 bg-grid opacity-20" />
      </div>

      <div className="relative z-10 w-full max-w-[420px]">
        {/* Brand Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="mb-8 flex flex-col items-center"
        >
          {/* Logo */}
          <div className="group relative mb-6">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl gradient-primary text-white shadow-elevated transition-transform duration-300 group-hover:scale-105 group-hover:rotate-3">
              <Smartphone className="h-7 w-7" />
            </div>
            {/* Pulse effect */}
            <div className="absolute inset-0 rounded-2xl gradient-primary opacity-0 group-hover:opacity-20 blur-xl transition-opacity duration-300" />
            
            {/* Status badge */}
            <div className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-400 border-2 border-background">
              <Zap className="h-2.5 w-2.5 text-white" />
            </div>
          </div>

          {/* Title */}
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Cell City
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Mobile Spare Parts Operating System
          </p>

          {/* Feature pills */}
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            {[
              { icon: Sparkles, text: "AI-Powered" },
              { icon: Shield, text: "Secure" },
              { icon: Zap, text: "Lightning Fast" },
            ].map(({ icon: Icon, text }) => (
              <span
                key={text}
                className="inline-flex items-center gap-1 rounded-full bg-accent px-2.5 py-1 text-[10px] font-medium text-muted-foreground"
              >
                <Icon className="h-3 w-3" />
                {text}
              </span>
            ))}
          </div>
        </motion.div>

        {/* Mode Tabs */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
          className="mb-6 flex rounded-2xl bg-card p-1.5 shadow-card border border-border/50"
        >
          {MODES.map((m) => (
            <button
              key={m.key}
              onClick={() => setMode(m.key)}
              className={cn(
                "relative flex-1 rounded-xl py-2.5 text-xs font-semibold transition-all duration-200",
                mode === m.key ? "text-foreground" : "text-muted-foreground hover:text-foreground/70"
              )}
            >
              {mode === m.key && (
                <motion.div
                  layoutId="authTab"
                  transition={{ type: "spring", stiffness: 350, damping: 28 }}
                  className="absolute inset-0 rounded-xl bg-background shadow-soft"
                />
              )}
              <span className="relative">{m.label}</span>
            </button>
          ))}
        </motion.div>

        {/* Form Card */}
        <AnimatePresence mode="wait">
          <motion.form
            key={mode}
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -12, scale: 0.98 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            onSubmit={submit}
            className="space-y-5 rounded-2xl border border-border/50 bg-card/80 backdrop-blur-sm p-6 shadow-card"
          >
            {/* Register fields */}
            {mode === "register" && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-4"
              >
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-foreground">Full Name</Label>
                  <div className="relative">
                    <User className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input 
                      value={form.name} 
                      onChange={(e) => set("name", e.target.value)} 
                      placeholder="Bilal Ahmed" 
                      className="h-11 pl-11 rounded-xl border-border/60 bg-background focus:border-primary/50" 
                      required 
                    />
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-foreground">Username</Label>
                    <div className="relative">
                      <User className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input 
                        value={form.username} 
                        onChange={(e) => set("username", e.target.value.toLowerCase())} 
                        placeholder="bilal" 
                        className="h-11 pl-11 rounded-xl border-border/60 bg-background focus:border-primary/50" 
                        required 
                      />
                    </div>
                  </div>
                  
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-foreground">Phone</Label>
                    <div className="relative">
                      <Phone className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input 
                        value={form.phone} 
                        onChange={(e) => set("phone", e.target.value)} 
                        placeholder="+92 300..." 
                        className="h-11 pl-11 rounded-xl border-border/60 bg-background focus:border-primary/50" 
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-foreground">Email Address</Label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input 
                      type="email" 
                      value={form.email} 
                      onChange={(e) => set("email", e.target.value)} 
                      placeholder="bilal@example.com" 
                      className="h-11 pl-11 rounded-xl border-border/60 bg-background focus:border-primary/50" 
                      required 
                    />
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
                className="space-y-4"
              >
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-foreground">Username or Email</Label>
                  <div className="relative">
                    <User className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={form.username || form.email}
                      onChange={(e) => set("username", e.target.value)}
                      placeholder="bilal or bilal@example.com"
                      className="h-11 pl-11 rounded-xl border-border/60 bg-background focus:border-primary/50"
                      required
                      autoFocus
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
                className="space-y-4"
              >
                <div className="rounded-xl bg-gradient-to-r from-primary/10 to-chart-3/10 p-4 border border-primary/20">
                  <div className="flex items-start gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/20">
                      <Users className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-foreground">Team Member Access</p>
                      <p className="mt-0.5 text-[11px] text-muted-foreground leading-relaxed">
                        Sign in using your business handle, work email, and password.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-foreground">Business Handle</Label>
                  <div className="relative">
                    <Building2 className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={form.businessHandle}
                      onChange={(e) => setForm((f) => ({ ...f, businessHandle: e.target.value.toLowerCase() }))}
                      placeholder="cell-city"
                      className="h-11 pl-11 rounded-xl border-border/60 bg-background focus:border-primary/50"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-foreground">Work Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      type="email"
                      value={form.employeeEmail}
                      onChange={(e) => setForm((f) => ({ ...f, employeeEmail: e.target.value.toLowerCase() }))}
                      placeholder="ali@company.com"
                      className="h-11 pl-11 rounded-xl border-border/60 bg-background focus:border-primary/50"
                      required
                    />
                  </div>
                </div>
              </motion.div>
            )}

            {/* Password field — always shown */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-foreground">Password</Label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="password"
                  value={form.password}
                  onChange={(e) => set("password", e.target.value)}
                  placeholder={mode === "register" ? "Create a strong password" : "Enter your password"}
                  className="h-11 pl-11 rounded-xl border-border/60 bg-background focus:border-primary/50"
                  required
                />
              </div>
            </div>

            {/* Submit button */}
            <motion.div whileTap={{ scale: 0.98 }} transition={{ type: "spring", stiffness: 400, damping: 25 }}>
              <Button
                type="submit"
                size="lg"
                disabled={loading}
                className={cn(
                  "h-12 w-full gap-2.5 rounded-xl text-sm font-semibold shadow-soft",
                  "bg-primary hover:bg-primary/90 active:scale-[0.99]",
                  "transition-all duration-200"
                )}
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> 
                    <span>Please wait…</span>
                  </>
                ) : (
                  <>
                    <span>{mode === "login" ? "Sign In" : mode === "register" ? "Create Account" : "Access Workspace"}</span>
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </Button>
            </motion.div>
          </motion.form>
        </AnimatePresence>

        {/* Footer links */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="mt-6 text-center text-[11px] text-muted-foreground"
        >
          {mode === "login" ? (
            <>
              New here?{" "}
              <button
                onClick={() => setMode("register")}
                className="font-bold text-primary hover:text-primary/80 transition-colors"
              >
                Create an account
              </button>
            </>
          ) : mode === "register" ? (
            <>
              Already have an account?{" "}
              <button
                onClick={() => setMode("login")}
                className="font-bold text-primary hover:text-primary/80 transition-colors"
              >
                Sign in
              </button>
            </>
          ) : (
            <>
              Business owner?{" "}
              <button
                onClick={() => setMode("login")}
                className="font-bold text-primary hover:text-primary/80 transition-colors"
              >
                Sign in here
              </button>
            </>
          )}
          
          {mode !== "employee" && (
            <>
              <span className="mx-2 text-border">·</span>
              <button
                onClick={() => setMode("employee")}
                className="font-bold text-primary hover:text-primary/80 transition-colors"
              >
                Employee Portal
              </button>
            </>
          )}
        </motion.p>

        {/* Bottom branding */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="mt-4 text-center text-[10px] text-muted-foreground/60"
        >
          Protected by enterprise-grade security · End-to-end encrypted
        </motion.p>
      </div>
    </div>
  );
}
