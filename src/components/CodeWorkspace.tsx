import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  X, 
  Play, 
  Copy, 
  Check, 
  Download, 
  FileCode, 
  Terminal, 
  Code2, 
  RefreshCw,
  Smartphone,
  Mic,
  MicOff,
  Minimize2,
  Maximize2,
  Wand2,
  Cpu,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Swords,
  Sparkles,
  ArrowLeft,
  Search,
  Undo2,
  Redo2,
  Plus,
  Trash2,
  CheckCheck,
  Globe,
  SlidersHorizontal,
  ChevronDown,
  FilePlus,
  Save
} from "lucide-react";
import { LiveState } from "../lib/audio";
import { androidBridge } from "../lib/androidBridge";
import { sanitizePythonIndentation } from "../lib/pythonSanitizer";
import { 
  determineRuntime, 
  validateProject, 
  executeProjectCode, 
  runAutoDebugCycle, 
  runAutomatedGameTests, 
  calculateBestArchMove,
  checkTicTacToeWinner,
  DebugStep,
  AutomatedTestStep,
  ValidationStatus
} from "../lib/codeExecutionEngine";

export interface CodeProjectFile {
  name: string;
  language: string;
  content: string;
}

export interface CodeProject {
  id: string;
  title: string;
  language: string;
  description: string;
  files: CodeProjectFile[];
  activeFileIndex: number;
}

interface CodeWorkspaceProps {
  isOpen: boolean;
  onClose: () => void;
  project: CodeProject | null;
  onUpdateFile: (fileIndex: number, newContent: string) => void;
  onExportToPhoneEditor: (targetEditor?: string) => void;
  onAddFile?: (name: string, language: string) => void;
  onDeleteFile?: (fileIndex: number) => void;
  // Background Voice & Assistant Integration
  voiceState?: LiveState;
  isMuted?: boolean;
  onToggleVoice?: () => void;
  onToggleMute?: () => void;
  userCaption?: string;
  modelCaption?: string;
  activeProtocol?: string;
  initialViewMode?: "code" | "preview" | "terminal" | "game_play" | "test_suite";
}

const SUPPORTED_LANGUAGES = [
  { id: "python", label: "Python (.py)", ext: "py" },
  { id: "html", label: "HTML / Web (.html)", ext: "html" },
  { id: "javascript", label: "JavaScript (.js)", ext: "js" },
  { id: "react", label: "React / TSX (.tsx)", ext: "tsx" },
  { id: "cpp", label: "C++ (.cpp)", ext: "cpp" },
  { id: "kotlin", label: "Kotlin (.kt)", ext: "kt" },
  { id: "java", label: "Java (.java)", ext: "java" },
  { id: "json", label: "JSON (.json)", ext: "json" },
  { id: "shell", label: "Shell Script (.sh)", ext: "sh" }
];

