/**
 * Audio handling utility for ARCH Live API Voice stream.
 * 
 * Features:
 * - Resampling to 16kHz layout sampling for microphone stream.
 * - Raw Little Endian Int16 PCM translation.
 * - 24kHz layout output sampling for model voice playback.
 * - Gapless jitter-free double-buffer queue scheduler.
 * - Anti-Flap State Guard: Eliminates rapid toggling between "listening" and "answering".
 * - Smart Acoustic Echo Gate: Prevents speaker audio from leaking back into the mic
 *   and triggering false self-interruptions during model turns.
 * - Immediate interruption and clean state restoration.
 * - Non-leaking silent monitor routing for Web Audio ScriptProcessor.
 * - Input & Output AnalyserNodes for real-time waveform visuals.
 * - Automatic background session keep-alive and robust auto-reconnection.
 */

import { getWsUrl } from "./api";

export type LiveState = "disconnected" | "connecting" | "listening" | "speaking";

// Downsamples arbitrary audio buffer rate (e.g. 44.1kHz or 48kHz) down to 16kHz
function downsampleTo16k(input: Float32Array, inputSampleRate: number): Float32Array {
  if (inputSampleRate === 16000) return input;
  const ratio = inputSampleRate / 16000;
  const newLength = Math.round(input.length / ratio);
  const result = new Float32Array(newLength);
  let offsetResult = 0;
  let offsetInput = 0;
  while (offsetResult < result.length) {
    const nextOffsetInput = Math.round((offsetResult + 1) * ratio);
    let accum = 0;
    let count = 0;
    for (let i = offsetInput; i < nextOffsetInput && i < input.length; i++) {
      accum += input[i];
      count++;
    }
    result[offsetResult] = count > 0 ? accum / count : input[offsetInput];
    offsetResult++;
    offsetInput = nextOffsetInput;
  }
  return result;
}

