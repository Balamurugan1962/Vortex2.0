"use client";

import { useState, useEffect, useRef } from "react";
import * as tf from "@tensorflow/tfjs";
import * as cocoSsd from "@tensorflow-models/coco-ssd";
import { invoke } from "@tauri-apps/api/core";
import { readFile } from "@tauri-apps/plugin-fs";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  Monitor,
  MonitorOff,
  AlertTriangle,
  Camera,
  VideoOff,
  Users,
  Smartphone,
  Search,
  ExternalLink,
  ShieldAlert
} from "lucide-react";
import { useRouter } from "next/navigation";
import { getScreenshotableMonitors, getMonitorScreenshot } from "tauri-plugin-screenshots-api";

export default function DebugPage() {
  const router = useRouter();
  const [tabSwitchCount, setTabSwitchCount] = useState(0);
  const lastFocusTime = useRef<number>(0);

  // Process State
  const [processes, setProcesses] = useState<any[]>([]);
  const [processSearch, setProcessSearch] = useState("");
  const [processLoading, setProcessLoading] = useState(false);

  // Mirror State
  const [mirrorStatus, setMirrorStatus] = useState<"unknown" | "safe" | "mirrored">("unknown");
  const [mirrorLoading, setMirrorLoading] = useState(false);

  // Camera & AI State
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const modelRef = useRef<cocoSsd.ObjectDetection | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [modelLoaded, setModelLoaded] = useState(false);
  const [personCount, setPersonCount] = useState(0);
  const [phoneDetected, setPhoneDetected] = useState(false);

  // Screenshot State
  const [screenshotData, setScreenshotData] = useState<string | null>(null);
  const [screenshotLoading, setScreenshotLoading] = useState(false);

  // Load AI Model
  useEffect(() => {
    const loadModel = async () => {
      try {
        await tf.ready();
        modelRef.current = await cocoSsd.load();
        setModelLoaded(true);
      } catch (err) {
        console.error("Failed to load COCO-SSD model", err);
      }
    };
    loadModel();
  }, []);

  // Listen for Window Blur
  useEffect(() => {
    let unlisten: (() => void) | null = null;

    const setupListener = async () => {
      const appWindow = getCurrentWindow();
      unlisten = await appWindow.onFocusChanged(({ payload: focused }) => {
        // Debounce: prevent multiple triggers within 500ms
        const now = Date.now();
        if (!focused && (now - lastFocusTime.current > 500)) {
          setTabSwitchCount(prev => prev + 1);
          lastFocusTime.current = now;
        }
      });
    };

    setupListener();
    refreshProcesses();

    return () => {
      if (unlisten) unlisten();
      stopCamera();
    };
  }, []);

  const refreshProcesses = async () => {
    setProcessLoading(true);
    try {
      const list = await invoke<any[]>("get_running_apps");
      setProcesses(list.sort((a, b) => b.cpu_usage - a.cpu_usage));
    } catch (err) {
      console.error("Failed to fetch processes:", err);
    } finally {
      setProcessLoading(false);
    }
  };

  const testMirroring = async () => {
    setMirrorLoading(true);
    try {
      const isMirrored = await invoke<boolean>("check_screen_mirroring");
      setMirrorStatus(isMirrored ? "mirrored" : "safe");
    } catch (err) {
      console.error("Mirror check failed:", err);
      setMirrorStatus("unknown");
    } finally {
      setMirrorLoading(false);
    }
  };

  const closeProcess = async (pid: number) => {
    try {
      await invoke("kill_process", { pid });
      setTimeout(refreshProcesses, 500);
    } catch (err) { console.error(err); }
  };

  const startCamera = async () => {
    setCameraError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      if (videoRef.current) {
        setIsCameraActive(true);
        videoRef.current.srcObject = stream;
        videoRef.current.onloadeddata = () => detectFrame();
      }
    } catch (err: any) {
      setCameraError(err?.message || "Camera access failed.");
    }
  };

  const detectFrame = async () => {
    if (!videoRef.current || !canvasRef.current || !modelRef.current) return;
    const video = videoRef.current;
    if (video.readyState === 4) {
      const predictions = await modelRef.current.detect(video);
      let pCount = 0;
      let phone = false;

      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.strokeStyle = "#22c55e";
        ctx.lineWidth = 4;
        ctx.font = "16px sans-serif";

        predictions.forEach(p => {
          if (p.class === "person") pCount++;
          if (p.class === "cell phone") phone = true;

          if (p.class === "person" || p.class === "cell phone") {
            const [x, y, w, h] = p.bbox;
            ctx.strokeRect(x, y, w, h);
            ctx.fillStyle = "#22c55e";
            ctx.fillRect(x, y, ctx.measureText(p.class).width + 10, 25);
            ctx.fillStyle = "white";
            ctx.fillText(p.class, x + 5, y + 18);
          }
        });
      }
      setPersonCount(pCount);
      setPhoneDetected(phone);
    }
    animationFrameRef.current = requestAnimationFrame(detectFrame);
  };

  const stopCamera = () => {
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    if (videoRef.current?.srcObject) {
      (videoRef.current.srcObject as MediaStream).getTracks().forEach(t => t.stop());
      videoRef.current.srcObject = null;
      setIsCameraActive(false);
    }
  };

  const captureScreenshot = async () => {
    setScreenshotLoading(true);
    try {
      const monitors = await getScreenshotableMonitors();
      if (monitors?.length > 0) {
        const path = await getMonitorScreenshot(monitors[0].id);
        const uint8Arr = await readFile(path);
        let binary = '';
        for (let i = 0; i < uint8Arr.length; i++) binary += String.fromCharCode(uint8Arr[i]);
        setScreenshotData(`data:image/png;base64,${window.btoa(binary)}`);
      }
    } catch (err) { console.error(err); }
    finally { setScreenshotLoading(false); }
  };

  return (
    <div className="min-h-screen bg-background p-4 md:p-8 text-foreground">
      <div className="max-w-[1440px] mx-auto space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border pb-8">
          <div>
            <h1 className="text-5xl font-black tracking-tighter mb-2 uppercase">Debug</h1>
          </div>
          <Button variant="outline" size="lg" onClick={() => router.push('/')} className="rounded-full px-8 border-2 font-bold hover:bg-foreground hover:text-background transition-all">
            <ArrowLeft className="w-4 h-4 mr-2" /> EXIT DEBUG
          </Button>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
          {/* Main Column */}
          <div className="xl:col-span-8 space-y-8">
            {/* Live Feed Card */}
            <div className="bg-card rounded-3xl border border-border shadow-2xl overflow-hidden relative group">
              <div className="p-6 border-b border-border flex items-center justify-between bg-muted/20">
                <div className="flex items-center gap-3">
                  <div className={`w-3 h-3 rounded-full ${isCameraActive ? 'bg-green-500 animate-pulse' : 'bg-muted'}`} />
                  <h2 className="text-xl font-bold uppercase tracking-tight">AI Vision Feed</h2>
                </div>
                {!isCameraActive ? (
                  <Button onClick={startCamera} disabled={!modelLoaded} className="bg-primary hover:bg-primary/90 rounded-full px-6 font-bold shadow-lg shadow-primary/20">
                    <Camera className="w-4 h-4 mr-2" /> {!modelLoaded ? "LOADING MODEL..." : "ACTIVATE"}
                  </Button>
                ) : (
                  <Button onClick={stopCamera} variant="destructive" className="rounded-full px-6 font-bold">
                    <VideoOff className="w-4 h-4 mr-2" /> DEACTIVATE
                  </Button>
                )}
              </div>

              <div className="aspect-video bg-black relative">
                <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover scale-x-[-1]" style={{ display: isCameraActive ? 'block' : 'none' }} />
                <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none scale-x-[-1]" style={{ display: isCameraActive ? 'block' : 'none' }} />

                {!isCameraActive && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center space-y-4">
                    <div className="w-20 h-20 rounded-full bg-muted/10 flex items-center justify-center border border-white/5">
                      <Camera className="w-10 h-10 text-muted-foreground" />
                    </div>
                    <p className="text-muted-foreground font-mono text-sm uppercase tracking-widest opacity-50">Camera Standby</p>
                  </div>
                )}

                {cameraError && (
                  <div className="absolute inset-0 bg-destructive/10 backdrop-blur-sm flex items-center justify-center">
                    <div className="bg-background/80 p-4 rounded-xl border border-destructive text-destructive font-bold flex items-center gap-2">
                      <AlertTriangle className="w-5 h-5" /> {cameraError}
                    </div>
                  </div>
                )}
              </div>

              {/* Status Footer */}
              <div className="grid grid-cols-2 bg-muted/10">
                <div className={`p-8 border-r border-border flex items-center justify-between transition-colors ${personCount > 1 ? 'bg-destructive/10' : ''}`}>
                  <div className="space-y-1">
                    <p className="text-xs font-bold text-muted-foreground uppercase opacity-60">Occupancy</p>
                    <p className={`text-4xl font-black ${personCount > 1 ? 'text-destructive' : ''}`}>{personCount} PERS</p>
                  </div>
                  <Users className={`w-8 h-8 ${personCount > 1 ? 'text-destructive' : 'text-primary'}`} />
                </div>
                <div className={`p-8 flex items-center justify-between transition-colors ${phoneDetected ? 'bg-destructive/10' : ''}`}>
                  <div className="space-y-1">
                    <p className="text-xs font-bold text-muted-foreground uppercase opacity-60">Security</p>
                    <p className={`text-4xl font-black ${phoneDetected ? 'text-destructive' : ''}`}>{phoneDetected ? 'ALERT' : 'CLEAN'}</p>
                  </div>
                  <Smartphone className={`w-8 h-8 ${phoneDetected ? 'text-destructive animate-bounce' : 'text-primary'}`} />
                </div>
              </div>
            </div>

            {/* Screenshot Card */}
            <div className="bg-card rounded-3xl border border-border shadow-xl overflow-hidden">
              <div className="p-6 border-b border-border flex items-center justify-between">
                <h2 className="text-xl font-bold uppercase tracking-tight">External Monitor Capture</h2>
                <Button onClick={captureScreenshot} disabled={screenshotLoading} variant="outline" className="rounded-full font-bold">
                  {screenshotLoading ? "CAPTURING..." : "CAPTURE LOG"}
                </Button>
              </div>
              <div className="p-6">
                {screenshotData ? (
                  <div className="rounded-xl overflow-hidden border border-border shadow-inner bg-black">
                    <img src={screenshotData} alt="Diagnostic" className="w-full h-auto max-h-[500px] object-contain" />
                  </div>
                ) : (
                  <div className="h-[200px] rounded-xl border-2 border-dashed border-border flex items-center justify-center text-muted-foreground font-mono text-sm uppercase tracking-widest opacity-50">
                    Awaiting diagnostic trigger
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right Column */}
          <div className="xl:col-span-4 space-y-8">
            {/* App List Card */}
            <div className="bg-card rounded-3xl border border-border shadow-xl h-[500px] flex flex-col">
              <div className="p-6 border-b border-border">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-bold uppercase tracking-tight">Restricted Apps</h2>
                  <Button onClick={refreshProcesses} disabled={processLoading} size="sm" variant="ghost" className="h-8 w-8 p-0 rounded-full hover:bg-muted">
                    <Monitor className={`w-4 h-4 ${processLoading ? 'animate-spin' : ''}`} />
                  </Button>
                </div>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    value={processSearch}
                    onChange={e => setProcessSearch(e.target.value)}
                    placeholder="SEARCHING PROCESSES..."
                    className="w-full bg-muted/40 border-none rounded-2xl h-12 pl-10 pr-4 text-sm font-mono focus:ring-2 focus:ring-primary/20"
                  />
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
                {processes
                  .filter(p => !processSearch || p.name.toLowerCase().includes(processSearch.toLowerCase()))
                  .map(p => (
                    <div key={p.pid} className="flex items-center justify-between p-4 hover:bg-muted/30 rounded-2xl transition-all border border-transparent hover:border-border">
                      <div className="flex items-center gap-3 overflow-hidden">
                        <div className="w-10 h-10 flex-shrink-0 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-bold">
                          {p.name[0]?.toUpperCase() || '?'}
                        </div>
                        <div className="overflow-hidden">
                          <p className="text-sm font-bold truncate">{p.name}</p>
                          <p className="text-[10px] font-mono text-muted-foreground opacity-50">PID: {p.pid}</p>
                        </div>
                      </div>
                      <Button onClick={() => closeProcess(p.pid)} variant="destructive" size="sm" className="h-8 rounded-full text-[10px] font-black px-4 flex-shrink-0">
                        KILL
                      </Button>
                    </div>
                  ))}
                {processes.length === 0 && (
                  <div className="py-20 text-center space-y-4 opacity-30">
                    <ShieldAlert className="w-12 h-12 mx-auto" />
                    <p className="text-xs font-mono uppercase tracking-widest text-center">Environment Secured</p>
                  </div>
                )}
              </div>
            </div>

            {/* Mirroring Diagnostic Card */}
            <div className="bg-card rounded-3xl border border-border shadow-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold uppercase tracking-tight">Mirror Status</h2>
                <Button onClick={testMirroring} disabled={mirrorLoading} variant="outline" size="sm" className="rounded-full font-bold">
                  {mirrorLoading ? "CHECKING..." : "CHECK MIRRORING"}
                </Button>
              </div>
              <div className={`p-4 rounded-2xl border flex items-center gap-4 transition-all ${mirrorStatus === "mirrored" ? "bg-destructive/10 border-destructive" :
                mirrorStatus === "safe" ? "bg-green-500/10 border-green-500/50" : "bg-muted/50 border-border"
                }`}>
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${mirrorStatus === "mirrored" ? "bg-destructive text-white" :
                  mirrorStatus === "safe" ? "bg-green-500 text-white" : "bg-muted text-muted-foreground"
                  }`}>
                  {mirrorStatus === "mirrored" ? <MonitorOff className="w-6 h-6" /> : <Monitor className="w-6 h-6" />}
                </div>
                <div>
                  <p className="text-xs font-bold text-muted-foreground uppercase opacity-60 tracking-widest">Diagnostic Result</p>
                  <p className={`text-xl font-black uppercase ${mirrorStatus === "mirrored" ? "text-destructive" :
                    mirrorStatus === "safe" ? "text-green-500" : ""
                    }`}>
                    {mirrorStatus === "mirrored" ? "MIRRORED" : mirrorStatus === "safe" ? "NO MIRROR" : "UNKNOWN"}
                  </p>
                </div>
              </div>
            </div>

            {/* Focus Tracker Card */}
            <div className="bg-primary rounded-3xl p-8 text-primary-foreground shadow-2xl shadow-primary/30 relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 blur-3xl opacity-50" />
              <div className="relative z-10 flex flex-col h-full justify-between">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold uppercase tracking-widest text-xs opacity-70">Focus Violations</h3>
                  <ExternalLink className="w-4 h-4 opacity-50" />
                </div>
                <div className="py-10">
                  <span className="text-8xl font-black tabular-nums tracking-tighter leading-none">{tabSwitchCount}</span>
                  <p className="mt-4 text-sm font-medium opacity-80 leading-relaxed">System recorded window focus changes during active session mode.</p>
                </div>
                <Button onClick={() => setTabSwitchCount(0)} variant="secondary" className="bg-white/10 hover:bg-white/20 border-white/10 text-white rounded-full font-bold h-12">
                  RESET COUNTER
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
