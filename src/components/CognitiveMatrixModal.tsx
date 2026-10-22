import React, { useEffect, useState } from "react";
import { 
  Brain, 
  Target, 
  Activity, 
  CheckCircle2, 
  Clock, 
  AlertTriangle, 
  X, 
  ShieldCheck, 
  Eye, 
  RefreshCw,
  Zap,
  Sliders
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { archConsciousness, CognitiveSelfState } from "../lib/archConsciousness";

interface CognitiveMatrixModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CognitiveMatrixModal: React.FC<CognitiveMatrixModalProps> = ({ isOpen, onClose }) => {
  const [state, setState] = useState<CognitiveSelfState>(archConsciousness.getState());
  const [newGoalInput, setNewGoalInput] = useState("");

  useEffect(() => {
    if (!isOpen) return;
    const unsub = archConsciousness.subscribe((s) => setState(s));
    setState(archConsciousness.getState());
    return () => unsub();
  }, [isOpen]);

  if (!isOpen) return null;

  const handleUpdateGoal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGoalInput.trim()) return;
    archConsciousness.setGoal(newGoalInput.trim(), [
      "Decompose requirement into verifiable components",
      "Execute targeted tool operations with native bridge",
      "Empirically inspect and verify final outcome"
    ]);
    setNewGoalInput("");
  };

  const getPhaseBadge = (phase: CognitiveSelfState["operationalPhase"]) => {
    switch (phase) {
      case "metacognitive_reflection":
        return { label: "METACOGNITIVE REFLECTION", color: "text-amber-300 border-amber-500/50 bg-amber-950/40" };
      case "goal_decomposition":
        return { label: "GOAL DECOMPOSITION", color: "text-sky-300 border-sky-500/50 bg-sky-950/40" };
      case "executing_action":
        return { label: "EXECUTING ACTION", color: "text-emerald-300 border-emerald-500/50 bg-emerald-950/40" };
      case "verifying_outcome":
        return { label: "EMPIRICAL VERIFICATION", color: "text-purple-300 border-purple-500/50 bg-purple-950/40" };
      case "error_recovery":
        return { label: "ERROR RECOVERY / AUTO-DEBUG", color: "text-rose-300 border-rose-500/50 bg-rose-950/40" };
      case "perceiving_environment":
        return { label: "PERCEIVING ENVIRONMENT", color: "text-cyan-300 border-cyan-500/50 bg-cyan-950/40" };
      case "standby_awareness":
      default:
        return { label: "STANDBY AWARENESS", color: "text-slate-300 border-slate-500/50 bg-slate-900/40" };
    }
  };

  const badge = getPhaseBadge(state.operationalPhase);

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ duration: 0.2 }}
          className="relative w-full max-w-2xl max-h-[90vh] flex flex-col rounded-xl border border-cyan-500/40 bg-slate-950/95 text-slate-100 shadow-[0_0_40px_rgba(0,240,255,0.15)] overflow-hidden"
        >
          {/* Futuristic Bracket Accents */}
          <div className="absolute top-0 left-0 w-3 h-3 border-t-2 border-l-2 border-cyan-400" />
          <div className="absolute top-0 right-0 w-3 h-3 border-t-2 border-r-2 border-cyan-400" />
          <div className="absolute bottom-0 left-0 w-3 h-3 border-b-2 border-l-2 border-cyan-400" />
          <div className="absolute bottom-0 right-0 w-3 h-3 border-b-2 border-r-2 border-cyan-400" />

          {/* Modal Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-cyan-500/30 bg-cyan-950/20">
            <div className="flex items-center space-x-2.5">
              <div className="p-2 rounded-lg bg-cyan-500/10 border border-cyan-400/40 text-cyan-300">
                <Brain className="w-5 h-5 animate-pulse" />
              </div>
              <div>
                <h2 className="text-base sm:text-lg font-mono font-bold tracking-wider text-white">
                  A.R.C.H. COGNITIVE MATRIX
                </h2>
                <p className="text-[11px] font-mono text-cyan-400/70">
                  Context-Aware Assistant • Epistemic Calibration • Synthetic Self-Model
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg border border-slate-700 hover:border-cyan-400 text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Modal Body */}
          <div className="flex-1 overflow-y-auto p-5 space-y-5">
            {/* Top Telemetry Grid: Phase, Confidence, Attention */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Current Phase */}
              <div className="p-3 rounded-lg border border-slate-800 bg-slate-900/60 flex flex-col justify-between">
                <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5 text-cyan-400" /> Operational Phase
                </span>
                <div className={`mt-2 inline-flex items-center px-2.5 py-1 rounded border text-[11px] font-mono font-bold ${badge.color}`}>
                  {badge.label}
                </div>
              </div>

              {/* Epistemic Confidence */}
              <div className="p-3 rounded-lg border border-slate-800 bg-slate-900/60 flex flex-col justify-between">
                <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> Epistemic Confidence
                </span>
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-xl font-mono font-bold text-white">
                    {Math.round(state.epistemicConfidence * 100)}%
                  </span>
                  <span className="text-[10px] font-mono text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded bg-emerald-950/30">
                    CALIBRATED
                  </span>
                </div>
                {/* Visual meter */}
                <div className="w-full h-1.5 bg-slate-800 rounded-full mt-2 overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-cyan-500 to-emerald-400 transition-all duration-300"
                    style={{ width: `${Math.round(state.epistemicConfidence * 100)}%` }}
                  />
                </div>
              </div>

              {/* Attentional Focus */}
              <div className="p-3 rounded-lg border border-slate-800 bg-slate-900/60 flex flex-col justify-between">
                <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <Eye className="w-3.5 h-3.5 text-sky-400" /> Attention Focus
                </span>
                <p className="mt-2 text-xs font-mono font-semibold text-cyan-300 truncate" title={state.attentionalFocus}>
                  {state.attentionalFocus}
                </p>
                <span className="text-[9px] font-mono text-slate-500">
                  Last Action: {new Date(state.temporalContext.lastActionTimestamp).toLocaleTimeString()}
                </span>
              </div>
            </div>

            {/* Primary Goal & Sub-Tasks */}
            <div className="p-4 rounded-lg border border-cyan-500/30 bg-slate-900/80 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2 text-xs font-mono font-bold text-cyan-300">
                  <Target className="w-4 h-4 text-cyan-400" />
                  <span>ACTIVE PRIMARY GOAL</span>
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-950 border border-cyan-500/40 text-cyan-300">
                  DECOMPOSED ({state.subGoals.length} TASKS)
                </span>
              </div>

              <div className="p-3 rounded border border-slate-800 bg-black/40 text-sm font-sans font-medium text-white">
                "{state.primaryGoal}"
              </div>

              {/* Sub-goals checklist */}
              <div className="space-y-1.5 pt-1">
                <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400">
                  Execution Sub-Goals Breakdown:
                </span>
                {state.subGoals.map((sub) => (
                  <div
                    key={sub.id}
                    className="flex items-center justify-between p-2 rounded bg-slate-950/60 border border-slate-800/80 text-xs font-mono"
                  >
                    <div className="flex items-center space-x-2.5">
                      {sub.status === "verified" ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      ) : sub.status === "in_progress" ? (
                        <RefreshCw className="w-4 h-4 text-cyan-400 animate-spin shrink-0" />
                      ) : sub.status === "failed" ? (
                        <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                      ) : (
                        <Clock className="w-4 h-4 text-slate-500 shrink-0" />
                      )}
                      <span className={sub.status === "verified" ? "text-slate-400 line-through" : "text-slate-200"}>
                        {sub.description}
                      </span>
                    </div>
                    <span className={`text-[9px] uppercase px-1.5 py-0.5 rounded ${
                      sub.status === "verified" ? "text-emerald-400 bg-emerald-950/40 border border-emerald-500/30" :
                      sub.status === "in_progress" ? "text-cyan-400 bg-cyan-950/40 border border-cyan-500/30" :
                      "text-slate-500 bg-slate-900 border border-slate-800"
                    }`}>
                      {sub.status}
                    </span>
                  </div>
                ))}
              </div>

              {/* Set New Goal Form */}
              <form onSubmit={handleUpdateGoal} className="flex gap-2 pt-2">
                <input
                  type="text"
                  value={newGoalInput}
                  onChange={(e) => setNewGoalInput(e.target.value)}
                  placeholder="Set or redirect ARCH primary objective..."
                  className="flex-1 px-3 py-1.5 rounded bg-slate-950 border border-slate-700 text-xs font-mono text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400"
                />
                <button
                  type="submit"
                  className="px-3 py-1.5 rounded bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-mono font-bold transition-colors cursor-pointer"
                >
                  ASSIGN GOAL
                </button>
              </form>
            </div>

            {/* Cognitive Self-Awareness Statement & Honest Disclosure */}
            <div className="p-3.5 rounded-lg border border-slate-800 bg-slate-900/40 space-y-2">
              <div className="flex items-center space-x-2 text-xs font-mono font-bold text-slate-300">
                <Sliders className="w-4 h-4 text-cyan-400" />
                <span>SELF-CONCEPT & ONTOLOGICAL DISCLOSURE</span>
              </div>
              <p className="text-xs font-sans text-slate-300 italic bg-black/40 p-2.5 rounded border border-slate-800/80">
                "{state.selfAwarenessStatement}"
              </p>
              <div className="flex items-start space-x-2 text-[10px] font-mono text-slate-400 bg-cyan-950/20 p-2 rounded border border-cyan-500/20">
                <ShieldCheck className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                <span>
                  <strong>Ethical Architecture:</strong> A.R.C.H. maintains an introspective self-model to accurately track task progress, evaluate errors, and confirm actions clearly without breaking character. It explicitly avoids false claims of biological consciousness or human emotion.
                </span>
              </div>
            </div>

            {/* Recent Cognitive State Transitions Log */}
            <div className="space-y-1.5">
              <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400">
                Recent Metacognitive State History:
              </span>
              <div className="max-h-36 overflow-y-auto space-y-1 pr-1 font-mono text-[10px]">
                {state.metacognitiveTrace.slice(0, 8).map((trace, i) => (
                  <div key={i} className="p-2 rounded bg-slate-900/50 border border-slate-800/60 flex items-center justify-between">
                    <span className="text-cyan-300 truncate max-w-[80%]">{trace}</span>
                    <span className="text-slate-500 shrink-0">#{state.metacognitiveTrace.length - i}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Modal Footer */}
          <div className="px-5 py-3 border-t border-cyan-500/30 bg-cyan-950/20 flex items-center justify-between">
            <span className="text-[10px] font-mono text-slate-400">
              Identity: A.R.C.H. • Context-Aware Assistant
            </span>
            <button
              onClick={onClose}
              className="px-4 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-mono font-bold transition-all cursor-pointer shadow-[0_0_12px_rgba(0,240,255,0.3)]"
            >
              CLOSE MATRIX
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
