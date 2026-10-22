import React, { useState, useMemo } from "react";
import { 
  Mic, 
  MicOff, 
  Keyboard, 
  Sliders, 
  AudioWaveform, 
  Send, 
  X, 
  Database, 
  Code2, 
  ShieldCheck,
  Search,
  Sparkles,
  Smartphone
} from "lucide-react";
import { LiveState } from "../lib/audio";

interface ArchControllerBarProps {
  state: LiveState;
  isMuted: boolean;
  echoGuard?: boolean;
  onToggleVoice: () => void;
  onToggleMute: () => void;
  onInterruptSpeech?: () => void;
  onToggleEchoGuard?: () => void;
  onSubmitText: (text: string) => void;
  onLaunchShortcut?: (appName: string) => void;
  onOpenSettings: () => void;
  onOpenMemory?: () => void;
  onOpenWorkspace?: () => void;
}

export const ArchControllerBar: React.FC<ArchControllerBarProps> = ({
  state,
  isMuted,
  echoGuard = true,
  onToggleVoice,
  onToggleMute,
  onInterruptSpeech,
  onToggleEchoGuard,
  onSubmitText,
  onLaunchShortcut,
  onOpenSettings,
  onOpenMemory,
  onOpenWorkspace
}) => {
  const [isKeyboardOpen, setIsKeyboardOpen] = useState<boolean>(false);
  const [inputText, setInputText] = useState<string>("");

  const isConnected = state !== "disconnected";
  const isListening = state === "listening";
  const isSpeaking = state === "speaking";
  const isConnecting = state === "connecting";

  // Real-time search mode detector (App Launch vs App Search vs Web Search vs Code Agent)
  const searchMode = useMemo(() => {
    const val = inputText.trim().toLowerCase();
    if (!val) return null;
    if (/\b(youtube|play store|playstore|chrome|whatsapp|camera|settings|calculator|maps|gmail)\b/i.test(val)) {
      if (/\b(search|dhundho|about|for|play)\b/i.test(val)) {
        return { label: "APP SEARCH", color: "bg-amber-500/20 text-amber-300 border-amber-500/40" };
      }
      return { label: "APP LAUNCH", color: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40" };
    }
    if (/\b(python|code|game|website|script|banao|build|debug)\b/i.test(val)) {
      return { label: "CODING AGENT", color: "bg-cyan-500/20 text-cyan-300 border-cyan-500/40" };
    }
    if (/\b(search|google|internet|who|what|why|kya|kaise)\b/i.test(val)) {
      return { label: "WEB SEARCH", color: "bg-sky-500/20 text-sky-300 border-sky-500/40" };
    }
    return { label: "ARCH DIRECTIVE", color: "bg-cyan-500/20 text-cyan-300 border-cyan-500/40" };
  }, [inputText]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputText.trim()) {
      onSubmitText(inputText.trim());
      setInputText("");
    }
  };

  const handleCenterClick = () => {
    if (isSpeaking && onInterruptSpeech) {
      onInterruptSpeech();
    } else if (isMuted) {
      onToggleMute();
    } else {
      onToggleVoice();
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto px-3 sm:px-4 pb-3 sm:pb-4 select-none z-20">
      
      {/* 1. Clickable Quick App Shortcuts Tray (Unified with Command Dispatcher) */}
      <div className="flex items-center justify-center gap-1.5 sm:gap-2 mb-2 px-1 overflow-x-auto no-scrollbar py-1">
        {[
          { name: "YouTube", label: "YouTube", symbol: "▶", color: "hover:border-red-500/70 hover:text-red-300" },
          { name: "Google Play Store", label: "Play Store", symbol: "🛍️", color: "hover:border-emerald-500/70 hover:text-emerald-300" },
          { name: "Google Chrome", label: "Chrome", symbol: "🌐", color: "hover:border-amber-500/70 hover:text-amber-300" },
          { name: "WhatsApp", label: "WhatsApp", symbol: "💬", color: "hover:border-emerald-400 hover:text-emerald-300" },
          { name: "Camera", label: "Camera", symbol: "📷", color: "hover:border-cyan-400 hover:text-cyan-300" },
          { name: "Settings", label: "Settings", symbol: "⚙️", color: "hover:border-slate-300 hover:text-slate-100" },
          { name: "Code Workspace", label: "Code Agent", symbol: "⚡", color: "hover:border-cyan-400 hover:text-cyan-200" }
        ].map((item) => (
          <button
            key={item.name}
            onClick={() => {
              if (onLaunchShortcut) {
                onLaunchShortcut(item.name);
              } else {
                onSubmitText(`ARCH ${item.name} kholo`);
              }
            }}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-cyan-500/20 bg-black/60 text-[10px] sm:text-[11px] font-mono font-medium text-slate-300 transition-all cursor-pointer backdrop-blur-md shadow-sm active:scale-95 ${item.color}`}
            title={`Launch ${item.name} via Unified Dispatcher`}
          >
            <span className="text-xs">{item.symbol}</span>
            <span>{item.label}</span>
          </button>
        ))}
      </div>

      {/* 2. Primary Dock Controller Capsule */}
      <div className="relative flex items-center justify-between px-3 sm:px-5 py-2.5 rounded-full border border-cyan-500/40 bg-black/80 backdrop-blur-2xl shadow-[0_0_35px_rgba(0,240,255,0.18)]">
        
        {/* Left Side: Voice Master Switch or Universal Search Bar */}
        <div className="flex-1 flex items-center min-w-0 mr-2 sm:mr-3">
          {isKeyboardOpen ? (
            <form onSubmit={handleSend} className="flex-1 flex items-center space-x-1.5 sm:space-x-2">
              <div className="relative flex-1 flex items-center">
                <Search className="w-3.5 h-3.5 text-cyan-400/60 absolute left-3 pointer-events-none" />
                <input
                  type="text"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder="App name, search query, or code directive..."
                  className="w-full bg-cyan-950/40 border border-cyan-500/50 rounded-full pl-8 pr-24 py-1.5 text-xs sm:text-sm text-white placeholder-cyan-400/50 focus:outline-none focus:border-cyan-400 font-sans"
                  autoFocus
                />
                {searchMode && (
                  <span className={`absolute right-2 px-1.5 py-0.5 rounded text-[8px] sm:text-[9px] font-mono font-bold uppercase tracking-wider border ${searchMode.color}`}>
                    {searchMode.label}
                  </span>
                )}
              </div>
              <button
                type="submit"
                className="p-1.5 sm:p-2 rounded-full bg-cyan-500 hover:bg-cyan-400 text-black transition-colors cursor-pointer shadow-[0_0_12px_rgba(0,240,255,0.4)]"
                title="Dispatch command"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setIsKeyboardOpen(false)}
                className="p-1 text-cyan-400 hover:text-white cursor-pointer"
                title="Close search input"
              >
                <X className="w-4 h-4" />
              </button>
            </form>
          ) : (
            <div className="flex items-center gap-2">
              {/* Explicit VOICE ON / VOICE OFF Toggle Button */}
              <button
                onClick={onToggleVoice}
                className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1 rounded-full border text-[10px] sm:text-[11px] font-mono font-bold tracking-wider transition-all cursor-pointer ${
                  isConnected
                    ? isMuted
                      ? "border-amber-500/60 bg-amber-950/40 text-amber-300 shadow-[0_0_12px_rgba(245,158,11,0.25)]"
                      : "border-cyan-400/80 bg-cyan-950/60 text-cyan-300 shadow-[0_0_12px_rgba(0,240,255,0.3)] hover:bg-cyan-900/60"
                    : "border-slate-700 bg-slate-900/60 text-slate-400 hover:border-cyan-500/60 hover:text-cyan-300"
                }`}
                title={isConnected ? "Turn Voice OFF" : "Turn Voice ON (Activate ARCH)"}
              >
                <span className="relative flex h-2 w-2">
                  {isConnected && !isMuted && (
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75" />
                  )}
                  <span className={`relative inline-flex rounded-full h-2 w-2 ${
                    !isConnected ? "bg-slate-500" :
                    isMuted ? "bg-amber-400" :
                    isSpeaking ? "bg-sky-400" : "bg-cyan-400"
                  }`} />
                </span>
                <span>{isConnected ? (isMuted ? "VOICE MUTED" : "VOICE ON") : "VOICE OFF"}</span>
              </button>

              {/* Status Hint */}
              <span className="hidden sm:inline-block text-[11px] font-sans text-cyan-400/70 truncate max-w-[150px]">
                {isSpeaking ? "ARCH answering (tap mic to stop)..." :
                 isMuted ? "Mic muted (tap to unmute)" :
                 isListening ? "Listening to your voice..." :
                 isConnecting ? "Connecting..." : "Tap to speak"}
              </span>
            </div>
          )}
        </div>

        {/* Center: Large Glowing Tactile Voice Button with Clear State Feedback */}
        <div className="relative -my-3 flex-shrink-0">
          {/* Outer Pulsing Aura Ring */}
          <div className={`absolute -inset-2 rounded-full border border-cyan-400/40 transition-all duration-500 pointer-events-none ${
            isConnected && !isMuted ? "animate-ping opacity-40" : "opacity-0"
          }`} />

          <button
            onClick={handleCenterClick}
            className={`relative w-13 h-13 sm:w-16 sm:h-16 rounded-full flex flex-col items-center justify-center transition-all duration-300 border-2 cursor-pointer ${
              isSpeaking
                ? "bg-gradient-to-tr from-sky-600 to-cyan-400 border-white shadow-[0_0_30px_rgba(56,189,248,0.9)] scale-105 hover:brightness-110"
                : isListening && !isMuted
                ? "bg-gradient-to-tr from-cyan-600 to-cyan-400 border-cyan-300 shadow-[0_0_30px_rgba(0,240,255,0.85)] scale-105"
                : isMuted
                ? "bg-gradient-to-tr from-amber-700 to-amber-500 border-amber-300 shadow-[0_0_24px_rgba(245,158,11,0.7)]"
                : isConnecting
                ? "bg-amber-600 border-amber-300 animate-pulse shadow-[0_0_20px_rgba(245,158,11,0.6)]"
                : "bg-cyan-950/80 border-cyan-500/50 hover:border-cyan-300 hover:shadow-[0_0_22px_rgba(0,240,255,0.4)]"
            }`}
            title={
              isSpeaking ? "ARCH is answering. Tap to stop speech and return to listening" :
              isMuted ? "Microphone is muted. Tap to Unmute!" :
              isConnected ? "Voice is Active. Tap to Turn Voice OFF" :
              "Voice is OFF. Tap to Turn Voice ON"
            }
          >
            {isSpeaking ? (
              <AudioWaveform className="w-6 h-6 sm:w-7 sm:h-7 text-black animate-pulse" />
            ) : isListening && !isMuted ? (
              <Mic className="w-6 h-6 sm:w-7 sm:h-7 text-black drop-shadow-sm animate-pulse" />
            ) : isMuted ? (
              <MicOff className="w-5 h-5 sm:w-6 sm:h-6 text-black" />
            ) : (
              <MicOff className="w-5 h-5 sm:w-6 sm:h-6 text-cyan-300" />
            )}
          </button>
        </div>

        {/* Right Side: Search Toggle, Mic Mute, Echo Guard, Keyboard Toggle & Settings */}
        <div className="flex-1 flex items-center justify-end space-x-1 sm:space-x-2 ml-2 sm:ml-3">
          
          {/* Universal Search / Command Input Toggle */}
          <button
            onClick={() => setIsKeyboardOpen(prev => !prev)}
            className={`p-2 rounded-full border transition-all cursor-pointer ${
              isKeyboardOpen
                ? "border-cyan-400 bg-cyan-950/60 text-cyan-300 shadow-[0_0_10px_rgba(0,240,255,0.3)]"
                : "border-cyan-500/30 bg-black/40 text-cyan-400/80 hover:text-cyan-200 hover:border-cyan-400/60"
            }`}
            title="Search apps, web, or enter command"
          >
            <Search className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </button>

          {/* Echo Guard Indicator & Toggle */}
          {isConnected && onToggleEchoGuard && (
            <button
              onClick={onToggleEchoGuard}
              className={`p-2 rounded-full border transition-all cursor-pointer ${
                echoGuard
                  ? "border-cyan-500/50 bg-cyan-950/40 text-cyan-300 shadow-[0_0_8px_rgba(0,240,255,0.2)]"
                  : "border-slate-700 bg-black/40 text-slate-500 hover:text-slate-300"
              }`}
              title={echoGuard ? "Echo Guard ACTIVE (Protects mic against speaker feedback)" : "Echo Guard OFF"}
            >
              <ShieldCheck className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </button>
          )}

          {/* Quick Mic MUTE / UNMUTE Button */}
          {isConnected && (
            <button
              onClick={onToggleMute}
              className={`p-2 rounded-full border transition-all cursor-pointer ${
                isMuted
                  ? "border-amber-400 bg-amber-950/60 text-amber-300 shadow-[0_0_12px_rgba(245,158,11,0.4)]"
                  : "border-cyan-500/40 bg-black/50 text-cyan-400 hover:text-white hover:border-cyan-400"
              }`}
              title={isMuted ? "Unmute Microphone" : "Mute Microphone (Silence mic, keep ARCH connected)"}
            >
              {isMuted ? <MicOff className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-300" /> : <Mic className="w-3.5 h-3.5 sm:w-4 sm:h-4" />}
            </button>
          )}

          {/* Code Workspace Toggle */}
          {onOpenWorkspace && (
            <button
              onClick={onOpenWorkspace}
              className="p-2 rounded-full border border-cyan-500/30 bg-black/40 text-cyan-400/80 hover:text-cyan-200 hover:border-cyan-400/60 transition-all cursor-pointer"
              title="Open Autonomous Code Workspace & Terminal"
            >
              <Code2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </button>
          )}

          {/* Memory Matrix Toggle */}
          {onOpenMemory && (
            <button
              onClick={onOpenMemory}
              className="p-2 rounded-full border border-cyan-500/30 bg-black/40 text-cyan-400/80 hover:text-cyan-200 hover:border-cyan-400/60 transition-all cursor-pointer"
              title="ARCH Persistent Memory Matrix"
            >
              <Database className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </button>
          )}

          {/* Settings & Device Bridge */}
          <button
            onClick={onOpenSettings}
            className="p-2 rounded-full border border-cyan-500/30 bg-black/40 text-cyan-400/80 hover:text-cyan-200 hover:border-cyan-400/60 transition-all cursor-pointer"
            title="ARCH settings, APK Bridge & diagnostics"
          >
            <Sliders className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </button>
        </div>
      </div>

      {/* Futuristic Tagline Footer */}
      <div className="mt-2.5 flex items-center justify-center space-x-3 text-cyan-500/60 select-none">
        <span className="h-[1px] w-10 sm:w-20 bg-gradient-to-r from-transparent to-cyan-500/40" />
        <span className="text-[8.5px] sm:text-[9.5px] font-mono tracking-[0.25em] uppercase text-cyan-400/70 font-semibold">
          THINK • ANALYZE • EXECUTE
        </span>
        <span className="h-[1px] w-10 sm:w-20 bg-gradient-to-l from-transparent to-cyan-500/40" />
      </div>
    </div>
  );
};
