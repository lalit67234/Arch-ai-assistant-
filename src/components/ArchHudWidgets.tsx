import React, { useEffect, useState } from "react";
import { Cpu, Wifi, Battery, HardDrive, Brain, Activity } from "lucide-react";
import { LiveState } from "../lib/audio";
import { archConsciousness, CognitiveSelfState } from "../lib/archConsciousness";

interface ArchHudWidgetsProps {
  state: LiveState;
  getAudioData?: () => Uint8Array | null;
  onOpenCognitiveMatrix?: () => void;
}

export const ArchHudWidgets: React.FC<ArchHudWidgetsProps> = ({
  state,
  getAudioData,
  onOpenCognitiveMatrix
}) => {
  const [batteryLevel, setBatteryLevel] = useState<number>(78);
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);
  const [waveHeights, setWaveHeights] = useState<number[]>([12, 24, 40, 18, 28, 48, 20, 14]);
  const [cognitiveState, setCognitiveState] = useState<CognitiveSelfState>(archConsciousness.getState());

  useEffect(() => {
    const unsub = archConsciousness.subscribe((c) => setCognitiveState(c));
    return () => unsub();
  }, []);

  // Battery detection fallback
  useEffect(() => {
    if ("getBattery" in navigator) {
      (navigator as any).getBattery().then((battery: any) => {
        setBatteryLevel(Math.round(battery.level * 100));
        battery.addEventListener("levelchange", () => {
          setBatteryLevel(Math.round(battery.level * 100));
        });
      }).catch(() => {});
    }

    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  // Animate audio waveform bars from live FFT or pulse
  useEffect(() => {
    let animId: number;
    const updateWave = () => {
      if (getAudioData) {
        const data = getAudioData();
        if (data && data.length > 0) {
          const step = Math.floor(data.length / 8);
          const heights = [];
          for (let i = 0; i < 8; i++) {
            const val = data[i * step] || 0;
            heights.push(Math.max(10, Math.min(60, (val / 255) * 60)));
          }
          setWaveHeights(heights);
        } else {
          // Synthetic ambient activity
          const base = state === "speaking" ? 35 : state === "listening" ? 22 : 12;
          setWaveHeights(prev =>
            prev.map((_, i) => Math.max(8, base + Math.sin(Date.now() * 0.008 + i) * (base * 0.6)))
          );
        }
      }
      animId = requestAnimationFrame(updateWave);
    };

    animId = requestAnimationFrame(updateWave);
    return () => cancelAnimationFrame(animId);
  }, [getAudioData, state]);

  return (
    <div className="w-full flex items-start justify-between px-3 sm:px-6 md:px-8 pointer-events-none select-none z-10">
      {/* Left HUD: LISTENING & WAVEFORM */}
      <div className="relative w-36 sm:w-44 md:w-48 p-2.5 sm:p-3 rounded-lg border border-cyan-500/30 bg-black/40 backdrop-blur-md shadow-[0_0_15px_rgba(0,240,255,0.08)]">
        {/* Futuristic Corner Brackets */}
        <div className="absolute top-0 left-0 w-2.5 h-2.5 border-t-2 border-l-2 border-cyan-400" />
        <div className="absolute bottom-0 right-0 w-2.5 h-2.5 border-b-2 border-r-2 border-cyan-400" />

        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] sm:text-[11px] font-mono font-bold tracking-wider text-cyan-300 uppercase">
            {state === "speaking" ? "ARCH ANSWERING..." : state === "listening" ? "LISTENING..." : state === "connecting" ? "CONNECTING..." : "MONITORING..."}
          </span>
          <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
        </div>

        {/* Vertical Neon Waveform Spectrum Bars */}
        <div className="h-10 sm:h-12 flex items-end justify-between gap-1 px-1">
          {waveHeights.map((h, idx) => (
            <div
              key={idx}
              className="flex-1 rounded-t-sm transition-all duration-75"
              style={{
                height: `${h}px`,
                background: state === "speaking"
                  ? "linear-gradient(to top, rgba(14,165,233,0.3), rgba(0,240,255,0.9), #ffffff)"
                  : state === "listening"
                  ? "linear-gradient(to top, rgba(6,182,212,0.3), rgba(34,211,238,0.9))"
                  : "linear-gradient(to top, rgba(14,165,233,0.2), rgba(0,240,255,0.4))",
                boxShadow: state !== "disconnected" ? "0 0 8px rgba(0,240,255,0.6)" : "none"
              }}
            />
          ))}
        </div>
      </div>

      {/* Right HUD: AI CORE & TELEMETRY */}
      <div 
        onClick={onOpenCognitiveMatrix}
        className="relative pointer-events-auto cursor-pointer w-44 sm:w-52 md:w-56 p-2.5 sm:p-3 rounded-lg border border-cyan-500/30 hover:border-cyan-400/60 bg-black/40 backdrop-blur-md shadow-[0_0_15px_rgba(0,240,255,0.08)] transition-all group"
        title="Click to view ARCH Cognitive Self-Awareness Matrix"
      >
        {/* Futuristic Corner Brackets */}
        <div className="absolute top-0 right-0 w-2.5 h-2.5 border-t-2 border-r-2 border-cyan-400" />
        <div className="absolute bottom-0 left-0 w-2.5 h-2.5 border-b-2 border-l-2 border-cyan-400" />

        {/* Header: AI CORE & COGNITION */}
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex items-center space-x-1.5">
            <Brain className="w-3.5 h-3.5 text-cyan-400 group-hover:animate-pulse" />
            <span className="text-[10px] sm:text-[11px] font-mono font-bold tracking-wider text-cyan-300 uppercase">
              COGNITIVE CORE
            </span>
          </div>
          <span className="text-[9px] font-mono text-cyan-300 font-bold border border-cyan-500/40 px-1.5 py-0.2 rounded bg-cyan-950/40 group-hover:bg-cyan-900/50">
            MATRIX
          </span>
        </div>

        {/* Progress Bar with Confidence Color */}
        <div className="w-full h-1 bg-cyan-950 rounded-full overflow-hidden mb-2 border border-cyan-500/30">
          <div 
            className="h-full bg-cyan-400 shadow-[0_0_8px_#00f0ff] transition-all duration-300"
            style={{ width: `${Math.round(cognitiveState.epistemicConfidence * 100)}%` }} 
          />
        </div>

        {/* Telemetry Metrics */}
        <div className="space-y-1 text-[9px] sm:text-[10px] font-mono">
          <div className="flex items-center justify-between text-cyan-300/80">
            <div className="flex items-center space-x-1">
              <Activity className="w-3 h-3 text-cyan-400/80" />
              <span>PHASE</span>
            </div>
            <span className="text-white font-semibold uppercase text-[8.5px] truncate max-w-[90px]" title={cognitiveState.operationalPhase}>
              {cognitiveState.operationalPhase.replace("_", " ")}
            </span>
          </div>

          <div className="flex items-center justify-between text-cyan-300/80">
            <div className="flex items-center space-x-1">
              <HardDrive className="w-3 h-3 text-cyan-400/80" />
              <span>CONFIDENCE</span>
            </div>
            <span className="text-white font-semibold">
              {Math.round(cognitiveState.epistemicConfidence * 100)}%
            </span>
          </div>

          <div className="flex items-center justify-between text-cyan-300/80">
            <div className="flex items-center space-x-1">
              <Battery className="w-3 h-3 text-cyan-400/80" />
              <span>BATTERY</span>
            </div>
            <span className="text-white font-semibold">{batteryLevel}%</span>
          </div>

          <div className="flex items-center justify-between text-cyan-300/80">
            <div className="flex items-center space-x-1">
              <Wifi className="w-3 h-3 text-cyan-400/80" />
              <span>INTERNET</span>
            </div>
            <span className={`font-semibold ${isOnline ? "text-emerald-400" : "text-amber-400"}`}>
              {isOnline ? "CONNECTED" : "OFFLINE"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
