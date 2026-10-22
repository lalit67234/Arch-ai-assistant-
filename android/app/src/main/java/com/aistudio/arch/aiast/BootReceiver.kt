package com.aistudio.arch.aiast

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

/**
 * ARCH Boot & Package Replacement Receiver
 *
 * Ensures all persistent reminders scheduled in ArchDatabase survive device reboots
 * and APK upgrades by re-registering them with Android AlarmManager.
 */
class BootReceiver : BroadcastReceiver() {

    private val TAG = "BootReceiver"

    override fun onReceive(context: Context, intent: Intent) {
        val action = intent.action
        Log.d(TAG, "Device boot event received: $action")

        if (action == Intent.ACTION_BOOT_COMPLETED ||
            action == Intent.ACTION_MY_PACKAGE_REPLACED ||
            action == "android.intent.action.QUICKBOOT_POWERON"
        ) {
            val repository = ArchRepository(context)
            val scheduler = ReminderScheduler(context)

            CoroutineScope(Dispatchers.IO).launch {
                val now = System.currentTimeMillis()
                val upcomingReminders = repository.getUpcomingReminders(now)
                Log.i(TAG, "Rescheduling ${upcomingReminders.size} active reminders after boot.")

                for (reminder in upcomingReminders) {
                    scheduler.scheduleReminder(reminder)
                }
            }
        }
    }
}
