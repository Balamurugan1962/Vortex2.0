"use client";

import { useState, useEffect, useRef } from "react";
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
import { ToastProvider, useToast } from "@/components/ui/toast";
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
import * as api from "@/lib/api";
import { queueSubmission, syncPendingSubmissions } from "@/lib/sync-manager";

// Tauri-specific imports
const getTauriWindow = async () => {
    if (typeof window !== "undefined" && (window as any).__TAURI_INTERNALS__) {
        const { getCurrentWindow } = await import("@tauri-apps/api/window");
        return getCurrentWindow();
    }
    return null;
};

const invokeTauriCommand = async (command: string, args?: any) => {
    if (typeof window !== "undefined" && (window as any).__TAURI_INTERNALS__) {
        const { invoke } = await import("@tauri-apps/api/core");
        return invoke(command, args);
    }
    return null;
};

interface Violation {
    id?: number;
    timestamp: string;
    event_type: string;
    confidence: number;
    type?: string;
}

interface ViolationCounts {
    [key: string]: number;
}

const VIOLATION_MESSAGES: { [key: string]: string } = {
    NO_FACE_DETECTED: "No face detected in frame",
    MULTIPLE_FACE_DETECTED: "Multiple persons detected",
    PHONE_DETECTED: "Phone or gadget detected",
    LAPTOP_DETECTED: "Unauthorized laptop detected",
    MONITOR_DETECTED: "Additional monitor detected",
    VOICE_DETECTED: "Voice/audio detected",
    KEYBOARD_NAVIGATION_ATTEMPT: "Keyboard navigation attempt",
    WINDOW_SWITCH_DETECTED: "Window switching detected",
};

// Exam Data will be loaded from localStorage
interface Question {
    id: string | number;
    type: string;
    text: string;
    options?: string[];
    state?: string;
}

interface ExamBundle {
    id: number;
    title: string;
    questions: Question[];
    duration: number;
}

export default function ExamPage() {
    return (
        <ToastProvider>
            <ExamContent />
        </ToastProvider>
    );
}

