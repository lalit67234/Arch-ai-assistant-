/**
 * ARCH Unified Native Bridge Web Adapter
 *
 * Provides typed, structured request-response communication between the
 * React SPA and the native Android Kotlin runtime:
 * window.archNative.execute({ requestId, action, args })
 *
 * Implements explicit, distinct error codes and graceful web sandbox fallback.
 */

export type ArchErrorCode =
  | "APP_NOT_INSTALLED"
  | "APP_NOT_LAUNCHABLE"
  | "PERMISSION_DENIED"
  | "NETWORK_UNAVAILABLE"
  | "AI_API_ERROR"
  | "REQUEST_TIMEOUT"
  | "AUTHENTICATION_REQUIRED"
  | "UNSUPPORTED_OPERATION"
  | "BRIDGE_UNAVAILABLE"
  | "EXECUTION_UNVERIFIED";

export interface ArchNativeRequest {
  requestId: string;
  action: string;
  args?: Record<string, any>;
}

export interface ArchNativeResponse<T = any> {
  requestId: string;
  success: boolean;
  data?: T;
  errorCode?: ArchErrorCode;
  errorMessage?: string;
}

export interface DeviceCapabilities {
  isNativeBridge: boolean;
  platform: "android" | "web";
  sdkInt?: number;
  hasPackageManager: boolean;
  hasAlarmManager: boolean;
  hasForegroundMicrophone: boolean;
  hasMediaSession: boolean;
  hasRoomDatabase: boolean;
  capabilities: string[];
}

class ArchNativeBridgeAdapter {
  private static instance: ArchNativeBridgeAdapter;

  private constructor() {}

  public static getInstance(): ArchNativeBridgeAdapter {
    if (!ArchNativeBridgeAdapter.instance) {
      ArchNativeBridgeAdapter.instance = new ArchNativeBridgeAdapter();
    }
    return ArchNativeBridgeAdapter.instance;
  }

  /**
   * Detects whether ARCH is currently running inside the native Android Kotlin wrapper.
   */
  public isNative(): boolean {
    if (typeof window === "undefined") return false;
    const w = window as any;
    return Boolean(w.archNative || w.ArchAndroid || w.AndroidBridge || w.Android);
  }

