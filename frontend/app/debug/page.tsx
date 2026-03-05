"use client";

import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { readFile } from "@tauri-apps/plugin-fs";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Monitor, MonitorOff, AlertTriangle, Camera, EyeOff } from "lucide-react";
import { useRouter } from "next/navigation";
import { getScreenshotableMonitors, getMonitorScreenshot } from "tauri-plugin-screenshots-api";

export default function DebugPage() {
  const router = useRouter();
  const [mirrorStatus, setMirrorStatus] = useState<"unknown" | "mirrored" | "safe">("unknown");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [tabSwitchCount, setTabSwitchCount] = useState(0);

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
    };
  }, []);

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
        </div>
      </div>
    </div>
  );
}
