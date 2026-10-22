import React, { useEffect, useState } from "react";
import { LiveState } from "../lib/audio";

interface ArchDialogueCardProps {
  state: LiveState;
  userTranscript: string;
  modelTranscript: string;
  statusMessage?: string;
  onCardClick?: () => void;
}

export const ArchDialogueCard: React.FC<ArchDialogueCardProps> = ({
  state,
  userTranscript,
  modelTranscript,
  statusMessage,
  onCardClick
}) => {
  const [currentTime, setCurrentTime] = useState<string>("");

  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      let hours = now.getHours();
      const minutes = now.getMinutes();
      const ampm = hours >= 12 ? "PM" : "AM";
      hours = hours % 12;
      hours = hours ? hours : 12; // 0 becomes 12
      const strMinutes = minutes < 10 ? "0" + minutes : minutes;
      setCurrentTime(`${hours}:${strMinutes} ${ampm}`);
    };

    updateClock();
    const timer = setInterval(updateClock, 1000);
    return () => clearInterval(timer);
  }, []);

  const hasActiveSpeech = Boolean(userTranscript.trim() || modelTranscript.trim());

  return (
    <div 
      className="relative w-full max-w-xl mx-auto px-4 z-20 cursor-pointer select-none"
      onClick={onCardClick}
    >
      {/* Outer Angular Cyber HUD Container */}
      <div className="relative p-4 sm:p-5 rounded-xl border border-cyan-500/40 bg-black/60 backdrop-blur-xl shadow-[0_0_25px_rgba(0,240,255,0.12)] transition-all duration-300 hover:border-cyan-400">
        {/* Corner Cyber Accents */}
        <div className="absolute top-0 left-0 w-3 h-3 border-t-2 border-l-2 border-cyan-400" />
        <div className="absolute top-0 right-0 w-3 h-3 border-t-2 border-r-2 border-cyan-400" />
        <div className="absolute bottom-0 left-0 w-3 h-3 border-b-2 border-l-2 border-cyan-400" />
        <div className="absolute bottom-0 right-0 w-3 h-3 border-b-2 border-r-2 border-cyan-400" />

        {/* Top Meta Header: Clock & Tech Dots */}
        <div className="flex items-center justify-between pb-2 mb-2.5 border-b border-cyan-500/20">
          <div className="flex items-center space-x-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 shadow-[0_0_6px_#00f0ff]" />
            <span className="text-[10px] font-mono tracking-widest text-cyan-400 uppercase font-semibold">
              {state === "speaking" ? "ARCH ANSWERING" : state === "listening" ? "ACTIVE LISTENING" : state === "connecting" ? "CONNECTING..." : "COMMAND INTERFACE"}
            </span>
          </div>

          <div className="flex items-center space-x-2">
            <span className="text-[11px] font-mono text-cyan-300 font-bold tracking-wider">
              {currentTime || "5:15 PM"}
            </span>
            <span className="text-cyan-400 font-bold tracking-tighter text-xs">••</span>
          </div>
        </div>

        {/* Main Content Row */}
        <div className="flex items-start space-x-3 sm:space-x-4">
          {/* Circular Badge with Illuminated Chevron A */}
          <div className="relative flex-shrink-0 w-11 h-11 sm:w-12 sm:h-12 rounded-full border border-cyan-400/50 bg-cyan-950/40 flex items-center justify-center shadow-[0_0_15px_rgba(0,240,255,0.3)]">
            <svg className="w-6 h-6 text-cyan-300 drop-shadow-[0_0_8px_rgba(0,240,255,0.9)]" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2L2 22h5.5l2.2-4.5h4.6l2.2 4.5H22L12 2zm0 6.8l1.7 3.7h-3.4L12 8.8z" />
            </svg>
            <div className="absolute inset-0 rounded-full border border-cyan-400/30 animate-ping opacity-25" />
          </div>

          {/* Dialogue & Narrative Text */}
          <div className="flex-1 min-w-0">
            {hasActiveSpeech ? (
              <div className="space-y-1.5">
                {userTranscript && (
                  <div className="text-sm font-sans text-cyan-200">
                    <span className="font-mono text-[10px] uppercase tracking-wider text-cyan-400 font-bold mr-1.5">[YOU]:</span>
                    <span>"{userTranscript}"</span>
                  </div>
                )}

                {modelTranscript && (
                  <div className="text-sm sm:text-base font-sans font-medium text-white drop-shadow-[0_0_10px_rgba(255,255,255,0.3)] leading-relaxed">
                    <span className="font-mono text-[10px] uppercase tracking-wider text-cyan-300 font-bold mr-1.5">[ARCH]:</span>
                    <span>{modelTranscript}</span>
                  </div>
                )}
              </div>
            ) : statusMessage ? (
              <div className="text-sm font-sans text-white">
                <span className="font-mono text-[10px] uppercase tracking-wider text-cyan-400 font-bold mr-1.5">[STATUS]:</span>
                <span>{statusMessage}</span>
              </div>
            ) : (
              /* Default Welcome Narrative from Reference Image */
              <div className="space-y-0.5 sm:space-y-1">
                <div className="text-base sm:text-lg font-bold text-white tracking-wide">
                  Good evening, I'm <span className="text-cyan-300 drop-shadow-[0_0_10px_#00f0ff]">ARCH</span>.
                </div>
                <div className="text-xs sm:text-sm text-cyan-200/90 font-medium">
                  Your personal AI assistant.
                </div>
                <div className="text-xs sm:text-sm text-cyan-400/80 font-normal">
                  Ready to help, guide and get things done.
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