  /**
   * Executes a structured request on the native Android bridge with timeout protection.
   */
  public async execute<T = any>(
    action: string,
    args: Record<string, any> = {},
    timeoutMs: number = 8000
  ): Promise<ArchNativeResponse<T>> {
    const requestId = typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `req_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    if (!this.isNative()) {
      return this.handleWebFallback<T>(requestId, action, args);
    }

    const w = window as any;
    const bridgeObj = w.archNative || w.ArchAndroid || w.AndroidBridge || w.Android;

    return new Promise<ArchNativeResponse<T>>((resolve) => {
      const timer = setTimeout(() => {
        resolve({
          requestId,
          success: false,
          errorCode: "REQUEST_TIMEOUT",
          errorMessage: `Native bridge request '${action}' timed out after ${timeoutMs}ms.`
        });
      }, timeoutMs);

      try {
        if (typeof bridgeObj.execute === "function") {
          const reqPayload = JSON.stringify({ requestId, action, args });
          const rawResponse = bridgeObj.execute(reqPayload);
          clearTimeout(timer);

          if (rawResponse) {
            const parsed = typeof rawResponse === "string" ? JSON.parse(rawResponse) : rawResponse;
            resolve(parsed);
          } else {
            resolve({
              requestId,
              success: false,
              errorCode: "EXECUTION_UNVERIFIED",
              errorMessage: "Bridge returned an empty response."
            });
          }
        } else {
          // Compatibility with legacy methods
          clearTimeout(timer);
          this.executeLegacyFallback<T>(requestId, action, args, bridgeObj).then(resolve);
        }
      } catch (err: any) {
        clearTimeout(timer);
        resolve({
          requestId,
          success: false,
          errorCode: "EXECUTION_UNVERIFIED",
          errorMessage: `Native execution failed: ${err?.message || err}`
        });
      }
    });
  }

  /**
   * Maps actions to legacy native bridge methods if modern execute() is absent.
   */
  private async executeLegacyFallback<T>(
    requestId: string,
    action: string,
    args: Record<string, any>,
    nativeObj: any
  ): Promise<ArchNativeResponse<T>> {
    try {
      switch (action) {
        case "app.launch": {
          const target = args.appName || args.packageName || "";
          if (typeof nativeObj.launchApp === "function") {
            const res = nativeObj.launchApp(target);
            const parsed = typeof res === "string" ? JSON.parse(res) : res;
            return {
              requestId,
              success: Boolean(parsed.success),
              data: parsed,
              errorCode: parsed.success ? undefined : (parsed.errorCode || "APP_NOT_LAUNCHABLE"),
              errorMessage: parsed.errorMessage
            };
          }
          break;
        }
        case "camera.open": {
          if (typeof nativeObj.openCamera === "function") {
            const ok = nativeObj.openCamera();
            return { requestId, success: Boolean(ok), data: { opened: ok } as any };
          }
          break;
        }
        case "system.openSettings": {
          if (typeof nativeObj.openSettings === "function") {
            const ok = nativeObj.openSettings();
            return { requestId, success: Boolean(ok), data: { opened: ok } as any };
          }
          break;
        }
        case "app.list": {
          if (typeof nativeObj.getInstalledApps === "function") {
            const appsStr = nativeObj.getInstalledApps();
            const apps = typeof appsStr === "string" ? JSON.parse(appsStr) : appsStr;
            return { requestId, success: true, data: { apps } as any };
          }
          break;
        }
      }
    } catch (e: any) {
      return {
        requestId,
        success: false,
        errorCode: "EXECUTION_UNVERIFIED",
        errorMessage: e?.message || "Legacy call failed"
      };
    }

    return {
      requestId,
      success: false,
      errorCode: "UNSUPPORTED_OPERATION",
      errorMessage: `Action '${action}' is not supported by this native bridge version.`
    };
  }

  /**
   * Graceful fallback when running in a normal web browser.
   */
  private handleWebFallback<T>(
    requestId: string,
    action: string,
    args: Record<string, any>
  ): ArchNativeResponse<T> {
    switch (action) {
      case "app.launch": {
        const appName = (args.appName || args.packageName || "").toLowerCase();
        let fallbackUrl = "";
        if (appName.includes("youtube")) fallbackUrl = "https://m.youtube.com";
        else if (appName.includes("spotify")) fallbackUrl = "https://open.spotify.com";
        else if (appName.includes("chrome") || appName.includes("browser")) fallbackUrl = "https://google.com";
        else if (appName.includes("map")) fallbackUrl = "https://maps.google.com";
        else if (appName.includes("play")) fallbackUrl = "https://play.google.com/store";
        else if (appName.includes("pinterest")) fallbackUrl = "https://pinterest.com";

        if (fallbackUrl) {
          window.open(fallbackUrl, "_blank", "noopener,noreferrer");
          return {
            requestId,
            success: true,
            data: { openedInBrowser: true, url: fallbackUrl } as any
          };
        }
        return {
          requestId,
          success: false,
          errorCode: "APP_NOT_INSTALLED",
          errorMessage: `Native app launching is only available inside the ARCH Android APK.`
        };
      }

      case "media.search": {
        const query = encodeURIComponent(args.query || "");
        const target = args.target || "youtube";
        const url = target === "spotify"
          ? `https://open.spotify.com/search/${query}`
          : `https://www.youtube.com/results?search_query=${query}`;
        window.open(url, "_blank", "noopener,noreferrer");
        return { requestId, success: true, data: { openedInBrowser: true, url } as any };
      }

      case "memory.write": {
        try {
          const memories = JSON.parse(localStorage.getItem("arch_vault_memories") || "[]");
          memories.push({
            id: args.id || `mem_${Date.now()}`,
            key: args.key,
            category: args.category || "preference",
            content: args.content,
            updatedAt: Date.now()
          });
          localStorage.setItem("arch_vault_memories", JSON.stringify(memories));
          return { requestId, success: true, data: { savedLocally: true } as any };
        } catch (e: any) {
          return { requestId, success: false, errorCode: "EXECUTION_UNVERIFIED", errorMessage: e.message };
        }
      }

