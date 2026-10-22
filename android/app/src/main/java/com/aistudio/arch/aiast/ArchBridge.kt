package com.aistudio.arch.aiast

import android.content.Context
import android.content.Intent
import android.os.Build
import android.util.Log
import android.webkit.JavascriptInterface
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.runBlocking
import org.json.JSONArray
import org.json.JSONObject
import java.util.UUID

/**
 * ARCH Secure JavaScript-to-Native Android Bridge
 *
 * Implements the structured request-response protocol for:
 * window.archNative.execute({ requestId, action, args })
 *
 * Distinct Error Codes:
 * - APP_NOT_INSTALLED
 * - APP_NOT_LAUNCHABLE
 * - PERMISSION_DENIED
 * - NETWORK_UNAVAILABLE
 * - AI_API_ERROR
 * - REQUEST_TIMEOUT
 * - AUTHENTICATION_REQUIRED
 * - UNSUPPORTED_OPERATION
 * - BRIDGE_UNAVAILABLE
 * - EXECUTION_UNVERIFIED
 */
class ArchBridge(private val context: Context, private val activity: MainActivity) {

    private val TAG = "ArchBridge"
    private val appLauncher = AppLauncher(context)
    private val mediaController = MediaController(context)
    private val reminderScheduler = ReminderScheduler(context)
    private val repository = ArchRepository(context)

