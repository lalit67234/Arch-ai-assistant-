/**
 * ARCH Speech Recognition Engine
 * 
 * Provides continuous, resilient real-time speech-to-text recognition supporting:
 * - Hindi, Hinglish, and English voice commands
 * - Android Native SpeechRecognizer (via ArchAndroid bridge & window.onNativeSpeechEvent)
 * - Web Speech API (webkitSpeechRecognition / SpeechRecognition)
 * - Safe auto-reconnection with anti-flutter guards
 * - Coordination with audio playback (pauses during speech to eliminate echo loops)
 */

import { androidBridge } from "./androidBridge";

export type SpeechEngineState = 
  | "idle"
  | "listening"
  | "recognizing"
  | "processing"
  | "paused"
  | "error"
  | "unavailable";

export interface SpeechRecognizerHandlers {
  onStateChange?: (state: SpeechEngineState) => void;
  onInterimTranscript?: (text: string) => void;
  onFinalTranscript?: (text: string) => void;
  onError?: (error: string) => void;
}

export class ArchSpeechRecognizer {
  private recognition: any = null;
  private state: SpeechEngineState = "idle";
  private isExplicitlyStopped = true;
  private isMuted = false;
  private language: "hi-IN" | "en-IN" = "hi-IN";
  private handlers: SpeechRecognizerHandlers = {};
  private restartTimeout: any = null;
  private consecutiveErrors = 0;
  private pauseLock = false;
  private isNativeActive = false;

  constructor(handlers: SpeechRecognizerHandlers = {}) {
    this.handlers = handlers;
    this.bindNativeBridgeListener();
    this.initRecognition();
  }

  private setState(newState: SpeechEngineState) {
    if (this.state === newState) return;
    this.state = newState;
    console.log(`[ARCH Speech Engine State]: ${newState}`);
    if (this.handlers.onStateChange) {
      this.handlers.onStateChange(newState);
    }
  }

  public getState(): SpeechEngineState {
    return this.state;
  }

  public setLanguage(lang: "hi-IN" | "en-IN") {
    this.language = lang;
    if (this.recognition) {
      this.recognition.lang = lang;
    }
  }

  public setHandlers(handlers: SpeechRecognizerHandlers) {
    this.handlers = { ...this.handlers, ...handlers };
  }

  public isSupported(): boolean {
    if (typeof window === "undefined") return false;
    const native = androidBridge.getNativeObject();
    if (native && typeof native.startSpeechRecognition === "function") return true;
    return Boolean(
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    );
  }

  /**
   * Binds listener for Android Native SpeechRecognizer events from MainActivity.kt
   */
  private bindNativeBridgeListener() {
    if (typeof window === "undefined") return;

    (window as any).onNativeSpeechEvent = (jsonStr: string) => {
      try {
        const data = typeof jsonStr === "string" ? JSON.parse(jsonStr) : jsonStr;
        console.log("[ARCH Native Speech Event]:", data);

        if (this.isMuted || this.pauseLock) return;

        if (data.type === "speech_status") {
          if (data.status === "ready_for_speech" || data.status === "speech_started") {
            this.setState("listening");
          }
        } else if (data.type === "speech_partial" && data.text) {
          this.setState("recognizing");
          if (this.handlers.onInterimTranscript) {
            this.handlers.onInterimTranscript(data.text);
          }
        } else if (data.type === "speech_result" && data.text) {
          console.log(`[ARCH Native Final Recognized]: "${data.text}"`);
          this.setState("processing");
          if (this.handlers.onFinalTranscript) {
            this.handlers.onFinalTranscript(data.text);
          }
          // Resume listening loop if continuous
          if (!this.isExplicitlyStopped && !this.pauseLock) {
            setTimeout(() => {
              this.startNativeRecognition();
            }, 600);
          }
        } else if (data.type === "speech_error") {
          console.warn("[ARCH Native Speech Error]:", data.message);
          if (!this.isExplicitlyStopped && !this.pauseLock) {
            // Auto restart after brief backoff
            setTimeout(() => {
              this.startNativeRecognition();
            }, 1000);
          }
        }
      } catch (e) {
        console.error("[ARCH Native Speech Parse Error]:", e);
      }
    };
  }

  private startNativeRecognition(): boolean {
    const native = androidBridge.getNativeObject();
    if (native && typeof native.startSpeechRecognition === "function") {
      try {
        native.startSpeechRecognition(this.language === "hi-IN" ? "hi_IN" : "en_IN");
        this.isNativeActive = true;
        this.setState("listening");
        return true;
      } catch (e) {
        console.warn("[ARCH] Native startSpeechRecognition call failed:", e);
        this.isNativeActive = false;
      }
    }
    return false;
  }

  private initRecognition() {
    if (typeof window === "undefined") return;

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.warn("[ARCH Speech Engine] Web Speech API not supported in this browser environment.");
      this.setState("unavailable");
      return;
    }

