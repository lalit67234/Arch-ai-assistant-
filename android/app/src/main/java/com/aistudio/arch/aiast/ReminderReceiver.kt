package com.aistudio.arch.aiast

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.media.RingtoneManager
import android.os.Build
import android.util.Log
import androidx.core.app.NotificationCompat
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

/**
 * ARCH Reminder Broadcast Receiver
 *
 * Catches alarms fired by AlarmManager and displays high-priority Heads-Up Notifications
 * with action buttons (Done, Snooze).
 */
class ReminderReceiver : BroadcastReceiver() {

    companion object {
        const val ACTION_TRIGGER_REMINDER = "com.aistudio.arch.aiast.ACTION_TRIGGER_REMINDER"
        const val ACTION_COMPLETE_REMINDER = "com.aistudio.arch.aiast.ACTION_COMPLETE_REMINDER"
        const val ACTION_SNOOZE_REMINDER = "com.aistudio.arch.aiast.ACTION_SNOOZE_REMINDER"

        const val EXTRA_REMINDER_ID = "extra_reminder_id"
        const val EXTRA_REMINDER_TITLE = "extra_reminder_title"
        const val CHANNEL_ID = "arch_reminders_channel"
    }

    private val TAG = "ReminderReceiver"

    override fun onReceive(context: Context, intent: Intent) {
        val reminderId = intent.getStringExtra(EXTRA_REMINDER_ID) ?: return
        val reminderTitle = intent.getStringExtra(EXTRA_REMINDER_TITLE) ?: context.getString(R.string.reminder_default_title)

        Log.d(TAG, "Received alarm event: ${intent.action} for reminder $reminderId")

        when (intent.action) {
            ACTION_COMPLETE_REMINDER -> {
                dismissNotification(context, reminderId)
                val repository = ArchRepository(context)
                CoroutineScope(Dispatchers.IO).launch {
                    repository.markReminderCompleted(reminderId)
                }
            }
            ACTION_SNOOZE_REMINDER -> {
                dismissNotification(context, reminderId)
                val snoozeTime = System.currentTimeMillis() + (10 * 60 * 1000) // 10 minutes
                val repository = ArchRepository(context)
                val scheduler = ReminderScheduler(context)
                CoroutineScope(Dispatchers.IO).launch {
                    val snoozedReminder = ReminderEntity(
                        id = reminderId,
                        title = reminderTitle,
                        triggerTimeMillis = snoozeTime
                    )
                    repository.saveReminder(snoozedReminder)
                    scheduler.scheduleReminder(snoozedReminder)
                }
            }
            else -> {
                // Show Reminder Alert Notification
                showReminderNotification(context, reminderId, reminderTitle)
            }
        }
    }

    private fun showReminderNotification(context: Context, reminderId: String, title: String) {
        val notificationManager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

        // Create high-importance channel on Android 8.0+
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                context.getString(R.string.reminders_channel_name),
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = context.getString(R.string.reminders_channel_desc)
                enableVibration(true)
                vibrationPattern = longArrayOf(0, 300, 200, 300)
            }
            notificationManager.createNotificationChannel(channel)
        }

        // Tap opens ARCH
        val openIntent = Intent(context, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
        }
        val openPendingIntent = PendingIntent.getActivity(
            context,
            reminderId.hashCode(),
            openIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        // Complete Action
        val completeIntent = Intent(context, ReminderReceiver::class.java).apply {
            action = ACTION_COMPLETE_REMINDER
            putExtra(EXTRA_REMINDER_ID, reminderId)
        }
        val completePendingIntent = PendingIntent.getBroadcast(
            context,
            (reminderId + "_complete").hashCode(),
            completeIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        // Snooze Action
        val snoozeIntent = Intent(context, ReminderReceiver::class.java).apply {
            action = ACTION_SNOOZE_REMINDER
            putExtra(EXTRA_REMINDER_ID, reminderId)
            putExtra(EXTRA_REMINDER_TITLE, title)
        }
        val snoozePendingIntent = PendingIntent.getBroadcast(
            context,
            (reminderId + "_snooze").hashCode(),
            snoozeIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val soundUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION)

        val notification = NotificationCompat.Builder(context, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_arch_notification)
            .setContentTitle("ARCH Alert: $title")
            .setContentText("Scheduled reminder alert triggered.")
            .setStyle(NotificationCompat.BigTextStyle().bigText("ARCH Reminder: $title\nTap to open tactical console."))
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setCategory(NotificationCompat.CATEGORY_REMINDER)
            .setAutoCancel(true)
            .setSound(soundUri)
            .setContentIntent(openPendingIntent)
            .addAction(R.drawable.ic_arch_notification, context.getString(R.string.action_complete), completePendingIntent)
            .addAction(R.drawable.ic_arch_notification, context.getString(R.string.action_snooze), snoozePendingIntent)
            .build()

        notificationManager.notify(reminderId.hashCode(), notification)
    }

    private fun dismissNotification(context: Context, reminderId: String) {
        val notificationManager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        notificationManager.cancel(reminderId.hashCode())
    }
}
