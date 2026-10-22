import React, { useState, useEffect } from "react";
import { 
  Play, 
  Search, 
  Smartphone, 
  MousePointer, 
  Terminal, 
  Clipboard, 
  ArrowLeft, 
  Home, 
  Menu, 
  Camera, 
  Lock, 
  ChevronUp, 
  ChevronDown, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw, 
  Layers,
  FileText,
  Sliders,
  Send
} from "lucide-react";
import { androidBridge, BridgeLogEntry, MultiStepAction } from "../lib/androidBridge";

export const AndroidAutomationConsole: React.FC = () => {
  const [activePackage, setActivePackage] = useState<string>("com.stark.jarvis");
  const [activeAppName, setActiveAppName] = useState<string>("ARCH Assistant");
  const [isServiceActive, setIsServiceActive] = useState<boolean>(false);
  const [isNative, setIsNative] = useState<boolean>(false);
  
  // Inputs
  const [launchQuery, setLaunchQuery] = useState<string>("");
  const [customPackage, setCustomPackage] = useState<string>("com.google.android.youtube");
  const [clickQuery, setClickQuery] = useState<string>("Search");
  const [tapX, setTapX] = useState<number>(500);
  const [tapY, setTapY] = useState<number>(1000);
  const [textToType, setTextToType] = useState<string>("ARCH device automation verified");
  const [targetField, setTargetField] = useState<string>("");
  const [clipboardVal, setClipboardVal] = useState<string>("");

  // Inspection & Flow
  const [visibleElements, setVisibleElements] = useState<any[]>([]);
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [flowRunning, setFlowRunning] = useState<boolean>(false);
  const [flowResults, setFlowResults] = useState<any[]>([]);
  const [logs, setLogs] = useState<BridgeLogEntry[]>([]);

  useEffect(() => {
    refreshStatus();
    setLogs(androidBridge.getLogs().slice(0, 30));

    const unsubscribe = androidBridge.subscribeLogs((entry) => {
      setLogs((prev) => [entry, ...prev.slice(0, 35)]);
    });

    return () => unsubscribe();
  }, []);

  const refreshStatus = async () => {
    const isNat = androidBridge.isNative();
    setIsNative(isNat);
    setIsServiceActive(androidBridge.isAccessibilityActive());
    const fg = await androidBridge.getActiveForegroundApp();
    if (fg && fg.success) {
      setActivePackage(fg.packageName);
      setActiveAppName(fg.appName);
    }
  };

  const handleLaunch = async (pkg: string, query?: string) => {
    await androidBridge.launchApp(pkg, query);
    setTimeout(refreshStatus, 600);
  };

  const handleClickElement = async () => {
    if (!clickQuery.trim()) return;
    await androidBridge.interactWithUIElement("click_element", { query: clickQuery.trim() });
    setTimeout(refreshStatus, 400);
  };

  const handleTapCoordinates = async () => {
    await androidBridge.controlDevice("tap", { x: Number(tapX), y: Number(tapY) });
  };

  const handleTypeText = async () => {
    if (!textToType) return;
    await androidBridge.interactWithUIElement("type_text", {
      text: textToType,
      target: targetField.trim()
    });
  };

  const handleClipboard = async (action: "copy" | "cut" | "paste" | "select_all" | "get" | "set") => {
    if (action === "get") {
      const res = await androidBridge.textAction("get_clipboard", {});
      if (res.success && res.clipboardText !== undefined) {
        setClipboardVal(res.clipboardText);
      }
    } else if (action === "set") {
      await androidBridge.textAction("set_clipboard", { text: textToType });
    } else {
      await androidBridge.textAction(action, { query: targetField.trim(), text: textToType });
    }
  };

  const handleGlobal = async (action: string) => {
    await androidBridge.controlDevice(action, {});
    setTimeout(refreshStatus, 400);
  };

  const handleScanUI = async () => {
    setIsScanning(true);
    const elements = await androidBridge.getVisibleUIElements();
    setVisibleElements(elements);
    setIsScanning(false);
  };

  const handleRunMultiStepFlow = async () => {
    setFlowRunning(true);
    setFlowResults([]);

    const steps: MultiStepAction[] = [
      { action: "wait", durationMs: 400 },
      { action: "click", query: clickQuery || "Search" },
      { action: "wait", durationMs: 300 },
      { action: "type", text: textToType || "ARCH Automation Test", target: "" },
      { action: "tap", x: 950, y: 1800 }
    ];

    const result = await androidBridge.executeMultiStepFlow(steps);
    if (result && result.reports) {
      setFlowResults(result.reports);
    }
    setFlowRunning(false);
    setTimeout(refreshStatus, 500);
  };

  return (
    <div className="space-y-4 text-xs">
      {/* Top Banner: Real-time Host & Accessibility Status */}
      <div className="p-3.5 bg-slate-900/90 border border-cyan-500/30 rounded-xl flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <Smartphone className="w-5 h-5 text-cyan-400 shrink-0" />
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-white uppercase tracking-wider text-[11px]">
                Target: Android 9 (API 28) Device Automation
              </span>
              <span
                className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                  isNative
                    ? "bg-emerald-950/80 border border-emerald-500/50 text-emerald-400"
                    : "bg-cyan-950/80 border border-cyan-500/40 text-cyan-300"
                }`}
              >
                {isNative ? "Native APK Bridge" : "Simulated Bridge"}
              </span>
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">
              Active App: <strong className="text-cyan-300">{activeAppName}</strong> ({activePackage})
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div
            className={`px-2.5 py-1 rounded-lg border flex items-center gap-1.5 text-[10px] uppercase font-bold tracking-wider ${
              isServiceActive
                ? "bg-emerald-950/60 border-emerald-500/40 text-emerald-400"
                : "bg-amber-950/60 border-amber-500/40 text-amber-400"
            }`}
          >
            {isServiceActive ? <CheckCircle2 size={12} /> : <AlertCircle size={12} />}
            <span>Accessibility: {isServiceActive ? "ACTIVE" : "DISABLED"}</span>
          </div>

          {!isServiceActive && (
            <button
              onClick={() => androidBridge.openAccessibilitySettings()}
              className="px-2.5 py-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 rounded-lg text-[10px] font-bold uppercase transition cursor-pointer"
            >
              Open Settings
            </button>
          )}

          <button
            onClick={refreshStatus}
            className="p-1.5 bg-white/5 hover:bg-cyan-500/20 text-slate-300 hover:text-cyan-300 border border-white/10 rounded-lg transition cursor-pointer"
            title="Refresh device status"
          >
            <RefreshCw size={13} />
          </button>
        </div>
      </div>

      {/* Grid of Automation Controls */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        
        {/* Module 1: Launch Apps & Execute Searches */}
        <div className="p-3.5 bg-white/5 border border-white/10 rounded-xl space-y-3">
          <div className="flex items-center justify-between text-cyan-400 font-bold uppercase tracking-wider text-[11px]">
            <span className="flex items-center gap-1.5">
              <Play size={13} />
              <span>1. Launch App & Search</span>
            </span>
          </div>

          <div className="space-y-2">
            <div className="flex gap-2">
              <input
                type="text"
                value={customPackage}
                onChange={(e) => setCustomPackage(e.target.value)}
                placeholder="Package name or app name..."
                className="flex-1 bg-black/40 border border-white/10 rounded-lg px-2.5 py-1.5 text-[11px] text-white focus:border-cyan-400 focus:outline-none"
              />
              <button
                onClick={() => handleLaunch(customPackage, launchQuery)}
                className="px-3 py-1.5 bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 rounded-lg font-bold text-[10px] uppercase transition cursor-pointer"
              >
                Launch
              </button>
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                value={launchQuery}
                onChange={(e) => setLaunchQuery(e.target.value)}
                placeholder="Optional query (e.g. search term)..."
                className="flex-1 bg-black/40 border border-white/10 rounded-lg px-2.5 py-1.5 text-[11px] text-white focus:border-cyan-400 focus:outline-none"
              />
              <button
                onClick={() => androidBridge.searchYouTube(launchQuery || "quantum computing")}
                className="px-3 py-1.5 bg-red-950/40 hover:bg-red-900/40 text-red-300 border border-red-500/30 rounded-lg font-bold text-[10px] uppercase transition cursor-pointer flex items-center gap-1"
              >
                <Search size={11} />
                <span>YouTube</span>
              </button>
            </div>

            {/* Quick App Presets */}
            <div className="flex flex-wrap gap-1.5 pt-1">
              {[
                { name: "YouTube", pkg: "com.google.android.youtube" },
                { name: "WhatsApp", pkg: "com.whatsapp" },
                { name: "Chrome", pkg: "com.android.chrome" },
                { name: "Settings", pkg: "com.android.settings" },
                { name: "Camera", pkg: "android.hardware.camera2" },
                { name: "Pydroid 3", pkg: "ru.iiec.pydroid3" }
              ].map((p) => (
                <button
                  key={p.pkg}
                  onClick={() => {
                    setCustomPackage(p.pkg);
                    handleLaunch(p.pkg);
                  }}
                  className="px-2 py-0.5 bg-white/5 hover:bg-cyan-500/20 text-slate-300 hover:text-cyan-300 border border-white/10 rounded text-[10px] font-mono transition cursor-pointer"
                >
                  {p.name}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Module 2: UI Element Clicking & Screen Tapping */}
        <div className="p-3.5 bg-white/5 border border-white/10 rounded-xl space-y-3">
          <div className="flex items-center justify-between text-cyan-400 font-bold uppercase tracking-wider text-[11px]">
            <span className="flex items-center gap-1.5">
              <MousePointer size={13} />
              <span>2. Click Element / Screen Tap</span>
            </span>
          </div>

          <div className="space-y-2">
            <div className="flex gap-2">
              <input
                type="text"
                value={clickQuery}
                onChange={(e) => setClickQuery(e.target.value)}
                placeholder="Button text, ID, or description (e.g. 'Search', 'Send')..."
                className="flex-1 bg-black/40 border border-white/10 rounded-lg px-2.5 py-1.5 text-[11px] text-white focus:border-cyan-400 focus:outline-none"
              />
              <button
                onClick={handleClickElement}
                className="px-3 py-1.5 bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 rounded-lg font-bold text-[10px] uppercase transition cursor-pointer"
              >
                Click
              </button>
            </div>

            {/* Coordinates Tap */}
            <div className="flex items-center gap-2 pt-1">
              <span className="text-slate-400 text-[10px]">Tap Coordinates:</span>
              <input
                type="number"
                value={tapX}
                onChange={(e) => setTapX(Number(e.target.value))}
                className="w-16 bg-black/40 border border-white/10 rounded px-2 py-1 text-[10px] text-white text-center"
                placeholder="X"
              />
              <input
                type="number"
                value={tapY}
                onChange={(e) => setTapY(Number(e.target.value))}
                className="w-16 bg-black/40 border border-white/10 rounded px-2 py-1 text-[10px] text-white text-center"
                placeholder="Y"
              />
              <button
                onClick={handleTapCoordinates}
                className="px-2.5 py-1 bg-white/10 hover:bg-cyan-500/20 text-slate-200 hover:text-cyan-300 border border-white/10 rounded text-[10px] font-bold uppercase transition cursor-pointer"
              >
                Dispatch Tap
              </button>
            </div>
          </div>
        </div>

        {/* Module 3: Type Text & Clipboard Operations */}
        <div className="p-3.5 bg-white/5 border border-white/10 rounded-xl space-y-3">
          <div className="flex items-center justify-between text-cyan-400 font-bold uppercase tracking-wider text-[11px]">
            <span className="flex items-center gap-1.5">
              <Terminal size={13} />
              <span>3. Type Text & Clipboard</span>
            </span>
          </div>

          <div className="space-y-2">
            <input
              type="text"
              value={textToType}
              onChange={(e) => setTextToType(e.target.value)}
              placeholder="Text or code to type..."
              className="w-full bg-black/40 border border-white/10 rounded-lg px-2.5 py-1.5 text-[11px] text-white focus:border-cyan-400 focus:outline-none"
            />

            <div className="flex gap-2">
              <input
                type="text"
                value={targetField}
                onChange={(e) => setTargetField(e.target.value)}
                placeholder="Target input label/ID (or empty for focused field)"
                className="flex-1 bg-black/40 border border-white/10 rounded px-2 py-1 text-[10px] text-slate-300 focus:border-cyan-400 focus:outline-none"
              />
              <button
                onClick={handleTypeText}
                className="px-2.5 py-1 bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 rounded text-[10px] font-bold uppercase transition cursor-pointer flex items-center gap-1"
              >
                <Send size={10} />
                <span>Type Text</span>
              </button>
            </div>

            {/* Clipboard Bar */}
            <div className="flex flex-wrap gap-1.5 pt-1">
              <button
                onClick={() => handleClipboard("select_all")}
                className="px-2 py-0.5 bg-white/5 hover:bg-white/10 text-slate-300 rounded text-[10px] border border-white/10"
              >
                Select All
              </button>
              <button
                onClick={() => handleClipboard("copy")}
                className="px-2 py-0.5 bg-white/5 hover:bg-white/10 text-slate-300 rounded text-[10px] border border-white/10"
              >
                Copy
              </button>
              <button
                onClick={() => handleClipboard("cut")}
                className="px-2 py-0.5 bg-white/5 hover:bg-white/10 text-slate-300 rounded text-[10px] border border-white/10"
              >
                Cut
              </button>
              <button
                onClick={() => handleClipboard("paste")}
                className="px-2 py-0.5 bg-white/5 hover:bg-white/10 text-slate-300 rounded text-[10px] border border-white/10"
              >
                Paste
              </button>
              <button
                onClick={() => handleClipboard("get")}
                className="px-2 py-0.5 bg-white/5 hover:bg-white/10 text-slate-300 rounded text-[10px] border border-white/10"
              >
                Read Clip
              </button>
            </div>
            {clipboardVal && (
              <div className="text-[10px] text-cyan-400 font-mono truncate">
                Clipboard: &quot;{clipboardVal}&quot;
              </div>
            )}
          </div>
        </div>

        {/* Module 4: System Navigation & Android 9 API 28 Gestures */}
        <div className="p-3.5 bg-white/5 border border-white/10 rounded-xl space-y-3">
          <div className="flex items-center justify-between text-cyan-400 font-bold uppercase tracking-wider text-[11px]">
            <span className="flex items-center gap-1.5">
              <Sliders size={13} />
              <span>4. System Navigation & API 28 Actions</span>
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={() => handleGlobal("back")}
              className="px-2 py-1.5 bg-white/5 hover:bg-cyan-500/20 text-slate-200 hover:text-cyan-300 border border-white/10 rounded flex items-center justify-center gap-1 text-[10px] font-bold uppercase transition cursor-pointer"
            >
              <ArrowLeft size={12} />
              <span>Back</span>
            </button>
            <button
              onClick={() => handleGlobal("home")}
              className="px-2 py-1.5 bg-white/5 hover:bg-cyan-500/20 text-slate-200 hover:text-cyan-300 border border-white/10 rounded flex items-center justify-center gap-1 text-[10px] font-bold uppercase transition cursor-pointer"
            >
              <Home size={12} />
              <span>Home</span>
            </button>
            <button
              onClick={() => handleGlobal("recents")}
              className="px-2 py-1.5 bg-white/5 hover:bg-cyan-500/20 text-slate-200 hover:text-cyan-300 border border-white/10 rounded flex items-center justify-center gap-1 text-[10px] font-bold uppercase transition cursor-pointer"
            >
              <Menu size={12} />
              <span>Recents</span>
            </button>
            <button
              onClick={() => handleGlobal("scroll_up")}
              className="px-2 py-1.5 bg-white/5 hover:bg-cyan-500/20 text-slate-200 hover:text-cyan-300 border border-white/10 rounded flex items-center justify-center gap-1 text-[10px] font-bold uppercase transition cursor-pointer"
            >
              <ChevronUp size={12} />
              <span>Scroll Up</span>
            </button>
            <button
              onClick={() => handleGlobal("scroll_down")}
              className="px-2 py-1.5 bg-white/5 hover:bg-cyan-500/20 text-slate-200 hover:text-cyan-300 border border-white/10 rounded flex items-center justify-center gap-1 text-[10px] font-bold uppercase transition cursor-pointer"
            >
              <ChevronDown size={12} />
              <span>Scroll Down</span>
            </button>
            <button
              onClick={() => handleGlobal("screenshot")}
              className="px-2 py-1.5 bg-cyan-950/40 hover:bg-cyan-900/50 text-cyan-300 border border-cyan-500/40 rounded flex items-center justify-center gap-1 text-[10px] font-bold uppercase transition cursor-pointer"
              title="Android 9 (API 28) GLOBAL_ACTION_TAKE_SCREENSHOT"
            >
              <Camera size={12} />
              <span>Screenshot</span>
            </button>
          </div>

          <div className="flex items-center justify-between pt-1 text-[10px] text-slate-400 border-t border-white/5">
            <span>Android 9 API 28 Direct Screenshot & Screen Lock supported</span>
            <button
              onClick={() => handleGlobal("lock")}
              className="px-2 py-0.5 bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10 rounded flex items-center gap-1 text-[9px] uppercase"
            >
              <Lock size={10} />
              <span>Lock Screen</span>
            </button>
          </div>
        </div>

      </div>

      {/* Module 5: Multi-Step Cross-App Sequence Execution */}
      <div className="p-3.5 bg-slate-900/60 border border-cyan-500/30 rounded-xl space-y-3">
        <div className="flex items-center justify-between">
          <div className="font-bold text-cyan-300 uppercase tracking-wider text-[11px] flex items-center gap-2">
            <Layers size={14} />
            <span>Multi-Step Cross-App Workflow Runner (Verified Execution)</span>
          </div>
          <button
            onClick={handleRunMultiStepFlow}
            disabled={flowRunning}
            className="px-3 py-1 bg-cyan-500 hover:bg-cyan-400 text-black rounded-lg font-bold text-[10px] uppercase tracking-wider transition cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
          >
            {flowRunning ? <RefreshCw size={12} className="animate-spin" /> : <Play size={12} />}
            <span>{flowRunning ? "Executing..." : "Run Test Sequence"}</span>
          </button>
        </div>

        <div className="text-[10px] text-slate-400">
          Runs sequential operations (Click &quot;{clickQuery || 'Search'}&quot; → Wait 300ms → Type text → Tap Submit) and validates each step outcome before advancing.
        </div>

        {flowResults.length > 0 && (
          <div className="space-y-1.5 bg-black/40 p-2.5 rounded-lg border border-white/5">
            {flowResults.map((r, idx) => (
              <div key={idx} className="flex items-center justify-between text-[10px]">
                <span className="flex items-center gap-2">
                  {r.success ? (
                    <CheckCircle2 size={12} className="text-emerald-400" />
                  ) : (
                    <AlertCircle size={12} className="text-rose-400" />
                  )}
                  <span className="font-mono text-slate-200">Step {r.stepIndex}: {r.action}</span>
                </span>
                <span className={r.success ? "text-emerald-400" : "text-rose-400"}>
                  {r.message}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Module 6: Screen UI Node Inspector */}
      <div className="p-3.5 bg-white/5 border border-white/10 rounded-xl space-y-3">
        <div className="flex items-center justify-between">
          <div className="font-bold text-cyan-300 uppercase tracking-wider text-[11px] flex items-center gap-2">
            <FileText size={14} />
            <span>Accessible Screen UI Nodes ({visibleElements.length} detected)</span>
          </div>
          <button
            onClick={handleScanUI}
            disabled={isScanning}
            className="px-2.5 py-1 bg-white/10 hover:bg-cyan-500/20 text-slate-200 hover:text-cyan-300 border border-white/10 rounded text-[10px] font-bold uppercase transition cursor-pointer flex items-center gap-1"
          >
            {isScanning ? <RefreshCw size={11} className="animate-spin" /> : <Search size={11} />}
            <span>Scan Screen Nodes</span>
          </button>
        </div>

        {visibleElements.length > 0 ? (
          <div className="max-h-36 overflow-y-auto space-y-1.5 pr-1">
            {visibleElements.map((el, i) => (
              <div
                key={i}
                onClick={() => {
                  if (el.text) setClickQuery(el.text);
                  else if (el.id) setClickQuery(el.id);
                }}
                className="p-2 bg-black/40 hover:bg-cyan-950/40 border border-white/5 hover:border-cyan-500/30 rounded flex items-center justify-between cursor-pointer transition"
              >
                <div>
                  <span className="font-bold text-white block">
                    {el.text || el.desc || "<Unnamed interactive element>"}
                  </span>
                  <span className="text-[9px] text-slate-400 font-mono">
                    ID: {el.id || "none"} • {el.className?.split(".").pop()}
                  </span>
                </div>
                <div className="flex items-center gap-1 text-[9px] text-cyan-400 font-mono">
                  {el.clickable && <span className="px-1 bg-cyan-950 rounded">CLICKABLE</span>}
                  {el.editable && <span className="px-1 bg-emerald-950 text-emerald-400 rounded">INPUT</span>}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-[10px] text-slate-500 italic py-1">
            Click &quot;Scan Screen Nodes&quot; to inspect interactive buttons, text fields, and views on the active device screen.
          </div>
        )}
      </div>

      {/* Live Event & Audit Log */}
      <div className="p-3 bg-black/60 border border-white/10 rounded-xl space-y-2">
        <div className="text-[10px] font-bold text-cyan-400 uppercase tracking-wider flex items-center justify-between">
          <span>Native Bridge Event Audit Log</span>
          <span className="text-slate-500 text-[9px]">{logs.length} events logged</span>
        </div>
        <div className="max-h-28 overflow-y-auto space-y-1 pr-1 font-mono text-[9.5px]">
          {logs.map((log) => (
            <div key={log.id} className="flex items-start gap-2 border-b border-white/5 pb-1">
              <span className="text-slate-500 shrink-0">{log.timestamp}</span>
              <span
                className={`px-1 py-0.2 rounded uppercase font-bold shrink-0 text-[8.5px] ${
                  log.type === "intent"
                    ? "bg-cyan-950 text-cyan-400 border border-cyan-500/30"
                    : log.type === "accessibility"
                    ? "bg-purple-950 text-purple-300 border border-purple-500/30"
                    : log.type === "error"
                    ? "bg-rose-950 text-rose-300 border border-rose-500/30"
                    : "bg-slate-800 text-slate-300"
                }`}
              >
                {log.type}
              </span>
              <span className="text-slate-200 shrink-0 font-bold">{log.title}:</span>
              <span className="text-slate-400 truncate">{log.details}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