function ExamContent() {
    const router = useRouter();
    const { addToast } = useToast();
    const [exam, setExam] = useState<ExamBundle | null>(null);
    const [questions, setQuestions] = useState<Question[]>([]);
    const [answers, setAnswers] = useState<{ [key: string]: any }>({});
    const [currentIdx, setCurrentIdx] = useState(0);
    const [timeLeft, setTimeLeft] = useState(3600);
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    const [lastSaved, setLastSaved] = useState(new Date());
    const [isSaving, setIsSaving] = useState(false);
    const [isOnline, setIsOnline] = useState(true);
    const [violations, setViolations] = useState(0);
    const [violationCounts, setViolationCounts] = useState<ViolationCounts>({});
    const [isFullscreen, setIsFullscreen] = useState(true);
    const [isScreenSharing, setIsScreenSharing] = useState(true);
    const [isMonitoringActive, setIsMonitoringActive] = useState(false);
    const wsRef = useRef<WebSocket | null>(null);
    const lastViolationTime = useRef<{ [key: string]: number }>({});

    // Thresholds
    const TOTAL_VIOLATION_THRESHOLD = 10;
    const SAME_TYPE_THRESHOLD = 3;
    const VIOLATION_COOLDOWN = 8000; // 8 seconds cooldown between same violation toasts

    // Load Exam Data on mount
    useEffect(() => {
        const loadExam = () => {
            const code = localStorage.getItem('vortex_current_exam_code');
            if (!code) {
                router.push('/student/connect');
                return;
            }

            const bundleStr = localStorage.getItem(`vortex_exam_${code}`);
            if (!bundleStr) {
                router.push('/student/connect');
                return;
            }

            const bundle: ExamBundle = JSON.parse(bundleStr);
            setExam(bundle);
            setQuestions(bundle.questions);
            setTimeLeft(bundle.duration * 60);

            // Load saved answers if any (Tauri persistence)
            const savedAnswers = localStorage.getItem(`vortex_answers_${bundle.id}`);
            if (savedAnswers) {
                setAnswers(JSON.parse(savedAnswers));
            }
        };

        const handleOfflineStatus = () => {
            setIsOnline(navigator.onLine);
            if (navigator.onLine) {
                syncPendingSubmissions();
            }
        };

        loadExam();
        setIsOnline(navigator.onLine);
        window.addEventListener('online', handleOfflineStatus);
        window.addEventListener('offline', handleOfflineStatus);
        syncPendingSubmissions();

        const startMonitoring = async () => {
            try {
                await invokeTauriCommand("start_exam_monitoring");
                setIsMonitoringActive(true);
                connectToViolationWebSocket();
            } catch (error) {
                console.error("Failed to start monitoring:", error);
            }
        };

        // startMonitoring(); // Disabled for testing/bypass

        return () => {
            stopMonitoring();
            window.removeEventListener('online', handleOfflineStatus);
            window.removeEventListener('offline', handleOfflineStatus);
        };
    }, []);

    const connectToViolationWebSocket = () => {
        try {
            const ws = new WebSocket("ws://localhost:8000/ws/violations");

            ws.onopen = () => {
                console.log("Connected to violation stream");
            };

            ws.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data) as Violation;

                    // Skip ping messages
                    if (data.type === "ping") return;

                    if (data.event_type && data.type === "violation") {
                        handleViolation(data);
                    }
                } catch (error) {
                    console.error("Error parsing violation data:", error);
                }
            };

            ws.onerror = (error) => {
                console.error("WebSocket error:", error);
            };

            ws.onclose = () => {
                console.log("Violation stream disconnected");
                // Attempt reconnection after 3 seconds
                setTimeout(() => {
                    if (isMonitoringActive) {
                        connectToViolationWebSocket();
                    }
                }, 3000);
            };

            wsRef.current = ws;
        } catch (error) {
            console.error("Failed to connect to violation stream:", error);
        }
    };

    const handleViolation = (violation: Violation) => {
        const { event_type } = violation;
        const now = Date.now();
        const lastTime = lastViolationTime.current[event_type] || 0;

        // Update violation counts
        setViolationCounts((prev) => ({
            ...prev,
            [event_type]: (prev[event_type] || 0) + 1,
        }));

        setViolations((prev) => prev + 1);

        // Show toast notification (with cooldown to prevent spam)
        if (now - lastTime > VIOLATION_COOLDOWN) {
            const message = VIOLATION_MESSAGES[event_type] || event_type;
            const count = violationCounts[event_type] || 0;

            addToast({
                title: "Security Alert",
                description: `${message} (${count + 1} times)`,
                variant: "destructive",
                duration: 6000,
            });

            lastViolationTime.current[event_type] = now;
        }

        // Check thresholds
        const totalViolations = violations + 1;
        const typeCount = (violationCounts[event_type] || 0) + 1;

        if (totalViolations >= TOTAL_VIOLATION_THRESHOLD) {
            addToast({
                title: "Exam Terminated",
                description: `Total violation threshold exceeded (${totalViolations})`,
                variant: "destructive",
                duration: 0,
            });
            setTimeout(() => handleSubmit("violations_exceeded"), 2000);
        } else if (typeCount >= SAME_TYPE_THRESHOLD) {
            addToast({
                title: "Warning",
                description: `Multiple ${VIOLATION_MESSAGES[event_type]?.toLowerCase()} violations detected`,
                variant: "warning",
                duration: 8000,
            });
        }
    };

    const stopMonitoring = async () => {
        try {
            if (wsRef.current) {
                wsRef.current.close();
                wsRef.current = null;
            }
            await invokeTauriCommand("stop_exam_monitoring");
            setIsMonitoringActive(false);
            console.log("Exam monitoring stopped");
        } catch (error) {
            console.error("Failed to stop monitoring:", error);
        }
    };

    useEffect(() => {
        const handleFullscreen = () => {
            const isFS = !!document.fullscreenElement;
            setIsFullscreen(isFS);
            if (!isFS) {
                setViolations(prev => prev + 1);
                addToast({
                    title: "Security Alert",
                    description: "Fullscreen mode exited",
                    variant: "warning",
                    duration: 5000,
                });
            }
        };

        const handleSecurityEvents = (e: Event) => {
            e.preventDefault();
            setViolations(prev => prev + 1);
            addToast({
                title: "Security Alert",
                description: "Unauthorized action detected",
                variant: "destructive",
                duration: 5000,
            });
        };

        const handleFocus = () => {
            if (!document.hasFocus()) {
                setViolations(prev => prev + 1);
                addToast({
                    title: "Security Alert",
                    description: "Window focus lost",
                    variant: "warning",
                    duration: 5000,
                });
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
    }, [addToast]);

    useEffect(() => {
        const timer = setInterval(() => {
            setTimeLeft(prev => {
                if (prev <= 1) {
                    clearInterval(timer);
                    handleSubmit("time_expired");
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

    const handleAnswerChange = (val: any) => {
        const currentQ = questions[currentIdx];
        if (!currentQ) return;

        const newAnswers = { ...answers, [currentQ.id]: val };
        setAnswers(newAnswers);

        // Persist to localStorage immediately (Tauri friendly)
        if (exam) {
            localStorage.setItem(`vortex_answers_${exam.id}`, JSON.stringify(newAnswers));
        }
    };

    const handleSave = () => {
        setIsSaving(true);
        setTimeout(() => {
            setLastSaved(new Date());
            setIsSaving(false);
        }, 300);
    };

    const handleSubmit = async (reason: string = "completed") => {
        if (!exam) return;

        await stopMonitoring();
        setIsSaving(true);

        try {
            await api.submitExamAnswers(exam.id, answers);
            console.log("Submission successful");
        } catch (error) {
            console.warn("Failed to submit online, queuing for later sync...");
            queueSubmission(exam.id, answers);
        } finally {
            setIsSaving(false);
            // Clear local draft after submission attempt (either success or queued)
            localStorage.removeItem(`vortex_answers_${exam.id}`);
            router.push(`/student/result?reason=${reason}&violations=${violations}`);
        }
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
                    {questions.map((q, idx) => {
                        const isAnswered = answers[q.id] !== undefined;
                        return (
                            <button
                                key={q.id}
                                onClick={() => setCurrentIdx(idx)}
                                className={cn(
                                    "h-11 rounded-md text-xs font-black transition-all flex items-center justify-center border-2",
                                    currentIdx === idx
                                        ? "bg-primary border-primary text-primary-foreground shadow-lg shadow-primary/30 scale-105"
                                        : isAnswered
                                            ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-600"
                                            : "bg-muted/30 border-border text-muted-foreground hover:border-primary/30"
                                )}
                            >
                                {idx + 1}
                            </button>
                        );
                    })}
                </div>

                <div className="p-6 border-t border-border bg-muted/5 space-y-4">
                    {/* Violation Summary */}
                    {violations > 0 && (
                        <div className="space-y-2 p-3 bg-red-500/5 border border-red-500/20 rounded-md">
                            <div className="flex items-center justify-between">
                                <span className="text-[10px] font-black uppercase tracking-tighter text-red-600">
                                    Total Violations
                                </span>
                                <Badge variant="destructive" className="font-bold">
                                    {violations}/{TOTAL_VIOLATION_THRESHOLD}
                                </Badge>
                            </div>
                            {Object.entries(violationCounts).map(([type, count]) => (
                                <div key={type} className="flex items-center justify-between text-xs">
                                    <span className="text-muted-foreground truncate">
                                        {VIOLATION_MESSAGES[type] || type}
                                    </span>
                                    <span className="text-red-600 font-bold ml-2">{count}</span>
                                </div>
                            ))}
                        </div>
                    )}

                    <div className="space-y-2">
                        <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-tighter">
                            <span className="text-muted-foreground">Progress Tracking</span>
                            <span className="text-primary">{Math.round((Object.keys(answers).length / questions.length || 0) * 100)}%</span>
                        </div>
                        <Progress value={(Object.keys(answers).length / questions.length || 0) * 100} className="h-1.5 bg-muted" />
                    </div>
                    <Button onClick={() => handleSubmit("manual")} className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-black h-12 shadow-lg shadow-primary/30 rounded-md transition-all">
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
                                {isSaving ? "Syncing..." : `Session Persisted at ${lastSaved.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
                            </span>
                            <span className={cn(
                                "text-[9px] font-black uppercase tracking-widest flex items-center gap-1.5 mt-0.5",
                                isOnline ? "text-emerald-500" : "text-amber-500"
                            )}>
                                {isOnline ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
                                {isOnline ? "Network Active" : "Offline Mode (Queued)"}
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
                    {!exam || questions.length === 0 ? (
                        <div className="flex-1 flex flex-col items-center justify-center space-y-6">
                            <Lock className="w-16 h-16 text-muted-foreground animate-pulse" />
                            <h2 className="text-xl font-bold text-muted-foreground">Initializing Secure Bundle...</h2>
                        </div>
                    ) : (
                        <div className="w-full max-w-4xl space-y-10">
                            <div className="flex items-center justify-between border-b border-border/50 pb-6">
                                <div className="space-y-1">
                                    <span className="text-muted-foreground font-black uppercase tracking-[0.2em] text-[10px]">Security Module {currentIdx + 1}</span>
                                    <h3 className="text-sm font-bold text-foreground">{exam.title}</h3>
                                </div>
                                <Button variant="ghost" size="sm" className="h-9 text-[10px] text-orange-600 font-black uppercase tracking-widest hover:bg-orange-500/5 rounded-full border border-orange-500/20">
                                    <Flag className="w-3.5 h-3.5 mr-2" /> Mark for Audit
                                </Button>
                            </div>

                            <div className="space-y-8">
                                <h2 className="text-3xl font-bold leading-tight text-foreground tracking-tight">
                                    {questions[currentIdx].text}
                                </h2>

                                {questions[currentIdx].type === "MCQ" && (
                                    <RadioGroup
                                        value={answers[questions[currentIdx].id]?.toString()}
                                        onValueChange={(val) => handleAnswerChange(parseInt(val))}
                                        className="grid gap-4 mt-10"
                                    >
                                        {questions[currentIdx].options?.map((opt, i) => (
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

                                {questions[currentIdx].type === "Multi-select" && (
                                    <div className="grid gap-4 mt-10">
                                        {questions[currentIdx].options?.map((opt, i) => {
                                            const currentAnswers = (answers[questions[currentIdx].id] as number[]) || [];
                                            return (
                                                <div key={i} className="relative group">
                                                    <Checkbox
                                                        id={`check-${i}`}
                                                        checked={currentAnswers.includes(i)}
                                                        onCheckedChange={(checked) => {
                                                            const newSelection = checked
                                                                ? [...currentAnswers, i]
                                                                : currentAnswers.filter(a => a !== i);
                                                            handleAnswerChange(newSelection);
                                                        }}
                                                        className="absolute left-6 top-1/2 -translate-y-1/2 z-10 border-primary data-[state=checked]:bg-primary"
                                                    />
                                                    <Label
                                                        htmlFor={`check-${i}`}
                                                        className="flex items-center p-6 pl-14 rounded-md border-2 border-border bg-card hover:bg-primary/5 hover:border-primary/30 transition-all cursor-pointer shadow-sm group-hover:shadow-md text-xl font-medium w-full"
                                                    >
                                                        {opt}
                                                    </Label>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}

                                {(questions[currentIdx].type === "Short Answer" || questions[currentIdx].type === "Long Answer") && (
                                    <div className="mt-10">
                                        {questions[currentIdx].type === "Long Answer" ? (
                                            <Textarea
                                                placeholder="Detailed structural analysis output..."
                                                value={answers[questions[currentIdx].id] || ""}
                                                onChange={(e) => handleAnswerChange(e.target.value)}
                                                className="bg-card border-2 border-border min-h-[400px] text-lg leading-relaxed focus-visible:ring-primary shadow-inner font-medium text-foreground p-8 rounded-md"
                                            />
                                        ) : (
                                            <Input
                                                placeholder="Enter cryptographic hash or literal response..."
                                                value={answers[questions[currentIdx].id] || ""}
                                                onChange={(e) => handleAnswerChange(e.target.value)}
                                                className="bg-card border-2 border-border h-16 text-xl focus-visible:ring-primary shadow-inner font-bold text-foreground px-6 rounded-md"
                                            />
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Bottom Status */}
                    {exam && questions.length > 0 && (
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
                                <Button onClick={handleSave} className="bg-muted text-foreground font-black px-8 h-12 rounded-md hover:bg-muted/80 transition-all">
                                    Snapshot Response
                                </Button>
                            </div>

                            <Button
                                className="bg-primary hover:bg-primary/90 text-primary-foreground font-black px-12 h-12 rounded-md shadow-lg shadow-primary/20 transition-all text-xs uppercase tracking-widest"
                                onClick={() => {
                                    if (currentIdx < questions.length - 1) {
                                        setCurrentIdx(prev => prev + 1);
                                        handleSave();
                                    } else {
                                        handleSubmit("completed");
                                    }
                                }}
                            >
                                {currentIdx === questions.length - 1 ? "End Session" : "Next Module"}
                                {currentIdx < questions.length - 1 && <ChevronRight className="w-4 h-4 ml-2" />}
                            </Button>
                        </div>
                    )}
                </main>
            </div>

            {/* Security Border */}
            <div className="fixed inset-0 pointer-events-none border-t-4 border-primary/40 z-[100] shadow-[inset_0_10px_10px_-10px_rgba(139,92,246,0.3)]" />

            {/* Fullscreen Restriction Overlay - DISABLED FOR TESTING */}
            {/* 
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
            */}

            {/* Screen Share Restriction Overlay - DISABLED FOR TESTING */}
            {/* 
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
            */}
        </div>
    );
}
