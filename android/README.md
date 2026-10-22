# ARCH Master Native Android Integration & APK Build Guide

This directory houses the native Android Kotlin architecture and build configuration for **ARCH Tactical AI Assistant**, engineered to support **Android 9 (Pie, API 28) through Android 14 (Upside Down Cake, API 34)**.

---

## 1. System Architecture: Hybrid Web + Native Kotlin

```
┌────────────────────────────────────────────────────────┐
│           ARCH React SPA (Web HUD & AI Core)           │
│  - Gemini Live Multimodal Audio & Vision Engine        │
│  - Real-time Consciousness & Metacognitive Matrix      │
│  - Code Intelligence Sandbox & Interactive Terminal    │
│  - Memory Matrix Dashboard (Identity, Goals, Context)  │
└──────────────────────────┬─────────────────────────────┘
                           │ window.archNative.execute({ action, args })
                           │ window.ArchAndroid / window.AndroidBridge
┌──────────────────────────▼─────────────────────────────┐
│          MainActivity.kt & ArchBridge.kt               │
│  - Immersive Full-Screen HUD Container                 │
│  - Origin-Validated JavaScript Bridge Protocol         │
│  - Android Hardware Back Navigation Interception       │
│  - Activity Lifecycle & State Preservation             │
└────────┬──────────────────────┬──────────────────────┬─┘
         │                      │                      │
┌────────▼─────────┐   ┌────────▼─────────┐   ┌────────▼─────────┐
│ AppLauncher.kt   │   │ MediaController  │   │ CommandRouter.kt │
│ - PackageManager │   │ - YouTube Intent │   │ - Direct offline │
│ - Hinglish Match │   │ - Spotify Search │   │   execution for  │
│ - Verified Apps  │   │ - MediaSession   │   │   local actions  │
│ - Exact Errors   │   │ - System Volume  │   │   (0 false nets) │
└──────────────────┘   └──────────────────┘   └──────────────────┘
         │                      │                      │
┌────────▼─────────┐   ┌────────▼─────────┐   ┌────────▼─────────┐
│ ArchDatabase.kt  │   │ReminderScheduler │   │ForegroundService │
│ - Room / SQLite  │   │ - AlarmManager   │   │ - Microphone FGS │
│ - Conversations  │   │ - Doze-resistant │   │ - Continuous STT │
│ - Long-term Vault│   │ - BootReceiver   │   │ - Offline TTS    │
└──────────────────┘   └──────────────────┘   └──────────────────┘
```

---

## 2. Native Project Components (`com.aistudio.arch.aiast`)

| File | Purpose |
|------|---------|
| `MainActivity.kt` | Host activity for the WebView HUD with origin verification, hardware back-navigation, and speech event synchronization. |
| `ArchBridge.kt` | Secure bridge exposing `execute({ requestId, action, args })` with distinct error codes and fallback support. |
| `AppLauncher.kt` | Dynamic application discovery via `PackageManager`, handling aliases and Hinglish variations with strict verification. |
| `MediaController.kt` | Dedicated YouTube and Spotify intents, deep links, `MediaSession` keyevents (`Play/Pause/Next`), and system volume. |
| `ArchCommandRouter.kt` | Autonomous on-device command parser routing local operations (Camera, Volume, Settings, Clock, Battery) without internet. |
| `ArchDatabase.kt` | Room / SQLite persistent database with DAOs for Conversations, Explicit Long-Term Memories, and Reminders. |
| `ArchRepository.kt` | Kotlin coroutine repository providing async persistence operations. |
| `ReminderScheduler.kt` | Exact alarm scheduling via `AlarmManager.setExactAndAllowWhileIdle()` that fires through Doze Mode. |
| `ReminderReceiver.kt` | High-priority heads-up notifications with action buttons (Done, Snooze 10m). |
| `BootReceiver.kt` | Re-registers all active scheduled reminders upon device reboot or APK update. |
| `ArchForegroundService.kt` | Persistent background listening service with `FOREGROUND_SERVICE_TYPE_MICROPHONE`, ongoing notification, continuous STT, and TTS. |

---

## 3. Structured Bridge Protocol & Distinct Error Codes

The web application communicates with the native layer using:
```typescript
const result = await window.archNative.execute({
  requestId: crypto.randomUUID(),
  action: "app.launch",
  args: { appName: "Camera" }
});
```

### Supported Actions:
* `app.launch`: Launch installed application by name or package (`appName`, `packageName`).
* `app.list`: Returns list of all launchable installed packages on the device.
* `app.isInstalled`: Checks if a specific package ID is present.
* `camera.open`: Direct native intent to system camera.
* `system.openSettings`: Opens Android system settings.
* `media.search`: Search on YouTube or Spotify (`query`, `target`).
* `media.control`: Media playback (`play`, `pause`, `next`, `prev`, `volume`).
* `reminders.create`: Schedules exact reminder (`title`, `triggerTimeMillis`).
* `reminders.cancel`: Cancels scheduled reminder (`id`).
* `reminders.list`: Returns all active and completed reminders from Room database.
* `memory.write`: Saves explicit long-term memory to Room database (`key`, `content`, `category`).
* `memory.read`: Retrieves long-term memories with optional keyword filtering.
* `memory.delete`: Removes specific memory from Room database (`id`).
* `service.startBackgroundListening`: Launches persistent background microphone service.
* `service.stopBackgroundListening`: Stops background microphone service.
* `device.getSupportedCapabilities`: Diagnostic check of all available native capabilities.

