package com.aistudio.arch.aiast

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.speech.RecognitionListener
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import android.speech.tts.TextToSpeech
import android.speech.tts.UtteranceProgressListener
import android.util.Log
import androidx.core.app.NotificationCompat
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.launch
import java.util.Locale

/**
 * ARCH Persistent Background Voice Assistant Service
 *
 * Implements an authorized native Android Foreground Service with:
 * - microphone foreground service type (Android 14+ compatible, Android 9+ backward compatible)
 * - Persistent notification with Start, Pause, Resume, and Stop controls
 * - Android SpeechRecognizer independent of WebView and MainActivity lifecycle
 * - Integrated TextToSpeech engine to vocalize responses while ARCH is in background or phone is locked
 * - Direct execution via ArchCommandRouter
 * - Automatic echo-guard: mutes microphone while ARCH is vocalizing
 */
class ArchForegroundService : Service(), TextToSpeech.OnInitListener {

    companion object {
        const val CHANNEL_ID = "arch_bg_service_channel"
        const val NOTIFICATION_ID = 2001

        const val ACTION_START = "com.aistudio.arch.aiast.ACTION_START_BG_SERVICE"
        const val ACTION_PAUSE = "com.aistudio.arch.aiast.ACTION_PAUSE_BG_SERVICE"
        const val ACTION_RESUME = "com.aistudio.arch.aiast.ACTION_RESUME_BG_SERVICE"
        const val ACTION_STOP = "com.aistudio.arch.aiast.ACTION_STOP_BG_SERVICE"

        // Event broadcast for MainActivity/WebView synchronization
        const val ACTION_SPEECH_EVENT = "com.aistudio.arch.aiast.ACTION_SPEECH_EVENT"
        const val EXTRA_EVENT_TYPE = "extra_event_type"
        const val EXTRA_TEXT = "extra_text"

        @Volatile
        var isServiceRunning: Boolean = false
            private set

        @Volatile
        var isListeningActive: Boolean = false
            private set
    }

    private val TAG = "ArchForegroundService"
    private val serviceScope = CoroutineScope(Dispatchers.Main + Job())
    private val mainHandler = Handler(Looper.getMainLooper())

    private var speechRecognizer: SpeechRecognizer? = null
    private var tts: TextToSpeech? = null
    private var isTtsReady: Boolean = false
    private var isSpeaking: Boolean = false
    private var isPaused: Boolean = false

    private lateinit var commandRouter: ArchCommandRouter
    private lateinit var repository: ArchRepository

