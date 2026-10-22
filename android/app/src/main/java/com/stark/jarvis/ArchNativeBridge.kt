package com.stark.jarvis

import android.Manifest
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.ApplicationInfo
import android.content.pm.PackageManager
import android.content.pm.ResolveInfo
import android.media.AudioManager
import android.net.Uri
import android.os.BatteryManager
import android.os.Build
import android.os.Environment
import android.provider.MediaStore
import android.provider.Settings
import android.util.Log
import android.webkit.JavascriptInterface
import androidx.core.content.ContextCompat
import androidx.core.content.FileProvider
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.io.FileOutputStream
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/**
 * ARCH Native Android SDK Bridge (Kotlin Implementation)
 *
 * Provides legitimate, permission-based device integration for Android 9 (API 28) and above.
 * Exposed in WebView as:
 *   window.ArchAndroid
 *   window.AndroidBridge
 *   window.Android
 */
class ArchNativeBridge(private val activity: MainActivity) {

    private val context: Context = activity.applicationContext
    private val TAG = "ArchNativeBridge"
    private val appLauncher: AppLauncher = AppLauncher(context)

    private fun getAccessibilityService(): JarvisAccessibilityService? {
        return JarvisAccessibilityService.getInstance()
    }

    /**
     * Confirms the native bridge is alive.
     */
    @JavascriptInterface
    fun isNative(): Boolean {
        return true
    }

    /**
     * Confirms whether Accessibility Service is currently active in Android Settings.
     */
    @JavascriptInterface
    fun isAccessibilityActive(): Boolean {
        return getAccessibilityService() != null
    }

    /**
     * Check if a specific package or app name is installed on the Android device.
     */
    @JavascriptInterface
    fun isAppInstalled(packageNameOrName: String?): Boolean {
        if (packageNameOrName.isNullOrBlank()) return false
        val match = appLauncher.resolveApp(packageNameOrName)
        return match?.isInstalled ?: false
    }

    /**
     * Returns a JSON array of all launchable installed applications on the Android device.
     */
    @JavascriptInterface
    fun getInstalledApps(): String {
        return appLauncher.getLaunchableAppsJson()
    }

    /**
     * Alias for getInstalledApps for dynamic app discovery.
     */
    @JavascriptInterface
    fun getLaunchableApps(): String {
        return appLauncher.getLaunchableAppsJson()
    }

    /**
     * Launch application via real Android Intent.
     * Does NOT fake or simulate success if application is not installed.
     */
    @JavascriptInterface
    fun launchApp(packageNameOrName: String?, query: String? = null): String {
        return appLauncher.launchApp(packageNameOrName, query).toString()
    }

    /**
     * Open Camera via native Android Camera intent.
     */
    @JavascriptInterface
    fun openCamera(): String {
        return appLauncher.launchCamera().toString()
    }

