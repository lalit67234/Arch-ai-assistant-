/**
 * ARCH Unified Asynchronous Command Dispatcher
 * 
 * Provides a single shared asynchronous command dispatcher for:
 * - Real-time Voice Recognition
 * - Clickable App Shortcuts (YouTube, Play Store, Chrome, WhatsApp, Camera, Settings, etc.)
 * - Search bar / Text Input with local vs web distinction
 * - Gemini Live session tool calls
 * 
 * Satisfies Phases 2, 3, 4, 5 of the ARCH repair architecture.
 */

import { androidBridge } from "./androidBridge";
import { evaluateArchIntent, ArchParsedIntent } from "./archIntentEngine";
import { CodeProject } from "../components/CodeWorkspace";

export type ArchIntentType =
  | "OPEN_APP"
  | "APP_SEARCH"
  | "WEB_SEARCH"
  | "CODE_GENERATION"
  | "CODE_DEBUGGING"
  | "PROJECT_ANALYSIS"
  | "GENERAL_AI"
  | "UNKNOWN"
  // Core device capabilities
  | "VOLUME_CONTROL"
  | "OPEN_CAMERA"
  | "OPEN_MAPS"
  | "OPEN_SETTINGS"
  | "DEVICE_ACTION"
  | "LIST_INSTALLED_APPS"
  | "GET_BATTERY"
  | "GET_DATETIME"
  | "TOGGLE_EDITOR";

export interface ArchCommandRequest {
  source: "voice" | "shortcut" | "text_search" | "tool_call" | "ui_action";
  rawText: string;
  explicitType?: ArchIntentType;
  appName?: string;
  targetQuery?: string;
  language?: string;
  meta?: Record<string, any>;
}

export interface ArchCommandResult {
  success: boolean;
  type: ArchIntentType;
  message: string;
  spokenResponse?: string;
  appName?: string;
  targetQuery?: string;
  installed?: boolean;
  verified?: boolean;
  projectAction?: "generate" | "debug" | "execute" | "test" | "play";
  payload?: any;
}

export interface ArchDispatcherContext {
  activeProject?: CodeProject | null;
  isVoiceConnected?: boolean;
  sendTextMessage?: (msg: string) => void;
  interruptSpeech?: () => void;
  setUserCaption?: (text: string) => void;
  setModelCaption?: (text: string) => void;
  setActiveProtocol?: (protocol: string) => void;
  setShowCodeWorkspace?: (open: boolean) => void;
  setWorkspaceViewMode?: (mode: "code" | "preview" | "terminal" | "game_play" | "test_suite") => void;
  setShowPermissionsModal?: (open: boolean) => void;
  setActiveCodeProject?: (proj: CodeProject) => void;
}

// In-flight deduplication cache
const recentDispatches = new Map<string, { timestamp: number; promise: Promise<ArchCommandResult> }>();
const DEDUP_WINDOW_MS = 1200;

/**
 * Normalizes Hindi, Hinglish, and English input and detects high-precision intent
 */
