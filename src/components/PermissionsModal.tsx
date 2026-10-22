import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  X, 
  ShieldCheck, 
  Smartphone, 
  Code, 
  Copy, 
  Check, 
  Mic, 
  Monitor, 
  FolderLock, 
  Bell, 
  Cpu,
  Download,
  Terminal,
  Layers,
  FileCode,
  FileText
} from "lucide-react";
import { androidBridge, AndroidPermissionsStatus } from "../lib/androidBridge";
import { ANDROID_APK_CODE_FILES, AndroidFileSource } from "../data/androidNativeCode";
import { AndroidAutomationConsole } from "./AndroidAutomationConsole";

interface PermissionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: "permissions" | "automation_tester" | "installed_apps" | "apk_code";
}

export const PermissionsModal: React.FC<PermissionsModalProps> = ({ 
  isOpen, 
  onClose,
  initialTab = "automation_tester"
}) => {
  const [status, setStatus] = useState<AndroidPermissionsStatus>({
    accessibilityService: false,
    mediaProjection: false,
    recordAudio: true,
    storageAccess: true,
    postNotifications: true,
    isNativeBridge: false
  });
  const [activeTab, setActiveTab] = useState<"permissions" | "automation_tester" | "installed_apps" | "apk_code">(initialTab);
  const [selectedFileIndex, setSelectedFileIndex] = useState<number>(0);
  const [copiedFile, setCopiedFile] = useState<boolean>(false);
  const [installedPkgs, setInstalledPkgs] = useState<string[]>([]);

  useEffect(() => {
    if (isOpen) {
      androidBridge.checkPermissions().then(setStatus);
      setInstalledPkgs(androidBridge.getSimulatedInstalledPackages());
      if (initialTab) {
        setActiveTab(initialTab);
      }
    }
  }, [isOpen, initialTab]);

  if (!isOpen) return null;

  const togglePackageInstalled = (pkg: string) => {
    const isCurrentlyInstalled = installedPkgs.includes(pkg);
    androidBridge.setSimulatedAppInstalled(pkg, !isCurrentlyInstalled);
    setInstalledPkgs(androidBridge.getSimulatedInstalledPackages());
  };

  const copyCurrentCode = () => {
    const current = ANDROID_APK_CODE_FILES[selectedFileIndex];
    if (current) {
      navigator.clipboard.writeText(current.content);
      setCopiedFile(true);
      setTimeout(() => setCopiedFile(false), 2000);
    }
  };

  const downloadCurrentFile = () => {
    const current = ANDROID_APK_CODE_FILES[selectedFileIndex];
    if (!current) return;
    const blob = new Blob([current.content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = current.filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const downloadAllFilesBundle = () => {
    let bundle = `# ====================================================================\n`;
    bundle += `# ARCH ASSISTANT - ANDROID 9 (API 28) FULL NATIVE SOURCE CODE BUNDLE\n`;
    bundle += `# Generated for HTML to APK Builder & Android Studio\n`;
    bundle += `# ====================================================================\n\n`;

    ANDROID_APK_CODE_FILES.forEach((file) => {
      bundle += `\n# --------------------------------------------------------------------\n`;
      bundle += `FILE: ${file.path} (${file.filename})\n`;
      bundle += `DESCRIPTION: ${file.description}\n`;
      bundle += `# --------------------------------------------------------------------\n\n`;
      bundle += file.content;
      bundle += `\n\n`;
    });

    const blob = new Blob([bundle], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "arch_android9_automation_bundle.txt";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleRequest = async (type: string) => {
    await androidBridge.requestPermission(type);
    const updated = await androidBridge.checkPermissions();
    setStatus(updated);
  };

  const permissionsList = [
    {
      id: "accessibility",
      name: "Accessibility Service (Android 9 API 28)",
      description: "Required for device automation: opening apps, scrolling, clicking UI elements, typing text, and gestures.",
      granted: status.accessibilityService,
      icon: <Smartphone size={18} className="text-cyan-400" />,
      actionText: "Enable in Settings",
      guide: "Android Settings > Accessibility > Installed Services > ARCH Device Control > Turn ON"
    },
    {
      id: "media_projection",
      name: "Screen Capture (MediaProjection)",
      description: "Required for real-time visual inspection of your screen stream via Gemini Live vision.",
      granted: status.mediaProjection,
      icon: <Monitor size={18} className="text-purple-400" />,
      actionText: "Request Capture",
      guide: "System prompt will ask 'Start recording or casting with ARCH?' -> Tap 'Start now'."
    },
    {
      id: "record_audio",
      name: "Microphone Stream",
      description: "Required for bidirectional low-latency voice-to-voice communication.",
      granted: status.recordAudio,
      icon: <Mic size={18} className="text-emerald-400" />,
      actionText: "Check Audio",
      guide: "Standard RECORD_AUDIO runtime permission."
    },
    {
      id: "storage",
      name: "File Creation & Editor Bridge",
      description: "Required to save generated projects and transfer files to Pydroid 3 and HopeWeb.",
      granted: status.storageAccess,
      icon: <FolderLock size={18} className="text-amber-400" />,
      actionText: "Storage Access",
      guide: "Allows saving scripts into /storage/emulated/0/Documents/ArchProjects"
    },
    {
      id: "notifications",
      name: "Foreground Service & Notifications",
      description: "Required for persistent background audio/screen streaming without Android killing the process.",
      granted: status.postNotifications,
      icon: <Bell size={18} className="text-sky-400" />,
      actionText: "Check Notifications",
      guide: "Shows active 'ARCH Core Active' persistent status notification."
    }
  ];

  const currentFile = ANDROID_APK_CODE_FILES[selectedFileIndex] || ANDROID_APK_CODE_FILES[0];

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md font-mono select-none">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="w-full max-w-4xl max-h-[90vh] flex flex-col bg-slate-950 border border-cyan-500/30 rounded-2xl shadow-[0_0_60px_rgba(6,182,212,0.2)] text-slate-200 overflow-hidden"
        >
          {/* Modal Header */}
          <div className="flex items-center justify-between px-5 py-3.5 bg-slate-900/90 border-b border-cyan-500/20 text-xs">
            <div className="flex items-center gap-2 text-cyan-400 font-bold tracking-wider uppercase">
              <ShieldCheck size={18} />
              <span>ARCH ANDROID 9 (API 28) AUTOMATION & NATIVE BRIDGE</span>
            </div>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white p-1 rounded hover:bg-white/5 transition cursor-pointer"
            >
              <X size={16} />
            </button>
          </div>

          {/* Navigation Tabs */}
          <div className="flex items-center gap-2 px-5 pt-3 pb-2 border-b border-white/5 text-xs bg-slate-950/60 overflow-x-auto">
            <button
              onClick={() => setActiveTab("automation_tester")}
              className={`px-3 py-1.5 rounded-lg transition uppercase tracking-wider text-[11px] font-bold flex items-center gap-1.5 cursor-pointer ${
                activeTab === "automation_tester"
                  ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-[0_0_12px_rgba(0,240,255,0.2)]"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <Terminal size={13} />
              <span>Device Automation Console</span>
            </button>
            <button
              onClick={() => setActiveTab("permissions")}
              className={`px-3 py-1.5 rounded-lg transition uppercase tracking-wider text-[11px] font-bold cursor-pointer ${
                activeTab === "permissions"
                  ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              Android Permissions
            </button>
            <button
              onClick={() => setActiveTab("installed_apps")}
              className={`px-3 py-1.5 rounded-lg transition uppercase tracking-wider text-[11px] font-bold flex items-center gap-1.5 cursor-pointer ${
                activeTab === "installed_apps"
                  ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <Smartphone size={13} />
              <span>Installed Apps</span>
            </button>
            <button
              onClick={() => setActiveTab("apk_code")}
              className={`px-3 py-1.5 rounded-lg transition uppercase tracking-wider text-[11px] font-bold flex items-center gap-1.5 cursor-pointer ${
                activeTab === "apk_code"
                  ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <Code size={13} />
              <span>Native APK Source Code</span>
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 text-xs">
            {/* Tab 1: Interactive Device Automation Console */}
            {activeTab === "automation_tester" && (
              <AndroidAutomationConsole />
            )}

            {/* Tab 2: Android Permissions */}
            {activeTab === "permissions" && (
              <>
                <div className="p-3 bg-cyan-950/20 border border-cyan-500/20 rounded-xl text-cyan-300 text-[11px] leading-relaxed">
                  <div className="font-bold uppercase tracking-wider mb-1 flex items-center gap-2">
                    <Cpu size={14} />
                    <span>Host Environment: {status.isNativeBridge ? "Android Native Bridge Connected" : "WebView / Browser Simulation Mode"}</span>
                  </div>
                  <span>
                    When compiled as an Android APK, ARCH communicates through the native Java bridge (`AndroidBridge.java`) to verify installed packages, launch apps via Intents, stream screen vision via MediaProjection, and navigate device UI using Android 9&apos;s official Accessibility APIs.
                  </span>
                </div>

                <div className="space-y-3">
                  {permissionsList.map((perm) => (
                    <div
                      key={perm.id}
                      className="p-3.5 rounded-xl bg-white/5 border border-white/5 hover:border-cyan-500/20 transition space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          {perm.icon}
                          <div>
                            <span className="font-bold text-slate-100 block text-xs">{perm.name}</span>
                            <span className="text-[10px] text-slate-400">{perm.description}</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider ${
                              perm.granted 
                                ? "bg-emerald-950/60 border border-emerald-500/40 text-emerald-400"
                                : "bg-amber-950/60 border border-amber-500/40 text-amber-400"
                            }`}
                          >
                            {perm.granted ? "AUTHORIZED" : "ACTION REQUIRED"}
                          </span>
                          <button
                            onClick={() => handleRequest(perm.id)}
                            className="px-2.5 py-1 bg-white/10 hover:bg-cyan-500/20 text-slate-200 hover:text-cyan-300 border border-white/10 rounded-lg text-[10px] uppercase tracking-wider font-bold transition cursor-pointer"
                          >
                            {perm.actionText}
                          </button>
                        </div>
                      </div>

                      <div className="text-[10px] text-slate-500 font-sans border-t border-white/5 pt-1.5">
                        <span className="text-cyan-400 font-mono font-bold">CONFIG: </span>
                        {perm.guide}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* Tab 3: Installed Apps Verification */}
            {activeTab === "installed_apps" && (
              <div className="space-y-4">
                <div className="p-3 bg-cyan-950/20 border border-cyan-500/30 rounded-xl text-cyan-300 text-[11px] leading-relaxed">
                  <div className="font-bold uppercase tracking-wider mb-1">
                    Device Package Verification Engine
                  </div>
                  <span>
                    ARCH will <strong>ONLY</strong> launch applications that genuinely exist on the device. Toggle any app below to test this: if an app is toggled OFF and you say &quot;ARCH, open YouTube&quot;, ARCH will verify the device package and inform you that YouTube is not installed instead of pretending it opened!
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {[
                    { name: "YouTube", pkg: "com.google.android.youtube", desc: "Google YouTube official app" },
                    { name: "Google Play Store", pkg: "com.android.vending", desc: "Google Play Store app market" },
                    { name: "WhatsApp", pkg: "com.whatsapp", desc: "WhatsApp Messenger" },
                    { name: "Google Maps", pkg: "com.google.android.apps.maps", desc: "Maps and navigation" },
                    { name: "Chrome", pkg: "com.android.chrome", desc: "Google Chrome Browser" },
                    { name: "Camera", pkg: "android.hardware.camera2", desc: "Device Camera" },
                    { name: "Settings", pkg: "com.android.settings", desc: "Android System Settings" },
                    { name: "Gmail", pkg: "com.google.android.gm", desc: "Google Email" },
                    { name: "Files", pkg: "com.google.android.documentsui", desc: "System File Manager" },
                    { name: "Pydroid 3", pkg: "ru.iiec.pydroid3", desc: "Python 3 IDE" },
                    { name: "HopeWeb", pkg: "com.hopeweb.editor", desc: "HTML/JS Web Editor" }
                  ].map((app) => {
                    const isInstalled = installedPkgs.includes(app.pkg);
                    return (
                      <div
                        key={app.pkg}
                        className={`p-3 rounded-xl border transition-all flex items-center justify-between ${
                          isInstalled 
                            ? "bg-cyan-950/30 border-cyan-500/40 text-white" 
                            : "bg-black/40 border-white/10 text-slate-400 opacity-70"
                        }`}
                      >
                        <div>
                          <div className="font-bold text-xs flex items-center gap-1.5">
                            <span className={isInstalled ? "text-cyan-300" : "text-slate-400"}>{app.name}</span>
                            <span className={`text-[9px] px-1.5 py-0.2 rounded font-mono ${
                              isInstalled ? "bg-cyan-500/20 text-cyan-300" : "bg-red-950/40 text-red-400"
                            }`}>
                              {isInstalled ? "INSTALLED" : "NOT INSTALLED"}
                            </span>
                          </div>
                          <div className="text-[10px] text-slate-500 font-mono">{app.pkg}</div>
                        </div>

                        <button
                          onClick={() => togglePackageInstalled(app.pkg)}
                          className={`px-2.5 py-1 rounded text-[10px] font-bold font-mono tracking-wider transition cursor-pointer ${
                            isInstalled
                              ? "bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/40"
                              : "bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40"
                          }`}
                        >
                          {isInstalled ? "UNINSTALL" : "INSTALL"}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Tab 4: Native APK Source Code */}
            {activeTab === "apk_code" && (
              <div className="space-y-4">
                <div className="p-3 bg-cyan-950/20 border border-cyan-500/20 rounded-xl text-cyan-300 text-[11px] leading-relaxed flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="font-bold uppercase tracking-wider mb-0.5">
                      Android 9 (API 28) Native Code for HTML to APK Builder
                    </div>
                    <span>
                      Copy or download these native files directly into your Android project. They include the full Accessibility Service, custom JavaScript Interface, and permissions for device automation.
                    </span>
                  </div>
                  <button
                    onClick={downloadAllFilesBundle}
                    className="px-3 py-1.5 bg-cyan-500 hover:bg-cyan-400 text-black font-bold uppercase rounded-lg text-[10px] tracking-wider transition cursor-pointer flex items-center gap-1.5 shrink-0"
                  >
                    <Download size={13} />
                    <span>Download All Files (.txt bundle)</span>
                  </button>
                </div>

                {/* File Switcher Tabs */}
                <div className="flex flex-wrap gap-1.5 border-b border-white/10 pb-2">
                  {ANDROID_APK_CODE_FILES.map((file, idx) => (
                    <button
                      key={file.filename}
                      onClick={() => setSelectedFileIndex(idx)}
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-mono transition cursor-pointer flex items-center gap-1.5 ${
                        selectedFileIndex === idx
                          ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/50 shadow-[0_0_10px_rgba(0,240,255,0.2)] font-bold"
                          : "bg-black/30 hover:bg-white/5 text-slate-400 border border-white/5"
                      }`}
                    >
                      <FileCode size={12} className={selectedFileIndex === idx ? "text-cyan-400" : "text-slate-500"} />
                      <span>{file.filename}</span>
                    </button>
                  ))}
                </div>

                {/* Selected File Details & Actions */}
                <div className="p-3 bg-slate-900 border border-white/10 rounded-xl space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/5 pb-2">
                    <div>
                      <span className="text-cyan-300 font-bold text-xs">{currentFile.filename}</span>
                      <span className="text-[10px] text-slate-400 ml-2 font-mono">({currentFile.path})</span>
                      <div className="text-[10px] text-slate-400 mt-0.5">{currentFile.description}</div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={copyCurrentCode}
                        className="px-2.5 py-1 bg-white/10 hover:bg-cyan-500/20 text-slate-200 hover:text-cyan-300 border border-white/10 rounded-lg text-[10px] font-bold uppercase transition cursor-pointer flex items-center gap-1"
                      >
                        {copiedFile ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                        <span>{copiedFile ? "Copied" : "Copy"}</span>
                      </button>

                      <button
                        onClick={downloadCurrentFile}
                        className="px-2.5 py-1 bg-white/10 hover:bg-cyan-500/20 text-slate-200 hover:text-cyan-300 border border-white/10 rounded-lg text-[10px] font-bold uppercase transition cursor-pointer flex items-center gap-1"
                      >
                        <Download size={12} />
                        <span>Download</span>
                      </button>
                    </div>
                  </div>

                  <pre className="p-3 bg-black/80 rounded-lg text-[10px] text-slate-300 overflow-x-auto select-text leading-4 max-h-72 scrollbar-thin font-mono">
                    {currentFile.content}
                  </pre>
                </div>
              </div>
            )}
          </div>

          {/* Modal Footer */}
          <div className="px-5 py-3 bg-slate-900/90 border-t border-white/5 flex items-center justify-between text-[10px] text-slate-400">
            <span>ARCH OPERATING SYSTEM v5.0 • ANDROID 9 (API 28) ENGINE</span>
            <button
              onClick={onClose}
              className="px-3 py-1 bg-white/10 hover:bg-white/20 text-white rounded-lg transition cursor-pointer"
            >
              Close
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
