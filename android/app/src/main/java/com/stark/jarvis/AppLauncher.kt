package com.stark.jarvis

import android.content.Context
import android.content.Intent
import android.content.pm.ApplicationInfo
import android.content.pm.PackageManager
import android.content.pm.ResolveInfo
import android.net.Uri
import android.provider.MediaStore
import android.provider.Settings
import android.util.Log
import org.json.JSONArray
import org.json.JSONObject

/**
 * ARCH Native Kotlin AppLauncher Service
 *
 * Resolves requested app names (in Hindi, Hinglish, and English) to installed,
 * launchable Android applications using legitimate PackageManager and Launch Intents.
 * Keeps display names and package identifiers strictly separated.
 * Does NOT pretend an app is launched if it is not installed.
 */
class AppLauncher(private val context: Context) {

    private val TAG = "ArchAppLauncher"
    private val pm: PackageManager = context.packageManager

    data class AppMatch(
        val displayName: String,
        val packageName: String,
        val isInstalled: Boolean,
        val isEnabled: Boolean = true
    )

    // Curated high-frequency alias registry for immediate, accurate resolution
    private val knownAppAliases = mapOf(
        "youtube" to listOf("youtube", "yt", "you tube", "यूट्यूब", "video player", "videos"),
        "playstore" to listOf("play store", "playstore", "google play", "google play store", "प्ले स्टोर", "प्लेस्टोर", "store", "market", "app store"),
        "whatsapp" to listOf("whatsapp", "whats app", "व्हाट्सएप", "wa"),
        "chrome" to listOf("chrome", "google chrome", "browser", "इंटरनेट", "ब्राउज़र", "web browser"),
        "camera" to listOf("camera", "cam", "photo", "कैमरा", "फोटो"),
        "settings" to listOf("settings", "preferences", "phone settings", "सेटिंग्स", "device settings"),
        "calculator" to listOf("calculator", "calc", "कैलकुलेटर", "hisab"),
        "gallery" to listOf("gallery", "photos", "google photos", "गैलरी", "pictures"),
        "maps" to listOf("google maps", "maps", "navigation", "मैप्स", "गूगल मैप"),
        "gmail" to listOf("gmail", "email", "mail", "जीमेल", "ईमेल"),
        "phone" to listOf("phone", "dialer", "call", "phone app", "फोन", "कॉल"),
        "messages" to listOf("messages", "sms", "message", "मैसेज"),
        "clock" to listOf("clock", "alarm", "घड़ी", "अलार्म"),
        "contacts" to listOf("contacts", "contact", "संपर्क"),
        "telegram" to listOf("telegram", "tele", "टेलीग्राम"),
        "ytmusic" to listOf("yt music", "youtube music", "yt songs", "म्यूजिक"),
        "instagram" to listOf("instagram", "insta", "आईजी"),
        "spotify" to listOf("spotify", "music", "गाने"),
        "pydroid" to listOf("pydroid", "pydroid 3", "python editor", "mera python editor", "पायथन एडिटर"),
        "hopeweb" to listOf("hopeweb", "hope web", "html editor", "mera html editor", "वेब एडिटर"),
        "acode" to listOf("acode", "code editor", "acode editor"),
        "files" to listOf("files", "file manager", "downloads", "my files", "फ़ाइलें", "storage")
    )

    private val knownCanonicalPackages = mapOf(
        "youtube" to "com.google.android.youtube",
        "playstore" to "com.android.vending",
        "whatsapp" to "com.whatsapp",
        "chrome" to "com.android.chrome",
        "camera" to "com.google.android.GoogleCamera",
        "settings" to "com.android.settings",
        "calculator" to "com.google.android.calculator",
        "gallery" to "com.google.android.apps.photos",
        "maps" to "com.google.android.apps.maps",
        "gmail" to "com.google.android.gm",
        "phone" to "com.google.android.dialer",
        "messages" to "com.google.android.apps.messaging",
        "clock" to "com.google.android.deskclock",
        "contacts" to "com.google.android.contacts",
        "telegram" to "org.telegram.messenger",
        "ytmusic" to "com.google.android.apps.youtube.music",
        "instagram" to "com.instagram.android",
        "spotify" to "com.spotify.music",
        "pydroid" to "ru.iiec.pydroid3",
        "hopeweb" to "com.hopeweb.editor",
        "acode" to "io.github.rosemoe.editor",
        "files" to "com.google.android.documentsui"
    )

