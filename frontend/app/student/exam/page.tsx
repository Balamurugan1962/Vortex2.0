"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
    Timer,
    Wifi,
    WifiOff,
    Save,
    ChevronLeft,
    ChevronRight,
    Flag,
    AlertTriangle,
    ShieldAlert,
    Menu,
    X,
    Lock,
    ExternalLink,
    Monitor
} from "lucide-react";
import { cn } from "@/lib/utils";

// Tauri-specific imports
const getTauriWindow = async () => {
    if (typeof window !== "undefined" && (window as any).__TAURI_INTERNALS__) {
        const { getCurrentWindow } = await import("@tauri-apps/api/window");
        return getCurrentWindow();
    }
    return null;
};

// Mock Question Data
const mockQuestions = [
    {
        id: "1",
        type: "MCQ",
        question: "What is the time complexity of searching for an element in a balanced Binary Search Tree (BST)?",
        options: ["O(1)", "O(n)", "O(log n)", "O(n log n)"],
        state: "answered"
    },
    {
        id: "2",
        type: "Multi-select",
        question: "Which of the following are stable sorting algorithms? (Choose all that apply)",
        options: ["Merge Sort", "Quick Sort", "Bubble Sort", "Heap Sort"],
        state: "not-visited"
    },
    {
        id: "3",
        type: "Short Answer",
        question: "Define 'Polymorphism' in the context of Object-Oriented Programming.",
        state: "marked"
    },
    {
        id: "4",
        type: "Long Answer",
        question: "Explain the difference between a Process and a Thread in operating systems.",
        state: "not-visited"
    },
    {
        id: "5",
        type: "MCQ",
        question: "Which layer of the OSI model is responsible for routing?",
        options: ["Data Link", "Network", "Transport", "Session"],
        state: "not-visited"
    },
];

