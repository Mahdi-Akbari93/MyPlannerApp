package com.mahdiakbari.myplanner

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

class BootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action == Intent.ACTION_BOOT_COMPLETED) {
            val prefs = context.getSharedPreferences("planner_prefs", Context.MODE_PRIVATE)
            prefs.getString("time1", null)?.let { ReminderScheduler.schedule(context, it, 1, "یادآوری نوبت اول") }
            prefs.getString("time2", null)?.let { ReminderScheduler.schedule(context, it, 2, "یادآوری نوبت دوم") }
        }
    }
}
