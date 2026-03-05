"use client";

import { useState, useEffect, useRef } from "react";
import * as tf from "@tensorflow/tfjs";
import * as cocoSsd from "@tensorflow-models/coco-ssd";
import { invoke } from "@tauri-apps/api/core";
import { readFile } from "@tauri-apps/plugin-fs";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Monitor, MonitorOff, AlertTriangle, Camera, EyeOff, Video, VideoOff } from "lucide-react";
import { useRouter } from "next/navigation";
import { getScreenshotableMonitors, getMonitorScreenshot } from "tauri-plugin-screenshots-api";

export default function DebugPage() {
  const router = useRouter();
  const [mirrorStatus, setMirrorStatus] = useState<"unknown" | "mirrored" | "safe">("unknown");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [tabSwitchCount, setTabSwitchCount] = useState(0);

  // Camera State
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const modelRef = useRef<cocoSsd.ObjectDetection | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

  // AI State
  const [modelLoaded, setModelLoaded] = useState(false);
  const [personCount, setPersonCount] = useState(0);
  const [phoneDetected, setPhoneDetected] = useState(false);

  // Load Model Once
  useEffect(() => {
    const loadModel = async () => {
      try {
        await tf.ready();
        const model = await cocoSsd.load();
        modelRef.current = model;
        setModelLoaded(true);
      } catch (err) {
        console.error("Failed to load COCO-SSD model", err);
      }
    };
    loadModel();
  }, []);

  useEffect(() => {
    let unlistenPromise: Promise<() => void> | null = null;

    const setupListener = () => {
      try {
        const appWindow = getCurrentWindow();
        unlistenPromise = appWindow.onFocusChanged(({ payload: focused }) => {
          if (!focused) {
            setTabSwitchCount((prev) => prev + 1);
          }
        });
      } catch (err) {
        console.error("Failed to setup blur listener", err);
      }
    };

    setupListener();

    return () => {
      if (unlistenPromise) {
        unlistenPromise.then((unlisten) => unlisten()).catch(console.error);
      }
      stopCamera();
    };
  }, []);

  const startCamera = async () => {
    setCameraError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      if (videoRef.current) {
        setIsCameraActive(true);
        videoRef.current.srcObject = stream;
        // Start detection loop once video starts playing
        videoRef.current.onloadeddata = () => {
          detectFrame();
        };
      }
    } catch (err: any) {
      setCameraError(err?.message || "Failed to access webcam. Please check permissions.");
    }
  };

  const detectFrame = async () => {
    if (!videoRef.current || !canvasRef.current || !modelRef.current) return;

    const video = videoRef.current;
    if (video.readyState === 4) {
      // Get inferences
      const predictions = await modelRef.current.detect(video);

      // Process predictions
      let tempPersonCount = 0;
      let tempPhoneDetected = false;

      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d");

      if (ctx) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Ensure styling matches flipped CSS scaling
        ctx.font = "16px sans-serif";
        ctx.textBaseline = "top";

        predictions.forEach((prediction) => {
          if (prediction.class !== "person" && prediction.class !== "cell phone") return;

          const [x, y, width, height] = prediction.bbox;

          if (prediction.class === "person") tempPersonCount++;
          if (prediction.class === "cell phone") tempPhoneDetected = true;

          // Draw Bounding Box (Consistent safe color for recognized objects)
          const color = "#22c55e";

          ctx.strokeStyle = color;
          ctx.lineWidth = 4;
          // IMPORTANT: Because our video element has scale-x-[-1] (CSS flip), 
          // the canvas coordinates do NOT match visual space unless we draw normally and flip the canvas via CSS too.
          ctx.strokeRect(x, y, width, height);

          // Draw Label Background
          ctx.fillStyle = color;
          const textWidth = ctx.measureText(prediction.class).width;
          const textHeight = 24;
          ctx.fillRect(x, y, textWidth + 8, textHeight);

          // Draw Label Text
          ctx.fillStyle = "#FFFFFF";
          ctx.fillText(`${prediction.class} (${Math.round(prediction.score * 100)}%)`, x + 4, y + 4);
        });
      }

      setPersonCount(tempPersonCount);
      setPhoneDetected(tempPhoneDetected);
    }

    // Continue loop
    animationFrameRef.current = requestAnimationFrame(detectFrame);
  };

  const stopCamera = () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }

    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((track) => track.stop());
      videoRef.current.srcObject = null;
      setIsCameraActive(false);
      setPersonCount(0);
      setPhoneDetected(false);

      // Clear canvas
      if (canvasRef.current) {
        const ctx = canvasRef.current.getContext("2d");
        if (ctx) ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      }
    }
  };

  const testMirroring = async () => {
    setLoading(true);
    setError(null);
    try {
      const isMirrored = await invoke<boolean>("check_screen_mirroring");
      if (isMirrored) {
        setMirrorStatus("mirrored");
      } else {
        setMirrorStatus("safe");
      }
    } catch (err: any) {
      setError(err?.toString() || "An unknown error occurred");
      setMirrorStatus("unknown");
    } finally {
      setLoading(false);
    }
  };

  const [screenshotData, setScreenshotData] = useState<string | null>(null);
  const [screenshotLoading, setScreenshotLoading] = useState(false);
  const [screenshotError, setScreenshotError] = useState<string | null>(null);

  const testScreenshot = async () => {
    setScreenshotLoading(true);
    setScreenshotError(null);
    try {
      const monitors = await getScreenshotableMonitors();
      if (!monitors || monitors.length === 0) {
        throw new Error("No primary monitor detected for screenshot.");
      }

      // Capture the first monitor (usually primary)
      const monitorId = monitors[0].id;
      const responsePath = await getMonitorScreenshot(monitorId);

      // The plugin returns a local file system path to the saved PNG.
      // We must convert it into an asset protocol URL for the WebView to render it.
      if (typeof responsePath === "string") {
        const uint8Arr = await readFile(responsePath);

        // Convert Uint8Array to base64
        let binary = '';
        const len = uint8Arr.byteLength;
        for (let i = 0; i < len; i++) {
          binary += String.fromCharCode(uint8Arr[i]);
        }
        const base64Data = window.btoa(binary);

        setScreenshotData(`data:image/png;base64,${base64Data}`);
      } else {
        throw new Error("Invalid response from screenshot plugin: expected string path.");
      }

    } catch (err: any) {
      setScreenshotError(err?.toString() || "An unknown error occurred while capturing screen.");
    } finally {
      setScreenshotLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background text-foreground p-6 relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-primary/5 via-background to-background pointer-events-none" />

      <div className="w-full max-w-md relative z-10 space-y-8 animate-in fade-in zoom-in duration-500">
        <Button
          variant="ghost"
          onClick={() => router.push("/")}
          className="absolute -top-12 left-0 text-muted-foreground hover:text-foreground hover:bg-muted/20"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Home
        </Button>

        <div className="text-center space-y-2">
          <div className="mx-auto w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4 border border-border">
            <AlertTriangle className="w-8 h-8 text-muted-foreground" />
          </div>
          <h1 className="text-3xl font-black tracking-tight text-foreground">Debug Tools</h1>
          <p className="text-muted-foreground text-sm">Test system capabilities and security features</p>
        </div>

        <div className="bg-card border border-border rounded-xl p-8 shadow-xl space-y-6">
          <div className="space-y-4">
            <h2 className="text-xl font-bold border-b border-border pb-2">Screen Mirroring Test</h2>
            <p className="text-sm text-muted-foreground">
              This tests the native macOS CoreGraphics API to detect physical or software (AirPlay/Sidecar) display mirroring.
            </p>

            <div className="flex flex-col gap-4 pt-2">
              <Button
                onClick={testMirroring}
                disabled={loading}
                className="w-full font-bold h-12"
              >
                {loading ? "Checking..." : "Check Mirroring Status"}
              </Button>

              <div className="mt-4 p-4 rounded-lg bg-muted/50 border border-border min-h-[100px] flex items-center justify-center">
                {error ? (
                  <div className="text-destructive text-sm text-center font-mono">
                    Error: {error}
                  </div>
                ) : mirrorStatus === "mirrored" ? (
                  <div className="flex flex-col items-center gap-2 text-destructive font-bold text-center">
                    <Monitor className="w-8 h-8 animate-pulse" />
                    <span>MIRRORING DETECTED!</span>
                  </div>
                ) : mirrorStatus === "safe" ? (
                  <div className="flex flex-col items-center gap-2 text-green-500 font-bold text-center">
                    <MonitorOff className="w-8 h-8" />
                    <span>No Mirroring Detected. Safe.</span>
                  </div>
                ) : (
                  <div className="text-muted-foreground text-sm font-mono opacity-50">
                    Awaiting test execution...
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-4 pt-4 mt-6 border-t border-border">
            <h2 className="text-xl font-bold border-b border-border pb-2">Active Tab Switch / Focus Tracker</h2>
            <p className="text-sm text-muted-foreground">
              This measures how many times the user switches away from the application window (alt-tabs or clicks elsewhere).
            </p>

            <div className="flex flex-col gap-4 pt-2">
              <div className="p-6 rounded-lg bg-orange-500/10 border border-orange-500/20 flex flex-col items-center justify-center space-y-2">
                <EyeOff className="w-10 h-10 text-orange-500 animate-pulse" />
                <div className="text-5xl font-black text-foreground">
                  {tabSwitchCount}
                </div>
                <div className="text-sm font-bold text-orange-500 uppercase tracking-widest">
                  Window focus lost
                </div>
              </div>
              <Button
                onClick={() => setTabSwitchCount(0)}
                variant="outline"
                className="w-full text-xs"
              >
                Reset Counter
              </Button>
            </div>
          </div>

          <div className="space-y-4 pt-4 mt-6 border-t border-border">
            <h2 className="text-xl font-bold border-b border-border pb-2">Full Screen Capture Test</h2>
            <p className="text-sm text-muted-foreground">
              This tests the native Tauri screenshot capability, forcing a full capture of the primary monitor without browser prompts.
            </p>

            <div className="flex flex-col gap-4 pt-2">
              <Button
                onClick={testScreenshot}
                disabled={screenshotLoading}
                variant="secondary"
                className="w-full font-bold h-12"
              >
                {screenshotLoading ? "Capturing..." : "Capture Entire Screen"}
              </Button>

              <div className="mt-4 p-4 rounded-lg bg-muted/50 border border-border min-h-[100px] flex flex-col items-center justify-center">
                {screenshotError ? (
                  <div className="text-destructive text-sm text-center font-mono">
                    Error: {screenshotError}
                  </div>
                ) : screenshotData ? (
                  <div className="flex flex-col items-center gap-3 w-full">
                    <div className="flex items-center gap-2 text-green-500 font-bold text-center text-sm">
                      <Camera className="w-4 h-4" />
                      <span>Capture Successful</span>
                    </div>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={screenshotData}
                      alt="Captured Screen"
                      className="w-full max-h-[300px] object-contain rounded border border-border mt-2 bg-black"
                    />
                  </div>
                ) : (
                  <div className="text-muted-foreground text-sm font-mono opacity-50">
                    Awaiting capture...
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-4 pt-4 mt-6 border-t border-border">
            <h2 className="text-xl font-bold border-b border-border pb-2">Live Webcam Feed</h2>
            <p className="text-sm text-muted-foreground">
              This tests local HTML5 WebRTC `getUserMedia` to verify the application has camera access and handles streaming correctly.
            </p>

            <div className="flex flex-col gap-4 pt-2">
              <div className="relative w-full aspect-video bg-black rounded-lg border border-border overflow-hidden flex items-center justify-center">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  style={{ display: isCameraActive ? "block" : "none" }}
                  className="absolute inset-0 w-full h-full object-cover scale-x-[-1]"
                />
                <canvas
                  ref={canvasRef}
                  style={{ display: isCameraActive ? "block" : "none" }}
                  className="absolute inset-0 w-full h-full object-cover pointer-events-none scale-x-[-1]"
                />

                {!isCameraActive && (
                  <div className="flex flex-col items-center gap-2 text-muted-foreground opacity-50">
                    <VideoOff className="w-12 h-12" />
                    <span className="text-sm font-bold uppercase tracking-widest">Camera Offline</span>
                  </div>
                )}

                {cameraError && !isCameraActive && (
                  <div className="absolute inset-0 bg-black/80 flex items-center justify-center p-4 z-10">
                    <span className="text-destructive font-mono text-center text-sm">{cameraError}</span>
                  </div>
                )}
              </div>

              {/* AI Detection Violations Flags */}
              <div className="flex flex-col gap-2">
                <div className={`flex items-center gap-3 p-3 rounded border font-bold ${personCount > 1 ? "bg-destructive/10 border-destructive text-destructive" : "bg-muted border-border text-muted-foreground"}`}>
                  <AlertTriangle className="w-5 h-5 flex-shrink-0" />
                  {personCount > 1 ? `Multiple People Detected! (${personCount})` : `Person Detection (Subject Only): Safe (${personCount})`}
                </div>
                <div className={`flex items-center gap-3 p-3 rounded border font-bold ${phoneDetected ? "bg-destructive/10 border-destructive text-destructive" : "bg-muted border-border text-muted-foreground"}`}>
                  <Camera className="w-5 h-5 flex-shrink-0" />
                  {phoneDetected ? "Mobile Phone Detected in Frame!" : "No Phones Detected: Safe"}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <Button
                  onClick={startCamera}
                  disabled={isCameraActive || !modelLoaded}
                  variant="secondary"
                  className="w-full font-bold h-12 bg-green-500/10 text-green-500 hover:bg-green-500/20 hover:text-green-400"
                >
                  <Video className="w-4 h-4 mr-2" />
                  {!modelLoaded ? "Loading AI Model..." : "Start Camera"}
                </Button>
                <Button
                  onClick={stopCamera}
                  disabled={!isCameraActive}
                  variant="outline"
                  className="w-full font-bold h-12 border-destructive/20 text-destructive hover:bg-destructive/10"
                >
                  <VideoOff className="w-4 h-4 mr-2" />
                  Stop Camera
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
