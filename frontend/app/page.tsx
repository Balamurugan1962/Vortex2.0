"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ShieldCheck, Loader2, AlertCircle, CheckCircle2, Server } from "lucide-react";
import { checkHealth, getBaseApiUrl } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default function Home() {
  const router = useRouter();
  const [status, setStatus] = useState<"idle" | "connecting" | "success" | "error">("idle");
  const [apiUrl, setApiUrl] = useState("");

  useEffect(() => {
    setApiUrl(getBaseApiUrl());
  }, []);

  const connect = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    setStatus("connecting");
    try {
      await checkHealth(apiUrl);

      // Save to localStorage so it persists
      if (typeof window !== 'undefined') {
        localStorage.setItem('vortex_api_url', apiUrl);
      }

      setStatus("success");
      setTimeout(() => {
        router.push("/login");
      }, 1000);
    } catch (error) {
      setStatus("error");
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background text-foreground relative overflow-hidden">
      {/* Background Decoration */}
      <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-primary/5 via-background to-background pointer-events-none" />

      <div className="space-y-8 text-center animate-in fade-in zoom-in duration-700 relative z-10 w-full max-w-sm px-6">
        <div className="mx-auto w-20 h-20 bg-primary rounded-md flex items-center justify-center shadow-[0_0_30px_rgba(139,92,246,0.2)]">
          <ShieldCheck className="w-10 h-10 text-primary-foreground" />
        </div>
        <div className="space-y-2">
          <h1 className="text-4xl font-black tracking-tight text-foreground">OffGuard</h1>
          <p className="text-muted-foreground font-medium">Secure Examination Desktop Client</p>
        </div>

        <div className="bg-card border border-border rounded-xl p-6 shadow-xl space-y-6 mt-8">
          <div className="space-y-2 text-left">
            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <Server className="w-3 h-3" />
              Target Server URL
            </label>
            <form onSubmit={connect} className="flex flex-col gap-3">
              <Input
                value={apiUrl}
                onChange={(e) => setApiUrl(e.target.value)}
                placeholder="http://localhost:3001/api"
                className="bg-background font-mono text-sm"
                disabled={status === "connecting" || status === "success"}
              />
              <Button
                type="submit"
                disabled={status === "connecting" || status === "success" || !apiUrl}
                className="w-full font-bold"
              >
                {status === "connecting" ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Connecting...
                  </>
                ) : "Connect to Server"}
              </Button>
            </form>
          </div>

          {status === "success" && (
            <div className="flex items-center justify-center gap-2 text-green-500 font-bold text-xs uppercase tracking-widest pt-2 animate-in fade-in slide-in-from-bottom-2">
              <CheckCircle2 className="w-4 h-4" />
              Connection Established
            </div>
          )}

          {status === "error" && (
            <div className="flex flex-col items-center justify-center gap-2 text-destructive font-bold text-xs uppercase tracking-widest pt-2 animate-in fade-in slide-in-from-bottom-2">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4" />
                Connection Failed
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="fixed bottom-12 text-muted-foreground/30 text-[10px] uppercase font-bold tracking-[0.3em]">
        Connection Setup
      </div>
    </div>
  );
}