      case "memory.read": {
        try {
          const memories = JSON.parse(localStorage.getItem("arch_vault_memories") || "[]");
          return { requestId, success: true, data: { memories } as any };
        } catch (e: any) {
          return { requestId, success: false, errorCode: "EXECUTION_UNVERIFIED", errorMessage: e.message };
        }
      }

      case "device.getSupportedCapabilities": {
        return {
          requestId,
          success: true,
          data: {
            isNativeBridge: false,
            platform: "web",
            hasPackageManager: false,
            hasAlarmManager: false,
            hasForegroundMicrophone: false,
            hasMediaSession: false,
            hasRoomDatabase: false,
            capabilities: ["memory.read", "memory.write", "media.search"]
          } as any
        };
      }

      default:
        return {
          requestId,
          success: false,
          errorCode: "BRIDGE_UNAVAILABLE",
          errorMessage: `Action '${action}' requires the native Android APK environment.`
        };
    }
  }

  // --- Convenience Methods ---

  public async launchApp(appNameOrPackage: string): Promise<ArchNativeResponse> {
    return this.execute("app.launch", { appName: appNameOrPackage });
  }

  public async listInstalledApps(): Promise<ArchNativeResponse<{ apps: { name: string; packageName: string }[] }>> {
    return this.execute("app.list");
  }

  public async isAppInstalled(packageName: string): Promise<boolean> {
    const res = await this.execute("app.isInstalled", { packageName });
    return Boolean(res.data?.isInstalled);
  }

  public async openCamera(): Promise<ArchNativeResponse> {
    return this.execute("camera.open");
  }

  public async openSettings(): Promise<ArchNativeResponse> {
    return this.execute("system.openSettings");
  }

  public async searchMedia(query: string, target: "youtube" | "spotify" = "youtube"): Promise<ArchNativeResponse> {
    return this.execute("media.search", { query, target });
  }

  public async controlMedia(command: "play" | "pause" | "next" | "prev" | "volume", extra: Record<string, any> = {}): Promise<ArchNativeResponse> {
    return this.execute("media.control", { command, ...extra });
  }

  public async createReminder(title: string, triggerTimeMillis: number, recurrence: string = "none"): Promise<ArchNativeResponse> {
    return this.execute("reminders.create", { title, triggerTimeMillis, recurrence });
  }

  public async cancelReminder(id: string): Promise<ArchNativeResponse> {
    return this.execute("reminders.cancel", { id });
  }

  public async listReminders(): Promise<ArchNativeResponse<{ reminders: any[] }>> {
    return this.execute("reminders.list");
  }

  public async writeMemory(key: string, content: string, category: string = "preference"): Promise<ArchNativeResponse> {
    return this.execute("memory.write", { key, content, category });
  }

  public async readMemory(query: string = ""): Promise<ArchNativeResponse<{ memories: any[] }>> {
    return this.execute("memory.read", { query });
  }

  public async deleteMemory(id: string): Promise<ArchNativeResponse> {
    return this.execute("memory.delete", { id });
  }

  public async startBackgroundListening(): Promise<ArchNativeResponse> {
    return this.execute("service.startBackgroundListening");
  }

  public async stopBackgroundListening(): Promise<ArchNativeResponse> {
    return this.execute("service.stopBackgroundListening");
  }

  public async getServiceStatus(): Promise<ArchNativeResponse<{ isServiceRunning: boolean; isListeningActive: boolean; sdkInt?: number }>> {
    return this.execute("service.getStatus");
  }

  public async getDeviceCapabilities(): Promise<ArchNativeResponse<DeviceCapabilities>> {
    return this.execute("device.getSupportedCapabilities");
  }
}

export const archNativeBridge = ArchNativeBridgeAdapter.getInstance();
