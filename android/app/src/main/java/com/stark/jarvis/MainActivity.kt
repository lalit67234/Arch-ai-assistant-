package com.stark.jarvis

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.media.projection.MediaProjectionManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.view.View
import android.webkit.PermissionRequest
import android.webkit.WebChromeClient
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat

/**
 * ARCH Native Android Host Activity (Kotlin)
 *
 * Implements:
 * - Immersive full-screen Android OS HUD
 * - Secure JavaScript Bridge (ArchAndroid, AndroidBridge, Android)
 * - Android 9 (API 28) lifecycle management and permission handling
 * - Android Native SpeechRecognizer & TextToSpeech via ArchSpeechManager
 * - Screen capture integration via MediaProjectionService
 * - Hardware Back Button event dispatching to Web application
 */
class MainActivity : AppCompatActivity() {

    companion object {
        const val REQUEST_SCREEN_CAPTURE = 1001
        const val REQUEST_AUDIO_PERMISSION = 1002
        const val REQUEST_CAMERA_PERMISSION = 1003
    }

    lateinit var webView: WebView
        private set
    lateinit var nativeBridge: ArchNativeBridge
        private set
    var speechManager: ArchSpeechManager? = null
        private set

    private var projectionManager: MediaProjectionManager? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // Immersive full-screen setup for Android 9+
        window.decorView.systemUiVisibility = (
            View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                or View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                or View.SYSTEM_UI_FLAG_FULLSCREEN
                or View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
        )

        webView = WebView(this)
        setContentView(webView)

        initWebViewSettings()

        // Initialize Speech Manager
        speechManager = ArchSpeechManager(this) { jsonResult ->
            runOnUiThread {
                // Forward speech recognition events directly to WebView
                val escaped = jsonResult.replace("'", "\\'")
                webView.evaluateJavascript("window.onNativeSpeechEvent && window.onNativeSpeechEvent('$escaped');", null)
            }
        }

        // Initialize Native Bridge
        nativeBridge = ArchNativeBridge(this)
        webView.addJavascriptInterface(nativeBridge, "ArchAndroid")
        webView.addJavascriptInterface(nativeBridge, "AndroidBridge")
        webView.addJavascriptInterface(nativeBridge, "Android")

        // Load ARCH frontend (assets or remote development endpoint)
        val remoteUrl = intent.getStringExtra("SERVER_URL")
        if (!remoteUrl.isNullOrEmpty()) {
            webView.loadUrl(remoteUrl)
        } else {
            try {
                assets.open("dist/index.html").use {
                    webView.loadUrl("file:///android_asset/dist/index.html")
                }
            } catch (e: Exception) {
                // Default to deployed production applet host
                webView.loadUrl("https://ais-dev-n6tq2cce4fmnboruf6is3y-1051926126330.asia-southeast1.run.app")
            }
        }

        checkInitialPermissions()
    }

    private fun initWebViewSettings() {
        webView.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            databaseEnabled = true
            mediaPlaybackRequiresUserGesture = false
            allowFileAccess = true
            allowContentAccess = true
            mixedContentMode = WebSettings.MIXED_CONTENT_ALWAYS_ALLOW
            useWideViewPort = true
            loadWithOverviewMode = true
        }

        webView.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(view: WebView?, url: String?): Boolean {
                if (url == null) return false
                if (url.startsWith("http://") || url.startsWith("https://") || url.startsWith("file://")) {
                    return false
                }
                // Handle deep links or tel:, mailto:, intent:
                return try {
                    val intent = Intent(Intent.ACTION_VIEW, Uri.parse(url)).apply {
                        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                    }
                    startActivity(intent)
                    true
                } catch (e: Exception) {
                    true
                }
            }
        }

        webView.webChromeClient = object : WebChromeClient() {
            override fun onPermissionRequest(request: PermissionRequest?) {
                // Auto-grant WebRTC microphone/camera permissions in WebView
                runOnUiThread {
                    request?.grant(request.resources)
                }
            }
        }
    }

    private fun checkInitialPermissions() {
        val permissionsToRequest = mutableListOf<String>()

        if (ContextCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
            permissionsToRequest.add(Manifest.permission.RECORD_AUDIO)
        }

        if (ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA) != PackageManager.PERMISSION_GRANTED) {
            permissionsToRequest.add(Manifest.permission.CAMERA)
        }

        if (permissionsToRequest.isNotEmpty()) {
            ActivityCompat.requestPermissions(this, permissionsToRequest.toTypedArray(), REQUEST_AUDIO_PERMISSION)
        }
    }

    fun requestAudioPermission() {
        ActivityCompat.requestPermissions(this, arrayOf(Manifest.permission.RECORD_AUDIO), REQUEST_AUDIO_PERMISSION)
    }

    fun requestCameraPermission() {
        ActivityCompat.requestPermissions(this, arrayOf(Manifest.permission.CAMERA), REQUEST_CAMERA_PERMISSION)
    }

    fun startScreenCapture() {
        projectionManager = getSystemService(MEDIA_PROJECTION_SERVICE) as? MediaProjectionManager
        projectionManager?.let {
            startActivityForResult(it.createScreenCaptureIntent(), REQUEST_SCREEN_CAPTURE)
        }
    }

    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        if (requestCode == REQUEST_SCREEN_CAPTURE && resultCode == RESULT_OK && data != null) {
            val serviceIntent = Intent(this, MediaProjectionService::class.java).apply {
                putExtra("PROJECTION_DATA", data)
            }
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                startForegroundService(serviceIntent)
            } else {
                startService(serviceIntent)
            }
            Toast.makeText(this, "ARCH Screen Vision activated", Toast.LENGTH_SHORT).show()
            webView.evaluateJavascript("window.onNativeScreenCaptureStarted && window.onNativeScreenCaptureStarted();", null)
        }
    }

    override fun onRequestPermissionsResult(requestCode: Int, permissions: Array<out String>, grantResults: IntArray) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        when (requestCode) {
            REQUEST_AUDIO_PERMISSION -> {
                val granted = grantResults.isNotEmpty() && grantResults[0] == PackageManager.PERMISSION_GRANTED
                webView.evaluateJavascript("window.onNativePermissionResult && window.onNativePermissionResult('audio', $granted);", null)
            }
            REQUEST_CAMERA_PERMISSION -> {
                val granted = grantResults.isNotEmpty() && grantResults[0] == PackageManager.PERMISSION_GRANTED
                webView.evaluateJavascript("window.onNativePermissionResult && window.onNativePermissionResult('camera', $granted);", null)
            }
        }
    }

    override fun onBackPressed() {
        // Dispatch hardware back event to JS so full-screen workspace, modals, or terminal can consume it
        webView.evaluateJavascript("window.dispatchEvent(new CustomEvent('archBackButton'));", null)
        if (webView.canGoBack()) {
            webView.goBack()
        } else {
            super.onBackPressed()
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        speechManager?.destroy()
    }
}
