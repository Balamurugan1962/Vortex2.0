"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { ShieldCheck, Loader2 } from "lucide-react";

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    const timer = setTimeout(() => {
      router.push("/login");
    }, 2000);
    return () => clearTimeout(timer);
  }, [router]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background text-foreground">
      <div className="space-y-6 text-center animate-in fade-in zoom-in duration-700">
        <div className="mx-auto w-20 h-20 bg-primary rounded-md flex items-center justify-center shadow-[0_0_30px_rgba(139,92,246,0.2)]">
          <ShieldCheck className="w-10 h-10 text-primary-foreground" />
        </div>
        <div className="space-y-2">
          <h1 className="text-4xl font-bold tracking-tight text-foreground">OffGuard</h1>
          <p className="text-muted-foreground font-medium">Secure Examination Desktop Client</p>
        </div>
        <div className="flex items-center justify-center gap-2 text-primary font-bold text-xs uppercase tracking-widest pt-4">
          <Loader2 className="w-4 h-4 animate-spin" />
          Initializing secure environment...
        </div>
      </div>

      <div className="fixed bottom-12 text-muted-foreground/30 text-[10px] uppercase font-bold tracking-[0.3em]">
        Authorized Access Only
      </div>
    </div>
  );
}
