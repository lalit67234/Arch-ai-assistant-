import React from "react";
import { Mic, MicOff, Radio, Brain, Sparkles, Smartphone } from "lucide-react";
import { LiveState } from "../lib/audio";

interface ArchHeaderProps {
  state: LiveState;
  isMuted?: boolean;
  onToggleVoice?: () => void;
  onToggleMute?: () => void;
  onOpenCognitiveMatrix?: () => void;
  onOpenMemories?: () => void;
  onOpenDeviceControl?: () => void;
}

export const ArchHeader: React.FC<ArchHeaderProps> = ({
  state,
  isMuted = false,
  onToggleVoice,
  onToggleMute,
  onOpenCognitiveMatrix,
  onOpenMemories,
  onOpenDeviceControl
}) => {
  const isConnected = state !== "disconnected";
  const isSpeaking = state === "speaking";
  const isListening = state === "listening";

  return (
    <header className="relative w-full z-20 flex items-center justify-between px-3 sm:px-6 md:px-8 py-3 select-none">
      {/* Left: ARCH Brand & Tagline */}
      <div className="flex items-center space-x-2.5 sm:space-x-3.5">
        {/* Custom Chevron "A" Logo Emblem */}
        <div className="relative w-7 h-7 sm:w-9 sm:h-9 flex items-center justify-center">
          <div className="absolute inset-0 rounded-lg bg-cyan-500/10 border border-cyan-400/40 shadow-[0_0_12px_rgba(0,240,255,0.25)]" />
          <svg className="w-4 h-4 sm:w-5 sm:h-5 text-cyan-300 drop-shadow-[0_0_8px_rgba(0,240,255,0.8)]" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2L2 22h5.5l2.2-4.5h4.6l2.2 4.5H22L12 2zm0 6.8l1.7 3.7h-3.4L12 8.8z" />
          </svg>
        </div>

        <div>
          <div className="flex items-baseline space-x-1.5">
            <span className="text-lg sm:text-2xl font-black tracking-[0.22em] text-white drop-shadow-[0_0_10px_rgba(255,255,255,0.4)]">
              A.R.C.H.
            </span>
          </div>
          <div className="text-[7.5px] sm:text-[9.5px] font-mono tracking-[0.14em] text-cyan-400/70 uppercase">
            Context-Aware AI Assistant
          </div>
        </div>
      </div>

      {/* Right: Cognition Matrix, Memory, Voice Toggle & Status Capsules */}
      <div className="flex items-center space-x-1.5 sm:space-x-2">
        {/* Cognitive Self-Awareness Button */}
        {onOpenCognitiveMatrix && (
          <button
            onClick={onOpenCognitiveMatrix}
            className="flex items-center space-x-1.5 px-2 sm:px-2.5 py-1 rounded-full border border-cyan-500/40 bg-cyan-950/30 text-cyan-300 hover:border-cyan-400 hover:bg-cyan-900/40 transition-all cursor-pointer shadow-[0_0_10px_rgba(0,240,255,0.15)]"
            title="Open ARCH Metacognitive Self-Awareness Matrix"
          >
            <Brain size={12} className="text-cyan-400" />
            <span className="text-[8.5px] sm:text-[9.5px] font-mono font-bold tracking-wider uppercase hidden xs:inline">
              COGNITION
            </span>
          </button>
        )}

        {/* Persistent Memory Matrix Button */}
        {onOpenMemories && (
          <button
            onClick={onOpenMemories}
            className="flex items-center space-x-1.5 px-2 sm:px-2.5 py-1 rounded-full border border-sky-500/40 bg-sky-950/30 text-sky-300 hover:border-sky-400 hover:bg-sky-900/40 transition-all cursor-pointer"
            title="Open Persistent Recollections Dashboard"
          >
            <Sparkles size={11} className="text-sky-400" />
            <span className="text-[8.5px] sm:text-[9.5px] font-mono font-bold tracking-wider uppercase hidden xs:inline">
              MEMORY
            </span>
          </button>
        )}

        {/* Android 9 Device Automation & Phone Control Button */}
        {onOpenDeviceControl && (
          <button
            onClick={onOpenDeviceControl}
            className="flex items-center space-x-1.5 px-2 sm:px-2.5 py-1 rounded-full border border-cyan-500/40 bg-cyan-950/30 text-cyan-300 hover:border-cyan-400 hover:bg-cyan-900/40 transition-all cursor-pointer shadow-[0_0_10px_rgba(0,240,255,0.15)]"
            title="Open Android 9 Device Automation & Native Bridge Console"
          >
            <Smartphone size={12} className="text-cyan-400" />
            <span className="text-[8.5px] sm:text-[9.5px] font-mono font-bold tracking-wider uppercase hidden xs:inline">
              DEVICE CONTROL
            </span>
          </button>
        )}

        {/* Interactive Voice On / Off Pill Button */}
        {onToggleVoice && (
          <button
            onClick={onToggleVoice}
            className={`flex items-center space-x-1.5 px-2 sm:px-2.5 py-1 rounded-full border transition-all cursor-pointer ${
              isConnected
                ? isMuted
                  ? "border-amber-500/50 bg-amber-950/30 text-amber-300"
                  : "border-cyan-400/60 bg-cyan-950/40 text-cyan-300 shadow-[0_0_10px_rgba(0,240,255,0.2)]"
                : "border-slate-700/60 bg-slate-900/40 text-slate-400 hover:border-cyan-500/50 hover:text-cyan-300"
            }`}
            title={isConnected ? "Click to turn Voice OFF" : "Click to turn Voice ON"}
          >
            <Radio size={11} className={isConnected && !isMuted ? "animate-pulse text-cyan-400" : isMuted ? "text-amber-400" : "text-slate-500"} />
            <span className="text-[8.5px] sm:text-[10px] font-mono font-bold tracking-widest uppercase">
              {isConnected ? (isMuted ? "MUTED" : "VOICE ON") : "VOICE OFF"}
            </span>
          </button>
        )}

        {/* System Online / Standby Capsule */}
        <div className="flex items-center space-x-1.5 sm:space-x-2 px-2.5 sm:px-3 py-1 rounded-full border border-cyan-500/40 bg-cyan-950/20 backdrop-blur-md shadow-[0_0_15px_rgba(0,240,255,0.15)]">
          <span className="relative flex h-2 w-2">
            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
              isSpeaking ? "bg-sky-400" :
              isListening ? "bg-cyan-400" :
              state === "connecting" ? "bg-amber-400" : "bg-cyan-500/50"
            }`} />
            <span className={`relative inline-flex rounded-full h-2 w-2 ${
              isSpeaking ? "bg-sky-300 shadow-[0_0_8px_#38bdf8]" :
              isListening ? "bg-cyan-400 shadow-[0_0_8px_#00f0ff]" :
              state === "connecting" ? "bg-amber-400" : "bg-cyan-500"
            }`} />
          </span>
          <span className="text-[8.5px] sm:text-[11px] font-mono font-bold tracking-widest text-cyan-300 uppercase">
            {isConnected ? "ONLINE" : "STANDBY"}
          </span>
        </div>
      </div>
    </header>
  );
};

