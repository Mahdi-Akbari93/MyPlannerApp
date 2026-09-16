package com.mahdiakbari.myplanner

import android.app.AlarmManager
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.Environment
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import java.io.File
import java.io.FileReader
import java.io.FileWriter
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Date
import java.util.Locale

object BackupScheduler {

    const val CHANNEL_ID = "backup_notifications"
    private const val PREFS_NAME = "planner_reminders_prefs"
    private const val CACHE_FILE_NAME = "latest_planner_cache.json"
    const val ACTION_AUTO_BACKUP = "com.mahdiakbari.myplanner.ACTION_AUTO_BACKUP"
    private const val BACKUP_REQ_CODE = 999111

    fun createBackupNotificationChannel(context: Context) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "پشتیبان‌گیری برنامه‌ریز",
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = "اعلان‌های وضعیت پشتیبان‌گیری محلی و ابری"
            }
            val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            manager.createNotificationChannel(channel)
        }
    }

    // ذخیره کپی همگام‌شده از آخرین داده‌های پلنر در حافظه داخلی اختصاصی اپلیکیشن
    fun saveLatestDataCache(context: Context, json: String) {
        if (json.isBlank() || json == "{}" || json == "[]") return
        try {
            val file = File(context.filesDir, CACHE_FILE_NAME)
            FileWriter(file).use { it.write(json) }
        } catch (e: Exception) {
            // نادیده می‌گیریم تا اختلالی در عملکرد برنامه ایجاد نشود
        }
    }

    fun readLatestDataCache(context: Context): String? {
        return try {
            val file = File(context.filesDir, CACHE_FILE_NAME)
            if (!file.exists() || file.length() == 0L) return null
            FileReader(file).use { it.readText() }
        } catch (e: Exception) {
            null
        }
    }

    private fun getTodayDateStr(): String {
        val sdf = SimpleDateFormat("yyyy-MM-dd", Locale.US)
        return sdf.format(Date())
    }

    // تنظیم آلارم روزانه دقیق بک‌آپ خودکار
    fun scheduleDailyAutoBackup(context: Context) {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val isEnabled = prefs.getBoolean("auto_backup_enabled", true)
        val hour = prefs.getInt("auto_backup_hour", 23)
        val minute = prefs.getInt("auto_backup_minute", 30)

        val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        val intent = Intent(context, AutoBackupReceiver::class.java).apply {
            action = ACTION_AUTO_BACKUP
        }
        val pendingIntent = PendingIntent.getBroadcast(
            context,
            BACKUP_REQ_CODE,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        if (!isEnabled) {
            alarmManager.cancel(pendingIntent)
            return
        }

        val now = Calendar.getInstance()
        val target = Calendar.getInstance().apply {
            set(Calendar.HOUR_OF_DAY, hour)
            set(Calendar.MINUTE, minute)
            set(Calendar.SECOND, 0)
            set(Calendar.MILLISECOND, 0)
        }

        if (target.before(now)) {
            target.add(Calendar.DATE, 1)
        }

        ReminderScheduler.scheduleExactClockAlarm(context, target.timeInMillis, pendingIntent)
    }

    // اجرای فرایند ذخیره فایل بکاپ در پوشه Downloads و در صورت نیاز ارسال به پیام‌رسان
    fun performBackup(context: Context, isAuto: Boolean, directJson: String? = null): Pair<Boolean, String> {
        val jsonContent = directJson ?: readLatestDataCache(context)
        if (jsonContent.isNullOrBlank()) {
            return Pair(false, "داده‌ای برای پشتیبان‌گیری در حافظه ذخیره نشده است.")
        }

        return try {
            val downloadsDir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS)
            val mainFolder = File(downloadsDir, "MyPlanner")
            val subFolderName = if (isAuto) "Daily_Backup" else "Manual_Backup"
            val targetDir = File(mainFolder, subFolderName)
            if (!targetDir.exists()) {
                targetDir.mkdirs()
            }

            val timestamp = System.currentTimeMillis()
            val prefix = if (isAuto) "auto_backup_daily_" else "manual_backup_"
            val fileName = "$prefix$timestamp.json"
            val file = File(targetDir, fileName)

            FileWriter(file).use { writer ->
                writer.write(jsonContent)
                writer.flush()
            }

            // ارسال ابری در صورت فعال بودن
            val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            val cloudEnabled = prefs.getBoolean("backup_cloud_enabled", false)
            var cloudStatus = ""

            if (cloudEnabled) {
                val platformName = if (prefs.getString("backup_platform", "bale") == "bale") "بله" else "تلگرام"
                val caption = "💾 نسخه پشتیبان ${if (isAuto) "خودکار روزانه" else "دستی"} مای‌پلنر\n" +
                        "📅 تاریخ: ${getTodayDateStr()}\n" +
                        "⏰ ساعت: ${SimpleDateFormat("HH:mm", Locale.US).format(Date())}"

                val (ok, msg) = BackupCloudSender.sendBackupDocument(context, file, caption)
                cloudStatus = if (ok) "\n☁️ همچنین با موفقیت به $platformName ارسال شد." else "\n⚠️ ارسال به $platformName ناموفق: $msg"
            }

            if (isAuto) {
                prefs.edit().putString("last_auto_backup_date", getTodayDateStr()).apply()
                // آلارم فردا را دوباره برقرار کن
                scheduleDailyAutoBackup(context)

                showNotification(
                    context,
                    "💾 پشتیبان‌گیری خودکار روزانه انجام شد",
                    "فایل در پوشه Downloads/MyPlanner ذخیره شد.$cloudStatus"
                )
            } else {
                showNotification(
                    context,
                    "📥 پشتیبان‌گیری دستی انجام شد",
                    "فایل در پوشه Downloads/MyPlanner ذخیره شد.$cloudStatus"
                )
            }

            Pair(true, "بکاپ با موفقیت ذخیره شد.$cloudStatus")
        } catch (e: Exception) {
            Pair(false, "خطا در ذخیره فایل بکاپ: ${e.message}")
        }
    }

    // جبران بکاپ جامانده در صورتی که گوشی در ساعت مقرر خاموش بوده است
    fun checkMissedBackup(context: Context) {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val isEnabled = prefs.getBoolean("auto_backup_enabled", true)
        if (!isEnabled) return

        val hour = prefs.getInt("auto_backup_hour", 23)
        val minute = prefs.getInt("auto_backup_minute", 30)

        val now = Calendar.getInstance()
        val scheduledToday = Calendar.getInstance().apply {
            set(Calendar.HOUR_OF_DAY, hour)
            set(Calendar.MINUTE, minute)
            set(Calendar.SECOND, 0)
            set(Calendar.MILLISECOND, 0)
        }

        val todayStr = getTodayDateStr()
        val lastFiredDate = prefs.getString("last_auto_backup_date", "")

        if (now.after(scheduledToday) && lastFiredDate != todayStr) {
            // گوشی خاموش بوده یا اپ متوقف شده؛ بکاپ امروز را با تاخیر انجام بده
            Thread {
                performBackup(context, isAuto = true)
            }.start()
        }
    }

    private fun showNotification(context: Context, title: String, message: String) {
        createBackupNotificationChannel(context)
        val builder = NotificationCompat.Builder(context, CHANNEL_ID)
            .setSmallIcon(android.R.drawable.ic_menu_save)
            .setContentTitle(title)
            .setContentText(message)
            .setStyle(NotificationCompat.BigTextStyle().bigText(message))
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setDefaults(NotificationCompat.DEFAULT_ALL)
            .setAutoCancel(true)

        try {
            with(NotificationManagerCompat.from(context)) {
                notify((System.currentTimeMillis() % 10000).toInt(), builder.build())
            }
        } catch (e: SecurityException) {
            // مجوز اعلان داده نشده بود
        }
    }
}
