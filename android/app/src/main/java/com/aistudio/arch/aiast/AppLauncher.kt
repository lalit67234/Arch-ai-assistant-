package com.aistudio.arch.aiast

import android.content.Context
import android.content.Intent
import android.content.pm.ApplicationInfo
import android.content.pm.PackageManager
import android.net.Uri
import android.provider.Settings
import android.util.Log
import org.json.JSONArray
import org.json.JSONObject
import java.util.Locale

/**
 * ARCH Universal Installed Application Launcher
 *
 * Implements:
 * - Dynamic discovery via Android PackageManager
 * - Multilingual & Hinglish alias resolution
 * - Strict verification: does not claim an app opened unless the intent successfully started
 * - Explicit distinct error codes: APP_NOT_INSTALLED, APP_NOT_LAUNCHABLE, PERMISSION_DENIED
 */
class AppLauncher(private val context: Context) {

    private val TAG = "AppLauncher"
    private val pm: PackageManager = context.packageManager

    data class AppLaunchResult(
        val success: Boolean,
        val errorCode: String? = null,
        val errorMessage: String? = null,
        val packageName: String? = null,
        val appName: String? = null
    ) {
        fun toJsonObject(): JSONObject = JSONObject().apply {
            put("success", success)
            put("packageName", packageName ?: "")
            put("appName", appName ?: "")
            if (!success) {
                put("errorCode", errorCode ?: "APP_NOT_LAUNCHABLE")
                put("errorMessage", errorMessage ?: "Unknown launch failure")
            }
        }
    }

    data class AppAliasDefinition(
        val canonicalName: String,
        val primaryPackage: String,
        val fallbackPackages: List<String> = emptyList(),
        val aliases: List<String>,
        val systemAction: String? = null
    )

    private val verifiedRegistry = listOf(
        AppAliasDefinition(
            canonicalName = "YouTube",
            primaryPackage = "com.google.android.youtube",
            fallbackPackages = listOf("com.google.android.apps.youtube.mango"),
            aliases = listOf("youtube", "yt", "यू ट्यूब", "यूट्यूब")
        ),
        AppAliasDefinition(
            canonicalName = "YouTube Music",
            primaryPackage = "com.google.android.apps.youtube.music",
            aliases = listOf("yt music", "youtube music", "ytmusic")
        ),
        AppAliasDefinition(
            canonicalName = "Spotify",
            primaryPackage = "com.spotify.music",
            aliases = listOf("spotify", "स्पॉटिफ़ाई", "स्पॉटिफाई", "spoty", "gaane")
        ),
        AppAliasDefinition(
            canonicalName = "Google Play Store",
            primaryPackage = "com.android.vending",
            aliases = listOf("play store", "playstore", "google play", "मार्केट", "प्ले स्टोर")
        ),
        AppAliasDefinition(
            canonicalName = "Pinterest",
            primaryPackage = "com.pinterest",
            aliases = listOf("pinterest", "पिनट्रेस्ट", "पिनटरेस्ट")
        ),
        AppAliasDefinition(
            canonicalName = "WhatsApp",
            primaryPackage = "com.whatsapp",
            fallbackPackages = listOf("com.whatsapp.w4b"),
            aliases = listOf("whatsapp", "व्हाट्सएप", "व्हाट्सऐप", "wa")
        ),
        AppAliasDefinition(
            canonicalName = "Google Chrome",
            primaryPackage = "com.android.chrome",
            aliases = listOf("chrome", "google chrome", "browser", "इंटरनेट", "क्रोम")
        ),
        AppAliasDefinition(
            canonicalName = "Camera",
            primaryPackage = "android.hardware.camera2",
            aliases = listOf("camera", "cam", "photo", "फोटो", "कैमरा"),
            systemAction = android.provider.MediaStore.ACTION_IMAGE_CAPTURE
        ),
        AppAliasDefinition(
            canonicalName = "Google Maps",
            primaryPackage = "com.google.android.apps.maps",
            aliases = listOf("maps", "google maps", "map", "नेविगेशन", "मैप्स")
        ),
        AppAliasDefinition(
            canonicalName = "Android Settings",
            primaryPackage = "com.android.settings",
            aliases = listOf("settings", "phone settings", "phone ki settings", "डिवाइस सेटिंग्स", "सेटिंग्स"),
            systemAction = Settings.ACTION_SETTINGS
        ),
        AppAliasDefinition(
            canonicalName = "Files / Storage",
            primaryPackage = "com.google.android.documentsui",
            fallbackPackages = listOf("com.google.android.apps.nbu.files"),
            aliases = listOf("files", "file manager", "downloads", "फ़ाइलें")
        ),
        AppAliasDefinition(
            canonicalName = "Calculator",
            primaryPackage = "com.google.android.calculator",
            aliases = listOf("calculator", "calc", "कैलकुलेटर")
        ),
        AppAliasDefinition(
            canonicalName = "Photos / Gallery",
            primaryPackage = "com.google.android.apps.photos",
            fallbackPackages = listOf("com.android.gallery3d"),
            aliases = listOf("photos", "gallery", "photo gallery", "गैलरी")
        ),
        AppAliasDefinition(
            canonicalName = "Telegram",
            primaryPackage = "org.telegram.messenger",
            aliases = listOf("telegram", "tg", "टेलीग्राम")
        ),
        AppAliasDefinition(
            canonicalName = "HopeWeb HTML Editor",
            primaryPackage = "com.hopeweb.editor",
            aliases = listOf("hopeweb", "hope web", "html editor", "mera html editor")
        ),
        AppAliasDefinition(
            canonicalName = "Acode Code Editor",
            primaryPackage = "io.github.rosemoe.editor",
            aliases = listOf("acode", "code editor", "text editor")
        ),
        AppAliasDefinition(
            canonicalName = "Pydroid 3",
            primaryPackage = "ru.iiec.pydroid3",
            aliases = listOf("pydroid", "pydroid 3", "python ide", "mera python editor")
        )
    )

