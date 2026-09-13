package com.mahdiakbari.myplanner

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import java.util.Calendar

object ReminderScheduler {
    fun schedule(context: Context, time: String, id: Int, label: String) {
        val parts = time.split(":")
        if (parts.size != 2) return
        val hour = parts[0].toIntOrNull() ?: return
        val minute = parts[1].toIntOrNull() ?: return

        val calendar = Calendar.getInstance().apply {
            set(Calendar.HOUR_OF_DAY, hour)
            set(Calendar.MINUTE, minute)
            set(Calendar.SECOND, 0)
            if (before(Calendar.getInstance())) add(Calendar.DAY_OF_YEAR, 1)
        }

        val intent = Intent(context, ReminderReceiver::class.java).apply {
            putExtra("label", label)
            putExtra("notifId", id)
        }
        val pendingIntent = PendingIntent.getBroadcast(
            context, id, intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        // inexact repeating: به مجوز ویژه (SCHEDULE_EXACT_ALARM) نیاز نداره، برای یادآوری روزانه دقت چند دقیقه‌ای کافیه
        alarmManager.setInexactRepeating(
            AlarmManager.RTC_WAKEUP,
            calendar.timeInMillis,
            AlarmManager.INTERVAL_DAY,
            pendingIntent
        )

        // برای بازیابی بعد از ری‌استارت گوشی (در BootReceiver خونده می‌شه)
        context.getSharedPreferences("planner_prefs", Context.MODE_PRIVATE).edit()
            .putString("time$id", time)
            .apply()
    }
}