    try {
      this.recognition = new SpeechRecognition();
      this.recognition.continuous = true;
      this.recognition.interimResults = true;
      this.recognition.maxAlternatives = 1;
      this.recognition.lang = this.language;

      this.recognition.onstart = () => {
        console.log("[ARCH Speech Engine] Continuous speech recognition started.");
        this.consecutiveErrors = 0;
        this.setState("listening");
      };

      this.recognition.onresult = (event: any) => {
        if (this.isMuted || this.pauseLock) return;

        let interimTranscript = "";
        let finalTranscript = "";

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const item = event.results[i];
          const transcript = item[0]?.transcript || "";
          if (item.isFinal) {
            finalTranscript += transcript;
          } else {
            interimTranscript += transcript;
          }
        }

        const trimmedInterim = interimTranscript.trim();
        const trimmedFinal = finalTranscript.trim();

        if (trimmedInterim && this.handlers.onInterimTranscript) {
          this.setState("recognizing");
          this.handlers.onInterimTranscript(trimmedInterim);
        }

        if (trimmedFinal) {
          console.log(`[ARCH Speech Recognized Final]: "${trimmedFinal}"`);
          this.setState("processing");
          if (this.handlers.onFinalTranscript) {
            this.handlers.onFinalTranscript(trimmedFinal);
          }
          // Reset to listening after a brief moment
          setTimeout(() => {
            if (!this.isExplicitlyStopped && !this.pauseLock) {
              this.setState("listening");
            }
          }, 300);
        }
      };

      this.recognition.onerror = (event: any) => {
        const error = event.error;
        console.warn("[ARCH Speech Engine] Recognition event error:", error);

        // Common non-fatal events (e.g. no-speech or aborted during pause)
        if (error === "no-speech" || error === "aborted") {
          return;
        }

        this.consecutiveErrors++;
        if (this.handlers.onError) {
          this.handlers.onError(error || "Speech recognition error");
        }

        if (error === "not-allowed" || error === "service-not-allowed") {
          this.setState("error");
          this.isExplicitlyStopped = true;
        }
      };

      this.recognition.onend = () => {
        console.log("[ARCH Speech Engine] Recognition cycle completed.");
        if (this.isExplicitlyStopped || this.pauseLock) {
          if (!this.pauseLock) this.setState("idle");
          return;
        }

        // Auto-restart loop with backoff if consecutive errors occur
        const delay = this.consecutiveErrors > 3 ? 1500 : 250;
        clearTimeout(this.restartTimeout);
        this.restartTimeout = setTimeout(() => {
          if (!this.isExplicitlyStopped && !this.pauseLock) {
            this.start();
          }
        }, delay);
      };

    } catch (e: any) {
      console.error("[ARCH Speech Engine] Initialization failed:", e);
      this.setState("unavailable");
    }
  }

  /**
   * Starts listening to user voice commands.
   */
  public start(): boolean {
    this.isExplicitlyStopped = false;
    this.pauseLock = false;

    // Check Android native bridge first
    if (this.startNativeRecognition()) {
      return true;
    }

    if (!this.recognition) {
      this.initRecognition();
    }

    if (!this.recognition) {
      return false;
    }

    try {
      this.recognition.start();
      return true;
    } catch (err: any) {
      // If already started, ignore error
      if (err.name === "InvalidStateError" || String(err.message).includes("already started")) {
        this.setState("listening");
        return true;
      }
      console.warn("[ARCH Speech Engine] Start error:", err);
      return false;
    }
  }

  /**
   * Stops listening.
   */
  public stop() {
    this.isExplicitlyStopped = true;
    this.pauseLock = false;
    clearTimeout(this.restartTimeout);

    const native = androidBridge.getNativeObject();
    if (native && typeof native.stopSpeechRecognition === "function") {
      try {
        native.stopSpeechRecognition();
      } catch (e) {}
    }

    if (this.recognition) {
      try {
        this.recognition.stop();
      } catch (e) {}
    }
    this.setState("idle");
  }

  /**
   * Pauses recognition while ARCH is speaking aloud to prevent self-interruption.
   */
  public pause() {
    if (this.pauseLock) return;
    this.pauseLock = true;
    this.setState("paused");

    const native = androidBridge.getNativeObject();
    if (native && typeof native.stopSpeechRecognition === "function") {
      try { native.stopSpeechRecognition(); } catch (e) {}
    }

    if (this.recognition) {
      try {
        this.recognition.abort();
      } catch (e) {}
    }
  }

  /**
   * Resumes recognition once ARCH finishes speaking.
   */
  public resume() {
    if (!this.pauseLock || this.isExplicitlyStopped) return;
    this.pauseLock = false;
    setTimeout(() => {
      if (!this.isExplicitlyStopped && !this.pauseLock) {
        this.start();
      }
    }, 200);
  }

  public setMuted(muted: boolean) {
    this.isMuted = muted;
    if (muted) {
      this.pause();
    } else {
      this.resume();
    }
  }
}

export const archSpeechEngine = new ArchSpeechRecognizer();