export function normalizeCommandIntent(rawText: string, context?: { activeProject?: boolean }): {
  type: ArchIntentType;
  appName?: string;
  targetQuery?: string;
  language?: string;
  spokenAcknowledgement?: string;
  hindiVoiceResponse?: string;
  details?: any;
} {
  const cleaned = rawText
    .trim()
    .toLowerCase()
    .replace(/[.,!?;:'"]/g, "")
    .replace(/\b(hey|hi|hello|ok|okay|please|zara|kripya|bhai|yaar|arrey|suno|sun)\b/gi, "")
    .replace(/\b(arch|a r c h|ark|arsh)\b/gi, "")
    .trim();

  // 1. One-Word Prompt Intelligence (Phase 5)
  if (/^(python|py)$/i.test(cleaned)) {
    return {
      type: "CODE_GENERATION",
      language: "python",
      details: { title: "Python Terminal Workspace", language: "python" },
      spokenAcknowledgement: "Opening Python sandbox environment with interactive script.",
      hindiVoiceResponse: "Python interactive environment open kar raha hoon, Sir."
    };
  }

  if (/^(ai|artificial intelligence)$/i.test(cleaned)) {
    return {
      type: "CODE_GENERATION",
      language: "python",
      details: { title: "AI Neural Network Engine", language: "python" },
      spokenAcknowledgement: "Generating AI Neural Model simulation project.",
      hindiVoiceResponse: "AI Neural Simulation engine generate kar raha hoon, Sir."
    };
  }

  if (/^(website|web)$/i.test(cleaned)) {
    return {
      type: "CODE_GENERATION",
      language: "html",
      details: { title: "Interactive Web Portal", language: "html" },
      spokenAcknowledgement: "Building modern responsive web portal.",
      hindiVoiceResponse: "Responsive Web Portal develop kar raha hoon, Sir."
    };
  }

  if (/^(game)$/i.test(cleaned)) {
    return {
      type: "CODE_GENERATION",
      language: "html",
      details: { title: "Arcade Canvas Game", language: "html" },
      spokenAcknowledgement: "Generating interactive canvas arcade game.",
      hindiVoiceResponse: "Interactive Arcade Game build kar raha hoon, Sir."
    };
  }

  if (/^(code)$/i.test(cleaned)) {
    return {
      type: "CODE_GENERATION",
      language: "html",
      details: { title: "ARCH Project", language: "html" },
      spokenAcknowledgement: "Accessing code intelligence workspace.",
      hindiVoiceResponse: "Code workspace open kar raha hoon, Sir."
    };
  }

  if (/^(optimize|optimization)$/i.test(cleaned)) {
    return {
      type: "PROJECT_ANALYSIS",
      spokenAcknowledgement: "Analyzing project performance, memory profiling, and bundle optimization.",
      hindiVoiceResponse: "Project optimization analysis initiate kar raha hoon, Sir."
    };
  }

  if (/^(research)$/i.test(cleaned)) {
    return {
      type: "PROJECT_ANALYSIS",
      spokenAcknowledgement: "Synthesizing deep technological research report.",
      hindiVoiceResponse: "Technology research intelligence activate kar raha hoon, Sir."
    };
  }

  // 2. Specific Local Application Launching / Open Intents
  // Handles: "YouTube kholo", "Chrome open karo", "WhatsApp chalao", "Open my calculator", "Mere phone ki settings kholo"
  const isAppLaunchPhrase = /\b(kholo|open|chalao|launch|start|khol do|kholna|run)\b/i.test(cleaned);

  // YouTube checks
  if (/\b(youtube|yt|you tube|यूट्यूब)\b/i.test(cleaned)) {
    const isSearch = /\b(search|dhundho|dhundo|for|play|about)\b/i.test(cleaned);
    if (isSearch) {
      let q = cleaned
        .replace(/.*?(?:search|dhundho|dhundo|for|play|about)\s+/i, "")
        .replace(/\b(karo|kar do|kijiye|please|pe|par|mein|in)\b/gi, "")
        .trim();
      return {
        type: "APP_SEARCH",
        appName: "YouTube",
        targetQuery: q || undefined,
        spokenAcknowledgement: q ? `Searching YouTube for "${q}", Sir.` : "Opening YouTube, Sir.",
        hindiVoiceResponse: q ? `YouTube par "${q}" search kar raha hoon, Sir.` : "YouTube open kar diya hai, Sir."
      };
    }
    return {
      type: "OPEN_APP",
      appName: "YouTube",
      spokenAcknowledgement: "Opening native YouTube application, Sir.",
      hindiVoiceResponse: "YouTube open kar diya hai, Sir."
    };
  }

  // Google Play Store checks
  if (/\b(play store|playstore|google play|store|market|प्ले स्टोर|प्लेस्टोर)\b/i.test(cleaned)) {
    const isSearch = /\b(search|dhundho|dhundo|for|about)\b/i.test(cleaned);
    let q: string | undefined = undefined;
    if (isSearch) {
      q = cleaned
        .replace(/.*?(?:search|dhundho|dhundo|for|about)\s+/i, "")
        .replace(/\b(karo|kar do|kijiye|please|pe|par|mein|in)\b/gi, "")
        .trim();
      return {
        type: "APP_SEARCH",
        appName: "Google Play Store",
        targetQuery: q || undefined,
        spokenAcknowledgement: q ? `Searching Google Play Store for "${q}", Sir.` : "Opening Google Play Store, Sir.",
        hindiVoiceResponse: q ? `Play Store par "${q}" search kar raha hoon, Sir.` : "Google Play Store open kar diya hai, Sir."
      };
    }
    return {
      type: "OPEN_APP",
      appName: "Google Play Store",
      spokenAcknowledgement: "Opening Google Play Store, Sir.",
      hindiVoiceResponse: "Google Play Store open kar diya hai, Sir."
    };
  }

  // Google Chrome checks
  if (/\b(chrome|google chrome|browser|इंटरनेट|ब्राउज़र)\b/i.test(cleaned)) {
    if ((cleaned.includes("mein") || cleaned.includes("me") || cleaned.includes("in")) && (cleaned.includes("kholo") || cleaned.includes("open") || cleaned.includes("search"))) {
      const match = cleaned.match(/(?:mein|me|in)\s+([a-zA-Z0-9\s.]+)\s+(?:kholo|open|search)/i);
      const target = match ? match[1].trim() : "google.com";
      return {
        type: "WEB_SEARCH",
        targetQuery: target,
        spokenAcknowledgement: `Opening ${target} in Chrome, Sir.`,
        hindiVoiceResponse: `Chrome mein ${target} open kar raha hoon, Sir.`
      };
    }
    return {
      type: "OPEN_APP",
      appName: "Google Chrome",
      spokenAcknowledgement: "Opening Google Chrome, Sir.",
      hindiVoiceResponse: "Google Chrome open kar diya hai, Sir."
    };
  }

  // WhatsApp checks
  if (/\b(whatsapp|whats app|व्हाट्सएप|wa)\b/i.test(cleaned)) {
    return {
      type: "OPEN_APP",
      appName: "WhatsApp",
      spokenAcknowledgement: "Opening WhatsApp, Sir.",
      hindiVoiceResponse: "WhatsApp open kar diya hai, Sir."
    };
  }

  // Spotify checks ("Spotify kholo", "Play song on Spotify", "Launch Spotify")
  if (/\b(spotify|music app|गाना|गाने|स्पॉटिफ़ाई)\b/i.test(cleaned)) {
    const isPlayOrSearch = /\b(search|dhundho|dhundo|for|play|chalao|bajao|song|artist|music)\b/i.test(cleaned);
    let q: string | undefined = undefined;
    if (isPlayOrSearch) {
      q = cleaned
        .replace(/.*?(?:search|dhundho|dhundo|for|play|chalao|bajao|song|artist)\s+/i, "")
        .replace(/\b(karo|kar do|kijiye|please|pe|par|mein|in|on|spotify|music)\b/gi, "")
        .trim();
    }
    return {
      type: isPlayOrSearch && q ? "APP_SEARCH" : "OPEN_APP",
      appName: "Spotify",
      targetQuery: q,
      spokenAcknowledgement: q ? `Playing "${q}" on Spotify, Sir.` : "Opening Spotify, Sir.",
      hindiVoiceResponse: q ? `Spotify par "${q}" play kar raha hoon, Sir.` : "Spotify open kar diya hai, Sir."
    };
  }

  // Pinterest checks ("Pinterest kholo", "Open Pinterest", "Pinterest open karo")
  if (/\b(pinterest|pin|पिनट्रेस्ट)\b/i.test(cleaned)) {
    const isSearch = /\b(search|dhundho|dhundo|for|ideas|pins)\b/i.test(cleaned);
    let q: string | undefined = undefined;
    if (isSearch) {
      q = cleaned
        .replace(/.*?(?:search|dhundho|dhundo|for|ideas|pins)\s+/i, "")
        .replace(/\b(karo|kar do|kijiye|please|pe|par|mein|in|on|pinterest)\b/gi, "")
        .trim();
    }
    return {
      type: isSearch && q ? "APP_SEARCH" : "OPEN_APP",
      appName: "Pinterest",
      targetQuery: q,
      spokenAcknowledgement: q ? `Searching Pinterest for "${q}", Sir.` : "Opening Pinterest, Sir.",
      hindiVoiceResponse: q ? `Pinterest par "${q}" search kar raha hoon, Sir.` : "Pinterest open kar diya hai, Sir."
    };
  }

  // YouTube Subscriptions ("Open my subscriptions", "subscriptions kholo")
  if (/\b(subscriptions|my subscriptions|subscription)\b/i.test(cleaned) && /\b(kholo|open|dikhao)\b/i.test(cleaned)) {
    return {
      type: "APP_SEARCH",
      appName: "YouTube",
      details: { action: "subscriptions" },
      spokenAcknowledgement: "Opening YouTube Subscriptions, Sir.",
      hindiVoiceResponse: "YouTube Subscriptions open kar diya hai, Sir."
    };
  }

  // Settings checks ("Mere phone ki settings kholo", "settings open karo")
  if (/\b(settings|preferences|phone settings|device settings|सेटिंग्स)\b/i.test(cleaned)) {
    // If specifically asking for ARCH permissions or bridge config
    if (/\b(bridge config|bridge settings|permissions modal|arch permissions|diagnostics modal|arch diagnostics)\b/i.test(cleaned)) {
      return {
        type: "OPEN_SETTINGS",
        spokenAcknowledgement: "Opening ARCH system bridge diagnostics and permissions.",
        hindiVoiceResponse: "ARCH bridge settings khol raha hoon, Sir."
      };
    }
    return {
      type: "OPEN_APP",
      appName: "Settings",
      spokenAcknowledgement: "Opening Android Device Settings, Sir.",
      hindiVoiceResponse: "Phone settings open kar diya hai, Sir."
    };
  }

  // Camera checks
  if (/\b(camera|photo|tasveer|selfie|कैमरा)\b/i.test(cleaned) && (isAppLaunchPhrase || /\b(take|kheecho|khincho)\b/i.test(cleaned))) {
    return {
      type: "OPEN_CAMERA",
      spokenAcknowledgement: "Opening device camera, Sir.",
      hindiVoiceResponse: "Camera open kar diya hai, Sir."
    };
  }

  // Calculator checks ("Open my calculator", "Calculator kholo")
  if (/\b(calculator|calc|कैलकुलेटर|hisab)\b/i.test(cleaned)) {
    return {
      type: "OPEN_APP",
      appName: "Calculator",
      spokenAcknowledgement: "Opening Calculator, Sir.",
      hindiVoiceResponse: "Calculator open kar diya hai, Sir."
    };
  }

  // Maps checks
  if (/\b(google maps|maps|map|navigation|मैप्स)\b/i.test(cleaned)) {
    const qMatch = cleaned.match(/(?:to|for|ka|ki|ke liye)\s+(.+)/i);
    const mapsQuery = qMatch ? qMatch[1].trim() : undefined;
    return {
      type: "OPEN_MAPS",
      targetQuery: mapsQuery,
      spokenAcknowledgement: mapsQuery ? `Searching Google Maps for ${mapsQuery}, Sir.` : "Opening Google Maps, Sir.",
      hindiVoiceResponse: mapsQuery ? `Google Maps mein ${mapsQuery} search kar raha hoon, Sir.` : "Google Maps open kar diya hai, Sir."
    };
  }

  // 3. Web Search Intents ("Google par search karo", "Search the web for...")
  if (/\b(google search|web search|internet par|google par search)\b/i.test(cleaned) ||
      (cleaned.startsWith("search ") && !cleaned.includes("youtube") && !cleaned.includes("store"))) {
    const query = cleaned
      .replace(/.*?(?:search|dhundho|dhundo)\s+/i, "")
      .replace(/\b(karo|kar do|kijiye|please|pe|par|mein)\b/gi, "")
      .trim();
    return {
      type: "WEB_SEARCH",
      targetQuery: query || cleaned,
      spokenAcknowledgement: `Searching the web for "${query || cleaned}", Sir.`,
      hindiVoiceResponse: `Web par "${query || cleaned}" search kar raha hoon, Sir.`
    };
  }

  // 4. Code Generation & Execution
  if (/\b(auto debug|debug this|fix errors|check errors|galtiyan theek karo|debug karo|solve error)\b/i.test(cleaned)) {
    return {
      type: "CODE_DEBUGGING",
      spokenAcknowledgement: "Initiating automatic debugging cycle: validate, run, analyze traceback, and auto-correct.",
      hindiVoiceResponse: "Automatic debugging cycle start kar raha hoon, Sir."
    };
  }

  if (/\b(test the game|test karo|run tests|run game test|automated test|check the game)\b/i.test(cleaned)) {
    return {
      type: "PROJECT_ANALYSIS",
      spokenAcknowledgement: "Executing comprehensive automated functional test suite.",
      hindiVoiceResponse: "Automated test suite execute kar raha hoon, Sir."
    };
  }

  if (/\b(chala ke dikhao|run code|run it|execute code|start code|project run karo|chalao code|run karo)\b/i.test(cleaned)) {
    return {
      type: "CODE_GENERATION",
      details: { action: "execute" },
      spokenAcknowledgement: "Executing code within isolated sandbox environment.",
      hindiVoiceResponse: "Code execute kar raha hoon, Sir."
    };
  }

  const hasCodeKeywords = /\b(code|python|html|script|program|game|calculator|tic tac toe|app|website|function|algorithm)\b/i.test(cleaned);
  const hasMakeKeywords = /\b(banao|bana do|make|create|write|build|generate|likho)\b/i.test(cleaned);

  if (hasCodeKeywords && hasMakeKeywords) {
    let language: "python" | "html" | "javascript" | "react" | "cpp" = "html";
    if (cleaned.includes("python") || cleaned.includes("py")) language = "python";
    else if (cleaned.includes("react")) language = "react";
    else if (cleaned.includes("javascript") || cleaned.includes("js")) language = "javascript";
    else if (cleaned.includes("c++") || cleaned.includes("cpp")) language = "cpp";

    let title = "Generated Project";
    if (cleaned.includes("tic tac toe") || cleaned.includes("tictactoe")) title = "Tic Tac Toe Game";
    else if (cleaned.includes("calculator")) title = "Interactive Calculator";
    else if (cleaned.includes("snake")) title = "Snake Game";
    else if (cleaned.includes("todo")) title = "Task Organizer";

    return {
      type: "CODE_GENERATION",
      language,
      details: { title, language },
      spokenAcknowledgement: `Building ${title} in ${language.toUpperCase()}. Ready for live execution.`,
      hindiVoiceResponse: `${title} build kar raha hoon, Sir.`
    };
  }

  // 5. Check with auxiliary ARCH Intent Evaluator
  const evaluated = evaluateArchIntent(rawText, { hasActiveProject: context?.activeProject });
  if (evaluated.type === "LAUNCH_APP" && evaluated.args?.appName) {
    return {
      type: "OPEN_APP",
      appName: evaluated.args.appName,
      targetQuery: evaluated.args.targetQuery,
      spokenAcknowledgement: evaluated.intent.spokenAcknowledgement,
      hindiVoiceResponse: evaluated.intent.hindiVoiceResponse
    };
  }

  if (evaluated.type === "VOLUME_CONTROL") {
    return {
      type: "VOLUME_CONTROL",
      details: { volumeAction: evaluated.args?.volumeAction || "down" },
      spokenAcknowledgement: evaluated.intent.spokenAcknowledgement,
      hindiVoiceResponse: evaluated.intent.hindiVoiceResponse
    };
  }

  if (evaluated.type === "LIST_INSTALLED_APPS") {
    return {
      type: "LIST_INSTALLED_APPS",
      spokenAcknowledgement: evaluated.intent.spokenAcknowledgement,
      hindiVoiceResponse: evaluated.intent.hindiVoiceResponse
    };
  }

  if (evaluated.type === "OPEN_CAMERA") return { type: "OPEN_CAMERA", hindiVoiceResponse: "Camera open kar diya hai, Sir." };
  if (evaluated.type === "OPEN_SETTINGS") return { type: "OPEN_SETTINGS", hindiVoiceResponse: "Settings open kar raha hoon, Sir." };
  if (evaluated.type === "GET_DATETIME") return { type: "GET_DATETIME", spokenAcknowledgement: evaluated.intent.spokenAcknowledgement };
  if (evaluated.type === "GET_BATTERY") return { type: "GET_BATTERY", spokenAcknowledgement: evaluated.intent.spokenAcknowledgement };
  if (evaluated.type === "TOGGLE_EDITOR") return { type: "TOGGLE_EDITOR", details: { visible: evaluated.args?.visible } };

  // 6. Default to General AI conversation
  return {
    type: "GENERAL_AI",
    spokenAcknowledgement: "Sir, main aapki baat sun raha hoon.",
    hindiVoiceResponse: "Sir, main dhyan se sun raha hoon."
  };
}

/**
 * Shared Asynchronous Command Dispatcher (Single Source of Truth)
 * 
 * Invoked by:
 * - Voice Speech Recognition
 * - Clickable shortcuts
 * - Search bar text entry
 * - Gemini Live tool calls
 */
export async function dispatchArchCommand(
  request: ArchCommandRequest,
  context: ArchDispatcherContext
): Promise<ArchCommandResult> {
  const dedupKey = `${request.explicitType || ""}_${request.appName || ""}_${request.rawText.trim().toLowerCase()}`;
  const now = Date.now();

  const cached = recentDispatches.get(dedupKey);
  if (cached && now - cached.timestamp < DEDUP_WINDOW_MS) {
    console.log(`[ARCH Dispatcher] Deduplicated duplicate request: "${request.rawText}"`);
    return cached.promise;
  }

  const dispatchPromise: Promise<ArchCommandResult> = (async (): Promise<ArchCommandResult> => {
    try {
      // 1. Resolve Intent
      let parsed = normalizeCommandIntent(request.rawText, {
        activeProject: Boolean(context.activeProject)
      });

      // Override if caller gave explicit intent (e.g. clicking YouTube shortcut)
      if (request.explicitType) {
        parsed.type = request.explicitType;
        if (request.appName) parsed.appName = request.appName;
        if (request.targetQuery) parsed.targetQuery = request.targetQuery;
      }

      console.log(`[ARCH Dispatcher] Executing [${parsed.type}] via source [${request.source}]:`, parsed);

      // Stop speaking if new command arrived
      if (context.interruptSpeech) {
        context.interruptSpeech();
      }

      // ----------------------------------------------------
      // ROUTE 1: OPEN_APP (Real Android Package-Aware Launch)
      // ----------------------------------------------------
      if (parsed.type === "OPEN_APP") {
        const app = parsed.appName || request.appName || request.rawText.trim();
        const query = parsed.targetQuery || request.targetQuery;

        if (context.setActiveProtocol) {
          context.setActiveProtocol(`LAUNCHING ${app.toUpperCase()}`);
        }

        const res = await androidBridge.launchApp(app, query);

        const responseMsg = res.installed && res.success
          ? (app.toLowerCase().includes("youtube") && query
              ? `YouTube par "${query}" search kar raha hoon, Sir.`
              : `${app} open kar diya hai, Sir.`)
          : (!res.installed
              ? `Sir, application "${app}" is phone par installed nahi hai.`
              : (res.message || `${app} open kiya ja raha hai, Sir.`));

        if (context.setModelCaption) context.setModelCaption(responseMsg);
        androidBridge.speakNative(responseMsg, "hi-IN");

        if (context.setActiveProtocol) {
          context.setActiveProtocol(res.installed && res.success ? `${app.toUpperCase()} ACTIVE` : "LAUNCH NOTICE");
        }

        return {
          success: res.success,
          type: "OPEN_APP",
          appName: app,
          installed: res.installed,
          verified: res.verified,
          message: responseMsg
        };
      }

      // ----------------------------------------------------
      // ROUTE 2: APP_SEARCH (Search inside YouTube / Play Store)
      // ----------------------------------------------------
      if (parsed.type === "APP_SEARCH") {
        const app = parsed.appName || "YouTube";
        const query = parsed.targetQuery || "";

        if (context.setActiveProtocol) {
          context.setActiveProtocol(`${app.toUpperCase()} SEARCH`);
        }

        if (app.toLowerCase().includes("youtube")) {
          const res = await androidBridge.searchYouTube(query);
          const responseMsg = query
            ? `YouTube par "${query}" search kar raha hoon, Sir.`
            : "YouTube open kar diya hai, Sir.";

          if (context.setModelCaption) context.setModelCaption(responseMsg);
          androidBridge.speakNative(responseMsg, "hi-IN");

          return {
            success: res.success,
            type: "APP_SEARCH",
            appName: "YouTube",
            targetQuery: query,
            message: responseMsg
          };
        } else {
          // Play Store or other app search
          const res = await androidBridge.launchApp(app, query);
          const responseMsg = `Play Store par "${query}" search kar raha hoon, Sir.`;
          if (context.setModelCaption) context.setModelCaption(responseMsg);
          androidBridge.speakNative(responseMsg, "hi-IN");
          return {
            success: res.success,
            type: "APP_SEARCH",
            appName: app,
            targetQuery: query,
            message: responseMsg
          };
        }
      }

      // ----------------------------------------------------
      // ROUTE 3: WEB_SEARCH (Internet / Google Search)
      // ----------------------------------------------------
      if (parsed.type === "WEB_SEARCH") {
        const query = parsed.targetQuery || request.rawText;
        const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}`;

        if (context.setActiveProtocol) {
          context.setActiveProtocol("WEB SEARCH");
        }

        await androidBridge.openUrl(searchUrl);
        const responseMsg = `Web par "${query}" search kar raha hoon, Sir.`;
        if (context.setModelCaption) context.setModelCaption(responseMsg);
        androidBridge.speakNative(responseMsg, "hi-IN");

        return {
          success: true,
          type: "WEB_SEARCH",
          targetQuery: query,
          message: responseMsg
        };
      }

      // ----------------------------------------------------
      // ROUTE 4: CODE_GENERATION / WORKSPACE
      // ----------------------------------------------------
      if (parsed.type === "CODE_GENERATION") {
        if (context.setActiveProtocol) context.setActiveProtocol("CODING AGENT ACTIVE");

        if (parsed.details?.action === "execute") {
          if (context.setWorkspaceViewMode) context.setWorkspaceViewMode("terminal");
          if (context.setShowCodeWorkspace) context.setShowCodeWorkspace(true);
          return { success: true, type: "CODE_GENERATION", message: "Executing code sandbox." };
        }

        // Open Workspace
        if (context.setShowCodeWorkspace) context.setShowCodeWorkspace(true);
        if (context.setWorkspaceViewMode) context.setWorkspaceViewMode("code");

        const msg = parsed.hindiVoiceResponse || "Code workspace open kar raha hoon, Sir.";
        if (context.setModelCaption) context.setModelCaption(msg);
        androidBridge.speakNative(msg, "hi-IN");

        return {
          success: true,
          type: "CODE_GENERATION",
          message: msg,
          payload: parsed.details
        };
      }

      // ----------------------------------------------------
      // ROUTE 5: CODE_DEBUGGING
      // ----------------------------------------------------
      if (parsed.type === "CODE_DEBUGGING") {
        if (context.setActiveProtocol) context.setActiveProtocol("AUTO-DEBUG ACTIVE");
        if (context.setShowCodeWorkspace) context.setShowCodeWorkspace(true);
        if (context.setWorkspaceViewMode) context.setWorkspaceViewMode("terminal");

        const msg = "Auto-debugging cycle initiate kar raha hoon, Sir.";
        if (context.setModelCaption) context.setModelCaption(msg);
        androidBridge.speakNative(msg, "hi-IN");

        return { success: true, type: "CODE_DEBUGGING", message: msg };
      }

      // ----------------------------------------------------
      // ROUTE 6: PROJECT_ANALYSIS
      // ----------------------------------------------------
      if (parsed.type === "PROJECT_ANALYSIS") {
        if (context.setActiveProtocol) context.setActiveProtocol("TEST & ANALYSIS");
        if (context.setShowCodeWorkspace) context.setShowCodeWorkspace(true);
        if (context.setWorkspaceViewMode) context.setWorkspaceViewMode("test_suite");

        const msg = "Automated test suite execute kar raha hoon, Sir.";
        if (context.setModelCaption) context.setModelCaption(msg);
        androidBridge.speakNative(msg, "hi-IN");

        return { success: true, type: "PROJECT_ANALYSIS", message: msg };
      }

      // ----------------------------------------------------
      // ROUTE 7: HARDWARE / DEVICE ACTIONS
      // ----------------------------------------------------
      if (parsed.type === "OPEN_CAMERA") {
        if (context.setActiveProtocol) context.setActiveProtocol("CAMERA LAUNCH");
        const res = await androidBridge.openCamera();
        const msg = res.message || "Camera open kar diya hai, Sir.";
        if (context.setModelCaption) context.setModelCaption(msg);
        androidBridge.speakNative(msg, "hi-IN");
        return { success: res.success, type: "OPEN_CAMERA", message: msg };
      }

      if (parsed.type === "OPEN_MAPS") {
        if (context.setActiveProtocol) context.setActiveProtocol("MAPS LAUNCH");
        const res = await androidBridge.openMaps(parsed.targetQuery);
        const msg = res.message || "Google Maps open kar diya hai, Sir.";
        if (context.setModelCaption) context.setModelCaption(msg);
        androidBridge.speakNative(msg, "hi-IN");
        return { success: res.success, type: "OPEN_MAPS", message: msg, targetQuery: parsed.targetQuery };
      }

      if (parsed.type === "OPEN_SETTINGS") {
        if (context.setShowPermissionsModal) context.setShowPermissionsModal(true);
        if (context.setActiveProtocol) context.setActiveProtocol("SETTINGS");
        const msg = "ARCH device permissions and bridge settings open kar raha hoon, Sir.";
        if (context.setModelCaption) context.setModelCaption(msg);
        androidBridge.speakNative(msg, "hi-IN");
        return { success: true, type: "OPEN_SETTINGS", message: msg };
      }

      if (parsed.type === "VOLUME_CONTROL") {
        const dir = parsed.details?.volumeAction || "down";
        const res = await androidBridge.adjustVolume(dir);
        if (context.setActiveProtocol) context.setActiveProtocol("VOLUME ADJUSTED");
        if (context.setModelCaption) context.setModelCaption(res.message);
        androidBridge.speakNative(res.message, "hi-IN");
        return { success: res.success, type: "VOLUME_CONTROL", message: res.message };
      }

      if (parsed.type === "LIST_INSTALLED_APPS") {
        const res = await androidBridge.getInstalledApps();
        const topApps = res.apps.slice(0, 8).map(a => a.appName).join(", ");
        const resp = `Aapke phone mein ${res.total || res.apps.length} applications installed hain, Sir: ${topApps}`;
        if (context.setActiveProtocol) context.setActiveProtocol("APPS LISTED");
        if (context.setModelCaption) context.setModelCaption(resp);
        androidBridge.speakNative(resp, "hi-IN");
        return { success: true, type: "LIST_INSTALLED_APPS", message: resp, payload: res.apps };
      }

      if (parsed.type === "GET_BATTERY") {
        const res = await androidBridge.getBatteryStatus();
        if (context.setModelCaption) context.setModelCaption(res.message);
        androidBridge.speakNative(res.message, "hi-IN");
        return { success: true, type: "GET_BATTERY", message: res.message };
      }

      if (parsed.type === "GET_DATETIME") {
        const res = await androidBridge.getDeviceDateTime();
        if (context.setModelCaption) context.setModelCaption(res.message);
        androidBridge.speakNative(res.message, "hi-IN");
        return { success: true, type: "GET_DATETIME", message: res.message };
      }

      if (parsed.type === "TOGGLE_EDITOR") {
        const vis = parsed.details?.visible !== false;
        if (context.setShowCodeWorkspace) context.setShowCodeWorkspace(vis);
        return { success: true, type: "TOGGLE_EDITOR", message: vis ? "Workspace opened" : "Workspace closed" };
      }

      // ----------------------------------------------------
      // ROUTE 8: GENERAL_AI (Conversational Intelligence)
      // ----------------------------------------------------
      if (context.sendTextMessage && context.isVoiceConnected) {
        context.sendTextMessage(request.rawText);
        if (context.setActiveProtocol) context.setActiveProtocol("ARCH ANSWERING");
        return {
          success: true,
          type: "GENERAL_AI",
          message: "Forwarded to Gemini Live conversational core."
        };
      }

      const fallbackMsg = parsed.hindiVoiceResponse || "Sir, main aapke nirdesh ka palan kar raha hoon.";
      if (context.setModelCaption) context.setModelCaption(fallbackMsg);
      androidBridge.speakNative(fallbackMsg, "hi-IN");

      return {
        success: true,
        type: "GENERAL_AI",
        message: fallbackMsg
      };

    } catch (err: any) {
      console.error("[ARCH Dispatcher Error]:", err);
      const errMsg = `Error executing directive: ${err.message || err}`;
      if (context.setModelCaption) context.setModelCaption(errMsg);
      return {
        success: false,
        type: "UNKNOWN",
        message: errMsg
      };
    }
  })();

  recentDispatches.set(dedupKey, { timestamp: now, promise: dispatchPromise });
  setTimeout(() => recentDispatches.delete(dedupKey), DEDUP_WINDOW_MS + 200);

  return dispatchPromise;
}