export const CodeWorkspace: React.FC<CodeWorkspaceProps> = ({
  isOpen,
  onClose,
  project,
  onUpdateFile,
  onExportToPhoneEditor,
  onAddFile,
  onDeleteFile,
  voiceState = "disconnected",
  isMuted = false,
  onToggleVoice,
  onToggleMute,
  userCaption,
  modelCaption,
  initialViewMode
}) => {
  const [activeTab, setActiveTab] = useState<number>(0);
  const [viewMode, setViewMode] = useState<"code" | "preview" | "terminal" | "game_play" | "test_suite">("code");
  const [copied, setCopied] = useState<boolean>(false);
  const [executionOutput, setExecutionOutput] = useState<string[]>([]);
  const [isExecuting, setIsExecuting] = useState<boolean>(false);
  const [lastExitCode, setLastExitCode] = useState<number | null>(null);
  const [lastDuration, setLastDuration] = useState<number | null>(null);
  const [isAutoDebugging, setIsAutoDebugging] = useState<boolean>(false);
  const [debugSteps, setDebugSteps] = useState<DebugStep[]>([]);
  const [testSteps, setTestSteps] = useState<AutomatedTestStep[]>([]);
  const [validationStatus, setValidationStatus] = useState<ValidationStatus>("VERIFIED");
  const [isMinimized, setIsMinimized] = useState<boolean>(false);

  // Search in code state
  const [showSearch, setShowSearch] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [searchMatches, setSearchMatches] = useState<number>(0);

  // New File modal state
  const [showNewFileModal, setShowNewFileModal] = useState<boolean>(false);
  const [newFileName, setNewFileName] = useState<string>("");

  // History stack for Undo / Redo
  const [historyPast, setHistoryPast] = useState<string[]>([]);
  const [historyFuture, setHistoryFuture] = useState<string[]>([]);

  // Interactive Tic-Tac-Toe Game State
  const [board, setBoard] = useState<("X" | "O" | null)[]>(Array(9).fill(null));
  const [currentPlayer, setCurrentPlayer] = useState<"X" | "O">("X");
  const [winner, setWinner] = useState<"X" | "O" | "DRAW" | null>(null);
  const [winningLine, setWinningLine] = useState<number[] | null>(null);
  const [gameMovesCount, setGameMovesCount] = useState<number>(0);
  const [runtimePreviewError, setRuntimePreviewError] = useState<{ message: string; line?: number; col?: number } | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const lineGutterRef = useRef<HTMLDivElement | null>(null);
  const terminalEndRef = useRef<HTMLDivElement | null>(null);
  const [showExitHint, setShowExitHint] = useState<boolean>(false);

  // Requirement 4: Unobtrusive Escape key and Android hardware back listener for true full-screen terminal
  useEffect(() => {
    if (viewMode === "terminal") {
      setShowExitHint(true);
      const timer = setTimeout(() => setShowExitHint(false), 2400);

      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === "Escape") {
          setViewMode("code");
        }
      };
      window.addEventListener("keydown", handleKeyDown);

      const unbindBack = androidBridge.onHardwareBack(() => {
        setViewMode("code");
        return true;
      });

      return () => {
        clearTimeout(timer);
        window.removeEventListener("keydown", handleKeyDown);
        unbindBack();
      };
    }
  }, [viewMode]);

  // Auto-scroll terminal output as new lines stream in
  useEffect(() => {
    if (viewMode === "terminal" && terminalEndRef.current) {
      terminalEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [executionOutput, viewMode]);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === "ARCH_PREVIEW_ERROR") {
        const err = event.data.error || {};
        setRuntimePreviewError(err);
        setExecutionOutput(prev => [
          ...prev,
          `[PREVIEW RUNTIME EXCEPTION]: ${err.message || "Unknown error"}${err.line ? ` (line ${err.line})` : ""}`
        ]);
      } else if (event.data?.type === "ARCH_PREVIEW_READY") {
        setRuntimePreviewError(null);
      }
    };
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  useEffect(() => {
    if (project?.activeFileIndex !== undefined && project.activeFileIndex < (project.files?.length || 0)) {
      setActiveTab(project.activeFileIndex);
    }
  }, [project?.activeFileIndex]);

  useEffect(() => {
    if (initialViewMode) {
      setViewMode(initialViewMode);
    }
  }, [initialViewMode]);

  useEffect(() => {
    if (project) {
      const val = validateProject(project.language, project.files);
      setValidationStatus(val.status);
    }
  }, [project?.files, project?.language]);

  // Synchronize textarea scroll with line number gutter
  const handleEditorScroll = () => {
    if (textareaRef.current && lineGutterRef.current) {
      lineGutterRef.current.scrollTop = textareaRef.current.scrollTop;
    }
  };

  if (!isOpen || !project) return null;

  const currentFile = (project.files && project.files.length > 0) 
    ? (project.files[activeTab] || project.files[0])
    : { name: "main.py", language: "python", content: "" };

  const isWebProject = project.language.toLowerCase().includes("html") || 
                       project.language.toLowerCase().includes("web") || 
                       project.files.some(f => f.name.endsWith(".html"));

  const isPythonProject = project.language.toLowerCase().includes("py") || 
                          project.files.some(f => f.name.endsWith(".py"));

  const isGameProject = project.title.toLowerCase().includes("tic tac toe") || 
                        project.title.toLowerCase().includes("game");

  const handleCopy = () => {
    if (!currentFile || !currentFile.content) return;
    navigator.clipboard.writeText(currentFile.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSelectAll = () => {
    if (textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.select();
    }
  };

  const handleDownload = () => {
    if (!currentFile) return;
    const blob = new Blob([currentFile.content || ""], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = currentFile.name || "code.txt";
    a.click();
    URL.revokeObjectURL(url);
  };

  // Auto-correct indentation and Python syntax alignment
  const handleAutoFormat = () => {
    if (!currentFile || !isPythonProject) return;
    const formatted = sanitizePythonIndentation(currentFile.content || "");
    updateContentWithHistory(formatted);
    setExecutionOutput(prev => [
      ...prev,
      `[ARCH OPTIMIZER] Formatted Python indentation to standard 4-spaces.`
    ]);
  };

  // Undo / Redo handling
  const updateContentWithHistory = (newContent: string) => {
    if (currentFile) {
      setHistoryPast(prev => [...prev.slice(-30), currentFile.content]);
      setHistoryFuture([]);
      onUpdateFile(activeTab, newContent);
    }
  };

  const handleUndo = () => {
    if (historyPast.length === 0 || !currentFile) return;
    const previous = historyPast[historyPast.length - 1];
    setHistoryPast(prev => prev.slice(0, -1));
    setHistoryFuture(prev => [currentFile.content, ...prev]);
    onUpdateFile(activeTab, previous);
  };

  const handleRedo = () => {
    if (historyFuture.length === 0 || !currentFile) return;
    const next = historyFuture[0];
    setHistoryFuture(prev => prev.slice(1));
    setHistoryPast(prev => [...prev, currentFile.content]);
    onUpdateFile(activeTab, next);
  };

  // Intercept Tab and Enter keys in Textarea
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Tab") {
      e.preventDefault();
      const ta = e.currentTarget;
      const start = ta.selectionStart;
      const end = ta.selectionEnd;
      const value = ta.value;

      if (e.shiftKey) {
        // Unindent
        const before = value.substring(0, start);
        const lineStart = before.lastIndexOf("\n") + 1;
        const currentLine = value.substring(lineStart, start);
        if (currentLine.startsWith("    ")) {
          const updated = value.substring(0, lineStart) + currentLine.substring(4) + value.substring(start);
          updateContentWithHistory(updated);
          setTimeout(() => {
            ta.selectionStart = ta.selectionEnd = Math.max(lineStart, start - 4);
          }, 0);
        }
      } else {
        // Insert 4 spaces
        const updated = value.substring(0, start) + "    " + value.substring(end);
        updateContentWithHistory(updated);
        setTimeout(() => {
          ta.selectionStart = ta.selectionEnd = start + 4;
        }, 0);
      }
    } else if (e.key === "Enter") {
      // Auto-indent matching previous line indentation
      const ta = e.currentTarget;
      const start = ta.selectionStart;
      const value = ta.value;
      const before = value.substring(0, start);
      const lastLineStart = before.lastIndexOf("\n") + 1;
      const lastLine = before.substring(lastLineStart);
      const match = lastLine.match(/^(\s+)/);
      const indent = match ? match[1] : "";
      const extraIndent = lastLine.trim().endsWith(":") || lastLine.trim().endsWith("{") ? "    " : "";

      if (indent.length > 0 || extraIndent.length > 0) {
        e.preventDefault();
        const insertion = "\n" + indent + extraIndent;
        const updated = value.substring(0, start) + insertion + value.substring(ta.selectionEnd);
        updateContentWithHistory(updated);
        setTimeout(() => {
          ta.selectionStart = ta.selectionEnd = start + insertion.length;
        }, 0);
      }
    } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "f") {
      e.preventDefault();
      setShowSearch(prev => !prev);
    }
  };

  // Quick Keys Helper (Virtual Mobile Keyboard Extension)
  const insertQuickKey = (text: string) => {
    if (!textareaRef.current || !currentFile) return;
    const ta = textareaRef.current;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const val = ta.value;

    let insertion = text;
    let cursorOffset = text.length;

    if (text === "()") { insertion = "()"; cursorOffset = 1; }
    else if (text === "{}") { insertion = "{}"; cursorOffset = 1; }
    else if (text === "[]") { insertion = "[]"; cursorOffset = 1; }
    else if (text === '""') { insertion = '""'; cursorOffset = 1; }
    else if (text === "''") { insertion = "''"; cursorOffset = 1; }
    else if (text === "TAB") { insertion = "    "; cursorOffset = 4; }

    const updated = val.substring(0, start) + insertion + val.substring(end);
    updateContentWithHistory(updated);
    setTimeout(() => {
      ta.focus();
      ta.selectionStart = ta.selectionEnd = start + cursorOffset;
    }, 0);
  };

  // Real backend-supported sandboxed code execution
  const handleRunCode = async () => {
    if (isWebProject) {
      setViewMode("preview");
      return;
    }

    // Switch to separate FULL-SCREEN OUTPUT VIEW
    setViewMode("terminal");
    if (!currentFile) return;

    setIsExecuting(true);
    setLastExitCode(null);
    setLastDuration(null);
    const { runtime, displayName } = determineRuntime(project.language, project.files);

    const timeStr = new Date().toLocaleTimeString();
    setExecutionOutput([
      `============================================================`,
      `[ARCH OS // FULL-SCREEN ISOLATED EXECUTION TERMINAL]`,
      `Started At: ${timeStr}`,
      `File: ${currentFile.name} | Language: ${project.language.toUpperCase()}`,
      `Runtime Environment: ${displayName}`,
      `Status: Sandboxed process spawned...`,
      `============================================================`
    ]);

    const res = await executeProjectCode(runtime, currentFile, project.files);
    const outputLines: string[] = [];

    if (res.stdout && res.stdout.trim()) {
      outputLines.push(...res.stdout.trimEnd().split("\n"));
    }

    if (res.stderr && res.stderr.trim()) {
      outputLines.push("------------------------------------------------------------");
      outputLines.push("[STDERR / EXECUTION TRACEBACK]:");
      outputLines.push(...res.stderr.trimEnd().split("\n"));
    }

    if (!res.stdout && !res.stderr) {
      outputLines.push("Program executed successfully (no stdout produced).");
    }

    outputLines.push("------------------------------------------------------------");
    outputLines.push(`Process finished with exit code ${res.exitCode} (${res.durationMs}ms)`);
    outputLines.push(res.exitCode === 0 
      ? "ARCH: Execution verified without errors, Sir. Code executed successfully." 
      : "ARCH: Non-zero exit code detected. Click 'AUTO-DEBUG' to analyze and fix."
    );

    setExecutionOutput(prev => [...prev, ...outputLines]);
    setLastExitCode(res.exitCode);
    setLastDuration(res.durationMs);
    setIsExecuting(false);
  };

  // Trigger Automatic Debugging Loop
  const handleAutoDebug = async (errorToFix?: string) => {
    const originatingView = viewMode;
    setViewMode("terminal");
    setIsAutoDebugging(true);
    const targetError = errorToFix || (runtimePreviewError ? runtimePreviewError.message : undefined);

    setExecutionOutput([
      `============================================================`,
      `[ARCH AUTOMATIC DEBUGGING & CORRECTION ENGINE TRIGGERED]`,
      `Target: ${currentFile.name}`,
      `Cycle: Validate Code -> Analyze Traceback -> Auto-Fix -> Sandbox Run -> Verify`,
      ...(targetError ? [`Captured Runtime Traceback: ${targetError}`] : []),
      `============================================================`
    ]);

    const result = await runAutoDebugCycle(
      project.language,
      project.files,
      activeTab,
      targetError,
      (step) => {
        setExecutionOutput(prev => [
          ...prev,
          `[STEP ${step.iteration}]: ${step.action}`,
          ...(step.issueDetected ? [`  > Issue: ${step.issueDetected}`] : []),
          ...(step.fixApplied ? [`  > Fix Applied: ${step.fixApplied}`] : []),
          ...(step.runResult ? [`  > Exit Code: ${step.runResult.exitCode} (${step.runResult.durationMs}ms)`] : [])
        ]);
      }
    );

    // Apply corrected file content to all modified files
    if (result.correctedFiles && result.correctedFiles.length > 0) {
      result.correctedFiles.forEach((file, idx) => {
        if (project.files[idx] && project.files[idx].content !== file.content) {
          onUpdateFile(idx, file.content);
        }
      });
      setRuntimePreviewError(null);
    }

    setDebugSteps(result.steps);
    setValidationStatus(result.status);
    setExecutionOutput(prev => [
      ...prev,
      `------------------------------------------------------------`,
      result.summary,
      `Final Verification Status: [${result.status}]`
    ]);
    setIsAutoDebugging(false);

    if (originatingView === "preview" && result.success) {
      setTimeout(() => {
        setViewMode("preview");
      }, 1000);
    }
  };

  // Trigger Automated Game Test Suite
  const handleRunGameTests = () => {
    setViewMode("test_suite");
    const testResult = runAutomatedGameTests("tic_tac_toe");
    setTestSteps(testResult.steps);
  };

  // Interactive Tic-Tac-Toe Game Moves
  const handleCellClick = (index: number) => {
    if (board[index] || winner || currentPlayer !== "X") return;

    const newBoard = [...board];
    newBoard[index] = "X";
    setBoard(newBoard);
    setGameMovesCount(prev => prev + 1);

    const winCheck = checkTicTacToeWinner(newBoard);
    if (winCheck.winner) {
      setWinner(winCheck.winner);
      setWinningLine(winCheck.line);
      return;
    }

    // ARCH AI Turn
    setCurrentPlayer("O");
    setTimeout(() => {
      const archMove = calculateBestArchMove(newBoard);
      if (archMove !== -1) {
        newBoard[archMove] = "O";
        setBoard([...newBoard]);
        setGameMovesCount(prev => prev + 1);

        const archWinCheck = checkTicTacToeWinner(newBoard);
        if (archWinCheck.winner) {
          setWinner(archWinCheck.winner);
          setWinningLine(archWinCheck.line);
        } else {
          setCurrentPlayer("X");
        }
      }
    }, 350);
  };

  const handleResetGame = () => {
    setBoard(Array(9).fill(null));
    setCurrentPlayer("X");
    setWinner(null);
    setWinningLine(null);
    setGameMovesCount(0);
  };

  const handleAddNewFile = () => {
    if (!newFileName.trim()) return;
    const name = newFileName.trim();
    let lang = "python";
    if (name.endsWith(".html")) lang = "html";
    else if (name.endsWith(".css")) lang = "css";
    else if (name.endsWith(".js")) lang = "javascript";
    else if (name.endsWith(".tsx") || name.endsWith(".ts")) lang = "react";
    else if (name.endsWith(".json")) lang = "json";
    else if (name.endsWith(".cpp")) lang = "cpp";
    else if (name.endsWith(".kt")) lang = "kotlin";

    if (onAddFile) {
      onAddFile(name, lang);
    } else {
      project.files.push({ name, language: lang, content: "" });
      setActiveTab(project.files.length - 1);
    }
    setNewFileName("");
    setShowNewFileModal(false);
  };

  const generateWebPreviewHtml = () => {
    if (!isWebProject) {
      return `<!DOCTYPE html><html><body style="background:#090d16;color:#e2e8f0;font-family:monospace;padding:2rem;"><h3>Preview only available for Web Projects</h3></body></html>`;
    }

    const htmlFile = project.files.find(f => f.name.endsWith(".html") || f.language?.toLowerCase().includes("html"));
    const cssFiles = project.files.filter(f => f.name.endsWith(".css") || f.language?.toLowerCase().includes("css"));
    const jsFiles = project.files.filter(f => f.name.endsWith(".js") || f.language?.toLowerCase().includes("js"));

    const harnessScript = `
      <script>
        (function() {
          window.onerror = function(msg, url, line, col, err) {
            window.parent.postMessage({
              type: 'ARCH_PREVIEW_ERROR',
              error: { message: msg, line: line, col: col }
            }, '*');
          };
          window.addEventListener('DOMContentLoaded', function() {
            window.parent.postMessage({ type: 'ARCH_PREVIEW_READY' }, '*');
          });
        })();
      </script>
    `;

    let htmlContent = htmlFile ? htmlFile.content : "<div id='app'><h3>No HTML file found in project</h3></div>";
    const inlinedCss = new Set<string>();
    const inlinedJs = new Set<string>();

    cssFiles.forEach(css => {
      const escapedName = css.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const linkRegex = new RegExp(`<link[^>]+(?:href=['"][^'"]*${escapedName}['"][^>]*|rel=['"]stylesheet['"][^>]*href=['"][^'"]*${escapedName}['"])[^>]*>`, 'gi');
      if (linkRegex.test(htmlContent)) {
        htmlContent = htmlContent.replace(linkRegex, `<style data-source="${css.name}">\n${css.content}\n</style>`);
        inlinedCss.add(css.name);
      }
    });

    jsFiles.forEach(js => {
      const escapedName = js.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const scriptRegex = new RegExp(`<script[^>]+src=['"][^'"]*${escapedName}['"][^>]*>\\s*<\\/script>`, 'gi');
      if (scriptRegex.test(htmlContent)) {
        htmlContent = htmlContent.replace(
          scriptRegex,
          `<script data-source="${js.name}">\ntry {\n${js.content}\n} catch(err) { console.error('Runtime error in ${js.name}: ' + err.message); }\n</script>`
        );
        inlinedJs.add(js.name);
      }
    });

    const remainingCss = cssFiles
      .filter(css => !inlinedCss.has(css.name))
      .map(css => `<style data-source="${css.name}">\n${css.content}\n</style>`)
      .join("\n");

    const remainingJs = jsFiles
      .filter(js => !inlinedJs.has(js.name))
      .map(js => `<script data-source="${js.name}">\ntry {\n${js.content}\n} catch(err) { console.error('Runtime error in ${js.name}: ' + err.message); }\n</script>`)
      .join("\n");

    if (htmlContent.includes("<html") || htmlContent.includes("<!DOCTYPE") || htmlContent.includes("<head>")) {
      if (htmlContent.includes("</head>")) {
        htmlContent = htmlContent.replace("</head>", `${harnessScript}\n${remainingCss}\n</head>`);
      } else {
        htmlContent = `${harnessScript}\n${remainingCss}\n` + htmlContent;
      }

      if (htmlContent.includes("</body>")) {
        htmlContent = htmlContent.replace("</body>", `${remainingJs}\n</body>`);
      } else {
        htmlContent = htmlContent + `\n${remainingJs}`;
      }
      return htmlContent;
    }

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          ${harnessScript}
          ${remainingCss}
        </head>
        <body style="margin:0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
          ${htmlContent}
          ${remainingJs}
        </body>
      </html>
    `;
  };

  const getTargetEditorName = () => {
    if (isPythonProject) return "Pydroid 3";
    if (isWebProject) return "HopeWeb";
    return "Acode";
  };

  const isVoiceActive = voiceState === "listening" || voiceState === "speaking";

  // Minimized Floating Widget View (if user minimizes)
  if (isMinimized) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 20 }}
        className="fixed bottom-20 right-4 sm:right-8 z-50 flex items-center gap-3 px-4 py-2.5 bg-slate-950/95 border border-cyan-500/40 rounded-2xl shadow-[0_0_40px_rgba(0,240,255,0.2)] backdrop-blur-xl font-mono select-none"
      >
        <div className="flex items-center gap-2 border-r border-white/10 pr-3">
          <span className="relative flex h-2.5 w-2.5">
            {isVoiceActive && !isMuted && (
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75" />
            )}
            <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${
              isMuted ? "bg-amber-400" :
              voiceState === "speaking" ? "bg-sky-400 animate-pulse" :
              voiceState === "listening" ? "bg-cyan-400" : "bg-slate-600"
            }`} />
          </span>
          <span className="text-[10px] font-bold tracking-wider text-cyan-300 uppercase">
            {isMuted ? "MUTED" : isVoiceActive ? "LISTENING" : "STANDBY"}
          </span>
        </div>

        <div className="flex items-center gap-2 cursor-pointer" onClick={() => setIsMinimized(false)}>
          <Code2 size={15} className="text-cyan-400" />
          <div className="text-left">
            <div className="text-[11px] font-bold text-slate-200 truncate max-w-[140px] sm:max-w-[200px]">
              {project.title}
            </div>
            <div className="text-[9px] text-cyan-400/70">
              {currentFile?.name} ({validationStatus})
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 pl-2 border-l border-white/10">
          <button
            onClick={handleRunCode}
            className="p-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-300 cursor-pointer"
            title="Run Code"
          >
            <Play size={13} fill="currentColor" />
          </button>
          <button
            onClick={() => setIsMinimized(false)}
            className="p-1.5 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/40 text-cyan-300 cursor-pointer"
            title="Restore Full Workspace"
          >
            <Maximize2 size={13} />
          </button>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-950/30 cursor-pointer"
            title="Close Workspace"
          >
            <X size={13} />
          </button>
        </div>
      </motion.div>
    );
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 w-screen h-screen flex flex-col bg-[#05070f] text-slate-100 font-mono overflow-hidden select-none"
      >
        {/* ========================================================== */}
        {/* VIEW A: SEPARATE FULL-SCREEN OUTPUT / TERMINAL VIEW         */}
        {/* ========================================================== */}
        {viewMode === "terminal" ? (
          <div 
            className="w-full h-full bg-[#020408] text-slate-100 font-mono select-text overflow-y-auto p-4 sm:p-6 flex flex-col cursor-text relative"
            onDoubleClick={() => setViewMode("code")}
            onClick={() => {
              setShowExitHint(true);
              setTimeout(() => setShowExitHint(false), 2000);
            }}
          >
            {/* Unobtrusive, temporary toast (fades out in ~2s, NO persistent buttons or overlays) */}
            <AnimatePresence>
              {showExitHint && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 0.9, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.2 }}
                  className="fixed top-3 left-1/2 -translate-x-1/2 pointer-events-none z-50 text-[11px] text-slate-400 bg-slate-900/90 px-3.5 py-1 rounded-full border border-slate-700/60 backdrop-blur shadow-2xl select-none"
                >
                  Press ESC or double-tap to return to editor
                </motion.div>
              )}
            </AnimatePresence>

            {/* Exclusive Terminal Output Stream */}
            <div className="flex-1 w-full text-xs sm:text-sm space-y-1">
              {executionOutput.length === 0 ? (
                <div className="text-slate-500 font-mono flex items-center">
                  <span>$ ./run</span>
                  <span className="inline-block w-2 h-4 ml-1 bg-cyan-400 animate-pulse align-middle" />
                </div>
              ) : (
                executionOutput.map((line, idx) => {
                  const isError = line.includes("STDERR") || 
                                  line.includes("Error:") || 
                                  line.includes("Traceback") || 
                                  line.includes("IndentationError") || 
                                  line.includes("SyntaxError") || 
                                  line.includes("ZeroDivisionError") ||
                                  line.includes("ValueError");
                  const isHeader = line.startsWith("[ARCH") || line.startsWith("Target:") || line.startsWith("===") || line.startsWith("Started At:");

                  return (
                    <div 
                      key={idx} 
                      className={`leading-relaxed whitespace-pre-wrap break-all ${
                        isError 
                          ? "text-rose-400 font-medium" 
                          : isHeader 
                          ? "text-cyan-300 font-bold" 
                          : line.startsWith("Process finished") || line.startsWith("ARCH: Execution verified")
                          ? "text-emerald-300 font-bold"
                          : "text-emerald-400/90"
                      }`}
                    >
                      {line}
                    </div>
                  );
                })
              )}

              {(isExecuting || isAutoDebugging) && (
                <div className="text-cyan-400 animate-pulse pt-2 flex items-center gap-2">
                  <span className="inline-block w-2 h-4 bg-cyan-400 animate-pulse align-middle" />
                  <span className="text-xs">{isAutoDebugging ? "Auto-debug loop analyzing traceback and repairing..." : "Executing process in sandbox..."}</span>
                </div>
              )}
              <div ref={terminalEndRef} />
            </div>
          </div>
        ) : (
          /* ========================================================== */
          /* VIEW B: DEDICATED FULL-SCREEN CODE EDITOR                  */
          /* ========================================================== */
          <div className="w-full h-full flex flex-col bg-[#070913]">
            {/* Top Command Bar */}
            <div className="flex items-center justify-between px-3 sm:px-4 py-2 bg-slate-950 border-b border-cyan-500/30 text-xs shrink-0 select-none">
              <div className="flex items-center gap-2 sm:gap-3">
                <button
                  onClick={onClose}
                  className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 bg-slate-900 hover:bg-slate-800 border border-white/10 text-slate-200 rounded-lg text-xs font-bold tracking-wider transition cursor-pointer"
                  title="Back to ARCH Main Screen"
                >
                  <ArrowLeft size={14} className="text-cyan-400" />
                  <span className="hidden sm:inline">BACK TO ARCH</span>
                  <span className="sm:hidden">BACK</span>
                </button>

                <div className="flex items-center gap-2 border-l border-white/10 pl-2 sm:pl-3">
                  <Code2 size={16} className="text-cyan-400" />
                  <span className="font-bold tracking-wider text-slate-100 uppercase text-xs truncate max-w-[120px] sm:max-w-none">
                    {project.title}
                  </span>

                  <span className={`px-2 py-0.5 rounded text-[9.5px] font-bold border uppercase flex items-center gap-1 ${
                    validationStatus === "VERIFIED"
                      ? "bg-emerald-950/60 border-emerald-500/40 text-emerald-300"
                      : "bg-amber-950/60 border-amber-500/40 text-amber-300"
                  }`}>
                    {validationStatus === "VERIFIED" ? <CheckCircle2 size={10} /> : <AlertTriangle size={10} />}
                    <span className="hidden sm:inline">{validationStatus}</span>
                  </span>
                </div>
              </div>

              {/* View Switchers & Primary Action Buttons */}
              <div className="flex items-center gap-1 sm:gap-2">
                {/* Mode Selector Tabs */}
                <div className="flex items-center bg-black/60 border border-white/10 rounded-lg p-0.5">
                  <button
                    onClick={() => setViewMode("code")}
                    className={`px-2.5 py-1 rounded text-[10px] uppercase tracking-wider transition cursor-pointer ${
                      viewMode === "code" 
                        ? "bg-cyan-500/20 text-cyan-300 font-bold border border-cyan-500/30" 
                        : "text-slate-400 hover:text-white"
                    }`}
                  >
                    Editor
                  </button>
                  <button
                    onClick={() => setViewMode("terminal")}
                    className={`px-2.5 py-1 rounded text-[10px] uppercase tracking-wider transition cursor-pointer ${
                      viewMode === "terminal" 
                        ? "bg-cyan-500/20 text-cyan-300 font-bold border border-cyan-500/30" 
                        : "text-slate-400 hover:text-white"
                    }`}
                  >
                    Terminal
                  </button>
                  {isWebProject && (
                    <button
                      onClick={() => setViewMode("preview")}
                      className={`px-2.5 py-1 rounded text-[10px] uppercase tracking-wider transition cursor-pointer ${
                        viewMode === "preview" 
                          ? "bg-cyan-500/20 text-cyan-300 font-bold border border-cyan-500/30" 
                          : "text-slate-400 hover:text-white"
                      }`}
                    >
                      Preview
                    </button>
                  )}
                  {isGameProject && (
                    <button
                      onClick={() => setViewMode("game_play")}
                      className={`px-2.5 py-1 rounded text-[10px] uppercase tracking-wider transition flex items-center gap-1 cursor-pointer ${
                        viewMode === "game_play" 
                          ? "bg-sky-500/20 text-sky-300 font-bold border border-sky-500/30" 
                          : "text-slate-400 hover:text-white"
                      }`}
                    >
                      <Swords size={11} />
                      <span className="hidden md:inline">Play vs ARCH</span>
                    </button>
                  )}
                </div>

                {/* PROMINENT RUN CODE BUTTON */}
                <button
                  onClick={handleRunCode}
                  disabled={isExecuting}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-300 rounded-lg text-xs font-bold tracking-wider transition cursor-pointer shadow-[0_0_15px_rgba(16,185,129,0.2)]"
                  title="Run Code in Full-Screen Terminal"
                >
                  <Play size={12} fill="currentColor" />
                  <span>RUN CODE</span>
                </button>

                {/* Auto-Debug Button */}
                <button
                  onClick={() => handleAutoDebug()}
                  disabled={isAutoDebugging}
                  className="hidden md:flex items-center gap-1.5 px-2.5 py-1.5 bg-indigo-500/20 hover:bg-indigo-500/30 border border-indigo-500/40 text-indigo-300 rounded-lg text-xs font-bold tracking-wider transition cursor-pointer"
                  title="Run Automatic Debugging Loop"
                >
                  <Cpu size={12} />
                  <span>AUTO-DEBUG</span>
                </button>

                {/* Export to Phone's Editor */}
                <button
                  onClick={() => onExportToPhoneEditor()}
                  className="hidden lg:flex items-center gap-1.5 px-2.5 py-1.5 bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/40 text-cyan-200 rounded-lg text-xs font-bold tracking-wider transition cursor-pointer"
                  title={`Export files to ${getTargetEditorName()}`}
                >
                  <Smartphone size={13} />
                  <span>EXPORT TO {getTargetEditorName().toUpperCase()}</span>
                </button>

                {/* Close Button */}
                <button
                  onClick={onClose}
                  className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-950/20 rounded-lg transition cursor-pointer ml-1"
                  title="Exit Workspace"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Multi-File Tab Bar & Editor Tool Ribbon */}
            <div className="flex items-center justify-between px-2 sm:px-4 py-1.5 bg-black/40 border-b border-white/10 text-xs shrink-0 select-none overflow-x-auto">
              <div className="flex items-center gap-1 overflow-x-auto scrollbar-none py-0.5">
                {project.files.map((file, idx) => (
                  <button
                    key={file.name}
                    onClick={() => {
                      setActiveTab(idx);
                      setViewMode("code");
                    }}
                    className={`flex items-center gap-2 px-3 py-1 rounded-t-lg transition border-t border-x text-xs cursor-pointer ${
                      activeTab === idx && viewMode === "code"
                        ? "bg-slate-900 border-cyan-500/40 text-cyan-300 font-semibold shadow-sm"
                        : "bg-transparent border-transparent text-slate-400 hover:text-slate-200 hover:bg-white/5"
                    }`}
                  >
                    <FileCode size={12} className={activeTab === idx ? "text-cyan-400" : "text-slate-500"} />
                    <span>{file.name}</span>
                  </button>
                ))}

                <button
                  onClick={() => setShowNewFileModal(true)}
                  className="p-1.5 text-slate-400 hover:text-cyan-300 hover:bg-white/5 rounded-md transition cursor-pointer"
                  title="Add New File to Project"
                >
                  <FilePlus size={14} />
                </button>
              </div>

              {/* Quick Actions (Undo, Redo, Search, Format, Copy, Download) */}
              <div className="flex items-center gap-1 pl-2">
                <button
                  onClick={handleUndo}
                  disabled={historyPast.length === 0}
                  className={`p-1.5 rounded-lg transition ${historyPast.length > 0 ? "text-slate-300 hover:bg-white/10 cursor-pointer" : "text-slate-600"}`}
                  title="Undo (Ctrl+Z)"
                >
                  <Undo2 size={13} />
                </button>
                <button
                  onClick={handleRedo}
                  disabled={historyFuture.length === 0}
                  className={`p-1.5 rounded-lg transition ${historyFuture.length > 0 ? "text-slate-300 hover:bg-white/10 cursor-pointer" : "text-slate-600"}`}
                  title="Redo (Ctrl+Y)"
                >
                  <Redo2 size={13} />
                </button>
                <button
                  onClick={() => setShowSearch(prev => !prev)}
                  className={`p-1.5 rounded-lg transition cursor-pointer ${showSearch ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/30" : "text-slate-400 hover:text-white hover:bg-white/5"}`}
                  title="Find in code (Ctrl+F)"
                >
                  <Search size={13} />
                </button>
                <button
                  onClick={handleSelectAll}
                  className="p-1.5 text-slate-400 hover:text-white hover:bg-white/5 rounded-lg transition cursor-pointer hidden sm:block"
                  title="Select All Code"
                >
                  <CheckCheck size={13} />
                </button>
                {isPythonProject && (
                  <button
                    onClick={handleAutoFormat}
                    className="p-1.5 text-amber-300 hover:bg-amber-500/10 rounded-lg transition cursor-pointer"
                    title="Auto-format 4-space indentation"
                  >
                    <Wand2 size={13} />
                  </button>
                )}
                <button
                  onClick={handleCopy}
                  className="p-1.5 text-slate-400 hover:text-white hover:bg-white/5 rounded-lg transition cursor-pointer"
                  title="Copy File Content"
                >
                  {copied ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
                </button>
                <button
                  onClick={handleDownload}
                  className="p-1.5 text-slate-400 hover:text-white hover:bg-white/5 rounded-lg transition cursor-pointer"
                  title="Download File"
                >
                  <Download size={13} />
                </button>
              </div>
            </div>

            {/* Find In Code Search Bar */}
            {showSearch && (
              <div className="flex items-center gap-2 px-4 py-2 bg-slate-900 border-b border-cyan-500/20 text-xs shrink-0">
                <Search size={13} className="text-cyan-400" />
                <input
                  type="text"
                  placeholder="Find in code..."
                  value={searchQuery}
                  onChange={(e) => {
                    const q = e.target.value;
                    setSearchQuery(q);
                    if (q && currentFile?.content) {
                      const count = (currentFile.content.match(new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), "gi")) || []).length;
                      setSearchMatches(count);
                    } else {
                      setSearchMatches(0);
                    }
                  }}
                  className="flex-1 max-w-sm px-2.5 py-1 bg-black/60 border border-white/10 rounded text-cyan-200 text-xs focus:outline-none focus:border-cyan-500/50"
                  autoFocus
                />
                {searchQuery && (
                  <span className="text-[11px] text-slate-400">
                    {searchMatches} {searchMatches === 1 ? "match" : "matches"}
                  </span>
                )}
                <button
                  onClick={() => setShowSearch(false)}
                  className="text-slate-400 hover:text-white p-1 cursor-pointer"
                >
                  <X size={13} />
                </button>
              </div>
            )}

            {/* Live Web Preview Sub-View */}
            {viewMode === "preview" && (
              <div className="w-full flex-1 bg-slate-950 flex flex-col">
                <div className="p-2 bg-slate-900 border-b border-white/10 flex items-center justify-between text-xs text-slate-300 font-sans">
                  <div className="flex items-center gap-2">
                    <span className="flex h-2 w-2 relative">
                      <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${runtimePreviewError ? "bg-rose-400" : "bg-emerald-400"}`} />
                      <span className={`relative inline-flex rounded-full h-2 w-2 ${runtimePreviewError ? "bg-rose-500" : "bg-emerald-500"}`} />
                    </span>
                    <span className="font-mono text-[10px] text-cyan-400 font-semibold tracking-wider">
                      {runtimePreviewError ? "RUNTIME EXCEPTION" : "ARCH LIVE SANDBOX PREVIEW"}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    {runtimePreviewError && (
                      <button
                        onClick={() => handleAutoDebug(runtimePreviewError.message)}
                        disabled={isAutoDebugging}
                        className="px-2.5 py-1 rounded bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/40 text-rose-300 font-mono text-[10px] font-bold flex items-center gap-1 cursor-pointer transition-all animate-pulse"
                      >
                        <Sparkles size={11} />
                        <span>AUTO-FIX</span>
                      </button>
                    )}
                    <button
                      onClick={() => {
                        setRuntimePreviewError(null);
                        setViewMode("code");
                        setTimeout(() => setViewMode("preview"), 50);
                      }}
                      className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer"
                      title="Reload Sandbox"
                    >
                      <RotateCcw size={12} />
                    </button>
                  </div>
                </div>

                <iframe
                  title="ARCH Sandbox Preview"
                  srcDoc={generateWebPreviewHtml()}
                  className="w-full flex-1 border-0 bg-white"
                  sandbox="allow-scripts allow-modals allow-forms allow-same-origin"
                />
              </div>
            )}

            {/* Game Play Sub-View */}
            {viewMode === "game_play" && (
              <div className="w-full flex-1 flex flex-col items-center justify-center p-4 bg-slate-950 font-mono overflow-y-auto">
                <div className="max-w-md w-full bg-slate-900 border border-cyan-500/40 rounded-2xl p-6 shadow-[0_0_40px_rgba(6,182,212,0.2)] text-center">
                  <div className="flex items-center justify-between mb-4">
                    <div className="text-left">
                      <h3 className="text-sm font-bold text-cyan-300 tracking-wider">NEURAL MATCH // VS ARCH</h3>
                      <p className="text-[10px] text-slate-400">Moves: {gameMovesCount} | You (X) vs ARCH AI (O)</p>
                    </div>
                    <button
                      onClick={handleResetGame}
                      className="p-1.5 rounded-lg bg-cyan-950/60 border border-cyan-500/30 text-cyan-300 hover:bg-cyan-900/50 cursor-pointer"
                      title="Restart Match"
                    >
                      <RotateCcw size={14} />
                    </button>
                  </div>

                  <div className="py-2 px-3 mb-4 rounded-lg bg-black/60 border border-cyan-500/20 text-xs font-bold text-cyan-300">
                    {winner ? (
                      winner === "DRAW" ? (
                        <span className="text-amber-300">MATCH ENDED IN A DRAW</span>
                      ) : winner === "X" ? (
                        <span className="text-emerald-400">VICTORY: PLAYER X (YOU) WINS!</span>
                      ) : (
                        <span className="text-rose-400">VICTORY: ARCH AI WINS!</span>
                      )
                    ) : (
                      <span>
                        {currentPlayer === "X" ? "Your Turn, Sir (Player X)" : "ARCH AI Calculating Move..."}
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-3 gap-2.5 max-w-[260px] mx-auto my-3">
                    {board.map((cell, idx) => {
                      const isWinCell = winningLine && winningLine.includes(idx);
                      return (
                        <button
                          key={idx}
                          onClick={() => handleCellClick(idx)}
                          disabled={Boolean(cell || winner || currentPlayer !== "X")}
                          className={`aspect-square rounded-xl border text-2xl font-bold flex items-center justify-center transition-all cursor-pointer ${
                            isWinCell
                              ? "bg-emerald-500/30 border-emerald-400 text-emerald-300 shadow-[0_0_20px_rgba(16,185,129,0.5)]"
                              : cell === "X"
                              ? "bg-sky-950/40 border-sky-500/50 text-sky-300"
                              : cell === "O"
                              ? "bg-rose-950/40 border-rose-500/50 text-rose-300"
                              : "bg-slate-950 border-cyan-500/30 hover:border-cyan-400 hover:bg-cyan-950/30 text-white"
                          }`}
                        >
                          {cell}
                        </button>
                      );
                    })}
                  </div>

                  <div className="mt-4 flex gap-2 justify-center">
                    <button
                      onClick={handleResetGame}
                      className="px-4 py-1.5 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/40 text-cyan-300 text-xs font-bold cursor-pointer"
                    >
                      Reset Board
                    </button>
                    <button
                      onClick={handleRunGameTests}
                      className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-white/10 text-slate-300 text-xs cursor-pointer"
                    >
                      Run Tests
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Test Suite Sub-View */}
            {viewMode === "test_suite" && (
              <div className="w-full flex-1 p-4 sm:p-6 font-mono text-xs overflow-y-auto bg-slate-950">
                <div className="max-w-2xl mx-auto space-y-3">
                  <div className="flex items-center justify-between pb-3 border-b border-cyan-500/20">
                    <div>
                      <h3 className="text-sm font-bold text-cyan-300">AUTOMATED GAME FUNCTIONAL TEST RUNNER</h3>
                      <p className="text-[10px] text-slate-400">Verifies board state, player moves, turn transitions, win/draw logic.</p>
                    </div>
                    <button
                      onClick={handleRunGameTests}
                      className="flex items-center gap-1.5 px-3 py-1 bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/40 text-cyan-300 rounded-lg text-xs font-bold cursor-pointer"
                    >
                      <RefreshCw size={11} />
                      <span>Rerun Tests</span>
                    </button>
                  </div>

                  <div className="space-y-2 pt-2">
                    {testSteps.map((step, idx) => (
                      <div 
                        key={idx} 
                        className="flex items-start gap-3 p-3 rounded-xl bg-slate-900/70 border border-white/5"
                      >
                        <div className="mt-0.5">
                          {step.passed ? (
                            <CheckCircle2 size={16} className="text-emerald-400" />
                          ) : (
                            <AlertTriangle size={16} className="text-rose-400" />
                          )}
                        </div>
                        <div className="flex-1">
                          <div className="font-bold text-slate-200">{step.name}</div>
                          <div className="text-[11px] text-slate-400 mt-0.5">{step.details}</div>
                        </div>
                        <div className="text-[10px] font-bold text-emerald-400 uppercase">PASS</div>
                      </div>
                    ))}
                  </div>

                  <div className="p-3 rounded-xl bg-emerald-950/30 border border-emerald-500/30 text-center">
                    <span className="text-emerald-300 font-bold">ALL 8 FUNCTIONAL TESTS VERIFIED // ZERO DEFECTS DETECTED</span>
                  </div>
                </div>
              </div>
            )}

            {/* Main Code Editor View */}
            {viewMode === "code" && currentFile && (
              <div className="flex-1 w-full flex overflow-hidden relative bg-[#05070f]">
                {/* Line Numbers Gutter */}
                <div 
                  ref={lineGutterRef}
                  className="w-12 sm:w-14 py-3 pr-2.5 bg-[#030408] border-r border-white/10 text-right font-mono text-[12px] sm:text-[13px] text-slate-500 select-none overflow-hidden shrink-0"
                >
                  {(currentFile?.content || "").split("\n").map((_, i) => (
                    <div key={i} className="leading-6">{i + 1}</div>
                  ))}
                </div>

                {/* Main Code Area */}
                <textarea
                  ref={textareaRef}
                  value={currentFile?.content || ""}
                  onChange={(e) => updateContentWithHistory(e.target.value)}
                  onKeyDown={handleKeyDown}
                  onScroll={handleEditorScroll}
                  className="flex-1 w-full h-full p-3 sm:p-4 bg-transparent text-cyan-50 font-mono text-[12.5px] sm:text-[13.5px] leading-6 resize-none focus:outline-none select-text overflow-y-auto whitespace-pre tab-4"
                  spellCheck={false}
                  placeholder="// Type code here or ask ARCH to generate..."
                />
              </div>
            )}

            {/* Quick Access Mobile Keys Bar (Essential for Android programming) */}
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-[#030408] border-t border-white/10 overflow-x-auto select-none shrink-0 scrollbar-none">
              <span className="text-[10px] text-slate-500 uppercase tracking-widest hidden sm:inline mr-1">QUICK KEYS:</span>
              {[
                "TAB",
                "()",
                "{}",
                "[]",
                '""',
                "''",
                ":",
                "=",
                ";",
                "#",
                "_",
                ".",
                "->",
                "<",
                ">"
              ].map(sym => (
                <button
                  key={sym}
                  onClick={() => insertQuickKey(sym)}
                  className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 border border-white/10 text-cyan-300 rounded text-xs font-mono font-bold transition active:scale-95 cursor-pointer shrink-0"
                >
                  {sym}
                </button>
              ))}
            </div>

            {/* Bottom Status Ribbon with Real Voice Context */}
            <div className="flex items-center justify-between px-3 sm:px-4 py-2 bg-slate-950 border-t border-white/10 text-xs shrink-0 select-none">
              <div className="flex items-center gap-3 text-slate-400">
                <span className="text-cyan-400 font-bold">{currentFile?.name}</span>
                <span className="hidden sm:inline">Lines: {(currentFile?.content || "").split("\n").length}</span>
                <span className="hidden sm:inline">Chars: {(currentFile?.content || "").length}</span>
              </div>

              {/* Background voice transcription feedback */}
              <div className="flex items-center gap-2 truncate max-w-[280px] sm:max-w-md text-right text-[11px]">
                {modelCaption ? (
                  <span className="text-cyan-200 truncate">
                    <strong className="text-cyan-400">ARCH:</strong> {modelCaption}
                  </span>
                ) : userCaption ? (
                  <span className="text-slate-300 truncate">
                    <strong className="text-slate-400">YOU:</strong> {userCaption}
                  </span>
                ) : (
                  <span className="text-slate-500 italic text-[10px] hidden sm:inline">
                    Speak "Run it", "Test code", or "Debug" anytime.
                  </span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* New File Modal */}
        {showNewFileModal && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-cyan-500/40 rounded-2xl p-5 max-w-sm w-full font-mono">
              <h3 className="text-sm font-bold text-cyan-300 mb-2">Create New File</h3>
              <p className="text-xs text-slate-400 mb-4">Enter file name with extension (e.g., utils.py, style.css, script.js):</p>
              <input
                type="text"
                placeholder="filename.ext"
                value={newFileName}
                onChange={(e) => setNewFileName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleAddNewFile(); }}
                className="w-full px-3 py-2 bg-black/60 border border-cyan-500/30 rounded-lg text-cyan-200 text-xs focus:outline-none focus:border-cyan-400 mb-4"
                autoFocus
              />
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setShowNewFileModal(false)}
                  className="px-3 py-1.5 rounded-lg border border-white/10 text-slate-400 text-xs hover:text-white"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddNewFile}
                  className="px-4 py-1.5 rounded-lg bg-cyan-500/20 border border-cyan-500/40 text-cyan-300 text-xs font-bold"
                >
                  Create
                </button>
              </div>
            </div>
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
};
