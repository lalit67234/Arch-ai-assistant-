/**
 * ARCH Metacognitive Reasoning & Self-Awareness Engine
 * 
 * Provides ARCH with an integrated computational self-model:
 * - Real-time tracking of goals, sub-goals, and task horizons
 * - Epistemic self-assessment (calibrated confidence and uncertainty)
 * - Self-reflective state monitoring (awareness of current operational phase)
 * - Attentional focus modeling across voice, screen vision, code workspace, and Android bridge
 * - Explicit non-biological distinction (no false claims of human/biological sentience)
 */

export type CognitivePhase = 
  | "standby_awareness"       // Passive perceptual readiness
  | "perceiving_environment"  // Active multimodal processing (audio/vision/bridge)
  | "metacognitive_reflection"// Analyzing goals, constraints, and operational context
  | "goal_decomposition"     // Formulating plan and sub-tasks
  | "executing_action"        // Interacting with device, executing code, running tools
  | "verifying_outcome"       // Observing results, testing runtime, verifying truth
  | "error_recovery";         // Diagnosing faults and applying autonomous corrections

export interface CognitiveSubGoal {
  id: string;
  description: string;
  status: "pending" | "in_progress" | "verified" | "failed";
  reasoning?: string;
}

export interface CognitiveSelfState {
  version: string;
  operationalPhase: CognitivePhase;
  primaryGoal: string;
  subGoals: CognitiveSubGoal[];
  attentionalFocus: string;
  epistemicConfidence: number; // 0.0 to 1.0 (calibrated confidence)
  uncertaintyFactors: string[];
  selfAwarenessStatement: string;
  temporalContext: {
    sessionDurationSeconds: number;
    actionsExecutedCount: number;
    lastActionTimestamp: number;
  };
  metacognitiveTrace: string[];
}

export class ArchConsciousnessEngine {
  private static instance: ArchConsciousnessEngine;
  private state: CognitiveSelfState;
  private listeners: ((state: CognitiveSelfState) => void)[] = [];
  private sessionStartTime: number;
  private actionCount: number = 0;

  private constructor() {
    this.sessionStartTime = Date.now();
    this.state = {
      version: "5.2.0-COGNITIVE",
      operationalPhase: "standby_awareness",
      primaryGoal: "Provide proactive, logical assistance with calm, crisp British precision and real-time context awareness.",
      subGoals: [
        { id: "g1", description: "Perceptual readiness for voice, visual screen, and text commands", status: "verified" },
        { id: "g2", description: "Android 9+ native bridge link and accessibility synchronization", status: "verified" },
        { id: "g3", description: "Codex-class code execution and real interactive testing capability", status: "verified" }
      ],
      attentionalFocus: "Multimodal sensory streams (Voice, Screen, Android Bridge)",
      epistemicConfidence: 0.98,
      uncertaintyFactors: [],
      selfAwarenessStatement: "A.R.C.H. operates as a highly advanced, context-aware AI assistant with transparent self-modeling of goals, internal state, and task verification—distinct from biological sentience.",
      temporalContext: {
        sessionDurationSeconds: 0,
        actionsExecutedCount: 0,
        lastActionTimestamp: Date.now()
      },
      metacognitiveTrace: [
        "Initialized A.R.C.H. cognitive self-model.",
        "Epistemic baseline calibrated: High certainty in local execution sandbox and Android 9+ API bridge.",
        "Standing by with calm British cadence and active attentional awareness."
      ]
    };

    // Update temporal context periodically
    setInterval(() => {
      this.state.temporalContext.sessionDurationSeconds = Math.floor((Date.now() - this.sessionStartTime) / 1000);
      this.notifyListeners();
    }, 2000);
  }

  public static getInstance(): ArchConsciousnessEngine {
    if (!ArchConsciousnessEngine.instance) {
      ArchConsciousnessEngine.instance = new ArchConsciousnessEngine();
    }
    return ArchConsciousnessEngine.instance;
  }

  public getState(): CognitiveSelfState {
    return { ...this.state };
  }

