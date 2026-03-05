"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ShieldCheck, Camera, Mic, MapPin, Maximize, Copy, Monitor, CheckCircle2, AlertCircle, XCircle } from "lucide-react";
import { Progress } from "@/components/ui/progress";

type PermissionStatus = "granted" | "pending" | "denied";

interface PermissionItem {
    id: string;
    label: string;
    icon: any;
    status: PermissionStatus;
    description: string;
}

export default function PermissionsPage() {
    const router = useRouter();
    const [permissions, setPermissions] = useState<PermissionItem[]>([
        { id: "camera", label: "Camera Access", icon: Camera, status: "pending", description: "Required for proctoring and identity verification." },
        { id: "mic", label: "Microphone Access", icon: Mic, status: "pending", description: "Required to detect unauthorized environmental noise." },
        { id: "location", label: "Location Access", icon: MapPin, status: "pending", description: "Required to verify regional examination compliance." },
        { id: "fullscreen", label: "Fullscreen Mode", icon: Maximize, status: "pending", description: "App must occupy the entire display to prevent multi-tasking." },
        { id: "clipboard", label: "Clipboard Restrictions", icon: Copy, status: "pending", description: "Restricting copy/paste actions to ensure exam integrity." },
        { id: "screen", label: "Screen Monitoring", icon: Monitor, status: "pending", description: "Enabling active focus tracking and screenshot captures." },
    ]);

    const [checking, setChecking] = useState(false);

    const requestPermission = (id: string) => {
        setPermissions(prev => prev.map(p =>
            p.id === id ? { ...p, status: "granted" } : p
        ));
    };

    const verifyAll = async () => {
        setChecking(true);
        await new Promise(resolve => setTimeout(resolve, 1500));
        setPermissions(prev => prev.map(p => ({ ...p, status: "granted" })));
        setChecking(false);
    };

    const allGranted = permissions.every(p => p.status === "granted");

    const getStatusIcon = (status: PermissionStatus) => {
        switch (status) {
            case "granted": return <CheckCircle2 className="w-5 h-5 text-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.2)]" />;
            case "denied": return <XCircle className="w-5 h-5 text-red-500" />;
            default: return <div className="w-5 h-5 rounded-full border-2 border-muted border-t-primary animate-spin" />;
        }
    };

    return (
        <div className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center p-6 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/10 via-background to-background">
            <div className="max-w-3xl w-full space-y-8">
                <div className="text-center space-y-2">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 mb-4 animate-pulse shadow-lg shadow-primary/10">
                        <ShieldCheck className="w-8 h-8 text-primary" />
                    </div>
                    <h1 className="text-4xl font-extrabold tracking-tight text-foreground">Security & Environment Check</h1>
                    <p className="text-muted-foreground text-lg font-medium">We need to verify your workstation setup before you can start the exam.</p>
                </div>

                <Card className="bg-card backdrop-blur-md border-border shadow-2xl overflow-hidden">
                    <CardHeader className="border-b border-border pb-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <CardTitle className="text-foreground font-bold">System Checklist</CardTitle>
                                <CardDescription className="text-muted-foreground font-medium">Grant all required permissions to proceed.</CardDescription>
                            </div>
                            <div className="bg-muted px-3 py-1 rounded-full border border-border">
                                <span className="text-xs font-bold text-muted-foreground">
                                    {permissions.filter(p => p.status === "granted").length}/{permissions.length} VALIDATED
                                </span>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="p-0">
                        <div className="divide-y divide-border">
                            {permissions.map((p) => (
                                <div key={p.id} className="group p-4 flex items-center justify-between hover:bg-muted/30 transition-colors">
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 rounded-lg bg-background border border-border flex items-center justify-center text-muted-foreground group-hover:text-primary group-hover:border-primary/50 transition-colors shadow-sm">
                                            <p.icon className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <div className="font-bold text-foreground">{p.label}</div>
                                            <div className="text-xs text-muted-foreground font-medium">{p.description}</div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        {getStatusIcon(p.status)}
                                        {p.status !== "granted" && (
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                className="text-primary hover:text-primary/80 hover:bg-primary/5 h-8 px-3 font-bold"
                                                onClick={() => requestPermission(p.id)}
                                            >
                                                Grant
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                    <CardFooter className="bg-muted/20 p-6 flex flex-col gap-4">
                        <div className="w-full flex items-center justify-between text-xs mb-1">
                            <span className="text-muted-foreground uppercase tracking-widest font-black">Readiness Level</span>
                            <span className="text-primary font-bold">
                                {Math.round((permissions.filter(p => p.status === "granted").length / permissions.length) * 100)}%
                            </span>
                        </div>
                        <Progress value={(permissions.filter(p => p.status === "granted").length / permissions.length) * 100} className="h-2 bg-muted/50" />

                        <div className="flex gap-4 mt-4 w-full">
                            <Button variant="outline" className="flex-1 border-border font-bold hover:bg-muted" onClick={verifyAll} disabled={checking}>
                                Auto-Verify All
                            </Button>
                            <Button
                                className={`flex-1 transition-all duration-500 font-bold shadow-lg ${allGranted ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-500/20' : 'bg-primary hover:bg-primary/90 shadow-primary/20'}`}
                                disabled={!allGranted}
                                onClick={() => router.push('/student/exam')}
                            >
                                {allGranted ? "Start Secure Examination" : "Check Readiness"}
                            </Button>
                        </div>

                        {!allGranted && (
                            <div className="flex items-center gap-2 justify-center text-orange-600 font-bold text-xs mt-2 bg-orange-500/5 p-2 rounded border border-orange-500/10">
                                <AlertCircle className="w-3 h-3" />
                                All system checks must be 'Granted' before the exam timer can begin.
                            </div>
                        )}
                    </CardFooter>
                </Card>
            </div>
        </div>
    );
}
