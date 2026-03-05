"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Camera, Terminal, Globe, Loader2, ShieldCheck, QrCode, LogOut } from "lucide-react";
import { logout, getBaseApiUrl } from "@/lib/api";

export default function StudentConnectPage() {
    const router = useRouter();
    const [examCode, setExamCode] = useState("");
    const [examUrl, setExamUrl] = useState("");
    const [isConnecting, setIsConnecting] = useState(false);
    const [downloadProgress, setDownloadProgress] = useState(0);

    const handleConnect = async () => {
        const codeToUse = examCode || (examUrl ? examUrl.split('/').pop() : "");
        if (!codeToUse) return;

        setIsConnecting(true);

        try {
            const response = await fetch(`${getBaseApiUrl()}/exams/${codeToUse}`);
            if (!response.ok) {
                throw new Error("Exam not found");
            }

            localStorage.setItem("vortex_active_exam_id", codeToUse);

            // Simulate downloading exam package
            for (let i = 0; i <= 100; i += 20) {
                setDownloadProgress(i);
                await new Promise(resolve => setTimeout(resolve, 400));
            }
            router.push("/student/permissions");
        } catch (error) {
            alert("Invalid Exam Code. Please check and try again.");
        } finally {
            setIsConnecting(false);
        }
    };

    const handleLogout = () => {
        logout();
        router.push("/login");
    };

    return (
        <div className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center p-6 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-primary/5 via-background to-background">
            <div className="w-full max-w-5xl flex justify-end mb-8">
                <Button variant="ghost" onClick={handleLogout} className="flex items-center gap-2 text-muted-foreground hover:text-foreground">
                    <LogOut className="w-4 h-4" /> Sign Out
                </Button>
            </div>
            <div className="max-w-xl w-full">
                {/* Manual Join only */}
                <div className="flex flex-col gap-6">
                    <Card className="bg-card/80 backdrop-blur-md border-border shadow-2xl overflow-hidden">
                        <div className="h-1.5 w-full bg-primary" />
                        <CardHeader className="pt-8 text-center">
                            <CardTitle className="text-3xl font-black flex items-center justify-center gap-3 text-foreground tracking-tight">
                                Secure Connection
                            </CardTitle>
                            <CardDescription className="text-muted-foreground font-medium pt-2 max-w-[280px] mx-auto">
                                Enter the 8-character code or exam URL to establish a link.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6 pt-4 px-8">
                            <div className="space-y-3">
                                <Label htmlFor="code" className="text-foreground font-bold text-xs uppercase tracking-widest">Exam Access Code</Label>
                                <Input
                                    id="code"
                                    placeholder="e.g., VX-12345"
                                    className="bg-background border-border h-14 text-xl font-mono tracking-widest uppercase focus-visible:ring-primary text-primary font-black text-center"
                                    value={examCode}
                                    onChange={(e) => setExamCode(e.target.value)}
                                    maxLength={8}
                                />
                            </div>

                            <div className="relative">
                                <div className="absolute inset-0 flex items-center">
                                    <span className="w-full border-t border-border/50"></span>
                                </div>
                                <div className="relative flex justify-center text-xs uppercase">
                                    <span className="bg-card px-4 text-muted-foreground/40 font-black font-mono tracking-tighter">Gateway Verification</span>
                                </div>
                            </div>

                            <div className="space-y-3">
                                <Label htmlFor="url" className="text-foreground font-bold text-xs uppercase tracking-widest">Exam Direct URL</Label>
                                <div className="flex gap-2">
                                    <div className="flex items-center justify-center w-12 bg-muted/30 border border-border rounded-md text-muted-foreground">
                                        <Globe className="w-4 h-4" />
                                    </div>
                                    <Input
                                        id="url"
                                        placeholder="https://offguard.app/join/..."
                                        className="bg-background border-border flex-1 text-foreground font-medium h-12"
                                        value={examUrl}
                                        onChange={(e) => setExamUrl(e.target.value)}
                                    />
                                </div>
                            </div>
                        </CardContent>
                        <CardFooter className="pb-10 pt-4 px-8">
                            <Button
                                onClick={handleConnect}
                                className="w-full bg-primary hover:bg-primary/90 text-primary-foreground h-14 text-lg font-black transition-all shadow-lg shadow-primary/20"
                                disabled={isConnecting || (!examCode && !examUrl)}
                            >
                                {isConnecting ? (
                                    <>
                                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                                        SYNCHRONIZING...
                                    </>
                                ) : (
                                    "ESTABLISH CONNECTION"
                                )}
                            </Button>
                        </CardFooter>
                    </Card>

                    {/* Connected State / Download Simulation */}
                    {isConnecting && (
                        <Card className="bg-primary/5 border-primary/20 animate-in fade-in slide-in-from-bottom-2 duration-300 shadow-sm border overflow-hidden">
                            <CardContent className="py-5 px-8">
                                <div className="flex items-center justify-between mb-3">
                                    <span className="text-xs font-black text-primary uppercase tracking-wider">Syncing Secure Bundle...</span>
                                    <span className="text-xs text-primary font-mono font-black">{downloadProgress}%</span>
                                </div>
                                <div className="w-full h-1.5 bg-muted rounded-md overflow-hidden">
                                    <div
                                        className="h-full bg-primary transition-all duration-300 shadow-[0_0_8px_rgba(139,92,246,0.3)] rounded-md"
                                        style={{ width: `${downloadProgress}%` }}
                                    />
                                </div>
                                <p className="text-[10px] text-muted-foreground/60 mt-3 flex items-center gap-1.5 uppercase font-black tracking-widest">
                                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                                    Verified Secure Key Exchange
                                </p>
                            </CardContent>
                        </Card>
                    )}
                </div>
            </div>
        </div>
    );
}
