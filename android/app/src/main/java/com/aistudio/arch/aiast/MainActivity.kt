package com.aistudio.arch.aiast

import android.Manifest
import android.annotation.SuppressLint
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.view.View
import android.webkit.ConsoleMessage
import android.webkit.PermissionRequest
import android.webkit.WebChromeClient
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Toast
import androidx.activity.OnBackPressedCallback
import androidx.appcompat.app.AppCompatActivity
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import org.json.JSONObject

/**
 * ARCH Native Host Activity (Kotlin)
 *
 * Implements:
 * - Immersive Full-Screen HUD for Android 9+
 * - Secure JavaScript-to-Native Bridge (window.archNative, window.ArchAndroid)
 * - Safe origin validation (HTTPS or local assets)
 * - State restoration across background/foreground transitions
 * - Hardware back-navigation integration
 * - Runtime permission handling (Audio, Camera, Notifications)
 */
class MainActivity : AppCompatActivity() {

    companion object {
        const val PERMISSIONS_REQUEST_CODE = 3001
        // Configurable remote URL or local assets
        const val DEFAULT_WEB_URL = "https://ais-dev-n6tq2cce4fmnboruf6is3y-1051926126330.asia-southeast1.run.app"
        const val LOCAL_ASSET_URL = "file:///android_asset/dist/index.html"
    }

    private val TAG = "MainActivity"
    lateinit var webView: WebView
        private set
    lateinit var bridge: ArchBridge
        private set

    private var speechEventReceiver: BroadcastReceiver? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // Immersive Sticky Full-Screen HUD
        window.decorView.systemUiVisibility = (
            View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                or View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                or View.SYSTEM_UI_FLAG_FULLSCREEN
                or View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
        )

        webView = WebView(this)
        setContentView(webView)

        bridge = ArchBridge(applicationContext, this)

        initWebViewSettings()
        registerSpeechEventReceiver()
        checkAndRequestPermissions()

