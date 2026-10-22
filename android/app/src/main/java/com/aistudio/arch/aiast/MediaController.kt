package com.aistudio.arch.aiast

import android.content.Context
import android.content.Intent
import android.media.AudioManager
import android.net.Uri
import android.os.SystemClock
import android.util.Log
import android.view.KeyEvent
import org.json.JSONObject
import java.net.URLEncoder

/**
 * ARCH Media & Audio Controller
 *
 * Implements dedicated YouTube, Spotify, and System Audio controls using
 * official Android intents, deep-links, and Media key events.
 */
class MediaController(private val context: Context) {

    private val TAG = "MediaController"
    private val audioManager = context.getSystemService(Context.AUDIO_SERVICE) as? AudioManager
    private val appLauncher = AppLauncher(context)

    data class MediaActionResult(
        val success: Boolean,
        val app: String,
        val action: String,
        val details: String,
        val errorCode: String? = null
    ) {
        fun toJsonObject(): JSONObject = JSONObject().apply {
            put("success", success)
            put("app", app)
            put("action", action)
            put("details", details)
            if (!success && errorCode != null) {
                put("errorCode", errorCode)
            }
        }
    }

    // --- YouTube Operations ---

    fun openYouTube(): MediaActionResult {
        val launchRes = appLauncher.launchApp("YouTube")
        return if (launchRes.success) {
            MediaActionResult(true, "YouTube", "open", "YouTube application launched.")
        } else {
            // Web fallback
            val intent = Intent(Intent.ACTION_VIEW, Uri.parse("https://m.youtube.com")).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK
            }
            context.startActivity(intent)
            MediaActionResult(true, "YouTube", "open_web", "YouTube launched in web browser.")
        }
    }

    fun searchYouTube(query: String): MediaActionResult {
        if (query.isBlank()) return openYouTube()

        val encoded = URLEncoder.encode(query.trim(), "UTF-8")
        val isYtInstalled = appLauncher.isPackageInstalled("com.google.android.youtube")

        val intent = if (isYtInstalled) {
            Intent(Intent.ACTION_SEARCH).apply {
                setPackage("com.google.android.youtube")
                putExtra("query", query.trim())
                flags = Intent.FLAG_ACTIVITY_NEW_TASK
            }
        } else {
            Intent(Intent.ACTION_VIEW, Uri.parse("https://www.youtube.com/results?search_query=$encoded")).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK
            }
        }

        return try {
            context.startActivity(intent)
            MediaActionResult(
                success = true,
                app = "YouTube",
                action = "search",
                details = "Searching YouTube for '$query'."
            )
        } catch (e: Exception) {
            Log.e(TAG, "YouTube search failed: ${e.message}")
            MediaActionResult(
                success = false,
                app = "YouTube",
                action = "search",
                details = "Failed to launch YouTube search: ${e.message}",
                errorCode = "APP_NOT_LAUNCHABLE"
            )
        }
    }

    fun playYouTubeVideo(videoIdOrUrl: String): MediaActionResult {
        val uri = if (videoIdOrUrl.startsWith("http://") || videoIdOrUrl.startsWith("https://")) {
            Uri.parse(videoIdOrUrl)
        } else {
            Uri.parse("vnd.youtube:$videoIdOrUrl")
        }

        val intent = Intent(Intent.ACTION_VIEW, uri).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK
        }
        if (appLauncher.isPackageInstalled("com.google.android.youtube")) {
            intent.setPackage("com.google.android.youtube")
        }

        return try {
            context.startActivity(intent)
            MediaActionResult(
                success = true,
                app = "YouTube",
                action = "open_video",
                details = "Opened video in YouTube."
            )
        } catch (e: Exception) {
            MediaActionResult(
                success = false,
                app = "YouTube",
                action = "open_video",
                details = "Could not open video: ${e.message}",
                errorCode = "APP_NOT_LAUNCHABLE"
            )
        }
    }

    // --- Spotify Operations ---

    fun openSpotify(): MediaActionResult {
        val isInstalled = appLauncher.isPackageInstalled("com.spotify.music")
        if (!isInstalled) {
            return MediaActionResult(
                success = false,
                app = "Spotify",
                action = "open",
                details = "Spotify application is not installed on this device.",
                errorCode = "APP_NOT_INSTALLED"
            )
        }
        val launchRes = appLauncher.launchApp("Spotify")
        return MediaActionResult(
            success = launchRes.success,
            app = "Spotify",
            action = "open",
            details = if (launchRes.success) "Spotify application opened." else (launchRes.errorMessage ?: "Failed to open Spotify"),
            errorCode = launchRes.errorCode
        )
    }

    fun searchSpotify(query: String): MediaActionResult {
        val encoded = URLEncoder.encode(query.trim(), "UTF-8")
        val isInstalled = appLauncher.isPackageInstalled("com.spotify.music")

        val intent = if (isInstalled) {
            Intent(Intent.ACTION_VIEW, Uri.parse("spotify:search:$encoded")).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK
            }
        } else {
            Intent(Intent.ACTION_VIEW, Uri.parse("https://open.spotify.com/search/$encoded")).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK
            }
        }

        return try {
            context.startActivity(intent)
            MediaActionResult(
                success = true,
                app = "Spotify",
                action = "search",
                details = "Searching Spotify for '$query'."
            )
        } catch (e: Exception) {
            MediaActionResult(
                success = false,
                app = "Spotify",
                action = "search",
                details = "Failed to launch Spotify search: ${e.message}",
                errorCode = "APP_NOT_LAUNCHABLE"
            )
        }
    }

    // --- System Media Playback Control (KeyEvents) ---

    fun togglePlayPause(): MediaActionResult {
        return dispatchMediaKeyEvent(KeyEvent.KEYCODE_MEDIA_PLAY_PAUSE, "play_pause")
    }

    fun nextTrack(): MediaActionResult {
        return dispatchMediaKeyEvent(KeyEvent.KEYCODE_MEDIA_NEXT, "next_track")
    }

    fun previousTrack(): MediaActionResult {
        return dispatchMediaKeyEvent(KeyEvent.KEYCODE_MEDIA_PREVIOUS, "prev_track")
    }

    private fun dispatchMediaKeyEvent(keyCode: Int, actionName: String): MediaActionResult {
        if (audioManager == null) {
            return MediaActionResult(false, "System", actionName, "AudioManager is unavailable", "UNSUPPORTED_OPERATION")
        }

        return try {
            val eventDown = KeyEvent(SystemClock.uptimeMillis(), SystemClock.uptimeMillis(), KeyEvent.ACTION_DOWN, keyCode, 0)
            val eventUp = KeyEvent(SystemClock.uptimeMillis(), SystemClock.uptimeMillis(), KeyEvent.ACTION_UP, keyCode, 0)

            audioManager.dispatchMediaKeyEvent(eventDown)
            audioManager.dispatchMediaKeyEvent(eventUp)

            MediaActionResult(
                success = true,
                app = "MediaSession",
                action = actionName,
                details = "Dispatched media key $actionName to active audio player."
            )
        } catch (e: Exception) {
            Log.e(TAG, "Failed to dispatch media key event: ${e.message}")
            MediaActionResult(
                success = false,
                app = "MediaSession",
                action = actionName,
                details = "Media key event failed: ${e.message}",
                errorCode = "UNSUPPORTED_OPERATION"
            )
        }
    }

    // --- System Audio Volume Adjustment ---

    fun adjustVolume(direction: String, percent: Int? = null): MediaActionResult {
        if (audioManager == null) {
            return MediaActionResult(false, "System", "volume", "AudioManager is unavailable", "UNSUPPORTED_OPERATION")
        }

        return try {
            val maxVol = audioManager.getStreamMaxVolume(AudioManager.STREAM_MUSIC)

            if (percent != null) {
                val clamped = percent.coerceIn(0, 100)
                val targetVol = (clamped * maxVol) / 100
                audioManager.setStreamVolume(AudioManager.STREAM_MUSIC, targetVol, AudioManager.FLAG_SHOW_UI)
                return MediaActionResult(true, "System", "set_volume", "Volume set to $clamped%")
            }

            when (direction.lowercase()) {
                "up", "raise", "increase", "badao" -> {
                    audioManager.adjustStreamVolume(AudioManager.STREAM_MUSIC, AudioManager.ADJUST_RAISE, AudioManager.FLAG_SHOW_UI)
                    MediaActionResult(true, "System", "volume_up", "Volume increased.")
                }
                "down", "lower", "decrease", "ghatao", "kam karo" -> {
                    audioManager.adjustStreamVolume(AudioManager.STREAM_MUSIC, AudioManager.ADJUST_LOWER, AudioManager.FLAG_SHOW_UI)
                    MediaActionResult(true, "System", "volume_down", "Volume lowered.")
                }
                "mute" -> {
                    audioManager.adjustStreamVolume(AudioManager.STREAM_MUSIC, AudioManager.ADJUST_MUTE, AudioManager.FLAG_SHOW_UI)
                    MediaActionResult(true, "System", "volume_mute", "Volume muted.")
                }
                "unmute" -> {
                    audioManager.adjustStreamVolume(AudioManager.STREAM_MUSIC, AudioManager.ADJUST_UNMUTE, AudioManager.FLAG_SHOW_UI)
                    MediaActionResult(true, "System", "volume_unmute", "Volume unmuted.")
                }
                else -> {
                    MediaActionResult(false, "System", "volume", "Unknown volume direction: $direction", "UNSUPPORTED_OPERATION")
                }
            }
        } catch (e: Exception) {
            MediaActionResult(false, "System", "volume", "Volume change failed: ${e.message}", "UNSUPPORTED_OPERATION")
        }
    }
}
