package com.mahdiakbari.myplanner

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

// این رسیور هم با روشن شدن گوشی (BOOT_COMPLETED) و هم بلافاصله بعد از آپدیت/نصب مجدد خود اپ
// (MY_PACKAGE_REPLACED) اجرا میشه. هر دوی این اتفاق‌ها باعث میشن اندروید تمام آلارم‌های
// از پیش تنظیم‌شده رو پاک کنه، بدون اینکه به SharedPreferences ما دست بزنه؛ برای همین این
// رسیور از روی همون prefs، همه‌چیز رو از نو می‌سازه و اگر زمان چیزی گذشته باشه، همون لحظه
// نوتیفش رو نشون میده (جبران عقب‌افتادگی).
class BootReceiver : BroadcastReceiver() {

    companion object {
        // این سه‌تا: روشن شدن گوشی / آپدیت اپ / بعضی گوشی‌های خاص (HTC و مشابه)
        // این یکی: طبق مستندات رسمی گوگل، وقتی اجازه‌ی «زمان‌بندی آلارم دقیق» (Alarms & reminders)
        // توسط کاربر یا خود سیستم تغییر کنه (مثلاً اندروید به‌خاطر بی‌استفاده موندن پسش بگیره
        // و بعداً کاربر دوباره بدش)، همین لحظه این پخش سراسری میاد؛ گوگل صراحتاً توصیه کرده
        // که این حالت دقیقاً مثل BOOT_COMPLETED مدیریت بشه، نه اینکه منتظر باز شدن دستی اپ بمونیم
        private val TRIGGER_ACTIONS = setOf(
            Intent.ACTION_BOOT_COMPLETED,
            Intent.ACTION_MY_PACKAGE_REPLACED,
            "android.intent.action.QUICKBOOT_POWERON",
            "com.htc.intent.action.QUICKBOOT_POWERON",
            "android.app.action.SCHEDULE_EXACT_ALARM_PERMISSION_STATE_CHANGED"
        )
    }

    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action !in TRIGGER_ACTIONS) return

        ReminderScheduler.createNotificationChannel(context)

        ReminderScheduler.rescheduleAllDailyReminders(context)
        ReminderScheduler.rescheduleAllCustomReminders(context)
        ReminderScheduler.reschedulePeriodicReminder(context)
        ReminderScheduler.rescheduleAllOneOffReminders(context)
        ReminderScheduler.rescheduleAllTaskRepeatReminders(context)
        BackupScheduler.scheduleDailyAutoBackup(context)
    }
}
