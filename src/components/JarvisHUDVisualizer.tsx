import React, { useEffect, useState } from "react";
import { LiveState } from "../lib/audio";

interface JarvisHUDVisualizerProps {
  state: LiveState;
  volumeLevel?: number;
  activeProtocol?: string;
  isScreenSharing?: boolean;
}

export const JarvisHUDVisualizer: React.FC<JarvisHUDVisualizerProps> = ({
  state,
}) => {
  const [rotationDegree, setRotationDegree] = useState(0);
  const [pulsePhase, setPulsePhase] = useState(0);

  // Smooth rotational loop
  useEffect(() => {
    let animId: number;
    let currentDeg = 0;
    let phase = 0;

    const tick = () => {
      const speed = state === "speaking" ? 1.4 : state === "listening" ? 0.9 : state === "connecting" ? 2.5 : 0.35;
      currentDeg = (currentDeg + speed) % 360;
      phase = (phase + 0.05) % (Math.PI * 2);

      setRotationDegree(currentDeg);
      setPulsePhase(phase);
      animId = requestAnimationFrame(tick);
    };

    animId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animId);
  }, [state]);

  // Audio reactive scale & glow
  const coreScale = 1 + (state === "speaking" ? 0.12 * Math.sin(pulsePhase * 3) : state === "listening" ? 0.06 * Math.sin(pulsePhase * 2) : 0);

  return (
    <div className="relative w-full h-full flex items-center justify-center overflow-hidden select-none pointer-events-none">
      {/* Background Radial Glow Matrix */}
      <div 
        className="absolute w-[500px] h-[500px] md:w-[650px] md:h-[650px] rounded-full blur-[140px] transition-all duration-700 pointer-events-none"
        style={{
          background: state === "speaking"
            ? "radial-gradient(circle, rgba(56,189,248,0.22) 0%, rgba(30,58,138,0.12) 50%, transparent 70%)"
            : state === "listening"
            ? "radial-gradient(circle, rgba(34,211,238,0.28) 0%, rgba(12,74,110,0.15) 50%, transparent 70%)"
            : state === "connecting"
            ? "radial-gradient(circle, rgba(245,158,11,0.2) 0%, rgba(180,83,9,0.1) 50%, transparent 70%)"
            : "radial-gradient(circle, rgba(14,165,233,0.07) 0%, transparent 70%)"
        }}
      />

      {/* Futuristic Background Grid Coordinate Lines */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#00f0ff06_1px,transparent_1px),linear-gradient(to_bottom,#00f0ff06_1px,transparent_1px)] bg-[size:40px_40px] opacity-40 pointer-events-none" />

      {/* Tactical Corner Brackets with Crosshairs (HUD Aesthetics without text collisions) */}
      <div className="absolute inset-4 md:inset-8 pointer-events-none opacity-40">
        {/* Top-Left Bracket */}
        <div className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-cyan-400" />
        <div className="absolute top-2 left-2 text-[9px] font-mono text-cyan-400/60">+</div>
        {/* Top-Right Bracket */}
        <div className="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 border-cyan-400" />
        <div className="absolute top-2 right-2 text-[9px] font-mono text-cyan-400/60">+</div>
        {/* Bottom-Left Bracket */}
        <div className="absolute bottom-0 left-0 w-8 h-8 border-b-2 border-l-2 border-cyan-400" />
        <div className="absolute bottom-2 left-2 text-[9px] font-mono text-cyan-400/60">+</div>
        {/* Bottom-Right Bracket */}
        <div className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-cyan-400" />
        <div className="absolute bottom-2 right-2 text-[9px] font-mono text-cyan-400/60">+</div>
      </div>

      {/* Main Holographic Arc Reactor Central Display */}
      <div 
        className="relative w-60 h-60 sm:w-72 sm:h-72 md:w-84 md:h-84 flex items-center justify-center transition-transform duration-300 pointer-events-none"
        style={{ transform: `scale(${coreScale})` }}
      >
        {/* Outermost Segmented HUD Ring (Reverse Rotation) */}
        <svg 
          className="absolute inset-0 w-full h-full text-cyan-500/20"
          style={{ transform: `rotate(${-rotationDegree * 0.4}deg)` }}
          viewBox="0 0 400 400"
        >
          <circle 
            cx="200" 
            cy="200" 
            r="190" 
            fill="none" 
            stroke="currentColor" 
            strokeWidth="1.5" 
            strokeDasharray="8 16 32 16"
          />
          <circle 
            cx="200" 
            cy="200" 
            r="178" 
            fill="none" 
            stroke="currentColor" 
            strokeWidth="1" 
            strokeDasharray="4 8"
          />
        </svg>

        {/* Outer Coordinate Ticks Ring (Forward Rotation) */}
        <svg 
          className="absolute inset-4 w-[calc(100%-32px)] h-[calc(100%-32px)] text-cyan-400/35"
          style={{ transform: `rotate(${rotationDegree * 0.8}deg)` }}
          viewBox="0 0 360 360"
        >
          {Array.from({ length: 36 }).map((_, i) => (
            <line
              key={i}
              x1="180"
              y1={i % 3 === 0 ? "10" : "16"}
              x2="180"
              y2="24"
              stroke="currentColor"
              strokeWidth={i % 3 === 0 ? "2" : "1"}
              strokeOpacity={i % 3 === 0 ? "0.9" : "0.4"}
              transform={`rotate(${i * 10} 180 180)`}
            />
          ))}
          <circle 
            cx="180" 
            cy="180" 
            r="150" 
            fill="none" 
            stroke="currentColor" 
            strokeWidth="1.5" 
            strokeDasharray="40 120 80 40"
          />
        </svg>

        {/* Middle Hexagonal Arc Grid (Slow Reverse Rotation) */}
        <svg 
          className="absolute inset-8 w-[calc(100%-64px)] h-[calc(100%-64px)] text-sky-400/30"
          style={{ transform: `rotate(${-rotationDegree * 1.2}deg)` }}
          viewBox="0 0 300 300"
        >
          <circle 
            cx="150" 
            cy="150" 
            r="135" 
            fill="none" 
            stroke="currentColor" 
            strokeWidth="2" 
            strokeDasharray="16 32 48 32"
          />
          <circle 
            cx="150" 
            cy="150" 
            r="115" 
            fill="none" 
            stroke="currentColor" 
            strokeWidth="1" 
            strokeDasharray="6 6"
          />
        </svg>

        {/* Inner Arc Core Rings */}
        <div 
          className={`absolute w-32 h-32 sm:w-40 sm:h-40 md:w-44 md:h-44 rounded-full border border-cyan-400/40 flex items-center justify-center backdrop-blur-xs transition-all duration-500 ${
            state === "speaking"
              ? "border-cyan-300 shadow-[0_0_50px_rgba(56,189,248,0.45)] bg-cyan-950/20"
              : state === "listening"
              ? "border-cyan-400 shadow-[0_0_40px_rgba(34,211,238,0.35)] bg-sky-950/20"
              : "border-cyan-500/20 shadow-[0_0_20px_rgba(14,165,233,0.1)] bg-slate-950/40"
          }`}
        >
          {/* Inner Gyroscope Spindles */}
          <div 
            className="w-24 h-24 sm:w-32 sm:h-32 rounded-full border border-cyan-400/30 flex items-center justify-center"
            style={{ transform: `rotate(${rotationDegree * 2}deg)` }}
          >
            <div className="w-full h-0.5 bg-gradient-to-r from-transparent via-cyan-400/50 to-transparent" />
            <div className="absolute h-full w-0.5 bg-gradient-to-b from-transparent via-cyan-400/50 to-transparent" />
          </div>

          {/* Core Central Pulse Node */}
          <div className="absolute flex flex-col items-center justify-center text-center pointer-events-none">
            <div 
              className={`w-10 h-10 sm:w-14 sm:h-14 rounded-full flex items-center justify-center transition-all duration-300 ${
                state === "speaking"
                  ? "bg-cyan-400/40 shadow-[0_0_35px_#38bdf8]"
                  : state === "listening"
                  ? "bg-sky-400/30 shadow-[0_0_30px_#22d3ee] animate-pulse"
                  : state === "connecting"
                  ? "bg-amber-400/30 shadow-[0_0_25px_#f59e0b] animate-ping"
                  : "bg-cyan-500/15 shadow-[0_0_15px_#0284c7]"
              }`}
            >
              <div 
                className={`w-5 h-5 sm:w-7 sm:h-7 rounded-full border border-white/60 ${
                  state === "speaking" 
                    ? "bg-white shadow-[0_0_20px_#ffffff]" 
                    : state === "listening"
                    ? "bg-cyan-200 shadow-[0_0_15px_#38bdf8]"
                    : "bg-cyan-400/80"
                }`} 
              />
            </div>

            {/* Sub-label inside HUD core */}
            <span className="mt-2 text-[8px] sm:text-[9px] font-mono font-bold tracking-[0.25em] text-cyan-300/80 uppercase">
              {state === "speaking" 
                ? "TRANSMITTING" 
                : state === "listening" 
                ? "LISTENING" 
                : state === "connecting"
                ? "INITIALIZING"
                : "READY"}
            </span>
          </div>
        </div>

        {/* Ambient Ring Waveform Particles */}
        {state === "speaking" && (
          <div className="absolute inset-0 rounded-full border border-cyan-400/30 animate-ping pointer-events-none" />
        )}
      </div>
    </div>
  );
};