    /**
     * Checks if a package is installed and enabled on the Android device.
     */
    fun isPackageInstalled(packageName: String): Boolean {
        return try {
            if (pm.getLaunchIntentForPackage(packageName) != null) {
                return true
            }
            val info = pm.getApplicationInfo(packageName, 0)
            info.enabled
        } catch (e: Exception) {
            try {
                pm.getPackageInfo(packageName, 0)
                true
            } catch (ignored: Exception) {
                false
            }
        }
    }

    /**
     * Dynamically discovers all launchable applications via CATEGORY_LAUNCHER.
     */
    fun getLaunchableApps(): List<AppMatch> {
        val launchIntent = Intent(Intent.ACTION_MAIN, null).apply {
            addCategory(Intent.CATEGORY_LAUNCHER)
        }
        val resolveList: List<ResolveInfo> = pm.queryIntentActivities(launchIntent, 0)
        val list = mutableListOf<AppMatch>()

        for (resolveInfo in resolveList) {
            val ai = resolveInfo.activityInfo ?: continue
            val label = resolveInfo.loadLabel(pm).toString()
            val pkg = ai.packageName
            list.add(AppMatch(displayName = label, packageName = pkg, isInstalled = true, isEnabled = ai.applicationInfo.enabled))
        }
        return list.sortedBy { it.displayName.lowercase() }
    }

    /**
     * Returns JSON list of all installed launchable applications for the assistant.
     */
    fun getLaunchableAppsJson(): String {
        return try {
            val apps = getLaunchableApps()
            val arr = JSONArray()
            for (app in apps) {
                arr.put(JSONObject().apply {
                    put("appName", app.displayName)
                    put("packageName", app.packageName)
                    put("isEnabled", app.isEnabled)
                })
            }
            JSONObject().apply {
                put("success", true)
                put("total", apps.size)
                put("apps", arr)
            }.toString()
        } catch (e: Exception) {
            JSONObject().apply {
                put("success", false)
                put("error", e.message)
            }.toString()
        }
    }

    /**
     * Resolves app request into package and display name.
     */
    fun resolveApp(appNameOrPackage: String): AppMatch? {
        val clean = appNameOrPackage.trim().lowercase()

        // 1. Direct package ID check
        if (clean.contains(".")) {
            if (isPackageInstalled(appNameOrPackage.trim())) {
                val label = try {
                    val appInfo = pm.getApplicationInfo(appNameOrPackage.trim(), 0)
                    pm.getApplicationLabel(appInfo).toString()
                } catch (e: Exception) {
                    appNameOrPackage
                }
                return AppMatch(label, appNameOrPackage.trim(), true)
            }
        }

        // 2. Check canonical package alias map
        for ((key, aliases) in knownAppAliases) {
            if (aliases.any { clean.contains(it) || it.contains(clean) }) {
                val candidatePkg = knownCanonicalPackages[key]
                if (candidatePkg != null && isPackageInstalled(candidatePkg)) {
                    val label = try {
                        val appInfo = pm.getApplicationInfo(candidatePkg, 0)
                        pm.getApplicationLabel(appInfo).toString()
                    } catch (e: Exception) {
                        key.replaceFirstChar { it.uppercase() }
                    }
                    return AppMatch(label, candidatePkg, true)
                }
            }
        }

        // 3. Dynamic lookup against all launchable apps installed on phone
        val launchable = getLaunchableApps()
        // Exact label match
        for (app in launchable) {
            if (app.displayName.equals(appNameOrPackage, ignoreCase = true)) {
                return app
            }
        }
        // Substring / partial match
        for (app in launchable) {
            val appLabelClean = app.displayName.lowercase()
            if (appLabelClean.contains(clean) || clean.contains(appLabelClean)) {
                return app
            }
        }

        // 4. Fallback search across all installed applications
        try {
            val allApps = pm.getInstalledApplications(PackageManager.GET_META_DATA)
            for (app in allApps) {
                val label = pm.getApplicationLabel(app).toString()
                if (label.equals(appNameOrPackage, ignoreCase = true) || label.lowercase().contains(clean)) {
                    return AppMatch(label, app.packageName, app.enabled)
                }
            }
        } catch (ignored: Exception) {}

        return null
    }

