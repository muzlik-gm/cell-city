"use client";

import { Button } from "@/components/ui/button";
import { AlertTriangle, RefreshCw } from "lucide-react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html>
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif" }}>
        <div style={{ display: "flex", minHeight: "100vh", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "1rem", backgroundColor: "#0a0a0a", color: "#fafafa" }}>
          <div style={{ textAlign: "center", maxWidth: "400px" }}>
            <div style={{ display: "flex", height: "64px", width: "64px", margin: "0 auto", alignItems: "center", justifyContent: "center", borderRadius: "16px", backgroundColor: "rgba(239,68,68,0.1)", color: "#ef4444" }}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
            </div>
            <h1 style={{ fontSize: "24px", fontWeight: "bold", marginTop: "24px" }}>Application Error</h1>
            <p style={{ fontSize: "14px", color: "#a1a1aa", marginTop: "8px" }}>
              A critical error occurred. Please refresh the page.
            </p>
            <button
              onClick={reset}
              style={{
                marginTop: "24px", padding: "10px 20px", borderRadius: "8px",
                backgroundColor: "#10b981", color: "white", border: "none",
                cursor: "pointer", fontWeight: 600, fontSize: "14px",
              }}
            >
              Try Again
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
