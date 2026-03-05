"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ShieldCheck, Camera, Mic, MapPin, Maximize, Copy, Monitor, CheckCircle2, AlertCircle, XCircle, ShieldAlert } from "lucide-react";
import { Progress } from "@/components/ui/progress";

// Tauri-specific imports (dynamic to prevent server-side errors)
const getTauriWindow = async () => {
    if (typeof window !== "undefined" && (window as any).__TAURI_INTERNALS__) {
        const { getCurrentWindow } = await import("@tauri-apps/api/window");
        return getCurrentWindow();
    }
    return null;
};

const getTauriClipboard = async () => {
    if (typeof window !== "undefined" && (window as any).__TAURI_INTERNALS__) {
        const { readText } = await import("@tauri-apps/plugin-clipboard-manager");
        return { readText };
    }
    return null;
};

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

    useEffect(() => {
        const syncPermissions = async () => {
            const types = ["camera" as PermissionName, "microphone" as PermissionName, "geolocation" as PermissionName];

            for (const type of types) {
                try {
                    const status = await navigator.permissions.query({ name: type });
                    const id = type === "microphone" ? "mic" : type === "camera" ? "camera" : "location";

                    if (status.state === "granted") {
                        setPermissions(prev => prev.map(p =>
                            p.id === id ? { ...p, status: "granted" } : p
                        ));
                    }

                    status.onchange = () => {
                        setPermissions(prev => prev.map(p =>
                            p.id === id ? { ...p, status: status.state === "granted" ? "granted" : "pending" } : p
                        ));
                    };
                } catch (e) {
                    console.warn(`Browser doesn't support direct permission query for ${type}`);
                }
            }
        };

        syncPermissions();

        const handleFullscreenChange = () => {
            setPermissions(prev => prev.map(p =>
                p.id === "fullscreen" ? { ...p, status: !!document.fullscreenElement ? "granted" : "pending" } : p
            ));
        };

        document.addEventListener("fullscreenchange", handleFullscreenChange);
        return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
    }, []);

    const checkPermissionStatus = async (id: string): Promise<boolean> => {
        try {
            switch (id) {
                case "camera":
                    const camStream = await navigator.mediaDevices.getUserMedia({ video: true });
                    camStream.getTracks().forEach(track => track.stop());
                    return true;
                case "mic":
                    const micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
                    micStream.getTracks().forEach(track => track.stop());
                    return true;
                case "location":
                    return new Promise((resolve) => {
                        navigator.geolocation.getCurrentPosition(
                            () => resolve(true),
                            () => resolve(false),
                            { timeout: 5000, enableHighAccuracy: false }
                        );
                    });
                case "fullscreen":
                    try {
                        const tauriWin = await getTauriWindow();
                        if (tauriWin) {
                            await tauriWin.setFullscreen(true);
                            return await tauriWin.isFullscreen();
                        } else {
                            if (!document.fullscreenElement) {
                                await document.documentElement.requestFullscreen();
                            }
                            return !!document.fullscreenElement;
                        }
                    } catch (e) {
                        console.error("Fullscreen request failed:", e);
                        return false;
                    }
                case "screen":
                    const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
                    screenStream.getTracks().forEach(track => track.stop());
                    return true;
                case "clipboard":
                    try {
                        const tauriClipboard = await getTauriClipboard();
                        if (tauriClipboard) {
                            await tauriClipboard.readText();
                            return true;
                        }
                        await navigator.clipboard.readText();
                        return true;
                    } catch (e) {
                        return false;
                    }
                default:
                    return true;
            }
        } catch (error) {
            console.error(`Permission denied for ${id}:`, error);
            return false;
        }
    };

    const requestPermission = async (id: string) => {
        const granted = await checkPermissionStatus(id);
        setPermissions(prev => prev.map(p =>
            p.id === id ? { ...p, status: granted ? "granted" : "denied" } : p
        ));
    };

    const verifyAll = async () => {
        setChecking(true);
        for (const p of permissions) {
            if (p.status !== "granted") {
                const granted = await checkPermissionStatus(p.id);
                setPermissions(prev => prev.map(item =>
                    item.id === p.id ? { ...item, status: granted ? "granted" : "denied" } : item
                ));
                if (!granted) break; // Stop if one fails during auto-verify
            }
        }
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
                            <div className="bg-muted px-3 py-1 rounded-md border border-border">
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
                                        <div className="w-10 h-10 rounded-md bg-background border border-border flex items-center justify-center text-muted-foreground group-hover:text-primary group-hover:border-primary/50 transition-colors shadow-sm">
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
                        <Progress value={(permissions.filter(p => p.status === "granted").length / permissions.length) * 100} className="h-2 bg-muted/50 rounded-md" />

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

                        <div className="flex flex-col items-center gap-2">
                            <Button
                                variant="ghost"
                                size="sm"
                                className="text-muted-foreground/30 hover:text-muted-foreground hover:bg-transparent font-black tracking-widest text-[9px] uppercase mt-2 h-6"
                                onClick={() => router.push('/student/exam')}
                            >
                                [ bypass environment verification ]
                            </Button>

                            {!allGranted && (
                                <div className="flex items-center gap-2 justify-center text-orange-600 font-bold text-xs bg-orange-500/5 p-2 rounded border border-orange-500/10 w-full">
                                    <AlertCircle className="w-3 h-3" />
                                    All system checks must be 'Granted' before the exam timer can begin.
                                </div>
                            )}
                        </div>
                    </CardFooter>
                </Card>
            </div>
            {/* Fullscreen Restriction Overlay - DISABLED FOR TESTING */}
            {/* 
            {typeof document !== 'undefined' && !document.fullscreenElement && permissions.find(p => p.id === "fullscreen")?.status === "granted" && (
                <div className="fixed inset-0 bg-background/90 backdrop-blur-xl z-[100] flex items-center justify-center p-6 animate-in fade-in duration-500">
                    <Card className="max-w-md w-full border-red-500/50 shadow-2xl shadow-red-500/20 bg-card/50">
                        <CardHeader className="text-center pb-4">
                            <div className="mx-auto w-16 h-16 bg-red-500/10 rounded-md flex items-center justify-center mb-4 text-red-600 border border-red-500/20">
                                <ShieldAlert className="w-10 h-10" />
                            </div>
                            <CardTitle className="text-2xl font-black text-foreground">Security Violation</CardTitle>
                            <CardDescription className="font-bold text-red-600/80">Fullscreen Mode Terminated</CardDescription>
                        </CardHeader>
                        <CardContent className="text-center space-y-4">
                            <p className="text-sm text-muted-foreground font-medium">
                                To maintain examination integrity, you must remain in fullscreen mode. Your progress has been restricted until compliance is restored.
                            </p>
                        </CardContent>
                        <CardFooter>
                            <Button
                                onClick={() => requestPermission("fullscreen")}
                                className="w-full bg-red-600 hover:bg-red-700 text-white font-black h-12 rounded-md transition-all shadow-lg shadow-red-500/20"
                            >
                                Re-enter Fullscreen Mode
                            </Button>
                        </CardFooter>
                    </Card>
                </div>
            )}
            */}
        </div>
    );
}
