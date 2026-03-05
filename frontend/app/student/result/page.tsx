"use client";

import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ShieldCheck, CheckCircle2, Home, LogOut, ArrowRight } from "lucide-react";

export default function ExamResultPage() {
    const router = useRouter();

    return (
        <div className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center p-6 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-primary/10 via-background to-background">
            <Card className="w-full max-w-xl bg-card backdrop-blur-xl border-border shadow-2xl text-center overflow-hidden">
                <div className="h-2 w-full bg-emerald-500" />
                <CardHeader className="pt-12 pb-8">
                    <div className="mx-auto w-24 h-24 bg-emerald-500/10 rounded-full flex items-center justify-center mb-6 text-emerald-600 border border-emerald-500/20 shadow-sm">
                        <CheckCircle2 className="w-12 h-12" />
                    </div>
                    <CardTitle className="text-4xl font-black tracking-tight text-foreground">Session Finalized</CardTitle>
                    <CardDescription className="text-muted-foreground text-lg mt-2 font-medium">
                        Your responses have been securely encrypted and synchronized with the examination server.
                    </CardDescription>
                </CardHeader>
                <CardContent className="px-12 py-8 space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="p-4 rounded-md bg-muted/20 border border-border shadow-inner">
                            <div className="text-[10px] text-muted-foreground uppercase font-black tracking-widest mb-1">Status</div>
                            <div className="text-emerald-600 font-black">SUCCESSFUL</div>
                        </div>
                        <div className="p-4 rounded-md bg-muted/20 border border-border shadow-inner">
                            <div className="text-[10px] text-muted-foreground uppercase font-black tracking-widest mb-1">Sync ID</div>
                            <div className="text-primary font-mono text-sm leading-none font-bold">#VX-AZ-99120</div>
                        </div>
                    </div>

                    <div className="bg-primary/5 border border-primary/20 rounded-md p-6 flex items-start gap-4 text-left shadow-sm">
                        <ShieldCheck className="w-6 h-6 text-primary shrink-0 mt-1" />
                        <div className="space-y-1">
                            <h4 className="font-bold text-primary text-sm">Security Verification Passed</h4>
                            <p className="text-[11px] text-muted-foreground leading-relaxed font-medium">
                                The local client integrity check was completed. No significant environmental anomalies were reported during this session.
                            </p>
                        </div>
                    </div>
                </CardContent>
                <CardFooter className="flex flex-col gap-4 pb-12 px-12 pt-4">
                    <Button onClick={() => router.push('/login')} className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-black h-12 shadow-lg shadow-primary/20 transition-all">
                        Return to Authentication Gate
                    </Button>
                    <div className="flex items-center gap-4 w-full">
                        <Button variant="ghost" className="flex-1 text-muted-foreground font-bold hover:text-foreground hover:bg-muted text-xs uppercase tracking-widest">
                            View Session Log
                        </Button>
                        <Button variant="ghost" className="flex-1 text-muted-foreground font-bold hover:text-red-600 hover:bg-red-500/5 text-xs uppercase tracking-widest">
                            <LogOut className="w-4 h-4 mr-2" /> Terminate Client
                        </Button>
                    </div>
                </CardFooter>
            </Card>

            <p className="mt-8 text-muted-foreground/40 text-[10px] uppercase font-black tracking-[0.2em] flex items-center gap-2">
                <ShieldCheck className="w-3 h-3" />
                OffGuard Secure Client Environment v0.1.0 (BETA)
            </p>
        </div>
    );
}
