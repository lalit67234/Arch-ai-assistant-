package com.stark.jarvis

import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.speech.RecognitionListener
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import android.speech.tts.TextToSpeech
import android.util.Log
import org.json.JSONObject
import java.util.Locale

/**
 * ARCH Speech Manager: Handles Android Native Text-to-Speech (TTS)
 * and SpeechRecognizer with support for Hindi ("hi_IN") and English ("en_IN" / "en_US").
 * Fully compatible with Android 9 (API 28) and above.
 */
class ArchSpeechManager(private val context: Context, private val onResultCallback: (String) -> Unit) :
    TextToSpeech.OnInitListener, RecognitionListener {

    private val TAG = "ArchSpeechManager"
    private var tts: TextToSpeech? = null
    private var isTtsReady = false
    private var speechRecognizer: SpeechRecognizer? = null
    private var isListening = false

    init {
        try {
            tts = TextToSpeech(context, this)
        } catch (e: Exception) {
            Log.e(TAG, "Failed to initialize TextToSpeech", e)
        }
    }

    override fun onInit(status: Int) {
        if (status == TextToSpeech.SUCCESS) {
            isTtsReady = true
            // Default to Indian English or Hindi
            val locale = Locale("en", "IN")
            val available = tts?.isLanguageAvailable(locale)
            if (available == TextToSpeech.LANG_AVAILABLE || available == TextToSpeech.LANG_COUNTRY_AVAILABLE) {
                tts?.language = locale
            } else {
                tts?.language = Locale.US
            }
            tts?.setPitch(1.0f)
            tts?.setSpeechRate(1.0f)
            Log.i(TAG, "Native TTS initialized successfully")
        } else {
            Log.e(TAG, "TTS Initialization failed with status: $status")
            isTtsReady = false
        }
    }

    fun speak(text: String, language: String = "hi_IN"): Boolean {
        if (!isTtsReady || tts == null) return false
        try {
            val targetLocale = if (language.startsWith("hi", ignoreCase = true)) {
                Locale("hi", "IN")
            } else {
                Locale("en", "IN")
            }

            if (tts?.isLanguageAvailable(targetLocale) == TextToSpeech.LANG_AVAILABLE ||
                tts?.isLanguageAvailable(targetLocale) == TextToSpeech.LANG_COUNTRY_AVAILABLE) {
                tts?.language = targetLocale
            }

            tts?.speak(text, TextToSpeech.QUEUE_FLUSH, null, "arch_tts_${System.currentTimeMillis()}")
            return true
        } catch (e: Exception) {
            Log.e(TAG, "Speech playback error", e)
            return false
        }
    }

    fun stopSpeaking() {
        try {
            tts?.stop()
        } catch (e: Exception) {
            Log.w(TAG, "Error stopping TTS", e)
        }
    }

    fun startListening(language: String = "hi_IN") {
        if (isListening) return

        try {
            if (!SpeechRecognizer.isRecognitionAvailable(context)) {
                onResultCallback(JSONObject().apply {
                    put("type", "speech_error")
                    put("message", "Android Speech Recognition service is not available on this device.")
                }.toString())
                return
            }

            if (speechRecognizer == null) {
                speechRecognizer = SpeechRecognizer.createSpeechRecognizer(context).apply {
                    setRecognitionListener(this@ArchSpeechManager)
                }
            }

            val intent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
                putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
                putExtra(RecognizerIntent.EXTRA_LANGUAGE, if (language.startsWith("hi", ignoreCase = true)) "hi-IN" else "en-IN")
                putExtra(RecognizerIntent.EXTRA_LANGUAGE_PREFERENCE, if (language.startsWith("hi", ignoreCase = true)) "hi-IN" else "en-IN")
                putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true)
                putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 3)
            }

            speechRecognizer?.startListening(intent)
            isListening = true
        } catch (e: Exception) {
            Log.e(TAG, "Error starting speech recognition", e)
            isListening = false
        }
    }

    fun stopListening() {
        try {
            speechRecognizer?.stopListening()
            isListening = false
        } catch (e: Exception) {
            Log.w(TAG, "Error stopping speech recognition", e)
        }
    }

    fun destroy() {
        try {
            tts?.stop()
            tts?.shutdown()
        } catch (e: Exception) {}
        try {
            speechRecognizer?.destroy()
        } catch (e: Exception) {}
    }

    // SpeechRecognizer Callbacks
    override fun onReadyForSpeech(params: Bundle?) {
        onResultCallback(JSONObject().apply {
            put("type", "speech_status")
            put("status", "ready_for_speech")
        }.toString())
    }

    override fun onBeginningOfSpeech() {
        onResultCallback(JSONObject().apply {
            put("type", "speech_status")
            put("status", "speech_started")
        }.toString())
    }

    override fun onRmsChanged(rmsdB: Float) {}

    override fun onBufferReceived(buffer: ByteArray?) {}

    override fun onEndOfSpeech() {
        isListening = false
        onResultCallback(JSONObject().apply {
            put("type", "speech_status")
            put("status", "speech_ended")
        }.toString())
    }

    override fun onError(error: Int) {
        isListening = false
        val errorMsg = when (error) {
            SpeechRecognizer.ERROR_AUDIO -> "Audio recording error"
            SpeechRecognizer.ERROR_CLIENT -> "Client error"
            SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS -> "RECORD_AUDIO permission missing"
            SpeechRecognizer.ERROR_NETWORK -> "Network connection required for speech recognition"
            SpeechRecognizer.ERROR_NETWORK_TIMEOUT -> "Network timeout"
            SpeechRecognizer.ERROR_NO_MATCH -> "No speech recognized. Ek baar phir bolenge sir?"
            SpeechRecognizer.ERROR_RECOGNIZER_BUSY -> "Speech recognizer is busy"
            SpeechRecognizer.ERROR_SERVER -> "Server error"
            SpeechRecognizer.ERROR_SPEECH_TIMEOUT -> "Speech timeout (silence)"
            else -> "Speech recognition error ($error)"
        }
        onResultCallback(JSONObject().apply {
            put("type", "speech_error")
            put("errorCode", error)
            put("message", errorMsg)
        }.toString())
    }

    override fun onResults(results: Bundle?) {
        isListening = false
        val matches = results?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)
        val text = matches?.firstOrNull() ?: ""
        onResultCallback(JSONObject().apply {
            put("type", "speech_result")
            put("text", text)
            put("allMatches", matches?.joinToString("|") ?: "")
        }.toString())
    }

    override fun onPartialResults(partialResults: Bundle?) {
        val matches = partialResults?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)
        val text = matches?.firstOrNull() ?: ""
        if (text.isNotEmpty()) {
            onResultCallback(JSONObject().apply {
                put("type", "speech_partial")
                put("text", text)
            }.toString())
        }
    }

    override fun onEvent(eventType: Int, params: Bundle?) {}
}