    override fun onCreate() {
        super.onCreate()
        Log.i(TAG, "Creating ARCH Foreground Service")
        commandRouter = ArchCommandRouter(applicationContext)
        repository = ArchRepository(applicationContext)

        createNotificationChannel()
        tts = TextToSpeech(applicationContext, this)
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val action = intent?.action ?: ACTION_START
        Log.d(TAG, "onStartCommand action: $action")

        when (action) {
            ACTION_START -> {
                isServiceRunning = true
                isPaused = false
                startForegroundWithNotification(isListening = true)
                initSpeechRecognizer()
                startListening()
            }
            ACTION_PAUSE -> {
                isPaused = true
                stopListening()
                updateNotification(isListening = false, isPaused = true)
            }
            ACTION_RESUME -> {
                isPaused = false
                startForegroundWithNotification(isListening = true)
                startListening()
            }
            ACTION_STOP -> {
                isServiceRunning = false
                isPaused = false
                stopListening()
                stopForeground(true)
                stopSelf()
            }
        }

        return START_STICKY
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                getString(R.string.bg_service_channel_name),
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = getString(R.string.bg_service_channel_desc)
                setShowBadge(false)
            }
            val nm = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            nm.createNotificationChannel(channel)
        }
    }

    private fun buildNotification(isListening: Boolean, isPaused: Boolean): Notification {
        // Tap notification to bring ARCH to foreground
        val openIntent = Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP
        }
        val openPendingIntent = PendingIntent.getActivity(
            this,
            0,
            openIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        // Pause/Resume Action
        val toggleActionIntent = Intent(this, ArchForegroundService::class.java).apply {
            action = if (isPaused) ACTION_RESUME else ACTION_PAUSE
        }
        val togglePendingIntent = PendingIntent.getService(
            this,
            1,
            toggleActionIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        // Stop Action
        val stopActionIntent = Intent(this, ArchForegroundService::class.java).apply {
            action = ACTION_STOP
        }
        val stopPendingIntent = PendingIntent.getService(
            this,
            2,
            stopActionIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val statusText = when {
            isPaused -> getString(R.string.bg_service_paused)
            isListening -> getString(R.string.bg_service_listening)
            else -> "Standby"
        }

        val toggleActionLabel = if (isPaused) getString(R.string.action_resume) else getString(R.string.action_pause)
        val toggleIcon = if (isPaused) R.drawable.ic_mic else R.drawable.ic_pause

        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_arch_notification)
            .setContentTitle(getString(R.string.bg_service_title))
            .setContentText(statusText)
            .setStyle(NotificationCompat.BigTextStyle().bigText("ARCH Voice Assistant is active.\nStatus: $statusText"))
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setContentIntent(openPendingIntent)
            .addAction(toggleIcon, toggleActionLabel, togglePendingIntent)
            .addAction(R.drawable.ic_stop, getString(R.string.action_stop), stopPendingIntent)
            .build()
    }

    private fun startForegroundWithNotification(isListening: Boolean) {
        val notification = buildNotification(isListening = isListening, isPaused = false)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            // Android 14+ requires explicit MICROPHONE foregroundServiceType
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
                try {
                    startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE)
                } catch (e: Exception) {
                    Log.w(TAG, "Failed to start with FOREGROUND_SERVICE_TYPE_MICROPHONE: ${e.message}")
                    startForeground(NOTIFICATION_ID, notification)
                }
            } else {
                startForeground(NOTIFICATION_ID, notification)
            }
        } else {
            startForeground(NOTIFICATION_ID, notification)
        }
    }

    private fun updateNotification(isListening: Boolean, isPaused: Boolean) {
        val notification = buildNotification(isListening, isPaused)
        val nm = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        nm.notify(NOTIFICATION_ID, notification)
    }

    private fun initSpeechRecognizer() {
        if (!SpeechRecognizer.isRecognitionAvailable(this)) {
            Log.e(TAG, "SpeechRecognizer is unavailable on this system")
            return
        }

        if (speechRecognizer != null) {
            speechRecognizer?.destroy()
        }

        speechRecognizer = SpeechRecognizer.createSpeechRecognizer(this).apply {
            setRecognitionListener(object : RecognitionListener {
                override fun onReadyForSpeech(params: Bundle?) {
                    isListeningActive = true
                    broadcastSpeechEvent("ready", "")
                }

                override fun onBeginningOfSpeech() {
                    broadcastSpeechEvent("speech_started", "")
                }

                override fun onRmsChanged(rmsdB: Float) {}

                override fun onBufferReceived(buffer: ByteArray?) {}

                override fun onEndOfSpeech() {
                    isListeningActive = false
                }

                override fun onError(error: Int) {
                    isListeningActive = false
                    val errorMsg = getErrorText(error)
                    Log.d(TAG, "Speech recognition error: $errorMsg ($error)")
                    broadcastSpeechEvent("error", errorMsg)

                    // Auto restart recognition after brief backoff unless stopped or speaking
                    if (isServiceRunning && !isPaused && !isSpeaking) {
                        mainHandler.postDelayed({
                            startListening()
                        }, 1000)
                    }
                }

                override fun onResults(results: Bundle?) {
                    val matches = results?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)
                    val topText = matches?.firstOrNull() ?: ""
                    Log.i(TAG, "Background Recognized: '$topText'")

                    if (topText.isNotBlank()) {
                        broadcastSpeechEvent("final", topText)
                        handleRecognizedSpeech(topText)
                    } else {
                        // Loop restart
                        if (isServiceRunning && !isPaused && !isSpeaking) {
                            startListening()
                        }
                    }
                }

                override fun onPartialResults(partialResults: Bundle?) {
                    val matches = partialResults?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)
                    val interim = matches?.firstOrNull() ?: ""
                    if (interim.isNotBlank()) {
                        broadcastSpeechEvent("partial", interim)
                    }
                }

                override fun onEvent(eventType: Int, params: Bundle?) {}
            })
        }
    }

    private fun startListening() {
        if (!isServiceRunning || isPaused || isSpeaking) {
            Log.d(TAG, "startListening skipped: isServiceRunning=$isServiceRunning, isPaused=$isPaused, isSpeaking=$isSpeaking")
            return
        }

        mainHandler.post {
            try {
                val intent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
                    putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
                    putExtra(RecognizerIntent.EXTRA_LANGUAGE, "en-IN")
                    putExtra(RecognizerIntent.EXTRA_LANGUAGE_PREFERENCE, "en-IN")
                    putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true)
                    putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 3)
                }
                speechRecognizer?.startListening(intent)
                isListeningActive = true
            } catch (e: Exception) {
                Log.e(TAG, "startListening exception: ${e.message}")
            }
        }
    }

    private fun stopListening() {
        mainHandler.post {
            try {
                speechRecognizer?.stopListening()
                speechRecognizer?.cancel()
                isListeningActive = false
            } catch (e: Exception) {
                Log.w(TAG, "stopListening exception: ${e.message}")
            }
        }
    }

    private fun handleRecognizedSpeech(text: String) {
        serviceScope.launch {
            // Save user prompt in Room vault
            repository.saveMessage("user", text)

            // Route directly on device
            val result = commandRouter.routeCommand(text)

            if (result.isHandledLocally) {
                // Speak local response
                val spoken = result.spokenResponse
                if (spoken.isNotBlank()) {
                    speak(spoken)
                    repository.saveMessage("model", spoken, result.action)
                }
            } else {
                // Generative AI / Web action needed -> broadcast to WebView if open
                Log.i(TAG, "Command requires AI reasoning: '$text'")
            }

            // Resume listening loop after brief delay (handled in UtteranceProgressListener if speaking)
            if (!isSpeaking && isServiceRunning && !isPaused) {
                mainHandler.postDelayed({
                    startListening()
                }, 800)
            }
        }
    }

    private fun speak(text: String) {
        if (!isTtsReady || tts == null) {
            Log.w(TAG, "TTS not ready to vocalize: '$text'")
            return
        }

        // Echo-guard: stop mic capture while ARCH is speaking
        isSpeaking = true
        stopListening()

        tts?.setOnUtteranceProgressListener(object : UtteranceProgressListener() {
            override fun onStart(utteranceId: String?) {
                isSpeaking = true
            }

            override fun onDone(utteranceId: String?) {
                isSpeaking = false
                if (isServiceRunning && !isPaused) {
                    mainHandler.postDelayed({
                        startListening()
                    }, 500)
                }
            }

            override fun onError(utteranceId: String?) {
                isSpeaking = false
                if (isServiceRunning && !isPaused) {
                    startListening()
                }
            }
        })

        tts?.speak(text, TextToSpeech.QUEUE_FLUSH, null, "arch_bg_utterance_${System.currentTimeMillis()}")
    }

    private fun broadcastSpeechEvent(type: String, text: String) {
        val intent = Intent(ACTION_SPEECH_EVENT).apply {
            putExtra(EXTRA_EVENT_TYPE, type)
            putExtra(EXTRA_TEXT, text)
        }
        sendBroadcast(intent)
    }

    override fun onInit(status: Int) {
        if (status == TextToSpeech.SUCCESS) {
            tts?.language = Locale("en", "IN")
            isTtsReady = true
            Log.i(TAG, "TextToSpeech successfully initialized in Background Service")
        } else {
            Log.e(TAG, "TextToSpeech initialization failed with status $status")
            isTtsReady = false
        }
    }

    private fun getErrorText(errorCode: Int): String = when (errorCode) {
        SpeechRecognizer.ERROR_AUDIO -> "Audio recording error"
        SpeechRecognizer.ERROR_CLIENT -> "Client side error"
        SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS -> "Insufficient permissions"
        SpeechRecognizer.ERROR_NETWORK -> "Network error"
        SpeechRecognizer.ERROR_NETWORK_TIMEOUT -> "Network timeout"
        SpeechRecognizer.ERROR_NO_MATCH -> "No recognition match"
        SpeechRecognizer.ERROR_RECOGNIZER_BUSY -> "RecognitionService busy"
        SpeechRecognizer.ERROR_SERVER -> "Server error"
        SpeechRecognizer.ERROR_SPEECH_TIMEOUT -> "No speech input"
        else -> "Unknown speech error"
    }

    override fun onDestroy() {
        super.onDestroy()
        isServiceRunning = false
        isListeningActive = false
        stopListening()

        speechRecognizer?.destroy()
        speechRecognizer = null

        tts?.stop()
        tts?.shutdown()
        tts = null

        Log.i(TAG, "ArchForegroundService destroyed.")
    }

    override fun onBind(intent: Intent?): IBinder? = null
}
