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
    return (
        <ToastProvider>
            <ExamContent />
        </ToastProvider>
    );
}

function ExamContent() {
    const router = useRouter();
    const { addToast } = useToast();
    const [permissionsVerified, setPermissionsVerified] = useState(false);
    const [isLoadingPermissions, setIsLoadingPermissions] = useState(true);
    const [currentIdx, setCurrentIdx] = useState(0);
    const [timeLeft, setTimeLeft] = useState(3600);
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    const [lastSaved, setLastSaved] = useState(new Date());
    const [isSaving, setIsSaving] = useState(false);
    const [violations, setViolations] = useState(0);
    const [violationCounts, setViolationCounts] = useState<ViolationCounts>({});
    const [showViolationWarning, setShowViolationWarning] = useState(false);
    const [isFullscreen, setIsFullscreen] = useState(true);
    const [isScreenSharing, setIsScreenSharing] = useState(true);
    const [isMonitoringActive, setIsMonitoringActive] = useState(false);
    const wsRef = useRef<WebSocket | null>(null);
    const lastViolationTime = useRef<{ [key: string]: number }>({});
    const lastFullscreenState = useRef<boolean>(true);
    const isTerminating = useRef<boolean>(false);
    const actualViolationCount = useRef<number>(0);  // Track actual count synchronously

    // Thresholds
    const TOTAL_VIOLATION_THRESHOLD = 10;
    const VIOLATION_WARNING_THRESHOLD = 5; // Warning at 5 violations
    const SAME_TYPE_THRESHOLD = 3;
    const VIOLATION_COOLDOWN = 8000; // 8 seconds cooldown between same violation toasts

    // Check permissions gate before allowing exam
    useEffect(() => {
        const checkPermissions = async () => {
            const granted = sessionStorage.getItem("vortex.permissions.granted");
            if (granted !== "true") {
                console.log("Permissions not granted, redirecting...");
                router.push("/student/permissions");
                return;
            }
            setPermissionsVerified(true);
            setIsLoadingPermissions(false);
        };

        checkPermissions();
    }, [router]);

    // Start monitoring on mount
    useEffect(() => {
        if (!permissionsVerified) return;

        const initializeExam = async () => {
            try {
                // Call backend to start exam and initialize camera
                const response = await fetch("http://localhost:8000/start_exam", {
                    method: "POST"
                });
                const data = await response.json();
                
                if (data.status === "error") {
                    addToast({
                        title: "Camera Error",
                        description: data.message || "Failed to initialize camera",
                        variant: "destructive",
                        duration: 5000,
                    });
                    return;
                }

                console.log("✅ Exam initialized - Violation limit: 10");
                
                // Also notify Tauri
                await invokeTauriCommand("start_exam_monitoring");
                setIsMonitoringActive(true);
                console.log("Exam monitoring started");

                // Connect to violation WebSocket
                connectToViolationWebSocket();

                // Request fullscreen on exam start
                setTimeout(() => reEnterFullscreen(), 500);
                
                addToast({
                    title: "Exam Started",
                    description: "Camera and monitoring initialized",
                    variant: "default",
                    duration: 3000,
                });
            } catch (error) {
                console.error("Failed to initialize exam:", error);
                addToast({
                    title: "Initialization Error",
                    description: String(error),
                    variant: "destructive",
                    duration: 5000,
                });
            }
        };

        initializeExam();

        return () => {
            stopMonitoring();
        };
    }, [permissionsVerified]);

    const connectToViolationWebSocket = () => {
        try {
            const ws = new WebSocket("ws://localhost:8000/ws/violations");

            ws.onopen = () => {
                console.log("Connected to violation stream");
                addToast({
                    title: "Monitoring Active",
                    description: "Live violation detection enabled",
                    variant: "default",
                    duration: 3000,
                });
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

            ws.onerror = (event) => {
                console.error("WebSocket connection error - Backend may not be running on port 8000");
                console.error("Error details:", event);
                addToast({
                    title: "Monitoring Connection Failed",
                    description: "Could not connect to monitoring service. Ensure backend is running on port 8000.",
                    variant: "destructive",
                    duration: 8000,
                });
            };

            ws.onclose = (event) => {
                console.log(`Violation stream disconnected (code: ${event.code}, reason: ${event.reason || 'unknown'})`);
                // Attempt reconnection after 3 seconds
                setTimeout(() => {
                    if (isMonitoringActive) {
                        console.log("Attempting to reconnect to violation stream...");
                        connectToViolationWebSocket();
                    }
                }, 3000);
            };

            wsRef.current = ws;
        } catch (error) {
            console.error("Failed to initialize WebSocket connection:", error);
            addToast({
                title: "Connection Error",
                description: "Failed to establish monitoring connection",
                variant: "destructive",
                duration: 5000,
            });
        }
    };

    const handleViolation = (violation: Violation) => {
        // Use the violation count from backend for strict enforcement
        const backendCount = (violation as any).violation_count;
        const maxViolations = (violation as any).max_violations || TOTAL_VIOLATION_THRESHOLD;
        
        if (backendCount) {
            // Backend is tracking - use its count
            actualViolationCount.current = backendCount;
            setViolations(backendCount);
        } else {
            // Fallback to frontend tracking
            actualViolationCount.current += 1;
            setViolations(actualViolationCount.current);
        }

        const totalViolations = actualViolationCount.current;

        // Update violation counts
        const { event_type } = violation;
        const now = Date.now();
        const lastTime = lastViolationTime.current[event_type] || 0;

        setViolationCounts((prev) => ({
            ...prev,
            [event_type]: (prev[event_type] || 0) + 1,
        }));

        // Show toast notification (with cooldown to prevent spam)
        if (now - lastTime > VIOLATION_COOLDOWN) {
            const message = VIOLATION_MESSAGES[event_type] || event_type;
            const count = violationCounts[event_type] || 0;

            addToast({
                title: "Security Alert",
                description: `${message} (Violation ${totalViolations}/${TOTAL_VIOLATION_THRESHOLD})`,
                variant: "destructive",
                duration: 6000,
            });

            lastViolationTime.current[event_type] = now;
        }

        // STRICT 10 VIOLATION LIMIT - Check immediately
        if (totalViolations >= TOTAL_VIOLATION_THRESHOLD) {
            if (!isTerminating.current) {
                isTerminating.current = true;
                console.log(`❌ EXAM TERMINATED: ${totalViolations}/${TOTAL_VIOLATION_THRESHOLD} violations reached`);
                addToast({
                    title: "Exam Terminated",
                    description: `Violation limit (${TOTAL_VIOLATION_THRESHOLD}) exceeded. Session ended.`,
                    variant: "destructive",
                    duration: 0,
                });
                setTimeout(() => handleSubmit("violations_exceeded"), 1000);
            }
            return;  // Stop processing
        }

        // Check for warning
        const typeCount = (violationCounts[event_type] || 0) + 1;
        
        if (totalViolations === VIOLATION_WARNING_THRESHOLD) {
            // Show warning modal at 5 violations
            setShowViolationWarning(true);
            addToast({
                title: "⚠️ EXAM WARNING",
                description: `You have ${totalViolations}/${TOTAL_VIOLATION_THRESHOLD} violations. Continue and you may be auto-terminated.`,
                variant: "warning",
                duration: 0,
            });
        } else if (typeCount >= SAME_TYPE_THRESHOLD) {
            addToast({
                title: "Warning",
                description: `Multiple ${VIOLATION_MESSAGES[event_type]?.toLowerCase()} violations detected (${typeCount}/${SAME_TYPE_THRESHOLD})`,
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
            
            // Stop exam on backend
            await fetch("http://localhost:8000/stop_exam", {
                method: "POST"
            });
            
            // Notify Tauri
            await invokeTauriCommand("stop_exam_monitoring");
            setIsMonitoringActive(false);
            console.log("Exam monitoring stopped");
        } catch (error) {
            console.error("Failed to stop monitoring:", error);
        }
    };

    useEffect(() => {
        let intervalId: ReturnType<typeof setInterval> | undefined;
        let isMounted = true;

        const syncFullscreenState = async () => {
            const tauriWin = await getTauriWindow();
            let isFS = false;

            if (tauriWin) {
                try {
                    isFS = await tauriWin.isFullscreen();
                } catch (e) {
                    console.error("Could not check fullscreen state:", e);
                    isFS = false;
                }
            } else {
                isFS = !!document.fullscreenElement;
            }

            if (!isMounted) return;

            setIsFullscreen(isFS);

            const previous = lastFullscreenState.current;
            if (previous && !isFS) {
                setViolations(prev => prev + 1);
                addToast({
                    title: "Security Alert",
                    description: "Fullscreen mode exited",
                    variant: "warning",
                    duration: 5000,
                });
            }
            lastFullscreenState.current = isFS;
        };

        const handleSecurityEvents = (e: Event) => {
            e.preventDefault();
            const eventType = e.type;
            const description = eventType === "copy" ? "Copy action blocked" : 
                              eventType === "cut" ? "Cut action blocked" : 
                              eventType === "paste" ? "Paste action blocked" : 
                              eventType === "contextmenu" ? "Right-click blocked" : 
                              "Unauthorized action detected";
            
            setViolations(prev => prev + 1);
            addToast({
                title: "Security Alert",
                description,
                variant: "destructive",
                duration: 5000,
            });
            console.warn(`Clipboard/context violation: ${eventType} blocked`);
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

        const handleFullscreenChange = () => {
            syncFullscreenState();
        };

        document.addEventListener("fullscreenchange", handleFullscreenChange);
        document.addEventListener("copy", handleSecurityEvents);
        document.addEventListener("cut", handleSecurityEvents);
        document.addEventListener("paste", handleSecurityEvents);
        document.addEventListener("contextmenu", handleSecurityEvents);
        window.addEventListener("blur", handleFocus);

        // Initial fullscreen check + Tauri fallback polling.
        syncFullscreenState();
        intervalId = setInterval(syncFullscreenState, 1000);

        return () => {
            isMounted = false;
            document.removeEventListener("fullscreenchange", handleFullscreenChange);
            document.removeEventListener("copy", handleSecurityEvents);
            document.removeEventListener("cut", handleSecurityEvents);
            document.removeEventListener("paste", handleSecurityEvents);
            document.removeEventListener("contextmenu", handleSecurityEvents);
            window.removeEventListener("blur", handleFocus);
            if (intervalId) clearInterval(intervalId);
        };
    }, [addToast]);
    // F11 key handler for fullscreen and keyboard shortcut blocking
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // F11 for fullscreen
            if (e.key === 'F11') {
                e.preventDefault();
                reEnterFullscreen();
            }

            // Block clipboard keyboard shortcuts: Ctrl+C, Ctrl+V, Ctrl+X
            if ((e.ctrlKey || e.metaKey) && ['c', 'v', 'x'].includes(e.key.toLowerCase())) {
                e.preventDefault();
                const action = e.key.toLowerCase() === 'c' ? 'Copy' : 
                              e.key.toLowerCase() === 'v' ? 'Paste' : 'Cut';
                setViolations(prev => prev + 1);
                addToast({
                    title: "Security Alert",
                    description: `${action} keyboard shortcut blocked`,
                    variant: "destructive",
                    duration: 5000,
                });
                console.warn(`Clipboard shortcut violation: ${action} (Ctrl+${e.key.toUpperCase()}) blocked`);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);


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

    const question = mockQuestions[currentIdx];

    const handleSave = () => {
        setIsSaving(true);
        setTimeout(() => {
            setLastSaved(new Date());
            setIsSaving(false);
        }, 600);
    };

    const handleSubmit = async (reason: string = "completed") => {
        await stopMonitoring();
        router.push(`/student/result?reason=${reason}&violations=${violations}`);
    };

    const reEnterFullscreen = async () => {
        try {
            const tauriWin = await getTauriWindow();
            if (tauriWin) {
                // Tauri desktop app
                await tauriWin.setFullscreen(true);
                setIsFullscreen(true);
            } else {
                // Web browser fallback
                if (!document.fullscreenElement) {
                    await document.documentElement.requestFullscreen({
                        navigationUI: "hide"
                    });
                }
                // State will be updated by fullscreenchange event
            }
        } catch (e) {
            console.error("Fullscreen restoration failed:", e);
            addToast({
                title: "Fullscreen Error",
                description: "Could not enter fullscreen. Please try pressing F11 or allow fullscreen permission.",
                variant: "destructive",
                duration: 5000,
            });
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

    if (isLoadingPermissions) {
        return (
            <div className="w-full h-screen flex items-center justify-center bg-background text-foreground">
                <div className="text-center space-y-4">
                    <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
                    <p className="text-muted-foreground font-medium">Verifying exam setup...</p>
                </div>
            </div>
        );
    }

    if (!permissionsVerified) {
        return null;
    }

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
                            <span className="text-primary">{Math.round((1 / 5) * 100)}%</span>
                        </div>
                        <Progress value={20} className="h-1.5 bg-muted" />
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
                                Violations: {violations}/10
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
                                    handleSubmit("completed");
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
                                                    <div className="bg-muted/50 border border-border rounded-md p-3 text-xs text-left space-y-1">
                                                        <p className="font-bold">Alternative methods:</p>
                                                        <p>• Press <kbd className="px-2 py-1 bg-background border rounded text-xs font-mono">F11</kbd> on your keyboard</p>
                                                        <p>• Click the button below</p>
                                                    </div>
                        </CardContent>
                        <CardFooter className="pt-4 pb-10 px-10 flex flex-col gap-3">
                            <Button
                                onClick={reEnterFullscreen}
                                className="w-full bg-red-600 hover:bg-red-700 text-white font-black h-14 text-lg rounded-md transition-all shadow-lg shadow-red-500/30"
                            >
                                Resume Secure Session
                                                        <Button
                                                            variant="ghost"
                                                            onClick={() => setIsFullscreen(true)}
                                                            className="w-full text-xs text-muted-foreground hover:text-foreground"
                                                        >
                                                            I am in fullscreen (dismiss this warning)
                                                        </Button>
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

            {/* Violation Warning Modal - at 5 violations */}
            {showViolationWarning && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[400] flex items-center justify-center p-6 animate-in fade-in">
                    <Card className="max-w-lg w-full border-orange-500/60 shadow-[0_0_60px_rgba(249,115,22,0.3)] bg-card/80">
                        <CardHeader className="text-center pb-6 border-b border-orange-500/20">
                            <div className="mx-auto w-24 h-24 bg-orange-500/15 rounded-full flex items-center justify-center mb-4 text-orange-600 border-2 border-orange-500/40 animate-pulse">
                                <AlertTriangle className="w-14 h-14" />
                            </div>
                            <CardTitle className="text-3xl font-black text-foreground tracking-tight">Exam Integrity Warning</CardTitle>
                            <CardDescription className="text-orange-600 font-bold uppercase tracking-widest text-xs mt-2">Suspicious Behavior Detected</CardDescription>
                        </CardHeader>
                        <CardContent className="text-center space-y-6 px-10 py-8">
                            <div className="space-y-3">
                                <p className="text-lg font-black text-orange-600">{violations} Violations Recorded</p>
                                <p className="text-sm text-muted-foreground leading-relaxed">
                                    You are engaging in prohibited exam behavior. Your actions are being monitored and logged.
                                </p>
                            </div>

                            <div className="bg-orange-500/10 border border-orange-500/30 rounded-lg p-4 space-y-2 text-left">
                                <p className="text-xs font-black text-orange-600 uppercase tracking-wider">⚠️ Important Notice:</p>
                                <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
                                    {Object.entries(violationCounts).map(([type, count]) => (
                                        <li key={type} className="text-orange-600/80 font-medium">
                                            {VIOLATION_MESSAGES[type] || type}: {count} time{count !== 1 ? 's' : ''}
                                        </li>
                                    ))}
                                </ul>
                            </div>

                            <div className="bg-red-500/5 border border-red-500/20 rounded-lg p-4">
                                <p className="text-xs font-bold text-red-600 uppercase tracking-wider mb-2">Threshold Warning:</p>
                                <div className="flex items-center gap-3">
                                    <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                                        <div 
                                            className="h-full bg-gradient-to-r from-orange-500 to-red-600 transition-all duration-300"
                                            style={{ width: `${(violations / TOTAL_VIOLATION_THRESHOLD) * 100}%` }}
                                        />
                                    </div>
                                    <span className="text-xs font-black text-red-600 whitespace-nowrap">{violations}/{TOTAL_VIOLATION_THRESHOLD}</span>
                                </div>
                                <p className="text-xs text-red-600/80 mt-2 font-medium">
                                    {TOTAL_VIOLATION_THRESHOLD - violations} more violations will auto-terminate your exam.
                                </p>
                            </div>
                        </CardContent>
                        <CardFooter className="pt-6 pb-10 px-10 flex flex-col gap-3 border-t border-orange-500/20">
                            <Button
                                onClick={() => setShowViolationWarning(false)}
                                className="w-full bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700 text-white font-black h-12 rounded-md transition-all shadow-lg shadow-orange-500/30"
                            >
                                I Understand - Resume Exam
                            </Button>
                            <p className="text-xs text-muted-foreground text-center font-medium">
                                Continue carefully. Each violation will be recorded.
                            </p>
                        </CardFooter>
                    </Card>
                </div>
            )}
        </div>
    );
}