// PCM Conversion Helper: converts Float32Array [-1.0, 1.0] to signed Int16 Raw PCM Little Endian
function floatTo16BitPCM(input: Float32Array): ArrayBuffer {
  const buffer = new ArrayBuffer(input.length * 2);
  const view = new DataView(buffer);
  let offset = 0;
  for (let i = 0; i < input.length; i++, offset += 2) {
    let s = Math.max(-1, Math.min(1, input[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
  }
  return buffer;
}

// Float conversion helper: converts signed Int16 array buffer to Float32Array [-1.0, 1.0]
function pcm16ToFloats(uint8Array: Uint8Array): Float32Array {
  const int16 = new Int16Array(
    uint8Array.buffer,
    uint8Array.byteOffset,
    uint8Array.byteLength / 2
  );
  const floats = new Float32Array(int16.length);
  for (let i = 0; i < int16.length; i++) {
    floats[i] = int16[i] / 32768.0;
  }
  return floats;
}

// Convert ArrayBuffer to Base64 String
function base64ArrayBuffer(arrayBuffer: ArrayBuffer): string {
  let binary = "";
  const bytes = new Uint8Array(arrayBuffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

// Convert Base64 string to Uint8Array
function base64ToUint8Array(base64: string): Uint8Array {
  const binaryString = window.atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

export class AeviAudioSession {
  private ws: WebSocket | null = null;
  
  // Audio contexts
  private inputAudioCtx: AudioContext | null = null;
  private outputAudioCtx: AudioContext | null = null;
  
  // Audio sources & processors
  private micStream: MediaStream | null = null;
  private micSourceNode: MediaStreamAudioSourceNode | null = null;
  private micProcessorNode: ScriptProcessorNode | null = null;
  private silentGainNode: GainNode | null = null;
  
  // Visualisers
  public inputAnalyser: AnalyserNode | null = null;
  public outputAnalyser: AnalyserNode | null = null;
  private outputGainNode: GainNode | null = null;
  
  // Buffering / Playback details
  private nextStartTime = 0;
  private activeSources: AudioBufferSourceNode[] = [];
  
  // State Callbacks
  private onStateChange: (state: LiveState) => void;
  private onTranscription: (role: "user" | "model", text: string) => void;
  private onToolCall: (name: string, args: any, callback: (result: any) => void) => void;
  private onError: (error: string) => void;
  private onMemorySync?: (memories: any[]) => void;
  private onMuteChange?: (isMuted: boolean) => void;
  private onMicPermissionChange?: (granted: boolean, message?: string) => void;
  
  private currentState: LiveState = "disconnected";
  private isActivated = false;
  private isMuted = false;
  private micPermissionGranted = false;

  // Anti-Flap & Echo-Guard State Tracking
  private isModelTurnActive = false;
  private hasTurnCompleted = true;
  private turnEndTimer: any = null;
  private echoGuardEnabled = true;

  // Auto-reconnect utilities
  private reconnectTimer: any = null;
  private reconnectCount = 0;

  constructor(handlers: {
    onStateChange: (state: LiveState) => void;
    onTranscription: (role: "user" | "model", text: string) => void;
    onToolCall: (name: string, args: any, callback: (result: any) => void) => void;
    onError: (error: string) => void;
    onMemorySync?: (memories: any[]) => void;
    onMuteChange?: (isMuted: boolean) => void;
    onMicPermissionChange?: (granted: boolean, message?: string) => void;
  }) {
    this.onStateChange = handlers.onStateChange;
    this.onTranscription = handlers.onTranscription;
    this.onToolCall = handlers.onToolCall;
    this.onError = handlers.onError;
    this.onMemorySync = handlers.onMemorySync;
    this.onMuteChange = handlers.onMuteChange;
    this.onMicPermissionChange = handlers.onMicPermissionChange;
  }

  public isMicrophoneActive(): boolean {
    return Boolean(this.micStream && this.micStream.active && this.micPermissionGranted && !this.isMuted);
  }

  public isMicrophonePermissionGranted(): boolean {
    return this.micPermissionGranted;
  }

  private setState(state: LiveState) {
    if (this.currentState === state) return;
    console.log(`[ARCH Audio State]: ${this.currentState} -> ${state}`);
    this.currentState = state;
    this.onStateChange(state);
  }

  public getState(): LiveState {
    return this.currentState;
  }

  public getIsMuted(): boolean {
    return this.isMuted;
  }

  public setMuted(muted: boolean) {
    this.isMuted = muted;
    if (this.micStream) {
      this.micStream.getAudioTracks().forEach((track) => {
        track.enabled = !muted;
      });
    }
    if (this.onMuteChange) {
      this.onMuteChange(this.isMuted);
    }
  }

  public toggleMute(): boolean {
    this.setMuted(!this.isMuted);
    return this.isMuted;
  }

  public getEchoGuard(): boolean {
    return this.echoGuardEnabled;
  }

  public setEchoGuard(enabled: boolean) {
    this.echoGuardEnabled = enabled;
  }

  public toggleEchoGuard(): boolean {
    this.echoGuardEnabled = !this.echoGuardEnabled;
    return this.echoGuardEnabled;
  }

  /**
   * Pushes a compressed JPEG base64 screenshot frame directly to the live WebSocket server.
   */
  public sendVideoFrame(base64Data: string) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN && this.currentState !== "disconnected") {
      this.ws.send(JSON.stringify({ type: "video", video: base64Data }));
    }
  }

  /**
   * Dispatches text command or transcribed prompt to the Gemini Live session.
   */
  public sendTextMessage(text: string) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN && this.currentState !== "disconnected") {
      this.ws.send(JSON.stringify({ type: "text", text }));
    }
  }

  /**
   * Returns live frequency data array for HUD waveform spectrum analysis.
   */
  public getAudioFrequencyData(): Uint8Array | null {
    const activeAnalyser = this.currentState === "speaking" ? this.outputAnalyser : this.inputAnalyser;
    if (!activeAnalyser) return null;

    const dataArray = new Uint8Array(activeAnalyser.frequencyBinCount);
    activeAnalyser.getByteFrequencyData(dataArray);
    return dataArray;
  }

  /**
   * Prompts the backend WebSocket that user has remained silent for a while.
   */
  public sendSilenceTrigger() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN && this.currentState === "listening") {
      this.ws.send(JSON.stringify({ type: "silenceTrigger" }));
    }
  }

  /**
   * Safe Audio Context & Device Initialization. Reusable even upon reconnection.
   */
  private async initAudioPipeline() {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) {
      throw new Error("Audio link unsupported: Web Audio API missing in browser.");
    }

    // 1. Output Pipeline Setup (Always succeeds, no microphone permission needed)
    if (!this.outputAudioCtx) {
      try {
        this.outputAudioCtx = new AudioContextClass({ sampleRate: 24000 });
      } catch (e) {
        this.outputAudioCtx = new AudioContextClass();
      }

      if (this.outputAudioCtx.state === "suspended") {
        await this.outputAudioCtx.resume().catch(() => {});
      }

      this.outputGainNode = this.outputAudioCtx.createGain();
      this.outputAnalyser = this.outputAudioCtx.createAnalyser();
      this.outputAnalyser.fftSize = 256;
      this.outputAnalyser.smoothingTimeConstant = 0.8;

      this.outputGainNode.connect(this.outputAnalyser);
      this.outputAnalyser.connect(this.outputAudioCtx.destination);
    }

    // 2. Attempt to initialize Microphone Input Pipeline (Catches permission errors safely)
    await this.initMicrophone().catch((err) => {
      console.warn("[ARCH] Initial microphone initialization failed:", err);
    });
  }

  /**
   * Explicitly request or reconnect microphone input stream
   */
  public async requestMicrophoneAccess(): Promise<boolean> {
    return await this.initMicrophone();
  }

  /**
   * Initializes or attaches the microphone stream safely without terminating the session on permission failure.
   */
  public async initMicrophone(): Promise<boolean> {
    if (this.micStream && this.micStream.active && this.micProcessorNode) {
      this.micPermissionGranted = true;
      if (this.onMicPermissionChange) {
        this.onMicPermissionChange(true);
      }
      return true;
    }

    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      this.micPermissionGranted = false;
      if (this.onMicPermissionChange) {
        this.onMicPermissionChange(false, "Microphone access is not supported in this browser environment.");
      }
      return false;
    }

    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) {
      this.micPermissionGranted = false;
      return false;
    }

    try {
      if (!this.inputAudioCtx) {
        try {
          this.inputAudioCtx = new AudioContextClass({ sampleRate: 16000 });
        } catch (e) {
          this.inputAudioCtx = new AudioContextClass();
        }
      }

      if (this.inputAudioCtx.state === "suspended") {
        await this.inputAudioCtx.resume().catch(() => {});
      }

      // Microphone access with robust noise & echo cancellation constraints
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        }
      });

      this.micStream = stream;
      this.micPermissionGranted = true;

      // Setup input analyser
      this.inputAnalyser = this.inputAudioCtx.createAnalyser();
      this.inputAnalyser.fftSize = 256;

      if (this.micSourceNode) {
        try { this.micSourceNode.disconnect(); } catch (e) {}
      }
      this.micSourceNode = this.inputAudioCtx.createMediaStreamSource(this.micStream);
      this.micSourceNode.connect(this.inputAnalyser);

      // Audio process node (2048 samples buffer)
      if (this.micProcessorNode) {
        try { this.micProcessorNode.disconnect(); } catch (e) {}
      }
      this.micProcessorNode = this.inputAudioCtx.createScriptProcessor(2048, 1, 1);
      this.micSourceNode.connect(this.micProcessorNode);

      // Route micProcessorNode through a silent gain node (gain = 0) to prevent local speaker feedback loop
      if (this.silentGainNode) {
        try { this.silentGainNode.disconnect(); } catch (e) {}
      }
      this.silentGainNode = this.inputAudioCtx.createGain();
      this.silentGainNode.gain.value = 0;
      this.micProcessorNode.connect(this.silentGainNode);
      this.silentGainNode.connect(this.inputAudioCtx.destination);

      this.micProcessorNode.onaudioprocess = (e) => {
        if (this.currentState === "disconnected" || this.currentState === "connecting" || this.isMuted) return;

        const rawChannelData = e.inputBuffer.getChannelData(0);

        // 1. Calculate input Root Mean Square (RMS) energy
        let sumSq = 0;
        for (let i = 0; i < rawChannelData.length; i++) {
          sumSq += rawChannelData[i] * rawChannelData[i];
        }
        const rms = Math.sqrt(sumSq / rawChannelData.length);

        // 2. Smart Echo-Gate & Acoustic Bleed Protection:
        // When ARCH is actively answering (speaking) or audio buffers are scheduled in speakers:
        const isSpeakingNow = this.currentState === "speaking" || this.activeSources.length > 0 || this.isModelTurnActive;
        if (isSpeakingNow && this.echoGuardEnabled) {
          // Typical acoustic speaker bleed registers below 0.065.
          // If RMS < 0.075, drop the chunk to prevent false self-interruption and state fluttering!
          if (rms < 0.075) {
            return;
          }
          // If RMS is high (>= 0.075), the user is intentionally speaking into the mic to interrupt/barge in!
          console.log(`[ARCH User Barge-In Detected] RMS: ${rms.toFixed(3)}`);
        }

        // 3. Resample down to 16kHz if the input context runs at a different hardware rate
        const actualSampleRate = this.inputAudioCtx?.sampleRate || 16000;
        const resampled = downsampleTo16k(rawChannelData, actualSampleRate);

        // 4. Convert to 16-bit PCM Little Endian
        const pcmBuffer = floatTo16BitPCM(resampled);
        const base64 = base64ArrayBuffer(pcmBuffer);

        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
          this.ws.send(JSON.stringify({ type: "audio", audio: base64 }));
        }
      };

      if (this.onMicPermissionChange) {
        this.onMicPermissionChange(true);
      }
      return true;

    } catch (err: any) {
      console.warn("[ARCH] Microphone permission denied or device unavailable:", err);
      this.micPermissionGranted = false;
      const isDenied = err.name === "NotAllowedError" || err.name === "PermissionDeniedError" || String(err.message).toLowerCase().includes("permission");
      const userMsg = isDenied
        ? "Microphone access blocked. ARCH connected in Text Mode. Click 'Grant Mic' or allow microphone in your browser to speak."
        : `Microphone unavailable (${err.message || err.name}). ARCH connected in Text Mode.`;

      if (this.onMicPermissionChange) {
        this.onMicPermissionChange(false, userMsg);
      }
      return false;
    }
  }

  /**
   * Establishes the WebSocket connection stream. Resolves when connected.
   */
  private connectSocket(): Promise<void> {
    if (this.ws) {
      try {
        this.ws.close();
      } catch (e) {}
      this.ws = null;
    }

    let wsUrl = "";
    try {
      wsUrl = getWsUrl("/live");
      this.ws = new WebSocket(wsUrl);
      this.ws.binaryType = "blob";
    } catch (wsErr: any) {
      console.error("[ARCH WS Init Error]:", wsErr);
      this.onError("Could not initialize connection to ARCH server.");
      return Promise.reject(wsErr);
    }

    return new Promise((resolve, reject) => {
      let resolved = false;

      this.ws!.onopen = () => {
        console.log("[ARCH] Connected to server bridge socket");
        this.setState("listening");
        this.reconnectCount = 0;
        resolved = true;
        resolve();
      };

      this.ws!.onmessage = async (event) => {
        try {
          const data = JSON.parse(event.data);

          // Root Error Handler
          if (data.type === "error") {
            this.onError(data.error);
            this.disconnect();
            return;
          }

          // Handle server statuses
          if (data.type === "status") {
            console.log("[ARCH WS Status]:", data.status);
            if (data.status === "connected") {
              this.setState("listening");
            } else if (data.status === "session_closed") {
              this.handleDisconnectOrReconnect();
            }
            return;
          }

          // Play vocal audio chunk from model
          if (data.type === "audio" && data.audio) {
            this.playAudioPCMChunk(data.audio);
          }

          // User interrupted speech or manual stop
          if (data.type === "interrupted") {
            this.handleInterruption();
          }

          // Server finished streaming turn content
          if (data.type === "turnComplete") {
            this.hasTurnCompleted = true;
            this.checkAndScheduleTurnEnd();
          }

          // Captions transcriptions
          if (data.type === "transcription") {
            this.onTranscription(data.role, data.text);
          }

          // Recollection memories
          if (data.type === "memory_sync" && data.memories) {
            if (this.onMemorySync) {
              this.onMemorySync(data.memories);
            }
          }

          // Model Tool Calls
          if (data.type === "toolCall") {
            const { callId, name, args } = data;
            this.onToolCall(name, args, (result) => {
              if (this.ws && this.ws.readyState === WebSocket.OPEN) {
                this.ws.send(JSON.stringify({
                  type: "toolResponse",
                  id: callId,
                  name: name,
                  output: result
                }));
              }
            });
          }
        } catch (parseError) {
          console.error("Error reading packet:", parseError);
        }
      };

      this.ws!.onerror = (wsError) => {
        console.error("WebSocket transport error:", wsError);
        if (!resolved) {
          resolved = true;
          reject(new Error("Network link lost."));
        }
      };

      this.ws!.onclose = () => {
        console.log("WebSocket connection closed for ARCH");
        if (this.isActivated) {
          this.handleDisconnectOrReconnect();
        } else {
          this.disconnect();
        }
      };
    });
  }

  /**
   * Triggers automatic, silent connection reconstruction under state retention.
   */
  private handleDisconnectOrReconnect() {
    if (!this.isActivated) return;

    this.setState("connecting");
    console.log("[ARCH] Connection lost unexpectedly. Attempting auto-reconnection...");

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }

    if (this.reconnectCount < 6) {
      this.reconnectCount++;
      const delay = Math.min(1000 * Math.pow(1.5, this.reconnectCount), 8000);
      console.log(`[ARCH] Scheduling automatic reconnect attempt #${this.reconnectCount} in ${delay}ms...`);

      this.reconnectTimer = setTimeout(async () => {
        if (!this.isActivated) return;
        try {
          await this.connectSocket();
          console.log("[ARCH] Auto-reconnection succeeded! Resuming companion session...");
        } catch (err) {
          console.error("[ARCH] Auto-reconnection attempt failed:", err);
          this.handleDisconnectOrReconnect();
        }
      }, delay);
    } else {
      console.warn("[ARCH] Maximum auto-reconnections exhausted. Standing down.");
      this.onError("Could not reconnect automatically. Tap the core indicator to reconnect.");
      this.disconnect();
    }
  }

  // Initiates connected lifecycle
  public async connect() {
    if (this.isActivated) return;
    this.isActivated = true;
    this.reconnectCount = 0;
    this.setState("connecting");

    try {
      // 1. Initialize audio pipeline
      await this.initAudioPipeline();

      // 2. Open live secure bridge
      await this.connectSocket();

    } catch (e: any) {
      console.error("ARCH connection sequence failed:", e);
      this.onError(e.message || "Failed to initialize audio link.");
      this.disconnect();
    }
  }

  // Interruption triggers: stops all active audio players immediately
  private handleInterruption() {
    console.log("[ARCH Audio] Interruption signal received; flushing playback buffers.");
    
    if (this.turnEndTimer) {
      clearTimeout(this.turnEndTimer);
      this.turnEndTimer = null;
    }

    // Stop all playing nodes
    this.activeSources.forEach((source) => {
      try {
        source.stop();
      } catch (err) {
        // Already finished or stopped
      }
    });
    this.activeSources = [];
    this.nextStartTime = 0;
    this.isModelTurnActive = false;
    this.hasTurnCompleted = true;
    
    // Set state back to user listening
    this.setState("listening");
  }

  /**
   * User or UI manual interruption method (stops model speaking and returns to listening)
   */
  public interruptSpeaking() {
    if (this.currentState === "speaking" || this.isModelTurnActive) {
      this.handleInterruption();
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: "client_interrupted" }));
      }
    }
  }

  /**
   * Evaluates if the model turn is genuinely finished and smoothly transitions back to "listening"
   */
  private checkAndScheduleTurnEnd() {
    if (this.turnEndTimer) {
      clearTimeout(this.turnEndTimer);
      this.turnEndTimer = null;
    }

    if (!this.hasTurnCompleted) {
      // Server hasn't finished sending chunks for this turn
      return;
    }

    if (this.activeSources.length === 0) {
      const now = this.outputAudioCtx?.currentTime || 0;
      const remainingMs = Math.max(0, (this.nextStartTime - now) * 1000);
      
      // Minimum 250ms debounce guard to ensure no packet arrives in transit
      const delay = Math.max(250, remainingMs + 100);

      this.turnEndTimer = setTimeout(() => {
        if (this.activeSources.length === 0 && this.hasTurnCompleted && this.currentState === "speaking") {
          this.isModelTurnActive = false;
          this.nextStartTime = 0;
          this.setState("listening");
        }
      }, delay);
    }
  }

  // Direct raw PCM chunk scheduled playback at 24kHz
  private playAudioPCMChunk(base64Audio: string) {
    if (!this.outputAudioCtx || !this.outputGainNode) return;

    try {
      // Cancel any pending return-to-listening transition because another chunk has arrived
      if (this.turnEndTimer) {
        clearTimeout(this.turnEndTimer);
        this.turnEndTimer = null;
      }

      this.isModelTurnActive = true;
      this.hasTurnCompleted = false;

      // Switch to speaking state
      if (this.currentState !== "speaking") {
        this.setState("speaking");
      }

      const uint8Array = base64ToUint8Array(base64Audio);
      const floats = pcm16ToFloats(uint8Array);

      // Create AudioBuffer of 24000Hz
      const buffer = this.outputAudioCtx.createBuffer(1, floats.length, 24000);
      buffer.getChannelData(0).set(floats);

      // Create Buffer source
      const source = this.outputAudioCtx.createBufferSource();
      source.buffer = buffer;

      // Connect source to gain which is routed to analyser & speakers
      source.connect(this.outputGainNode);

      const currentTime = this.outputAudioCtx.currentTime;
      
      // Gapless scheduler sync
      if (this.nextStartTime < currentTime) {
        // Start fresh: 40ms ahead to bridge schedule timing
        this.nextStartTime = currentTime + 0.04;
      }

      source.start(this.nextStartTime);
      this.nextStartTime += buffer.duration;

      source.onended = () => {
        const index = this.activeSources.indexOf(source);
        if (index > -1) {
          this.activeSources.splice(index, 1);
        }
        
        // Check if turn has completed and all audio is done
        this.checkAndScheduleTurnEnd();
      };

      this.activeSources.push(source);

    } catch (playbackError) {
      console.error("PCM Chunk buffering/playback failed:", playbackError);
    }
  }

  // Fully cleanup and release microphones & connection sockets
  public disconnect() {
    this.isActivated = false;
    this.isMuted = false;
    this.isModelTurnActive = false;
    this.hasTurnCompleted = true;

    if (this.turnEndTimer) {
      clearTimeout(this.turnEndTimer);
      this.turnEndTimer = null;
    }

    if (this.onMuteChange) {
      this.onMuteChange(false);
    }
    this.setState("disconnected");

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    // Close WS socket
    if (this.ws) {
      try {
        this.ws.close();
      } catch (e) {}
      this.ws = null;
    }

    // Stop all audio playback nodes
    this.activeSources.forEach((s) => {
      try {
        s.stop();
      } catch (e) {}
    });
    this.activeSources = [];
    this.nextStartTime = 0;

    // Stop and release user microphone streams
    if (this.micStream) {
      this.micStream.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch (e) {}
      });
      this.micStream = null;
    }

    // Disconnect routing nodes
    if (this.micProcessorNode) {
      try {
        this.micProcessorNode.disconnect();
      } catch (e) {}
      this.micProcessorNode = null;
    }

    if (this.silentGainNode) {
      try {
        this.silentGainNode.disconnect();
      } catch (e) {}
      this.silentGainNode = null;
    }

    if (this.micSourceNode) {
      try {
        this.micSourceNode.disconnect();
      } catch (e) {}
      this.micSourceNode = null;
    }

    // Close Audio contexts
    if (this.inputAudioCtx) {
      try {
        this.inputAudioCtx.close();
      } catch (e) {}
      this.inputAudioCtx = null;
    }

    if (this.outputAudioCtx) {
      try {
        this.outputAudioCtx.close();
      } catch (e) {}
      this.outputAudioCtx = null;
    }

    this.inputAnalyser = null;
    this.outputAnalyser = null;
    this.outputGainNode = null;
  }
}

// Dual export alias
export const MyraaAudioSession = AeviAudioSession;