    /**
     * Launches the installed native YouTube application directly.
     * Never opens a Chrome tab or embedded WebView when the native app is requested.
     */
    fun launchYouTube(searchQuery: String? = null): JSONObject {
        val youtubePkgs = listOf(
            "com.google.android.youtube",
            "com.google.android.apps.youtube.mango"
        )
        val youtubePkg = youtubePkgs.firstOrNull { isPackageInstalled(it) } ?: "com.google.android.youtube"
        val isInstalled = isPackageInstalled(youtubePkg)

        return try {
            val intent = if (!searchQuery.isNullOrBlank()) {
                // Use YouTube search intent explicitly targeted to native app
                Intent(Intent.ACTION_SEARCH).apply {
                    setPackage(youtubePkg)
                    putExtra("query", searchQuery.trim())
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                }
            } else {
                pm.getLaunchIntentForPackage(youtubePkg)?.apply {
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_RESET_TASK_IF_NEEDED)
                } ?: Intent(Intent.ACTION_MAIN).apply {
                    setPackage(youtubePkg)
                    addCategory(Intent.CATEGORY_LAUNCHER)
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_RESET_TASK_IF_NEEDED)
                }
            }

            if (intent != null) {
                context.startActivity(intent)
                JSONObject().apply {
                    put("success", true)
                    put("installed", true)
                    put("verified", true)
                    put("packageName", youtubePkg)
                    put("appName", "YouTube")
                    put("message", if (!searchQuery.isNullOrBlank()) {
                        "YouTube par '$searchQuery' search kar raha hoon, Sir."
                    } else {
                        "YouTube open kar diya hai, Sir."
                    })
                }
            } else {
                JSONObject().apply {
                    put("success", false)
                    put("installed", true)
                    put("verified", false)
                    put("packageName", youtubePkg)
                    put("message", "Unable to create launch intent for YouTube.")
                }
            }
        } catch (e: Exception) {
            Log.e(TAG, "Failed to launch native YouTube app: ${e.message}")
            JSONObject().apply {
                put("success", false)
                put("installed", true)
                put("packageName", youtubePkg)
                put("message", "YouTube launch karne mein samasya aayi: ${e.message}")
            }
        }
    }

    /**
     * Launches Google Play Store directly via native market intent.
     */
    fun launchPlayStore(searchQuery: String? = null): JSONObject {
        val playStorePkg = "com.android.vending"
        return try {
            val intent = if (!searchQuery.isNullOrBlank()) {
                Intent(Intent.ACTION_VIEW, Uri.parse("market://search?q=${Uri.encode(searchQuery.trim())}")).apply {
                    setPackage(playStorePkg)
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_RESET_TASK_IF_NEEDED)
                }
            } else {
                pm.getLaunchIntentForPackage(playStorePkg)?.apply {
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_RESET_TASK_IF_NEEDED)
                } ?: Intent(Intent.ACTION_VIEW, Uri.parse("market://details?id=$playStorePkg")).apply {
                    setPackage(playStorePkg)
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_RESET_TASK_IF_NEEDED)
                }
            }

            context.startActivity(intent)
            JSONObject().apply {
                put("success", true)
                put("installed", true)
                put("verified", true)
                put("packageName", playStorePkg)
                put("appName", "Google Play Store")
                put("message", if (!searchQuery.isNullOrBlank()) {
                    "Play Store par '$searchQuery' search kar raha hoon, Sir."
                } else {
                    "Google Play Store open kar diya hai, Sir."
                })
            }
        } catch (e: Exception) {
            Log.e(TAG, "Failed to launch Google Play Store: ${e.message}")
            JSONObject().apply {
                put("success", false)
                put("installed", true)
                put("packageName", playStorePkg)
                put("message", "Play Store open karne mein samasya aayi: ${e.message}")
            }
        }
    }

    /**
     * Launches camera application via native MediaStore intent.
     */
    fun launchCamera(): JSONObject {
        return try {
            val cameraIntent = Intent(MediaStore.ACTION_IMAGE_CAPTURE).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            if (cameraIntent.resolveActivity(pm) != null) {
                context.startActivity(cameraIntent)
                JSONObject().apply {
                    put("success", true)
                    put("verified", true)
                    put("message", "Camera opened successfully, Sir.")
                }
            } else {
                val camPkg = "com.google.android.GoogleCamera"
                val altPkg = "com.android.camera"
                val launchIntent = pm.getLaunchIntentForPackage(camPkg)
                    ?: pm.getLaunchIntentForPackage(altPkg)
                if (launchIntent != null) {
                    launchIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                    context.startActivity(launchIntent)
                    JSONObject().apply {
                        put("success", true)
                        put("verified", true)
                        put("message", "Camera application launched, Sir.")
                    }
                } else {
                    JSONObject().apply {
                        put("success", false)
                        put("message", "No supported camera application found on this device.")
                    }
                }
            }
        } catch (e: Exception) {
            JSONObject().apply {
                put("success", false)
                put("error", e.message)
                put("message", "Failed to open camera: ${e.message}")
            }
        }
    }

    /**
     * Launches settings via native Settings Intent.
     */
    fun launchSettings(): JSONObject {
        return try {
            val intent = Intent(Settings.ACTION_SETTINGS).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            context.startActivity(intent)
            JSONObject().apply {
                put("success", true)
                put("verified", true)
                put("message", "Device Settings opened, Sir.")
            }
        } catch (e: Exception) {
            JSONObject().apply {
                put("success", false)
                put("error", e.message)
                put("message", "Could not open Settings: ${e.message}")
            }
        }
    }

    /**
     * Main app launch method. Resolves app, checks installation, and dispatches native intent.
     */
    fun launchApp(appNameOrPackage: String?, query: String? = null): JSONObject {
        if (appNameOrPackage.isNullOrBlank()) {
            return JSONObject().apply {
                put("success", false)
                put("message", "Application name cannot be empty.")
            }
        }

        val target = appNameOrPackage.trim()

        // 1. YouTube specific route
        if (target.contains("youtube", ignoreCase = true) || target.equals("yt", ignoreCase = true) || target.equals("यूट्यूब", ignoreCase = true)) {
            return launchYouTube(query)
        }

        // 1b. Play Store specific route
        if (target.contains("play store", ignoreCase = true) || target.contains("playstore", ignoreCase = true) || target.contains("प्ले स्टोर") || target.contains("प्लेस्टोर") || target.equals("google play", ignoreCase = true) || target.equals("market", ignoreCase = true)) {
            return launchPlayStore(query)
        }

        // 2. Camera specific route
        if (target.equals("camera", ignoreCase = true) || target.equals("कैमरा", ignoreCase = true)) {
            return launchCamera()
        }

        // 3. Settings specific route
        if (target.equals("settings", ignoreCase = true) || target.equals("सेटिंग्स", ignoreCase = true)) {
            return launchSettings()
        }

        // 4. General App Resolution
        val match = resolveApp(target)
        if (match == null || !match.isInstalled) {
            return JSONObject().apply {
                put("success", false)
                put("installed", false)
                put("verified", false)
                put("appName", target)
                put("message", "Application '$target' is not installed on this Android device, Sir.")
            }
        }

        if (!match.isEnabled) {
            return JSONObject().apply {
                put("success", false)
                put("installed", true)
                put("enabled", false)
                put("appName", match.displayName)
                put("packageName", match.packageName)
                put("message", "Application '${match.displayName}' is disabled in Android Settings.")
            }
        }

        // 5. Dispatch Intent
        return try {
            val launchIntent = pm.getLaunchIntentForPackage(match.packageName)
            if (launchIntent != null) {
                launchIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_RESET_TASK_IF_NEEDED)
                context.startActivity(launchIntent)
                JSONObject().apply {
                    put("success", true)
                    put("installed", true)
                    put("verified", true)
                    put("appName", match.displayName)
                    put("packageName", match.packageName)
                    put("message", "${match.displayName} open kar diya hai, Sir.")
                }
            } else {
                JSONObject().apply {
                    put("success", false)
                    put("installed", true)
                    put("appName", match.displayName)
                    put("packageName", match.packageName)
                    put("message", "No launcher activity found for ${match.displayName}.")
                }
            }
        } catch (e: Exception) {
            JSONObject().apply {
                put("success", false)
                put("installed", true)
                put("error", e.message)
                put("message", "Could not launch ${match.displayName}: ${e.message}")
            }
        }
    }
}
