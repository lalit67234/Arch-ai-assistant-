import React from "react";
import { motion, AnimatePresence } from "motion/react";
import { ShieldAlert, Send, X, CheckCircle, Smartphone } from "lucide-react";

export interface PendingAction {
  id: string;
  type: "whatsapp" | "device_control" | "editor_export" | "app_launch";
  title: string;
  target: string;
  details: string;
  onConfirm: () => void;
  onCancel: () => void;
}

interface ActionConfirmationModalProps {
  action: PendingAction | null;
}

export const ActionConfirmationModal: React.FC<ActionConfirmationModalProps> = ({ action }) => {
  if (!action) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md font-mono select-none">
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 15 }}
          className="w-full max-w-md bg-slate-950 border border-amber-500/40 rounded-2xl p-5 shadow-[0_0_50px_rgba(245,158,11,0.25)] text-slate-200"
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-3 border-b border-amber-500/20 text-xs">
            <div className="flex items-center gap-2 text-amber-400 font-bold tracking-widest uppercase">
              <ShieldAlert size={16} />
              <span>CONFIRMATION PROTOCOL</span>
            </div>
            <button
              onClick={action.onCancel}
              className="text-slate-400 hover:text-white p-1 rounded hover:bg-white/5 transition"
            >
              <X size={14} />
            </button>
          </div>

          {/* Body */}
          <div className="py-4 space-y-3 text-xs">
            <div>
              <span className="text-[10px] text-slate-500 uppercase tracking-wider block mb-1">
                Requested Operation
              </span>
              <p className="font-bold text-slate-100 text-sm">{action.title}</p>
            </div>

            <div className="p-3 rounded-xl bg-white/5 border border-white/10 space-y-1.5">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-slate-400">Target:</span>
                <span className="text-cyan-300 font-bold">{action.target}</span>
              </div>
              <div>
                <span className="text-slate-400 text-[11px] block mb-1">Payload Content:</span>
                <p className="p-2 bg-black/60 rounded-lg text-slate-300 text-[11px] leading-relaxed border border-white/5 select-text">
                  &quot;{action.details}&quot;
                </p>
              </div>
            </div>

            <p className="text-[10px] text-amber-400/90 leading-relaxed">
              ⚠️ In accordance with Stark Security Protocols, external transmission requires explicit authorization before Android Intent dispatch.
            </p>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-3 pt-2">
            <button
              onClick={action.onCancel}
              className="flex-1 py-2 px-3 rounded-xl border border-white/10 text-slate-300 hover:bg-white/5 text-xs font-bold transition cursor-pointer"
            >
              ABORT (CANCEL)
            </button>
            <button
              onClick={action.onConfirm}
              className="flex-1 py-2 px-3 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/50 text-amber-300 text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer shadow-[0_0_20px_rgba(245,158,11,0.2)]"
            >
              <CheckCircle size={14} />
              <span>AUTHORIZE & SEND</span>
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
