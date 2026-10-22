package com.aistudio.arch.aiast

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import android.util.Log

/**
 * ARCH Persistent Reminder Scheduler
 *
 * Uses Android AlarmManager to trigger exact, Doze-mode-resistant alarms.
 * Integrates with Android 9 (API 28) through Android 14 (API 34).
 */
class ReminderScheduler(private val context: Context) {

    private val TAG = "ReminderScheduler"
    private val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as? AlarmManager

    fun scheduleReminder(reminder: ReminderEntity): Boolean {
        if (alarmManager == null) {
            Log.e(TAG, "AlarmManager unavailable on device")
            return false
        }

        val triggerTime = reminder.triggerTimeMillis
        if (triggerTime <= System.currentTimeMillis()) {
            Log.w(TAG, "Trigger time is in the past for reminder ${reminder.id}")
            return false
        }

        val intent = Intent(context, ReminderReceiver::class.java).apply {
            action = ReminderReceiver.ACTION_TRIGGER_REMINDER
            putExtra(ReminderReceiver.EXTRA_REMINDER_ID, reminder.id)
            putExtra(ReminderReceiver.EXTRA_REMINDER_TITLE, reminder.title)
        }

        val pendingIntent = PendingIntent.getBroadcast(
            context,
            reminder.id.hashCode(),
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                if (alarmManager.canScheduleExactAlarms()) {
                    alarmManager.setExactAndAllowWhileIdle(
                        AlarmManager.RTC_WAKEUP,
                        triggerTime,
                        pendingIntent
                    )
                } else {
                    // Fallback to inexact alarm if exact alarm permission was revoked by user
                    alarmManager.setAndAllowWhileIdle(
                        AlarmManager.RTC_WAKEUP,
                        triggerTime,
                        pendingIntent
                    )
                }
            } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                // Android 6 to 11 (covers Android 9 / API 28)
                alarmManager.setExactAndAllowWhileIdle(
                    AlarmManager.RTC_WAKEUP,
                    triggerTime,
                    pendingIntent
                )
            } else {
                alarmManager.setExact(
                    AlarmManager.RTC_WAKEUP,
                    triggerTime,
                    pendingIntent
                )
            }
            Log.i(TAG, "Successfully scheduled reminder ${reminder.id} for $triggerTime")
            return true
        } catch (e: SecurityException) {
            Log.e(TAG, "SecurityException while scheduling exact alarm: ${e.message}")
            try {
                alarmManager.set(AlarmManager.RTC_WAKEUP, triggerTime, pendingIntent)
                return true
            } catch (fallbackEx: Exception) {
                Log.e(TAG, "Fallback alarm failed: ${fallbackEx.message}")
                return false
            }
        } catch (e: Exception) {
            Log.e(TAG, "Failed to schedule alarm: ${e.message}")
            return false
        }
    }

    fun cancelReminder(reminderId: String) {
        if (alarmManager == null) return

        val intent = Intent(context, ReminderReceiver::class.java).apply {
            action = ReminderReceiver.ACTION_TRIGGER_REMINDER
        }
        val pendingIntent = PendingIntent.getBroadcast(
            context,
            reminderId.hashCode(),
            intent,
            PendingIntent.FLAG_NO_CREATE or PendingIntent.FLAG_IMMUTABLE
        )

        if (pendingIntent != null) {
            alarmManager.cancel(pendingIntent)
            pendingIntent.cancel()
            Log.i(TAG, "Cancelled alarm for reminder $reminderId")
        }
    }
}
