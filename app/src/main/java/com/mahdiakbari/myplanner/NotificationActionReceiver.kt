package com.mahdiakbari.myplanner

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

class NotificationActionReceiver : BroadcastReceiver() {

    companion object {
        const val ACTION_DONE = "com.mahdiakbari.myplanner.ACTION_REMINDER_DONE"
        const val ACTION_SNOOZE = "com.mahdiakbari.myplanner.ACTION_REMINDER_SNOOZE"
        // وقتی کاربر نوتیف رو با کشیدنِ انگشت کنار می‌ذاره (نه پاسخ داده، نه بازش کرده)
        const val ACTION_DISMISSED = "com.mahdiakbari.myplanner.ACTION_REMINDER_DISMISSED"
    }

    override fun onReceive(context: Context, intent: Intent) {
        val notificationId = intent.getIntExtra("NOTIFICATION_ID", -1)
        if (notificationId == -1) return

        when (intent.action) {
            ACTION_DONE -> {
                ReminderScheduler.handleReminderDone(context, notificationId)
            }
            ACTION_SNOOZE -> {
                val title = intent.getStringExtra("TITLE") ?: "⏰ یادآوری مجدد"
                val message = intent.getStringExtra("MESSAGE") ?: "زمان بررسی برنامه‌ها فرا رسید!"
                val snoozeMinutes = intent.getIntExtra("SNOOZE_MINUTES", 15)
                val targetTab = intent.getStringExtra("TARGET_TAB") ?: "daily"

                ReminderScheduler.handleReminderSnooze(context, notificationId, title, message, targetTab, snoozeMinutes)

                val label = formatMinutesLabel(snoozeMinutes)
                android.widget.Toast.makeText(context, "بعد از $label دوباره یادآوری می‌شود", android.widget.Toast.LENGTH_SHORT).show()
            }
            ACTION_DISMISSED -> {
                // دیگه کاری اینجا لازم نیست: همون لحظه‌ای که این نوتیف اول‌بار نمایش داده
                // شد، ReminderScheduler.schedulePendingRecheck از قبل یه چکِ ۱۵-دقیقه‌ای براش
                // ثبت کرده که مستقل از روشِ کنار رفتنِ نوتیفه — چه با کشیدنِ انگشت کنار رفته
                // باشه، چه فقط بالای صفحه بدون هیچ واکنشی مونده باشه — و اگه هنوز رسیدگی
                // نشده باشه، دوباره ظاهرش می‌کنه. اینجا کاری انجام ندادن از تکراری‌شدنِ اون
                // چکِ ۱۵-دقیقه‌ای جلوگیری می‌کنه.
            }
        }
    }

    private fun formatMinutesLabel(minutes: Int): String {
        return if (minutes % 60 == 0 && minutes >= 60) {
            "${minutes / 60} ساعت"
        } else {
            "$minutes دقیقه"
        }
    }
}