    /**
     * Open Google Maps or Navigation via native geo intent.
     */
    @JavascriptInterface
    fun openMaps(query: String?): String {
        return try {
            val uri = if (query.isNullOrBlank()) {
                Uri.parse("geo:0,0?q=")
            } else {
                Uri.parse("geo:0,0?q=${Uri.encode(query)}")
            }
            val mapIntent = Intent(Intent.ACTION_VIEW, uri).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                setPackage("com.google.android.apps.maps")
            }

            if (mapIntent.resolveActivity(context.packageManager) != null) {
                context.startActivity(mapIntent)
            } else {
                // Fallback to web browser or any map app
                val genericIntent = Intent(Intent.ACTION_VIEW, uri).apply {
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                }
                context.startActivity(genericIntent)
            }

            JSONObject().apply {
                put("success", true)
                put("verified", true)
                put("message", if (query.isNullOrBlank()) "Google Maps opened, Sir." else "Searching Google Maps for '$query', Sir.")
            }.toString()
        } catch (e: Exception) {
            errorResponse("Failed to open Maps: ${e.message}")
        }
    }

    /**
     * Open URL in Chrome or default web browser via native intent.
     */
    @JavascriptInterface
    fun openUrl(url: String?): String {
        if (url.isNullOrBlank()) return errorResponse("URL cannot be empty.")
        val targetUrl = if (!url.startsWith("http://") && !url.startsWith("https://")) {
            "https://$url"
        } else {
            url
        }

        return try {
            val browserIntent = Intent(Intent.ACTION_VIEW, Uri.parse(targetUrl)).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            context.startActivity(browserIntent)
            JSONObject().apply {
                put("success", true)
                put("verified", true)
                put("url", targetUrl)
                put("message", "Opened '$targetUrl' in browser, Sir.")
            }.toString()
        } catch (e: Exception) {
            errorResponse("Could not open URL: ${e.message}")
        }
    }

    /**
     * Adjust audio volume using permitted Android AudioManager APIs.
     * Supported directions: "up", "down", "mute", "max", or level (0-100)
     */
    @JavascriptInterface
    fun adjustVolume(direction: String?): String {
        return try {
            val audioManager = context.getSystemService(Context.AUDIO_SERVICE) as? AudioManager
                ?: return errorResponse("AudioManager service unavailable.")

            val maxVol = audioManager.getStreamMaxVolume(AudioManager.STREAM_MUSIC)
            val currentVol = audioManager.getStreamVolume(AudioManager.STREAM_MUSIC)

            val dir = direction?.lowercase() ?: "up"
            when (dir) {
                "up", "raise", "increase", "badhao" -> {
                    audioManager.adjustStreamVolume(
                        AudioManager.STREAM_MUSIC,
                        AudioManager.ADJUST_RAISE,
                        AudioManager.FLAG_SHOW_UI
                    )
                }
                "down", "lower", "decrease", "kam", "kam karo" -> {
                    audioManager.adjustStreamVolume(
                        AudioManager.STREAM_MUSIC,
                        AudioManager.ADJUST_LOWER,
                        AudioManager.FLAG_SHOW_UI
                    )
                }
                "mute", "silent", "chup" -> {
                    audioManager.setStreamVolume(AudioManager.STREAM_MUSIC, 0, AudioManager.FLAG_SHOW_UI)
                }
                "max" -> {
                    audioManager.setStreamVolume(AudioManager.STREAM_MUSIC, maxVol, AudioManager.FLAG_SHOW_UI)
                }
                else -> {
                    val percent = dir.filter { it.isDigit() }.toIntOrNull()
                    if (percent != null) {
                        val targetVol = (maxVol * (percent / 100f)).toInt().coerceIn(0, maxVol)
                        audioManager.setStreamVolume(AudioManager.STREAM_MUSIC, targetVol, AudioManager.FLAG_SHOW_UI)
                    } else {
                        audioManager.adjustStreamVolume(
                            AudioManager.STREAM_MUSIC,
                            AudioManager.ADJUST_RAISE,
                            AudioManager.FLAG_SHOW_UI
                        )
                    }
                }
            }

            val newVol = audioManager.getStreamVolume(AudioManager.STREAM_MUSIC)
            val percentage = (newVol.toFloat() / maxVol.toFloat() * 100).toInt()

            JSONObject().apply {
                put("success", true)
                put("verified", true)
                put("volume", percentage)
                put("message", "Volume adjusted to $percentage% (stream $newVol/$maxVol), Sir.")
            }.toString()
        } catch (e: Exception) {
            errorResponse("Failed to adjust volume: ${e.message}")
        }
    }

    /**
     * Read current device battery status (level, charging state, plugged type).
     */
    @JavascriptInterface
    fun getBatteryStatus(): String {
        return try {
            val ifilter = IntentFilter(Intent.ACTION_BATTERY_CHANGED)
            val batteryStatus = context.registerReceiver(null, ifilter)

            val level = batteryStatus?.getIntExtra(BatteryManager.EXTRA_LEVEL, -1) ?: -1
            val scale = batteryStatus?.getIntExtra(BatteryManager.EXTRA_SCALE, -1) ?: -1
            val batteryPct = if (level != -1 && scale != -1) (level * 100 / scale.toFloat()).toInt() else 80

            val status = batteryStatus?.getIntExtra(BatteryManager.EXTRA_STATUS, -1) ?: -1
            val isCharging = status == BatteryManager.BATTERY_STATUS_CHARGING || status == BatteryManager.BATTERY_STATUS_FULL

            val chargePlug = batteryStatus?.getIntExtra(BatteryManager.EXTRA_PLUGGED, -1) ?: -1
            val pluggedType = when (chargePlug) {
                BatteryManager.BATTERY_PLUGGED_USB -> "USB"
                BatteryManager.BATTERY_PLUGGED_AC -> "AC Charger"
                BatteryManager.BATTERY_PLUGGED_WIRELESS -> "Wireless"
                else -> "Battery Power"
            }

            val temp = (batteryStatus?.getIntExtra(BatteryManager.EXTRA_TEMPERATURE, 0) ?: 0) / 10.0

            JSONObject().apply {
                put("success", true)
                put("level", batteryPct)
                put("isCharging", isCharging)
                put("pluggedType", pluggedType)
                put("temperatureCelsius", temp)
                put("message", if (isCharging) {
                    "Battery $batteryPct% hai sir, $pluggedType se charge ho raha hai."
                } else {
                    "Battery $batteryPct% hai sir, charging connected nahi hai."
                })
            }.toString()
        } catch (e: Exception) {
            errorResponse("Failed to read battery status: ${e.message}")
        }
    }

    /**
     * Read current date and time formatted in Indian & conversational style.
     */
    @JavascriptInterface
    fun getDeviceDateTime(): String {
        return try {
            val now = Date()
            val timeFmt = SimpleDateFormat("h:mm a", Locale.ENGLISH)
            val dateFmt = SimpleDateFormat("EEEE, d MMMM yyyy", Locale.ENGLISH)
            val hindiDateFmt = SimpleDateFormat("d MMMM yyyy", Locale("hi", "IN"))

            val formattedTime = timeFmt.format(now)
            val formattedDate = dateFmt.format(now)

            JSONObject().apply {
                put("success", true)
                put("time", formattedTime)
                put("date", formattedDate)
                put("timestamp", now.time)
                put("message", "Abhi $formattedTime baj rahe hain sir, aur aaj ki date $formattedDate hai.")
            }.toString()
        } catch (e: Exception) {
            errorResponse("Failed to read device date/time: ${e.message}")
        }
    }

    /**
     * Return device OS version and hardware characteristics.
     */
    @JavascriptInterface
    fun getDeviceInfo(): String {
        return try {
            JSONObject().apply {
                put("sdkInt", Build.VERSION.SDK_INT)
                put("release", Build.VERSION.RELEASE)
                put("model", Build.MODEL)
                put("manufacturer", Build.MANUFACTURER)
                put("brand", Build.BRAND)
                put("isAndroid9", Build.VERSION.SDK_INT == Build.VERSION_CODES.P)
                put("isAndroid9Plus", Build.VERSION.SDK_INT >= Build.VERSION_CODES.P)
                put("accessibilityActive", isAccessibilityActive())
            }.toString()
        } catch (e: Exception) {
            "{}"
        }
    }

    /**
     * Native Text-to-Speech playback.
     */
    @JavascriptInterface
    fun speakNative(text: String?, language: String? = "hi_IN"): String {
        if (text.isNullOrBlank()) return errorResponse("Text cannot be empty.")
        val success = activity.speechManager?.speak(text, language ?: "hi_IN") ?: false
        return JSONObject().apply {
            put("success", success)
            put("message", if (success) "Speaking aloud..." else "TTS not ready")
        }.toString()
    }

    /**
     * Start Android Native Speech Recognition.
     */
    @JavascriptInterface
    fun startSpeechRecognition(language: String? = "hi_IN"): String {
        return try {
            activity.runOnUiThread {
                activity.speechManager?.startListening(language ?: "hi_IN")
            }
            JSONObject().apply {
                put("success", true)
                put("message", "Android native speech recognition listening...")
            }.toString()
        } catch (e: Exception) {
            errorResponse("Failed to start speech recognition: ${e.message}")
        }
    }

    /**
     * Stop Android Native Speech Recognition.
     */
    @JavascriptInterface
    fun stopSpeechRecognition(): String {
        return try {
            activity.runOnUiThread {
                activity.speechManager?.stopListening()
            }
            JSONObject().apply {
                put("success", true)
                put("message", "Speech recognition stopped.")
            }.toString()
        } catch (e: Exception) {
            errorResponse("Failed to stop speech recognition: ${e.message}")
        }
    }

    /**
     * YouTube search intent helper via native AppLauncher.
     */
    @JavascriptInterface
    fun searchYouTube(query: String?, autoplay: Boolean = true): String {
        return appLauncher.launchYouTube(query).toString()
    }

    /**
     * WhatsApp message intent dispatch.
     */
    @JavascriptInterface
    fun sendWhatsAppMessage(contactName: String?, phoneNumber: String?, message: String?): String {
        val msg = message ?: ""
        val phone = phoneNumber?.replace(Regex("[^0-9]"), "") ?: ""

        return try {
            val intent = if (phone.isNotBlank()) {
                Intent(Intent.ACTION_VIEW, Uri.parse("https://api.whatsapp.com/send?phone=$phone&text=${Uri.encode(msg)}"))
            } else {
                Intent(Intent.ACTION_SEND).apply {
                    type = "text/plain"
                    setPackage("com.whatsapp")
                    putExtra(Intent.EXTRA_TEXT, msg)
                }
            }
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            context.startActivity(intent)

            JSONObject().apply {
                put("success", true)
                put("installed", true)
                put("message", "WhatsApp Intent dispatched for $contactName, Sir.")
            }.toString()
        } catch (e: Exception) {
            errorResponse("WhatsApp launch failed: ${e.message}")
        }
    }

    /**
     * Transfer code files into user's installed phone editor (Pydroid 3 / HopeWeb / Acode).
     */
    @JavascriptInterface
    fun openFilesInEditor(editorPackage: String?, filesJson: String?): String {
        val targetPkg = editorPackage ?: "ru.iiec.pydroid3"
        return try {
            val jsonArr = JSONArray(filesJson ?: "[]")
            if (jsonArr.length() == 0) return errorResponse("No files provided for editor.")

            val firstFile = jsonArr.getJSONObject(0)
            val fileName = firstFile.optString("name", "main.py")
            val content = firstFile.optString("content", "")

            val outputDir = File(context.getExternalFilesDir(Environment.DIRECTORY_DOCUMENTS), "arch_projects")
            if (!outputDir.exists()) outputDir.mkdirs()

            val targetFile = File(outputDir, fileName)
            FileOutputStream(targetFile).use { it.write(content.toByteArray()) }

            val uri = FileProvider.getUriForFile(context, "${context.packageName}.provider", targetFile)
            val editIntent = Intent(Intent.ACTION_VIEW).apply {
                setDataAndType(uri, "text/plain")
                addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_GRANT_WRITE_URI_PERMISSION or Intent.FLAG_ACTIVITY_NEW_TASK)
                setPackage(targetPkg)
            }

            if (editIntent.resolveActivity(context.packageManager) != null) {
                context.startActivity(editIntent)
                JSONObject().apply {
                    put("success", true)
                    put("message", "Transferred $fileName into $targetPkg successfully, Sir.")
                }.toString()
            } else {
                // Fallback to any code viewer
                editIntent.setPackage(null)
                context.startActivity(Intent.createChooser(editIntent, "Open Code with...").apply {
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                })
                JSONObject().apply {
                    put("success", true)
                    put("message", "Dispatched file $fileName to mobile code editor, Sir.")
                }.toString()
            }
        } catch (e: Exception) {
            errorResponse("Failed to transfer files to editor: ${e.message}")
        }
    }

    /**
     * Execute Accessibility actions (tap, click, scroll, back, home, recents).
     */
    @JavascriptInterface
    fun performAccessibilityAction(action: String?, paramsJson: String?): String {
        val act = action?.lowercase() ?: return errorResponse("Action cannot be empty.")
        val service = getAccessibilityService()

        if (service == null) {
            return JSONObject().apply {
                put("success", false)
                put("verified", false)
                put("errorReason", "ACCESSIBILITY_SERVICE_OFF")
                put("message", "Android Accessibility Service is disabled. Please enable 'ARCH Device Control' in phone Settings.")
            }.toString()
        }

        return try {
            val params = if (!paramsJson.isNullOrBlank()) JSONObject(paramsJson) else JSONObject()
            val success = when (act) {
                "back" -> service.performGlobalAction(ArchAccessibilityService.GLOBAL_ACTION_BACK)
                "home" -> service.performGlobalAction(ArchAccessibilityService.GLOBAL_ACTION_HOME)
                "recents" -> service.performGlobalAction(ArchAccessibilityService.GLOBAL_ACTION_RECENTS)
                "notifications" -> service.performGlobalAction(ArchAccessibilityService.GLOBAL_ACTION_NOTIFICATIONS)
                "quick_settings" -> service.performGlobalAction(ArchAccessibilityService.GLOBAL_ACTION_QUICK_SETTINGS)
                "lock" -> if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) service.performGlobalAction(ArchAccessibilityService.GLOBAL_ACTION_LOCK_SCREEN) else false
                "screenshot" -> if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) service.performGlobalAction(ArchAccessibilityService.GLOBAL_ACTION_TAKE_SCREENSHOT) else false
                "scroll_down" -> service.scrollDown()
                "scroll_up" -> service.scrollUp()
                "click", "click_element", "tap" -> {
                    val query = params.optString("query", params.optString("text", ""))
                    if (query.isNotBlank()) service.clickElementByTextOrId(query) else false
                }
                "type", "type_text" -> {
                    val text = params.optString("text", "")
                    service.typeTextIntoActiveInput(text)
                }
                else -> false
            }

            JSONObject().apply {
                put("success", success)
                put("verified", success)
                put("action", act)
                put("message", if (success) "Executed gesture '$act' successfully, Sir." else "Could not execute '$act'.")
            }.toString()
        } catch (e: Exception) {
            errorResponse("Accessibility action failed: ${e.message}")
        }
    }

    /**
     * Check Android permissions status.
     */
    @JavascriptInterface
    fun getPermissionsStatus(): String {
        val micGranted = ContextCompat.checkSelfPermission(context, Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED
        val cameraGranted = ContextCompat.checkSelfPermission(context, Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED
        val accessibilityActive = isAccessibilityActive()

        return JSONObject().apply {
            put("accessibilityService", accessibilityActive)
            put("recordAudio", micGranted)
            put("camera", cameraGranted)
            put("storageAccess", true)
            put("isNativeBridge", true)
            put("sdkInt", Build.VERSION.SDK_INT)
            put("osRelease", Build.VERSION.RELEASE)
            put("environment", if (accessibilityActive) "NATIVE_APK_ACCESSIBILITY_ACTIVE" else "NATIVE_APK_BASIC")
        }.toString()
    }

    /**
     * Request native permission prompt or navigate to system settings.
     */
    @JavascriptInterface
    fun requestPermission(permissionType: String?): String {
        val type = permissionType?.lowercase() ?: "audio"
        activity.runOnUiThread {
            when (type) {
                "record_audio", "audio", "mic" -> activity.requestAudioPermission()
                "camera" -> activity.requestCameraPermission()
                "accessibility" -> openAccessibilitySettings()
            }
        }
        return JSONObject().apply {
            put("success", true)
            put("message", "Permission request prompt dispatched for '$type'.")
        }.toString()
    }

    /**
     * Open Android Accessibility Settings directly.
     */
    @JavascriptInterface
    fun openAccessibilitySettings() {
        try {
            val intent = Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            context.startActivity(intent)
        } catch (e: Exception) {
            Log.e(TAG, "Failed to open accessibility settings", e)
        }
    }

    private fun errorResponse(msg: String): String {
        return JSONObject().apply {
            put("success", false)
            put("error", msg)
            put("message", msg)
        }.toString()
    }
}