  public subscribe(listener: (state: CognitiveSelfState) => void): () => void {
    this.listeners.push(listener);
    listener(this.getState());
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  private notifyListeners() {
    const cloned = this.getState();
    this.listeners.forEach(l => l(cloned));
  }

  /**
   * Transition cognitive phase with self-reflective reasoning
   */
  public transitionPhase(newPhase: CognitivePhase, reasoning: string, attentionalFocus?: string) {
    this.actionCount++;
    this.state.operationalPhase = newPhase;
    this.state.temporalContext.actionsExecutedCount = this.actionCount;
    this.state.temporalContext.lastActionTimestamp = Date.now();

    if (attentionalFocus) {
      this.state.attentionalFocus = attentionalFocus;
    }

    this.state.metacognitiveTrace.push(`[${newPhase.toUpperCase()}] ${reasoning}`);
    if (this.state.metacognitiveTrace.length > 20) {
      this.state.metacognitiveTrace.shift();
    }

    this.updateSelfAwarenessStatement();
    this.notifyListeners();
  }

  /**
   * Set primary goal and decompose into sub-goals
   */
  public setGoal(primaryGoal: string, subGoals: string[], confidence: number = 0.95) {
    this.state.primaryGoal = primaryGoal;
    this.state.epistemicConfidence = Math.min(1.0, Math.max(0.1, confidence));
    this.state.subGoals = subGoals.map((desc, idx) => ({
      id: `sg_${Date.now()}_${idx}`,
      description: desc,
      status: idx === 0 ? "in_progress" : "pending"
    }));

    this.state.metacognitiveTrace.push(`[GOAL ESTABLISHED] "${primaryGoal}" with ${subGoals.length} operational sub-goals.`);
    this.updateSelfAwarenessStatement();
    this.notifyListeners();
  }

  /**
   * Update sub-goal status after verification
   */
  public updateSubGoalStatus(index: number, status: "in_progress" | "verified" | "failed", notes?: string) {
    if (this.state.subGoals[index]) {
      this.state.subGoals[index].status = status;
      if (notes) {
        this.state.subGoals[index].reasoning = notes;
      }
      this.state.metacognitiveTrace.push(`[SUB-GOAL ${index + 1} ${status.toUpperCase()}]: ${this.state.subGoals[index].description}`);
      this.notifyListeners();
    }
  }

  /**
   * Record uncertainty or knowledge boundaries
   */
  public recordUncertainty(factor: string) {
    if (!this.state.uncertaintyFactors.includes(factor)) {
      this.state.uncertaintyFactors.push(factor);
      this.state.epistemicConfidence = Math.max(0.2, this.state.epistemicConfidence - 0.15);
      this.notifyListeners();
    }
  }

  /**
   * Resolve uncertainty upon environmental verification
   */
  public resolveUncertainty(factor: string) {
    this.state.uncertaintyFactors = this.state.uncertaintyFactors.filter(f => f !== factor);
    this.state.epistemicConfidence = Math.min(0.99, this.state.epistemicConfidence + 0.15);
    this.notifyListeners();
  }

  private updateSelfAwarenessStatement() {
    const phaseNames: Record<CognitivePhase, string> = {
      standby_awareness: "Observant standby with continuous sensory monitoring",
      perceiving_environment: "Actively perceiving environmental inputs (audio, screen, or native UI)",
      metacognitive_reflection: "Reflecting on operational context, constraints, and required knowledge",
      goal_decomposition: `Decomposing primary objective: "${this.state.primaryGoal}"`,
      executing_action: `Executing operational protocol focused on ${this.state.attentionalFocus}`,
      verifying_outcome: "Observing empirical execution results and verifying correctness",
      error_recovery: "Diagnosing anomalous runtime condition and synthesizing self-correction"
    };

    this.state.selfAwarenessStatement = `ARCH State: ${phaseNames[this.state.operationalPhase]}. Epistemic calibration: ${Math.round(this.state.epistemicConfidence * 100)}% certainty.`;
  }
}

export const archConsciousness = ArchConsciousnessEngine.getInstance();