    /**
     * Resolves an app name or alias into a verified installed package or system action.
     */
    fun resolveApp(query: String): ResolvedTarget? {
        val clean = query.trim().lowercase(Locale.ROOT)
            .replace(Regex("^(open|launch|chalao|kholo|start)\\s+"), "")
            .replace(Regex("\\s+(open karo|kholo|chalao|start karo|app)$"), "")
            .trim()

        // 1. Check known registry
        for (def in verifiedRegistry) {
            val matches = clean == def.canonicalName.lowercase(Locale.ROOT) ||
                clean == def.primaryPackage.lowercase(Locale.ROOT) ||
                def.aliases.any { clean.contains(it.lowercase(Locale.ROOT)) }

            if (matches) {
                // Check primary package
                if (isPackageInstalled(def.primaryPackage)) {
                    return ResolvedTarget(def.canonicalName, def.primaryPackage, def.systemAction)
                }
                // Check fallback packages
                for (fallback in def.fallbackPackages) {
                    if (isPackageInstalled(fallback)) {
                        return ResolvedTarget(def.canonicalName, fallback, def.systemAction)
                    }
                }
                // If it has a system action (e.g. Camera or Settings), it can still launch via action
                if (def.systemAction != null) {
                    return ResolvedTarget(def.canonicalName, null, def.systemAction)
                }
                // App is known but not installed
                return ResolvedTarget(def.canonicalName, def.primaryPackage, null, isInstalled = false)
            }
        }

        // 2. Dynamic discovery via PackageManager
        val installedApps = getLaunchableInstalledApps()
        for (app in installedApps) {
            val labelLower = app.label.lowercase(Locale.ROOT)
            val pkgLower = app.packageName.lowercase(Locale.ROOT)
            if (labelLower == clean || labelLower.contains(clean) || clean.contains(labelLower) || pkgLower.contains(clean)) {
                return ResolvedTarget(app.label, app.packageName, null, isInstalled = true)
            }
        }

        return null
    }

    data class ResolvedTarget(
        val name: String,
        val packageName: String?,
        val systemAction: String?,
        val isInstalled: Boolean = true
    )