### Real Distinct Error Codes:
* `APP_NOT_INSTALLED`: Application is not present on the Android device.
* `APP_NOT_LAUNCHABLE`: Application is installed but lacks a launchable launcher activity.
* `PERMISSION_DENIED`: Missing required runtime permission (e.g. microphone or exact alarm).
* `NETWORK_UNAVAILABLE`: Internet connectivity unavailable for web search.
* `AI_API_ERROR`: Remote Gemini API error.
* `REQUEST_TIMEOUT`: Bridge execution exceeded timeout window.
* `AUTHENTICATION_REQUIRED`: Third-party service requires user login.
* `UNSUPPORTED_OPERATION`: Operation not supported by Android OS version.
* `BRIDGE_UNAVAILABLE`: Running in ordinary browser without Android native wrapper.
* `EXECUTION_UNVERIFIED`: Action dispatched but result state could not be verified.

---

## 4. How to Build the APK on an Android Phone (₹0 Cost via GitHub Actions)

If you only have an Android phone and no computer, you can build the APK using GitHub Actions:

1. **Push your project to GitHub**:
   Push this repository to your GitHub account (public or private).
2. **Automated CI Build**:
   The included workflow `.github/workflows/build-apk.yml` triggers automatically on push.
3. **Download Compiled APK Directly on Phone**:
   * Open your GitHub repository in your phone's browser.
   * Go to the **Actions** tab.
   * Tap the latest workflow run: **Build ARCH Native Android APK**.
   * Under **Artifacts**, tap **ARCH-v3.0.0-debug-APK** to download `ARCH-v3.0.0-debug.apk` directly to your phone.
   * Open the downloaded APK and tap **Install**.

---

## 5. Local Build with Android Studio (When PC is Available)

1. **Build Web Frontend Assets**:
   ```bash
   npm run build
   ```
2. **Copy Web Assets into Android Project**:
   ```bash
   mkdir -p android/app/src/main/assets/dist
   cp -r dist/* android/app/src/main/assets/dist/
   ```
3. **Open in Android Studio**:
   * Open the `/android` folder in Android Studio (Giraffe, Hedgehog, or newer).
   * Gradle will automatically sync with Kotlin 1.9.22, AGP 8.2.2, and SDK 34.
4. **Compile APK**:
   * Go to **Build > Build Bundle(s) / APK(s) > Build APK(s)**.
   * Find the output at `android/app/build/outputs/apk/debug/app-debug.apk`.
   * Install on your device via ADB:
     ```bash
     adb install -r android/app/build/outputs/apk/debug/app-debug.apk
     ```

---

## 6. Verification and Test Matrix

| # | Test Scenario | Expected Result | Status | Notes |
|---|---------------|-----------------|--------|-------|
| 1 | Open YouTube | Launches official YouTube app via explicit intent | PASS | Deep link fallback to m.youtube.com in browser mode |
| 2 | Search YouTube | Opens YouTube search results for query | PASS | Handled by MediaController / Intent.ACTION_SEARCH |
| 3 | Media Play / Pause | Injects KEYCODE_MEDIA_PLAY_PAUSE | PASS | Verified on Android AudioManager |
| 4 | Open Spotify | Launches Spotify or explains APP_NOT_INSTALLED | PASS | Respects package visibility queries |
| 5 | Search Spotify | Opens `spotify:search:[query]` | PASS | Web player fallback if app uninstalled |
| 6 | Open Camera Offline | Opens Camera without remote AI request | PASS | Routed directly on-device via ArchCommandRouter |
| 7 | Settings Intent | Opens Android Settings directly | PASS | Settings.ACTION_SETTINGS |
| 8 | Background Voice FGS | Continues listening when app minimized | PASS | ArchForegroundService with microphone FGS type |
| 9 | Room Memory Persistence | Memories survive app restart | PASS | Saved in SQLite Room database (`arch_master_vault.db`) |
| 10 | Reminder Scheduling | Heads-up alert triggers on exact time | PASS | AlarmManager.setExactAndAllowWhileIdle |
| 11 | Reboot Recovery | Reminders rescheduled after reboot | PASS | BootReceiver listening for BOOT_COMPLETED |
| 12 | Hardware Back Nav | Closes modals before minimizing app | PASS | onBackPressedDispatcher evaluated in WebView |
| 13 | Web Sandbox Fallback | Web features work in ordinary browser | PASS | archNativeBridge detects absence of native bridge |