        // Handle Android hardware back navigation
        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                // Check if web page has custom back handler
                webView.evaluateJavascript("window.onHardwareBackPressed ? window.onHardwareBackPressed() : false") { result ->
                    if (result != "true") {
                        if (webView.canGoBack()) {
                            webView.goBack()
                        } else {
                            // Minimize rather than killing assistant
                            moveTaskToBack(true)
                        }
                    }
                }
            }
        })

        // Restore state or load entry point
        if (savedInstanceState != null) {
            webView.restoreState(savedInstanceState)
        } else {
            loadArchFrontend()
        }
    }

    @SuppressLint("SetJavaScriptEnabled")
    private fun initWebViewSettings() {
        val assetLoader = androidx.webkit.WebViewAssetLoader.Builder()
            .addPathHandler("/assets/", androidx.webkit.WebViewAssetLoader.AssetsPathHandler(this))
            .build()

        webView.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            databaseEnabled = true
            mediaPlaybackRequiresUserGesture = false
            allowFileAccess = true
            allowContentAccess = true
            allowFileAccessFromFileURLs = true
            allowUniversalAccessFromFileURLs = true
            cacheMode = WebSettings.LOAD_DEFAULT
            mixedContentMode = WebSettings.MIXED_CONTENT_COMPATIBILITY_MODE
            userAgentString = "${userAgentString} ArchAndroidBridge/3.0.0"
        }

        // Bind secure bridge objects
        webView.addJavascriptInterface(bridge, "archNative")
        webView.addJavascriptInterface(bridge, "ArchAndroid")
        webView.addJavascriptInterface(bridge, "AndroidBridge")
        webView.addJavascriptInterface(bridge, "Android")

        webView.webChromeClient = object : WebChromeClient() {
            override fun onPermissionRequest(request: PermissionRequest) {
                runOnUiThread {
                    // Grant microphone and audio capture for ARCH voice conversation
                    request.grant(request.resources)
                }
            }

            override fun onConsoleMessage(consoleMessage: ConsoleMessage?): Boolean {
                consoleMessage?.let {
                    android.util.Log.d("ARCH_WEB_CONSOLE", "[${it.messageLevel()}] ${it.message()} -- line ${it.lineNumber()}")
                }
                return true
            }
        }

        webView.webViewClient = object : WebViewClient() {
            override fun shouldInterceptRequest(view: WebView?, request: WebResourceRequest?): android.webkit.WebResourceResponse? {
                val url = request?.url ?: return null
                return assetLoader.shouldInterceptRequest(url)
            }

            override fun shouldOverrideUrlLoading(view: WebView?, request: WebResourceRequest?): Boolean {
                val url = request?.url?.toString() ?: return false

                // Keep ARCH routes inside WebView
                if (url.startsWith("https://appassets.androidplatform.net") || url.startsWith("https://") || url.startsWith("file://") || url.startsWith("http://localhost")) {
                    return false
                }

                // External intents (market://, tel:, mailto:, etc.)
                return try {
                    val intent = Intent(Intent.ACTION_VIEW, Uri.parse(url)).apply {
                        flags = Intent.FLAG_ACTIVITY_NEW_TASK
                    }
                    startActivity(intent)
                    true
                } catch (e: Exception) {
                    false
                }
            }

            override fun onReceivedError(view: WebView?, request: WebResourceRequest?, error: WebResourceError?) {
                if (request?.isForMainFrame == true) {
                    android.util.Log.w(TAG, "WebView main frame error: ${error?.description}")
                    // If appassets host fails, fallback to direct file asset url
                    val failingUrl = request.url.toString()
                    if (failingUrl.startsWith("https://appassets.androidplatform.net")) {
                        view?.post { view.loadUrl(LOCAL_ASSET_URL) }
                    }
                }
            }
        }
    }

    private fun loadArchFrontend() {
        // Try local bundled assets first; otherwise load live secure endpoint
        val hasLocalDist = try {
            assets.list("dist")?.isNotEmpty() == true
        } catch (e: Exception) {
            false
        }

        if (hasLocalDist) {
            // Load via WebViewAssetLoader virtual HTTPS domain for modern ES modules and Web API support
            webView.loadUrl("https://appassets.androidplatform.net/assets/dist/index.html")
        } else {
            webView.loadUrl(DEFAULT_WEB_URL)
        }
    }

    private fun registerSpeechEventReceiver() {
        speechEventReceiver = object : BroadcastReceiver() {
            override fun onReceive(context: Context?, intent: Intent?) {
                if (intent?.action == ArchForegroundService.ACTION_SPEECH_EVENT) {
                    val type = intent.getStringExtra(ArchForegroundService.EXTRA_EVENT_TYPE) ?: ""
                    val text = intent.getStringExtra(ArchForegroundService.EXTRA_TEXT) ?: ""
                    val payload = JSONObject().apply {
                        put("type", type)
                        put("text", text)
                    }.toString().replace("'", "\\'")

                    runOnUiThread {
                        webView.evaluateJavascript("window.onNativeSpeechEvent && window.onNativeSpeechEvent('$payload');", null)
                    }
                }
            }
        }

        val filter = IntentFilter(ArchForegroundService.ACTION_SPEECH_EVENT)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            registerReceiver(speechEventReceiver, filter, Context.RECEIVER_NOT_EXPORTED)
        } else {
            registerReceiver(speechEventReceiver, filter)
        }
    }

    private fun checkAndRequestPermissions() {
        val permissionsNeeded = mutableListOf<String>()

        if (ContextCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
            permissionsNeeded.add(Manifest.permission.RECORD_AUDIO)
        }
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA) != PackageManager.PERMISSION_GRANTED) {
            permissionsNeeded.add(Manifest.permission.CAMERA)
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
                permissionsNeeded.add(Manifest.permission.POST_NOTIFICATIONS)
            }
        }

        if (permissionsNeeded.isNotEmpty()) {
            ActivityCompat.requestPermissions(this, permissionsNeeded.toTypedArray(), PERMISSIONS_REQUEST_CODE)
        }
    }

    override fun onRequestPermissionsResult(requestCode: Int, permissions: Array<out String>, grantResults: IntArray) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        if (requestCode == PERMISSIONS_REQUEST_CODE) {
            val audioIndex = permissions.indexOf(Manifest.permission.RECORD_AUDIO)
            if (audioIndex >= 0 && grantResults[audioIndex] == PackageManager.PERMISSION_GRANTED) {
                Toast.makeText(this, "ARCH Voice Input Enabled", Toast.LENGTH_SHORT).show()
            }
        }
    }

    override fun onSaveInstanceState(outState: Bundle) {
        super.onSaveInstanceState(outState)
        webView.saveState(outState)
    }

    override fun onResume() {
        super.onResume()
        webView.onResume()
    }

    override fun onPause() {
        super.onPause()
        webView.onPause()
    }

    override fun onDestroy() {
        speechEventReceiver?.let {
            unregisterReceiver(it)
            speechEventReceiver = null
        }
        webView.destroy()
        super.onDestroy()
    }
}