    data class InstalledAppItem(
        val label: String,
        val packageName: String
    )

    fun isPackageInstalled(packageName: String): Boolean {
        return try {
            pm.getPackageInfo(packageName, 0)
            true
        } catch (e: PackageManager.NameNotFoundException) {
            false
        }
    }

    fun getLaunchableInstalledApps(): List<InstalledAppItem> {
        val intent = Intent(Intent.ACTION_MAIN, null).apply {
            addCategory(Intent.CATEGORY_LAUNCHER)
        }
        val resolveInfos = pm.queryIntentActivities(intent, 0)
        val list = mutableListOf<InstalledAppItem>()
        for (ri in resolveInfos) {
            val label = ri.loadLabel(pm).toString()
            val pkg = ri.activityInfo.packageName
            list.add(InstalledAppItem(label, pkg))
        }
        return list
    }

    fun getLaunchableAppsJson(): String {
        val apps = getLaunchableInstalledApps()
        val array = JSONArray()
        for (app in apps) {
            array.put(JSONObject().apply {
                put("name", app.label)
                put("packageName", app.packageName)
            })
        }
        return array.toString()
    }

    /**
     * Executes explicit launch for the requested application.
     */
    fun launchApp(queryOrPackage: String): AppLaunchResult {
        val target = resolveApp(queryOrPackage)

        if (target == null) {
            // Check if query is a raw package name
            if (isPackageInstalled(queryOrPackage)) {
                return launchByPackage(queryOrPackage, queryOrPackage)
            }
            return AppLaunchResult(
                success = false,
                errorCode = "APP_NOT_INSTALLED",
                errorMessage = "Application '$queryOrPackage' is not installed on this Android device."
            )
        }

        if (!target.isInstalled) {
            return AppLaunchResult(
                success = false,
                errorCode = "APP_NOT_INSTALLED",
                errorMessage = "${target.name} is not installed.",
                appName = target.name,
                packageName = target.packageName
            )
        }

        // Try System Action if defined (Camera, Settings)
        if (target.systemAction != null) {
            try {
                val intent = Intent(target.systemAction).apply {
                    flags = Intent.FLAG_ACTIVITY_NEW_TASK
                }
                if (intent.resolveActivity(pm) != null) {
                    context.startActivity(intent)
                    return AppLaunchResult(success = true, appName = target.name)
                }
            } catch (e: Exception) {
                Log.w(TAG, "System action ${target.systemAction} failed, attempting package fallback: ${e.message}")
            }
        }

        if (target.packageName != null) {
            return launchByPackage(target.packageName, target.name)
        }

        return AppLaunchResult(
            success = false,
            errorCode = "APP_NOT_LAUNCHABLE",
            errorMessage = "No launchable activity found for ${target.name}."
        )
    }

    private fun launchByPackage(packageName: String, appName: String): AppLaunchResult {
        return try {
            val intent = pm.getLaunchIntentForPackage(packageName)
            if (intent == null) {
                AppLaunchResult(
                    success = false,
                    errorCode = "APP_NOT_LAUNCHABLE",
                    errorMessage = "Package $packageName is installed but lacks a launchable launcher activity.",
                    packageName = packageName,
                    appName = appName
                )
            } else {
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                context.startActivity(intent)
                Log.i(TAG, "Successfully launched $appName ($packageName)")
                AppLaunchResult(
                    success = true,
                    packageName = packageName,
                    appName = appName
                )
            }
        } catch (se: SecurityException) {
            Log.e(TAG, "SecurityException launching $packageName: ${se.message}")
            AppLaunchResult(
                success = false,
                errorCode = "PERMISSION_DENIED",
                errorMessage = "Android security policy prevented launching $packageName: ${se.message}",
                packageName = packageName,
                appName = appName
            )
        } catch (e: Exception) {
            Log.e(TAG, "Exception launching $packageName: ${e.message}")
            AppLaunchResult(
                success = false,
                errorCode = "APP_NOT_LAUNCHABLE",
                errorMessage = "Launch failed: ${e.message}",
                packageName = packageName,
                appName = appName
            )
        }
    }
}
