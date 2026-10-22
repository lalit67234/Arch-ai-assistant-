package com.aistudio.arch.aiast

import android.content.Context
import android.os.BatteryManager
import android.os.Build
import android.util.Log
import org.json.JSONObject
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.UUID

/**
 * ARCH Native Command Router (Offline Device Execution)
 *
 * Evaluates spoken & text commands directly on the Android device without requiring
 * an active cloud AI connection. Routes immediately to:
 * - AppLauncher (YouTube, Spotify, Camera, WhatsApp, Settings, Chrome, etc.)
 * - MediaController (Volume, Play/Pause, Track Skipping, YouTube Search)
 * - ReminderScheduler (Natural Language time parsing)
 * - ArchRepository (Local long-term memories)
 * - Device Diagnostics (Battery, Clock)
 *
 * Eliminates false "Network Unavailable" errors for local Android operations!
 */
class ArchCommandRouter(private val context: Context) {

    private val TAG = "ArchCommandRouter"
    private val appLauncher = AppLauncher(context)
    private val mediaController = MediaController(context)
    private val reminderScheduler = ReminderScheduler(context)
    private val repository = ArchRepository(context)

    data class RouterResult(
        val isHandledLocally: Boolean,
        val success: Boolean,
        val action: String,
        val spokenResponse: String,
        val errorCode: String? = null,
        val data: JSONObject? = null
    ) {
        fun toJsonObject(): JSONObject = JSONObject().apply {
            put("isHandledLocally", isHandledLocally)
            put("success", success)
            put("action", action)
            put("spokenResponse", spokenResponse)
            if (!success && errorCode != null) {
                put("errorCode", errorCode)
            }
            if (data != null) {
                put("data", data)
            }
        }
    }