    /**
     * Primary structured JSON invocation entry point.
     * Web call: window.archNative.execute(JSON.stringify({ requestId, action, args }))
     */
    @JavascriptInterface
    fun execute(requestJson: String?): String {
        if (requestJson.isNullOrBlank()) {
            return buildErrorResponse("unknown", "UNSUPPORTED_OPERATION", "Empty request payload")
        }

        return try {
            val request = JSONObject(requestJson)
            val requestId = request.optString("requestId", UUID.randomUUID().toString())
            val action = request.optString("action", "")
            val args = request.optJSONObject("args") ?: JSONObject()

            Log.d(TAG, "Bridge execute [$requestId]: action='$action'")

            when (action) {
                // --- Application Launching ---
                "app.launch" -> {
                    val appName = args.optString("appName", "")
                    val packageName = args.optString("packageName", "")
                    val target = if (appName.isNotBlank()) appName else packageName

                    if (target.isBlank()) {
                        buildErrorResponse(requestId, "UNSUPPORTED_OPERATION", "No appName or packageName provided")
                    } else {
                        val result = appLauncher.launchApp(target)
                        if (result.success) {
                            buildSuccessResponse(requestId, result.toJsonObject())
                        } else {
                            buildErrorResponse(
                                requestId,
                                result.errorCode ?: "APP_NOT_LAUNCHABLE",
                                result.errorMessage ?: "Failed to launch $target"
                            )
                        }
                    }
                }

                "app.list" -> {
                    val apps = appLauncher.getLaunchableAppsJson()
                    buildSuccessResponse(requestId, JSONObject().apply {
                        put("apps", JSONArray(apps))
                    })
                }

                "app.isInstalled" -> {
                    val packageName = args.optString("packageName", "")
                    val isInstalled = appLauncher.isPackageInstalled(packageName)
                    buildSuccessResponse(requestId, JSONObject().apply {
                        put("packageName", packageName)
                        put("isInstalled", isInstalled)
                    })
                }

                // --- System Operations ---
                "camera.open" -> {
                    val result = appLauncher.launchApp("Camera")
                    if (result.success) {
                        buildSuccessResponse(requestId, JSONObject().apply { put("message", "Camera opened") })
                    } else {
                        buildErrorResponse(requestId, result.errorCode ?: "APP_NOT_LAUNCHABLE", result.errorMessage ?: "Camera open failed")
                    }
                }

                "system.openSettings" -> {
                    val result = appLauncher.launchApp("Android Settings")
                    if (result.success) {
                        buildSuccessResponse(requestId, JSONObject().apply { put("message", "Settings opened") })
                    } else {
                        buildErrorResponse(requestId, result.errorCode ?: "APP_NOT_LAUNCHABLE", result.errorMessage ?: "Settings open failed")
                    }
                }

                // --- Media Operations ---
                "media.search" -> {
                    val target = args.optString("target", "youtube").lowercase()
                    val query = args.optString("query", "")
                    val result = when (target) {
                        "spotify" -> mediaController.searchSpotify(query)
                        else -> mediaController.searchYouTube(query)
                    }
                    if (result.success) {
                        buildSuccessResponse(requestId, result.toJsonObject())
                    } else {
                        buildErrorResponse(requestId, result.errorCode ?: "APP_NOT_LAUNCHABLE", result.details)
                    }
                }

                "media.control" -> {
                    val command = args.optString("command", "").lowercase()
                    val result = when (command) {
                        "play", "pause", "toggle" -> mediaController.togglePlayPause()
                        "next" -> mediaController.nextTrack()
                        "prev", "previous" -> mediaController.previousTrack()
                        "volume" -> {
                            val dir = args.optString("direction", "up")
                            val pct = if (args.has("percent")) args.optInt("percent") else null
                            mediaController.adjustVolume(dir, pct)
                        }
                        else -> MediaController.MediaActionResult(false, "System", command, "Unknown media command", "UNSUPPORTED_OPERATION")
                    }
                    if (result.success) {
                        buildSuccessResponse(requestId, result.toJsonObject())
                    } else {
                        buildErrorResponse(requestId, result.errorCode ?: "UNSUPPORTED_OPERATION", result.details)
                    }
                }

                // --- Persistent Reminders ---
                "reminders.create" -> {
                    val title = args.optString("title", "ARCH Reminder")
                    val triggerTime = args.optLong("triggerTimeMillis", System.currentTimeMillis() + 60000)
                    val reminderId = args.optString("id", UUID.randomUUID().toString())
                    val recurrence = args.optString("recurrence", "none")

                    val reminder = ReminderEntity(
                        id = reminderId,
                        title = title,
                        triggerTimeMillis = triggerTime,
                        recurrence = recurrence
                    )

                    runBlocking { repository.saveReminder(reminder) }
                    val scheduled = reminderScheduler.scheduleReminder(reminder)

                    if (scheduled) {
                        buildSuccessResponse(requestId, JSONObject().apply {
                            put("id", reminder.id)
                            put("title", reminder.title)
                            put("triggerTimeMillis", reminder.triggerTimeMillis)
                            put("scheduled", true)
                        })
                    } else {
                        buildErrorResponse(requestId, "EXECUTION_UNVERIFIED", "Could not schedule alarm with AlarmManager")
                    }
                }

                "reminders.cancel" -> {
                    val id = args.optString("id", "")
                    if (id.isBlank()) {
                        buildErrorResponse(requestId, "UNSUPPORTED_OPERATION", "Reminder id required")
                    } else {
                        reminderScheduler.cancelReminder(id)
                        runBlocking { repository.cancelReminder(id) }
                        buildSuccessResponse(requestId, JSONObject().apply { put("cancelled", true); put("id", id) })
                    }
                }

                "reminders.list" -> {
                    val reminders = runBlocking { repository.getAllReminders() }
                    val array = JSONArray()
                    for (r in reminders) {
                        array.put(JSONObject().apply {
                            put("id", r.id)
                            put("title", r.title)
                            put("triggerTimeMillis", r.triggerTimeMillis)
                            put("isCompleted", r.isCompleted)
                            put("isCancelled", r.isCancelled)
                        })
                    }
                    buildSuccessResponse(requestId, JSONObject().apply { put("reminders", array) })
                }

                // --- Long-Term Vault Memory ---
                "memory.write" -> {
                    val id = args.optString("id", UUID.randomUUID().toString())
                    val key = args.optString("key", "preference")
                    val category = args.optString("category", "preference")
                    val content = args.optString("content", "")

                    if (content.isBlank()) {
                        buildErrorResponse(requestId, "UNSUPPORTED_OPERATION", "Memory content cannot be empty")
                    } else {
                        runBlocking { repository.saveMemory(id, key, category, content) }
                        buildSuccessResponse(requestId, JSONObject().apply {
                            put("id", id)
                            put("saved", true)
                        })
                    }
                }

                "memory.read" -> {
                    val query = args.optString("query", "")
                    val memories = runBlocking {
                        if (query.isNotBlank()) repository.searchMemories(query) else repository.getAllMemories()
                    }
                    val array = JSONArray()
                    for (m in memories) {
                        array.put(JSONObject().apply {
                            put("id", m.id)
                            put("key", m.key)
                            put("category", m.category)
                            put("content", m.content)
                            put("updatedAt", m.updatedAt)
                        })
                    }
                    buildSuccessResponse(requestId, JSONObject().apply { put("memories", array) })
                }

                "memory.delete" -> {
                    val id = args.optString("id", "")
                    val deleted = runBlocking { repository.deleteMemory(id) }
                    buildSuccessResponse(requestId, JSONObject().apply { put("deleted", deleted) })
                }

                // --- Background Listening Service Controls ---
                "service.startBackgroundListening" -> {
                    val intent = Intent(context, ArchForegroundService::class.java).apply {
                        action = ArchForegroundService.ACTION_START
                    }
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                        context.startForegroundService(intent)
                    } else {
                        context.startService(intent)
                    }
                    buildSuccessResponse(requestId, JSONObject().apply {
                        put("status", "started")
                        put("foregroundServiceType", "microphone")
                    })
                }

                "service.stopBackgroundListening" -> {
                    val intent = Intent(context, ArchForegroundService::class.java).apply {
                        action = ArchForegroundService.ACTION_STOP
                    }
                    context.startService(intent)
                    buildSuccessResponse(requestId, JSONObject().apply {
                        put("status", "stopped")
                    })
                }

                "service.getStatus" -> {
                    buildSuccessResponse(requestId, JSONObject().apply {
                        put("isServiceRunning", ArchForegroundService.isServiceRunning)
                        put("isListeningActive", ArchForegroundService.isListeningActive)
                        put("sdkInt", Build.VERSION.SDK_INT)
                    })
                }

                // --- Device Capabilities Diagnostic ---
                "device.getSupportedCapabilities" -> {
                    buildSuccessResponse(requestId, JSONObject().apply {
                        put("isNativeBridge", true)
                        put("platform", "android")
                        put("sdkInt", Build.VERSION.SDK_INT)
                        put("hasPackageManager", true)
                        put("hasAlarmManager", true)
                        put("hasForegroundMicrophone", true)
                        put("hasMediaSession", true)
                        put("hasRoomDatabase", true)
                        put("capabilities", JSONArray().apply {
                            put("app.launch")
                            put("app.list")
                            put("camera.open")
                            put("system.openSettings")
                            put("media.search")
                            put("media.control")
                            put("reminders.create")
                            put("reminders.cancel")
                            put("reminders.list")
                            put("memory.read")
                            put("memory.write")
                            put("memory.delete")
                            put("service.startBackgroundListening")
                            put("service.stopBackgroundListening")
                        })
                    })
                }

                else -> {
                    buildErrorResponse(requestId, "UNSUPPORTED_OPERATION", "Unknown action: '$action'")
                }
            }
        } catch (e: Exception) {
            Log.e(TAG, "Bridge execution error: ${e.message}", e)
            buildErrorResponse("error", "EXECUTION_UNVERIFIED", "Bridge exception: ${e.message}")
        }
    }

    // --- Legacy Bridge Compatibility for window.ArchAndroid / window.AndroidBridge ---

    @JavascriptInterface
    fun isNative(): Boolean = true

    @JavascriptInterface
    fun isAppInstalled(nameOrPackage: String?): Boolean {
        if (nameOrPackage.isNullOrBlank()) return false
        val resolved = appLauncher.resolveApp(nameOrPackage)
        return resolved?.isInstalled ?: false
    }

    @JavascriptInterface
    fun getInstalledApps(): String = appLauncher.getLaunchableAppsJson()

    @JavascriptInterface
    fun launchApp(nameOrPackage: String?): String {
        if (nameOrPackage.isNullOrBlank()) {
            return JSONObject().apply {
                put("success", false)
                put("errorCode", "UNSUPPORTED_OPERATION")
                put("errorMessage", "No application specified")
            }.toString()
        }
        return appLauncher.launchApp(nameOrPackage).toJsonObject().toString()
    }

    @JavascriptInterface
    fun openCamera(): Boolean {
        return appLauncher.launchApp("Camera").success
    }

    @JavascriptInterface
    fun openSettings(): Boolean {
        return appLauncher.launchApp("Android Settings").success
    }

    @JavascriptInterface
    fun adjustVolume(dir: String): String {
        return mediaController.adjustVolume(dir).toJsonObject().toString()
    }

    private fun buildSuccessResponse(requestId: String, data: JSONObject): String {
        return JSONObject().apply {
            put("requestId", requestId)
            put("success", true)
            put("data", data)
        }.toString()
    }

    private fun buildErrorResponse(requestId: String, errorCode: String, errorMessage: String): String {
        return JSONObject().apply {
            put("requestId", requestId)
            put("success", false)
            put("errorCode", errorCode)
            put("errorMessage", errorMessage)
        }.toString()
    }
}