export default function ExamPage() {
    const router = useRouter();
    const [currentIdx, setCurrentIdx] = useState(0);
    const [timeLeft, setTimeLeft] = useState(3600);
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    const [lastSaved, setLastSaved] = useState(new Date());
    const [isSaving, setIsSaving] = useState(false);
    const [violations, setViolations] = useState(0);
    const [isFullscreen, setIsFullscreen] = useState(true);
    const [isScreenSharing, setIsScreenSharing] = useState(true);

    useEffect(() => {
        const handleFullscreen = () => {
            const isFS = !!document.fullscreenElement;
            setIsFullscreen(isFS);
            if (!isFS) {
                setViolations(prev => prev + 1);
            }
        };

        const handleSecurityEvents = (e: Event) => {
            e.preventDefault();
            setViolations(prev => prev + 1);
            // Optionally show a toast/notification here
        };

        const handleFocus = () => {
            if (!document.hasFocus()) {
                setViolations(prev => prev + 1);
            }
        };

        document.addEventListener("fullscreenchange", handleFullscreen);
        document.addEventListener("copy", handleSecurityEvents);
        document.addEventListener("cut", handleSecurityEvents);
        document.addEventListener("paste", handleSecurityEvents);
        document.addEventListener("contextmenu", handleSecurityEvents);
        window.addEventListener("blur", handleFocus);

        // Initial check
        setIsFullscreen(!!document.fullscreenElement);

        return () => {
            document.removeEventListener("fullscreenchange", handleFullscreen);
            document.removeEventListener("copy", handleSecurityEvents);
            document.removeEventListener("cut", handleSecurityEvents);
            document.removeEventListener("paste", handleSecurityEvents);
            document.removeEventListener("contextmenu", handleSecurityEvents);
            window.removeEventListener("blur", handleFocus);
        };
    }, []);

    useEffect(() => {
        if (violations >= 3) {
            handleSubmit();
        }
    }, [violations]);

    const question = mockQuestions[currentIdx];

    useEffect(() => {
        const timer = setInterval(() => {
            setTimeLeft(prev => {
                if (prev <= 1) {
                    clearInterval(timer);
                    handleSubmit();
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
        return () => clearInterval(timer);
    }, []);

    const formatTime = (seconds: number) => {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    };

    const handleSave = () => {
        setIsSaving(true);
        setTimeout(() => {
            setLastSaved(new Date());
            setIsSaving(false);
        }, 600);
    };

    const handleSubmit = () => {
        router.push("/student/result");
    };

    const reEnterFullscreen = async () => {
        try {
            const tauriWin = await getTauriWindow();
            if (tauriWin) {
                await tauriWin.setFullscreen(true);
            } else {
                await document.documentElement.requestFullscreen();
            }
        } catch (e) {
            console.error("Fullscreen restoration failed", e);
        }
    };

    const startScreenShare = async () => {
        try {
            const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
            setIsScreenSharing(true);
            stream.getTracks()[0].onended = () => {
                setIsScreenSharing(false);
                setViolations(prev => prev + 1);
            };
        } catch (e) {
            console.error("Screen share failed", e);
            setIsScreenSharing(false);
        }
    };

    return (
        <div className="flex h-screen bg-background text-foreground overflow-hidden select-none font-sans">
            {/* Sidebar */}
            <aside className={cn(
                "bg-card border-r border-border transition-all duration-300 flex flex-col z-20 shadow-xl",
                isSidebarOpen ? "w-80" : "w-0 opacity-0 overflow-hidden"
            )}>
                <div className="p-6 border-b border-border flex items-center justify-between bg-muted/5">
                    <div>
                        <h2 className="font-black text-xs uppercase tracking-widest text-muted-foreground">Question Navigator</h2>
                        <p className="text-[10px] font-bold text-primary mt-1">SECURE SESSION ACTIVE</p>
                    </div>
                </div>

                <div className="flex-1 overflow-auto p-6 grid grid-cols-4 gap-3 content-start">
                    {mockQuestions.map((q, idx) => (
                        <button
                            key={q.id}
                            onClick={() => setCurrentIdx(idx)}
                            className={cn(
                                "h-11 rounded-md text-xs font-black transition-all flex items-center justify-center border-2",
                                currentIdx === idx
                                    ? "bg-primary border-primary text-primary-foreground shadow-lg shadow-primary/30 scale-105"
                                    : q.state === "answered"
                                        ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-600"
                                        : q.state === "marked"
                                            ? "bg-orange-500/10 border-orange-500/20 text-orange-600"
                                            : "bg-muted/30 border-border text-muted-foreground hover:border-primary/30"
                            )}
                        >
                            {idx + 1}
                        </button>
                    ))}
                </div>

                <div className="p-6 border-t border-border bg-muted/5 space-y-4">
                    <div className="space-y-2">
                        <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-tighter">
                            <span className="text-muted-foreground">Progress Tracking</span>
                            <span className="text-primary">{Math.round((1 / 5) * 100)}%</span>
                        </div>
                        <Progress value={20} className="h-1.5 bg-muted" />
                    </div>
                    <Button onClick={handleSubmit} className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-black h-12 shadow-lg shadow-primary/30 rounded-md transition-all">
                        Finalize & Submit
                    </Button>
                </div>
            </aside>

            {/* Main */}
            <div className="flex-1 flex flex-col min-w-0 bg-background">
                <header className="h-16 border-b border-border flex items-center justify-between px-6 bg-card box-border z-10">
                    <div className="flex items-center gap-4">
                        <Button variant="ghost" size="icon" onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="text-muted-foreground hover:bg-muted rounded-md">
                            <Menu className="w-5 h-5" />
                        </Button>
                        <div className="flex items-center gap-2">
                            <Lock className="w-4 h-4 text-primary" />
                            <span className="font-black text-xs uppercase tracking-widest text-foreground">OffGuard Enforced Node</span>
                        </div>
                        <div className={cn(
                            "ml-4 px-3 py-1 rounded-md border flex items-center gap-2 transition-all duration-300",
                            violations > 0 ? "bg-red-500/10 border-red-500/20 text-red-600" : "bg-muted border-border text-muted-foreground"
                        )}>
                            <AlertTriangle className={cn("w-3.5 h-3.5", violations >= 2 && "animate-pulse")} />
                            <span className="text-[10px] font-black uppercase tracking-widest">
                                Violations: {violations}/3
                            </span>
                        </div>
                    </div>

                    <div className="flex items-center gap-6">
                        <div className="flex flex-col items-end">
                            <span className="text-[9px] font-black text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
                                <Save className={cn("w-3 h-3", isSaving && "animate-spin text-primary")} />
                                {isSaving ? "Syncing..." : `Saved at ${lastSaved.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
                            </span>
                            <span className="text-[9px] font-black text-emerald-500 uppercase tracking-widest flex items-center gap-1.5 mt-0.5">
                                <Wifi className="w-3 h-3" />
                                Connection Stable
                            </span>
                        </div>
                        <div className={cn(
                            "px-4 py-2 rounded-md border-2 font-mono text-xl font-black shadow-inner flex items-center gap-3",
                            timeLeft < 300 ? "bg-red-50 border-red-200 text-red-600 animate-pulse" : "bg-muted/30 border-border text-primary"
                        )}>
                            <Timer className="w-5 h-5" />
                            {formatTime(timeLeft)}
                        </div>
                    </div>
                </header>

                <main className="flex-1 overflow-auto p-12 flex flex-col items-center relative">
                    <div className="w-full max-w-4xl space-y-10">
                        <div className="flex items-center justify-between border-b border-border/50 pb-6">
                            <div className="space-y-1">
                                <span className="text-muted-foreground font-black uppercase tracking-[0.2em] text-[10px]">Security Module {currentIdx + 1}</span>
                                <h3 className="text-sm font-bold text-foreground">Core Competency Assessment</h3>
                            </div>
                            <Button variant="ghost" size="sm" className="h-9 text-[10px] text-orange-600 font-black uppercase tracking-widest hover:bg-orange-500/5 rounded-full border border-orange-500/20">
                                <Flag className="w-3.5 h-3.5 mr-2" /> Mark for Audit
                            </Button>
                        </div>

                        <div className="space-y-8">
                            <h2 className="text-3xl font-bold leading-tight text-foreground tracking-tight">
                                {question.question}
                            </h2>

                            {question.type === "MCQ" && (
                                <RadioGroup className="grid gap-4 mt-10">
                                    {question.options?.map((opt, i) => (
                                        <div key={i} className="relative group">
                                            <RadioGroupItem
                                                value={i.toString()}
                                                id={`opt-${i}`}
                                                className="absolute left-6 top-1/2 -translate-y-1/2 z-10 border-primary"
                                            />
                                            <Label
                                                htmlFor={`opt-${i}`}
                                                className="flex items-center p-6 pl-14 rounded-md border-2 border-border bg-card hover:bg-primary/5 hover:border-primary/30 transition-all cursor-pointer shadow-sm group-hover:shadow-md text-xl font-medium"
                                            >
                                                {opt}
                                            </Label>
                                        </div>
                                    ))}
                                </RadioGroup>
                            )}

                            {question.type === "Multi-select" && (
                                <div className="grid gap-4 mt-10">
                                    {question.options?.map((opt, i) => (
                                        <div key={i} className="relative group">
                                            <Checkbox
                                                id={`check-${i}`}
                                                className="absolute left-6 top-1/2 -translate-y-1/2 z-10 border-primary data-[state=checked]:bg-primary"
                                            />
                                            <Label
                                                htmlFor={`check-${i}`}
                                                className="flex items-center p-6 pl-14 rounded-md border-2 border-border bg-card hover:bg-primary/5 hover:border-primary/30 transition-all cursor-pointer shadow-sm group-hover:shadow-md text-xl font-medium w-full"
                                            >
                                                {opt}
                                            </Label>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {question.type === "Short Answer" && (
                                <div className="mt-10">
                                    <Input
                                        placeholder="Enter cryptographic hash or literal response..."
                                        className="bg-card border-2 border-border h-16 text-xl focus-visible:ring-primary shadow-inner font-bold text-foreground px-6 rounded-md"
                                    />
                                </div>
                            )}

                            {question.type === "Long Answer" && (
                                <div className="mt-10">
                                    <Textarea
                                        placeholder="Detailed structural analysis output..."
                                        className="bg-card border-2 border-border min-h-[400px] text-lg leading-relaxed focus-visible:ring-primary shadow-inner font-medium text-foreground p-8 rounded-md"
                                    />
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Bottom Status */}
                    <div className="sticky bottom-0 mt-20 w-full max-w-4xl py-6 border-t border-border bg-background/80 backdrop-blur-md flex items-center justify-between">
                        <div className="flex gap-4">
                            <Button
                                variant="outline"
                                className="border-2 border-border hover:bg-muted font-black px-8 h-12 rounded-md text-xs uppercase tracking-widest transition-all"
                                disabled={currentIdx === 0}
                                onClick={() => {
                                    setCurrentIdx(prev => prev - 1);
                                    handleSave();
                                }}
                            >
                                <ChevronLeft className="w-4 h-4 mr-2" /> Back
                            </Button>
                        </div>

                        <div className="flex gap-4">
                            <Button variant="ghost" className="text-muted-foreground font-black hover:text-foreground hover:bg-muted px-6 uppercase tracking-widest text-[10px]">
                                Flush Cache
                            </Button>
                            <Button onClick={handleSave} className="bg-muted text-foreground font-black px-8 h-12 rounded-md hover:bg-muted/80 transition-all">
                                Snapshot Response
                            </Button>
                        </div>

                        <Button
                            className="bg-primary hover:bg-primary/90 text-primary-foreground font-black px-12 h-12 rounded-md shadow-lg shadow-primary/20 transition-all text-xs uppercase tracking-widest"
                            onClick={() => {
                                if (currentIdx < mockQuestions.length - 1) {
                                    setCurrentIdx(prev => prev + 1);
                                    handleSave();
                                } else {
                                    handleSubmit();
                                }
                            }}
                        >
                            {currentIdx === mockQuestions.length - 1 ? "End Session" : "Next Module"}
                            {currentIdx < mockQuestions.length - 1 && <ChevronRight className="w-4 h-4 ml-2" />}
                        </Button>
                    </div>
                </main>
            </div>

            {/* Security Border */}
            <div className="fixed inset-0 pointer-events-none border-t-4 border-primary/40 z-[100] shadow-[inset_0_10px_10px_-10px_rgba(139,92,246,0.3)]" />

            {/* Fullscreen Restriction Overlay */}
            {!isFullscreen && (
                <div className="fixed inset-0 bg-background/95 backdrop-blur-2xl z-[200] flex items-center justify-center p-6 transition-all duration-500 animate-in fade-in">
                    <Card className="max-w-lg w-full border-red-500/50 shadow-[0_0_50px_rgba(239,68,68,0.2)] bg-card/50">
                        <CardHeader className="text-center pb-6">
                            <div className="mx-auto w-20 h-20 bg-red-500/10 rounded-md flex items-center justify-center mb-4 text-red-600 border border-red-500/20 animate-pulse">
                                <ShieldAlert className="w-12 h-12" />
                            </div>
                            <CardTitle className="text-3xl font-black text-foreground tracking-tight">Security Lockout</CardTitle>
                            <CardDescription className="text-red-600 font-bold uppercase tracking-widest text-xs mt-2">Violation Detected: Fullscreen Exited</CardDescription>
                        </CardHeader>
                        <CardContent className="text-center space-y-6 px-10">
                            <div className="bg-red-500/5 border border-red-500/10 rounded-md p-4 space-y-1">
                                <p className="text-xs font-black text-red-600 uppercase tracking-tighter">Violation Count</p>
                                <p className="text-4xl font-black text-red-600">{violations}</p>
                            </div>
                            <p className="text-sm text-muted-foreground font-medium leading-relaxed">
                                Continuous monitoring has detected an exit from the secure environment. This incident has been logged. You must return to fullscreen immediately to continue the examination.
                            </p>
                        </CardContent>
                        <CardFooter className="pt-4 pb-10 px-10">
                            <Button
                                onClick={reEnterFullscreen}
                                className="w-full bg-red-600 hover:bg-red-700 text-white font-black h-14 text-lg rounded-md transition-all shadow-lg shadow-red-500/30"
                            >
                                Resume Secure Session
                            </Button>
                        </CardFooter>
                    </Card>
                </div>
            )}

            {/* Screen Share Restriction Overlay */}
            {!isScreenSharing && (
                <div className="fixed inset-0 bg-background/95 backdrop-blur-2xl z-[300] flex items-center justify-center p-6 animate-in fade-in">
                    <Card className="max-w-lg w-full border-primary/50 shadow-[0_0_50px_rgba(139,92,246,0.2)] bg-card/50">
                        <CardHeader className="text-center pb-6">
                            <div className="mx-auto w-20 h-20 bg-primary/10 rounded-md flex items-center justify-center mb-4 text-primary border border-primary/20 animate-bounce">
                                <Monitor className="w-12 h-12" />
                            </div>
                            <CardTitle className="text-3xl font-black text-foreground tracking-tight">Monitoring Required</CardTitle>
                            <CardDescription className="text-primary font-bold uppercase tracking-widest text-xs mt-2">Active Screen Export Blocked</CardDescription>
                        </CardHeader>
                        <CardContent className="text-center space-y-6 px-10">
                            <p className="text-sm text-muted-foreground font-medium leading-relaxed">
                                You have stopped sharing your screen. To prevent unauthorized secondary displays or recording software, active screen monitoring must remain enabled throughout the session.
                            </p>
                        </CardContent>
                        <CardFooter className="pt-4 pb-10 px-10">
                            <Button
                                onClick={startScreenShare}
                                className="w-full bg-primary hover:bg-primary/90 text-white font-black h-14 text-lg rounded-md transition-all shadow-lg shadow-primary/30"
                            >
                                Re-enable Screen Monitoring
                            </Button>
                        </CardFooter>
                    </Card>
                </div>
            )}
        </div>
    );
}