    /**
     * Attempts to resolve and execute the command entirely on-device.
     * Returns RouterResult with isHandledLocally = false if the request requires generative AI reasoning.
     */
    suspend fun routeCommand(rawText: String): RouterResult {
        val text = rawText.trim()
        val lower = text.lowercase(Locale.ROOT)

        Log.d(TAG, "Routing command on-device: '$text'")

        // 1. App Launching Intent (English, Hindi, Hinglish)
        // e.g. "youtube kholo", "open camera", "chrome chalao", "whatsapp start karo"
        val openMatch = Regex("^(open|launch|kholo|chalao|start)\\s+(.+)$", RegexOption.IGNORE_CASE).find(lower)
            ?: Regex("^(.+)\\s+(kholo|chalao|open karo|start karo)$", RegexOption.IGNORE_CASE).find(lower)

        if (openMatch != null) {
            val appQuery = if (openMatch.groupValues.size >= 3) {
                val g1 = openMatch.groupValues[1]
                val g2 = openMatch.groupValues[2]
                if (listOf("open", "launch", "kholo", "chalao", "start").contains(g1.lowercase())) g2 else g1
            } else {
                openMatch.groupValues[1]
            }.replace(Regex("(mera|meri|my|the|app|application)"), "").trim()

            // Special device routes
            if (appQuery.contains("camera") || appQuery.contains("cam") || appQuery.contains("कैमरा")) {
                val res = appLauncher.launchApp("Camera")
                return RouterResult(
                    isHandledLocally = true,
                    success = res.success,
                    action = "camera.open",
                    spokenResponse = if (res.success) "Opening camera." else (res.errorMessage ?: "Could not open camera."),
                    errorCode = res.errorCode
                )
            }

            if (appQuery.contains("settings") || appQuery.contains("setting") || appQuery.contains("सेटिंग्स")) {
                val res = appLauncher.launchApp("Android Settings")
                return RouterResult(
                    isHandledLocally = true,
                    success = res.success,
                    action = "system.openSettings",
                    spokenResponse = if (res.success) "Opening Android system settings." else (res.errorMessage ?: "Could not open settings."),
                    errorCode = res.errorCode
                )
            }

            // General App Launch
            val launchResult = appLauncher.launchApp(appQuery)
            return RouterResult(
                isHandledLocally = true,
                success = launchResult.success,
                action = "app.launch",
                spokenResponse = if (launchResult.success) {
                    "Opening ${launchResult.appName ?: appQuery}."
                } else {
                    launchResult.errorMessage ?: "Failed to open $appQuery."
                },
                errorCode = launchResult.errorCode,
                data = launchResult.toJsonObject()
            )
        }

        // 2. YouTube Search or Play
        // e.g. "youtube par python tutorial search karo", "search youtube for lofi music"
        if (lower.contains("youtube")) {
            val searchRegex = Regex("(?:search|chalao|play|dhoondo)\\s+(?:youtube\\s+par|on\\s+youtube)?\\s*(.+)", RegexOption.IGNORE_CASE).find(lower)
                ?: Regex("youtube\\s+par\\s+(.+)\\s+(?:search|chalao|dhoondo)", RegexOption.IGNORE_CASE).find(lower)

            if (searchRegex != null) {
                val query = searchRegex.groupValues[1].replace(Regex("(search|karo|chalao|for|par)"), "").trim()
                if (query.isNotBlank()) {
                    val res = mediaController.searchYouTube(query)
                    return RouterResult(
                        isHandledLocally = true,
                        success = res.success,
                        action = "youtube.search",
                        spokenResponse = "Searching YouTube for $query.",
                        errorCode = res.errorCode,
                        data = res.toJsonObject()
                    )
                }
            }
        }

        // 3. Spotify Search or Play
        // e.g. "spotify par arijit singh ke gaane chalao", "play relaxing music on spotify"
        if (lower.contains("spotify") || lower.contains("gaana") || lower.contains("song")) {
            if (lower.contains("spotify")) {
                val spotifyRegex = Regex("spotify\\s+(?:par\\s+)?(?:play|chalao|search\\s+karo)?\\s*(.+)", RegexOption.IGNORE_CASE).find(lower)
                    ?: Regex("(?:play|search)\\s+(.+)\\s+on\\s+spotify", RegexOption.IGNORE_CASE).find(lower)

                if (spotifyRegex != null) {
                    val query = spotifyRegex.groupValues[1].replace(Regex("(kholo|open|chalao|par|search|karo)"), "").trim()
                    if (query.isNotBlank() && query != "spotify") {
                        val res = mediaController.searchSpotify(query)
                        return RouterResult(
                            isHandledLocally = true,
                            success = res.success,
                            action = "spotify.search",
                            spokenResponse = "Searching Spotify for $query.",
                            errorCode = res.errorCode,
                            data = res.toJsonObject()
                        )
                    }
                }
            }
        }

        // 4. Media Playback Controls
        if (lower.contains("pause") || lower.contains("rok do") || lower.contains("roko")) {
            val res = mediaController.togglePlayPause()
            return RouterResult(
                isHandledLocally = true,
                success = res.success,
                action = "media.pause",
                spokenResponse = "Media paused.",
                errorCode = res.errorCode
            )
        }
        if (lower.contains("resume") || lower.contains("chalu karo") || lower.contains("play")) {
            val res = mediaController.togglePlayPause()
            return RouterResult(
                isHandledLocally = true,
                success = res.success,
                action = "media.resume",
                spokenResponse = "Media playback resumed.",
                errorCode = res.errorCode
            )
        }
        if (lower.contains("next song") || lower.contains("agla gaana") || lower.contains("next track")) {
            val res = mediaController.nextTrack()
            return RouterResult(
                isHandledLocally = true,
                success = res.success,
                action = "media.next",
                spokenResponse = "Skipping to next track.",
                errorCode = res.errorCode
            )
        }

        // 5. Volume Controls
        // e.g. "volume badao", "volume kam karo", "mute karo"
        if (lower.contains("volume") || lower.contains("aawaz") || lower.contains("awaaz")) {
            val dir = if (lower.contains("up") || lower.contains("badao") || lower.contains("increase") || lower.contains("tez")) "up"
            else if (lower.contains("down") || lower.contains("kam") || lower.contains("ghatao") || lower.contains("decrease")) "down"
            else if (lower.contains("mute") || lower.contains("silent") || lower.contains("band")) "mute"
            else "up"

            val res = mediaController.adjustVolume(dir)
            return RouterResult(
                isHandledLocally = true,
                success = res.success,
                action = "system.volume",
                spokenResponse = res.details,
                errorCode = res.errorCode
            )
        }

        // 6. Battery Level Diagnostic
        // e.g. "battery kitna hai", "what is my battery level"
        if (lower.contains("battery") || lower.contains("charge") || lower.contains("charging")) {
            val bm = context.getSystemService(Context.BATTERY_SERVICE) as? BatteryManager
            val pct = bm?.getIntProperty(BatteryManager.BATTERY_PROPERTY_CAPACITY) ?: -1
            val isCharging = bm?.isCharging ?: false
            val textResp = if (pct >= 0) {
                "Your battery level is $pct%${if (isCharging) " and currently charging" else ""}."
            } else {
                "Unable to read device battery status."
            }
            return RouterResult(
                isHandledLocally = true,
                success = pct >= 0,
                action = "device.battery",
                spokenResponse = textResp,
                data = JSONObject().apply {
                    put("percentage", pct)
                    put("isCharging", isCharging)
                }
            )
        }

        // 7. Time / Date Diagnostic
        // e.g. "kya time ho raha hai", "what time is it", "aaj konsi date hai"
        if (lower.contains("time") || lower.contains("date") || lower.contains("samay") || lower.contains("tarikh")) {
            val sdf = SimpleDateFormat("h:mm a, EEEE, MMMM d", Locale.getDefault())
            val formatted = sdf.format(Date())
            return RouterResult(
                isHandledLocally = true,
                success = true,
                action = "device.datetime",
                spokenResponse = "The current time and date is $formatted.",
                data = JSONObject().apply { put("formatted", formatted) }
            )
        }

        // 8. Reminders (Simple Local Parsing)
        // e.g. "reminder lagao 10 minute baad", "remind me in 5 minutes"
        if (lower.contains("reminder") || lower.contains("yaad dilana")) {
            val minutesMatch = Regex("(\\d+)\\s*(?:min|minute|minutes|m)\\s*(?:baad|after|in)?", RegexOption.IGNORE_CASE).find(lower)
            if (minutesMatch != null) {
                val mins = minutesMatch.groupValues[1].toLongOrNull() ?: 5L
                val triggerTime = System.currentTimeMillis() + (mins * 60 * 1000)
                val title = text.replace(Regex("(reminder|lagao|yaad dilana|me|in|after|minutes|min|\\d+)", RegexOption.IGNORE_CASE), "").trim().ifBlank { "Scheduled Alert" }
                val reminder = ReminderEntity(
                    id = UUID.randomUUID().toString(),
                    title = title,
                    triggerTimeMillis = triggerTime
                )
                repository.saveReminder(reminder)
                val scheduled = reminderScheduler.scheduleReminder(reminder)
                return RouterResult(
                    isHandledLocally = true,
                    success = scheduled,
                    action = "reminders.create",
                    spokenResponse = if (scheduled) "Reminder set for $mins minutes from now: $title." else "Failed to schedule reminder alarm.",
                    errorCode = if (scheduled) null else "EXECUTION_UNVERIFIED",
                    data = JSONObject().apply {
                        put("id", reminder.id)
                        put("title", title)
                        put("triggerTimeMillis", triggerTime)
                    }
                )
            }
        }

        // Not a strictly local device operation -> requires generative AI / web reasoning
        return RouterResult(
            isHandledLocally = false,
            success = true,
            action = "ai.reasoning",
            spokenResponse = ""
        )
    }
}
