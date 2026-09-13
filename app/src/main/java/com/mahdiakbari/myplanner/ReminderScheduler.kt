package com.mahdiakbari.myplanner

import android.app.AlarmManager
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import androidx.core.app.NotificationManagerCompat
import org.json.JSONArray
import org.json.JSONObject
import java.util.Calendar

object ReminderScheduler {
    const val CHANNEL_ID = "planner_reminder_channel"
    private const val PREFS_NAME = "planner_reminders_prefs"
    private const val PENDING_KEY = "pending_reminders_json"

    data class PendingReminder(val id: Int, val title: String, val message: String, val targetTab: String)

    fun createNotificationChannel(context: Context) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val name = "یادآوری‌های برنامه‌ریز"
            val descriptionText = "کانال ارسال یادآوری کارهای روزانه، اهداف، هفتگی و ماهانه"
            val importance = NotificationManager.IMPORTANCE_HIGH
            val channel = NotificationChannel(CHANNEL_ID, name, importance).apply {
                description = descriptionText
                enableVibration(true)
                enableLights(true)
            }
            val notificationManager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            notificationManager.createNotificationChannel(channel)
        }
    }

    // حداکثر دو بازه‌ی تاخیرِ دلخواه که کاربر از تنظیمات اپ انتخاب کرده، علاوه بر ۱۵ و ۳۰
    // دقیقه‌ی پیش‌فرض. صفر یا منفی یعنی اون اسلات غیرفعاله و نادیده گرفته میشه
    fun getCustomSnoozeDurations(context: Context): List<Int> {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val d1 = prefs.getInt("custom_snooze_1_minutes", 0)
        val d2 = prefs.getInt("custom_snooze_2_minutes", 0)
        return listOfNotNull(
            if (d1 > 0) d1 else null,
            if (d2 > 0) d2 else null
        )
    }

    fun setCustomSnoozeDurations(context: Context, minutes1: Int, minutes2: Int) {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        prefs.edit()
            .putInt("custom_snooze_1_minutes", minutes1)
            .putInt("custom_snooze_2_minutes", minutes2)
            .apply()
    }

    // ============== لیستِ یادآورهای «هنوز رسیدگی‌نشده» ==============
    // هر یادآوری که نمایش داده میشه، تا وقتی «تمام» یا یکی از گزینه‌های تاخیر یا «باز کردن
    // برنامه» روش زده نشه، توی این لیست می‌مونه. صفحه‌ی تمام‌صفحه‌ی هشدار همیشه از روی همین
    // لیست رندر میشه — نه از روی یه یادآوریِ تکی — تا اگه چندتا هم‌زمان معلق باشن، همه‌شون
    // با هم و هرکدوم با دکمه‌های جدای خودشون نشون داده بشن

    private fun readPendingArray(context: Context): JSONArray {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        return try {
            JSONArray(prefs.getString(PENDING_KEY, "[]"))
        } catch (e: Exception) {
            JSONArray()
        }
    }

    private fun writePendingArray(context: Context, arr: JSONArray) {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        prefs.edit().putString(PENDING_KEY, arr.toString()).apply()
    }

    fun addPendingReminder(context: Context, notificationId: Int, title: String, message: String, targetTab: String) {
        val arr = readPendingArray(context)
        val filtered = JSONArray()
        for (i in 0 until arr.length()) {
            val obj = arr.optJSONObject(i) ?: continue
            if (obj.optInt("id") != notificationId) filtered.put(obj)
        }
        val newObj = JSONObject()
        newObj.put("id", notificationId)
        newObj.put("title", title)
        newObj.put("message", message)
        newObj.put("targetTab", targetTab)
        filtered.put(newObj)
        writePendingArray(context, filtered)
    }

    fun removePendingReminder(context: Context, notificationId: Int) {
        val arr = readPendingArray(context)
        val filtered = JSONArray()
        for (i in 0 until arr.length()) {
            val obj = arr.optJSONObject(i) ?: continue
            if (obj.optInt("id") != notificationId) filtered.put(obj)
        }
        writePendingArray(context, filtered)
    }

    fun isPendingReminder(context: Context, notificationId: Int): Boolean {
        val arr = readPendingArray(context)
        for (i in 0 until arr.length()) {
            if (arr.optJSONObject(i)?.optInt("id") == notificationId) return true
        }
        return false
    }

    fun getAllPendingReminders(context: Context): List<PendingReminder> {
        val arr = readPendingArray(context)
        val list = mutableListOf<PendingReminder>()
        for (i in 0 until arr.length()) {
            val obj = arr.optJSONObject(i) ?: continue
            list.add(
                PendingReminder(
                    obj.optInt("id"),
                    obj.optString("title"),
                    obj.optString("message"),
                    obj.optString("targetTab", "daily")
                )
            )
        }
        return list
    }

    // ۱۵ دقیقه بعد از نمایشِ هر یادآوری برنامه‌ریزی میشه؛ اگه تا اون موقع هنوز توی لیستِ
    // «در انتظار» بود (یعنی نه «تمام» زده شده، نه تاخیر خورده، نه از طریق باز کردن برنامه
    // بسته شده)، دوباره نمایش داده میشه — چه با کشیدنِ انگشت کنار رفته باشه چه فقط بالای
    // صفحه بدون هیچ واکنشی مونده باشه. با FLAG_UPDATE_CURRENT، هر بار که همین تابع دوباره
    // صدا زده بشه (روی همون notificationId)، فقط زمانِ چکِ بعدی رو جابه‌جا می‌کنه، نه اینکه
    // یه چکِ اضافه بسازه
    fun schedulePendingRecheck(context: Context, notificationId: Int, title: String, message: String, targetTab: String) {
        val reqCode = 900000000 + notificationId
        val recheckIntent = Intent(context, ReminderReceiver::class.java).apply {
            putExtra("IS_PENDING_RECHECK", true)
            putExtra("NOTIFICATION_ID", notificationId)
            putExtra("TITLE", title)
            putExtra("MESSAGE", message)
            putExtra("TARGET_TAB", targetTab)
        }
        val pendingIntent = PendingIntent.getBroadcast(
            context, reqCode, recheckIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        val triggerAt = System.currentTimeMillis() + 15 * 60 * 1000L
        scheduleExactClockAlarm(context, triggerAt, pendingIntent)
    }

    fun cancelPendingRecheck(context: Context, notificationId: Int) {
        val reqCode = 900000000 + notificationId
        val recheckIntent = Intent(context, ReminderReceiver::class.java)
        val pendingIntent = PendingIntent.getBroadcast(
            context, reqCode, recheckIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        alarmManager.cancel(pendingIntent)
    }

    // فقط خودِ نوتیف رو می‌بنده، از لیستِ «در انتظار» حذفش می‌کنه، و چکِ ۱۵-دقیقه‌ای‌ش رو
    // کنسل می‌کنه — یعنی دیگه هیچ‌وقت خودکار دوباره ظاهر نمیشه. دقیقاً همون چیزی که برای
    // دکمه‌ی «تمام» لازمه (چه از روی خودِ نوتیف، چه از صفحه‌ی تمام‌صفحه)
    fun handleReminderDone(context: Context, notificationId: Int) {
        NotificationManagerCompat.from(context).cancel(notificationId)
        removePendingReminder(context, notificationId)
        cancelPendingRecheck(context, notificationId)
    }

    // منطق مشترکِ «این نوتیف رو ببند و دوباره بعد از N دقیقه یادآوری کن»؛ هم از دکمه‌های
    // روی خودِ نوتیف صدا زده میشه، هم از صفحه‌ی تمام‌صفحه‌ی هشدار. چون یادآوریِ جدید با
    // notificationId تازه‌ای دوباره از مسیر عادیِ ReminderReceiver ظاهر میشه، اینجا هم از
    // لیستِ «در انتظار» و هم از چکِ ۱۵-دقیقه‌ایِ قبلی (که مال notificationId قدیمیه) حذف/
    // کنسل میشه، چون این‌ها به‌محضِ نمایشِ دوباره، برای notificationId جدید از نو ثبت میشن
    fun handleReminderSnooze(context: Context, notificationId: Int, title: String, message: String, targetTab: String, minutes: Int) {
        NotificationManagerCompat.from(context).cancel(notificationId)
        removePendingReminder(context, notificationId)
        cancelPendingRecheck(context, notificationId)

        val safeMinutes = minutes.coerceAtLeast(1)
        val snoozeReqCode = 700000000 + (notificationId * 1000) + (safeMinutes % 1000)

        val fireIntent = Intent(context, ReminderReceiver::class.java).apply {
            putExtra("TITLE", title)
            putExtra("MESSAGE", message)
            putExtra("TARGET_TAB", targetTab)
        }
        val pendingIntent = PendingIntent.getBroadcast(
            context, snoozeReqCode, fireIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val triggerAt = System.currentTimeMillis() + safeMinutes * 60 * 1000L
        scheduleExactClockAlarm(context, triggerAt, pendingIntent)
    }

    // وقتی نوتیف با کشیدنِ انگشت کنار گذاشته میشه، دیگه لازم نیست جداگانه کاری بشه: همون
    // لحظه‌ای که این نوتیف اول‌بار نمایش داده شد، schedulePendingRecheck از قبل براش یه چکِ
    // ۱۵-دقیقه‌ای ثبت کرده که مستقل از روشِ کنار رفتنِ نوتیفه (کشیدن با انگشت یا فقط بدون
    // واکنش موندن) و اگه هنوز رسیدگی نشده باشه، دوباره ظاهرش می‌کنه. این تابع دیگه لازم
    // نیست ولی برای سازگاری با نسخه‌های قبلیِ اپ (که ممکنه یه دونه از این آلارم‌های قدیمی
    // هنوز زمان‌بندی شده باشه) نگه داشته شده
    fun scheduleDismissResnooze(context: Context, notificationId: Int, title: String, message: String, targetTab: String) {
        val minutes = 15
        val snoozeReqCode = 800000000 + (notificationId * 1000) + minutes

        val fireIntent = Intent(context, ReminderReceiver::class.java).apply {
            putExtra("TITLE", title)
            putExtra("MESSAGE", message)
            putExtra("TARGET_TAB", targetTab)
        }
        val pendingIntent = PendingIntent.getBroadcast(
            context, snoozeReqCode, fireIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val triggerAt = System.currentTimeMillis() + minutes * 60 * 1000L
        scheduleExactClockAlarm(context, triggerAt, pendingIntent)
    }

    // متد کلیدی: استفاده از setAlarmClock جهت عبور ۱۰۰٪ از محدودیت‌های Doze Mode و باتری
    fun scheduleExactClockAlarm(context: Context, triggerAtMillis: Long, pendingIntent: PendingIntent) {
        val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                val alarmClockInfo = AlarmManager.AlarmClockInfo(triggerAtMillis, pendingIntent)
                alarmManager.setAlarmClock(alarmClockInfo, pendingIntent)
            } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                alarmManager.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAtMillis, pendingIntent)
            } else {
                alarmManager.setExact(AlarmManager.RTC_WAKEUP, triggerAtMillis, pendingIntent)
            }
        } catch (e: SecurityException) {
            alarmManager.set(AlarmManager.RTC_WAKEUP, triggerAtMillis, pendingIntent)
        }
    }

    // ================= ۱. یادآوری‌های روزانه =================
    fun scheduleDailyReminder(context: Context, hour: Int, minute: Int, reqCode: Int) {
        saveDailyReminderPrefs(context, hour, minute, reqCode)

        val intent = Intent(context, ReminderReceiver::class.java).apply {
            putExtra("TITLE", "📅 برنامه‌ریز روزانه")
            putExtra("MESSAGE", "برنامه‌های امروزت رو چک کردی؟ وقتشه یه نگاهی به کارهات بندازی! 🔥")
            putExtra("IS_DAILY", true)
            putExtra("DAILY_HOUR", hour)
            putExtra("DAILY_MINUTE", minute)
            putExtra("DAILY_REQ_CODE", reqCode)
            putExtra("TARGET_TAB", "daily")
        }

        val pendingIntent = PendingIntent.getBroadcast(
            context,
            reqCode,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val now = Calendar.getInstance()
        val calendar = Calendar.getInstance().apply {
            set(Calendar.HOUR_OF_DAY, hour)
            set(Calendar.MINUTE, minute)
            set(Calendar.SECOND, 0)
            set(Calendar.MILLISECOND, 0)
        }

        if (calendar.before(now)) {
            calendar.add(Calendar.DATE, 1)
        }

        scheduleExactClockAlarm(context, calendar.timeInMillis, pendingIntent)
    }

    private fun saveDailyReminderPrefs(context: Context, hour: Int, minute: Int, reqCode: Int) {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        prefs.edit()
            .putInt("daily_${reqCode}_hour", hour)
            .putInt("daily_${reqCode}_minute", minute)
            .putBoolean("daily_${reqCode}_active", true)
            .apply()
    }

    fun rescheduleAllDailyReminders(context: Context) {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val now = Calendar.getInstance()
        val todayStr = "${now.get(Calendar.YEAR)}-${now.get(Calendar.MONTH)}-${now.get(Calendar.DAY_OF_MONTH)}"

        for (reqCode in listOf(1, 2)) {
            if (prefs.getBoolean("daily_${reqCode}_active", false)) {
                val hour = prefs.getInt("daily_${reqCode}_hour", -1)
                val minute = prefs.getInt("daily_${reqCode}_minute", -1)
                if (hour in 0..23 && minute in 0..59) {
                    val targetToday = Calendar.getInstance().apply {
                        set(Calendar.HOUR_OF_DAY, hour)
                        set(Calendar.MINUTE, minute)
                        set(Calendar.SECOND, 0)
                        set(Calendar.MILLISECOND, 0)
                    }

                    val lastFired = prefs.getString("daily_${reqCode}_last_fired", "")

                    // اگر زمان امروز گذشته و گوشی خاموش بوده، نوتیفیکیشن جامانده را فوراً شلیک کن
                    if (now.after(targetToday) && lastFired != todayStr) {
                        triggerMissedDailyNotification(context, reqCode, hour, minute)
                        prefs.edit().putString("daily_${reqCode}_last_fired", todayStr).apply()
                    }

                    scheduleDailyReminder(context, hour, minute, reqCode)
                }
            }
        }
    }

    private fun triggerMissedDailyNotification(context: Context, reqCode: Int, hour: Int, minute: Int) {
        val intent = Intent(context, ReminderReceiver::class.java).apply {
            putExtra("TITLE", "📅 برنامه‌ریز روزانه (یادآوری جامانده)")
            putExtra("MESSAGE", "گوشی خاموش بود؛ برنامه‌های امروزت رو فراموش نکنی! 🔥")
            putExtra("IS_DAILY", true)
            putExtra("DAILY_HOUR", hour)
            putExtra("DAILY_MINUTE", minute)
            putExtra("DAILY_REQ_CODE", reqCode)
            putExtra("TARGET_TAB", "daily")
        }
        val pendingIntent = PendingIntent.getBroadcast(
            context,
            900000 + reqCode,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        scheduleExactClockAlarm(context, System.currentTimeMillis() + 1500, pendingIntent)
    }

    // ================= ۲. یادآوری‌های سفارشی هفتگی (تب «یادآوری») =================
    private fun customReqCode(id: Int, day: Int): Int = 500000000 + (id * 10) + day

    fun scheduleCustomReminder(context: Context, id: Int, text: String, hour: Int, minute: Int, days: List<Int>, repeat: Boolean, startDateMillis: Long = 0L) {
        saveCustomReminderPrefs(context, id, text, hour, minute, days, repeat, startDateMillis)
        days.forEach { day -> scheduleCustomReminderDay(context, id, text, hour, minute, day, repeat, startDateMillis) }
    }

    fun scheduleCustomReminderDay(context: Context, id: Int, text: String, hour: Int, minute: Int, targetDay: Int, repeat: Boolean, startDateMillis: Long = 0L) {
        val reqCode = customReqCode(id, targetDay)

        val intent = Intent(context, ReminderReceiver::class.java).apply {
            putExtra("TITLE", "⏰ یادآوری")
            putExtra("MESSAGE", text)
            putExtra("IS_WEEKLY", true)
            putExtra("WEEKLY_REPEAT", repeat)
            putExtra("WEEKLY_HOUR", hour)
            putExtra("WEEKLY_MINUTE", minute)
            putExtra("WEEKLY_DAY", targetDay)
            putExtra("WEEKLY_ID", id)
            putExtra("WEEKLY_START_DATE", startDateMillis)
            putExtra("TARGET_TAB", "reminders")
        }

        val pendingIntent = PendingIntent.getBroadcast(
            context, reqCode, intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        // محاسبه ریاضی ۱۰۰٪ دقیق فاصله تا روز هدف
        val now = Calendar.getInstance()
        val calendar = Calendar.getInstance().apply {
            set(Calendar.HOUR_OF_DAY, hour)
            set(Calendar.MINUTE, minute)
            set(Calendar.SECOND, 0)
            set(Calendar.MILLISECOND, 0)
        }

        val currentDay = calendar.get(Calendar.DAY_OF_WEEK)
        var daysUntil = (targetDay - currentDay + 7) % 7
        if (daysUntil == 0 && calendar.before(now)) {
            daysUntil = 7
        }
        calendar.add(Calendar.DATE, daysUntil)

        // اگه تاریخ شروع مشخص شده و اولین occurrence هنوز بهش نرسیده، هفته به هفته جلو
        // می‌ریم تا برسیم به اولین باری که این روز از هفته، سر یا بعد از تاریخ شروع باشه.
        // چون targetDay ثابته، این حلقه همیشه دقیقاً روی خودِ تاریخ شروع (وقتی روزش با
        // targetDay یکی باشه) یا اولین تکرار درست بعدش می‌شینه.
        if (startDateMillis > 0 && calendar.timeInMillis < startDateMillis) {
            while (calendar.timeInMillis < startDateMillis) {
                calendar.add(Calendar.DATE, 7)
            }
        }

        scheduleExactClockAlarm(context, calendar.timeInMillis, pendingIntent)
    }

    fun cancelCustomReminder(context: Context, id: Int, days: List<Int>) {
        val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        days.forEach { day ->
            val intent = Intent(context, ReminderReceiver::class.java)
            val pendingIntent = PendingIntent.getBroadcast(
                context, customReqCode(id, day), intent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
            alarmManager.cancel(pendingIntent)
        }
        removeCustomReminderPrefs(context, id)
    }

    private fun saveCustomReminderPrefs(context: Context, id: Int, text: String, hour: Int, minute: Int, days: List<Int>, repeat: Boolean, startDateMillis: Long = 0L) {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val ids = (prefs.getStringSet("custom_ids", mutableSetOf()) ?: mutableSetOf()).toMutableSet()
        ids.add(id.toString())
        prefs.edit()
            .putString("custom_${id}_text", text)
            .putInt("custom_${id}_hour", hour)
            .putInt("custom_${id}_minute", minute)
            .putString("custom_${id}_days", days.joinToString(","))
            .putBoolean("custom_${id}_repeat", repeat)
            .putLong("custom_${id}_start_date", startDateMillis)
            .putBoolean("custom_${id}_active", true)
            .putStringSet("custom_ids", ids)
            .apply()
    }

    // وقتی یادآوریِ «بدون تکرار هر هفته» یک بار برای یه روز خاص شلیک شد، دیگه نباید
    // برای اون روز دوباره برنامه‌ریزی بشه. این تابع فقط همون روز رو از لیست پاک می‌کنه،
    // و اگه لیست روزها کاملاً خالی شد، کل یادآوری رو حذف می‌کنه (وگرنه با یه ری‌استارت گوشی
    // بعدی، «rescheduleAllCustomReminders» دوباره برای هفته‌ی بعد زنده‌اش می‌کرد).
    fun removeCustomReminderDay(context: Context, id: Int, day: Int) {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val remainingDays = (prefs.getString("custom_${id}_days", "") ?: "")
            .split(",")
            .mapNotNull { it.toIntOrNull() }
            .filter { it != day }

        if (remainingDays.isEmpty()) {
            removeCustomReminderPrefs(context, id)
        } else {
            prefs.edit().putString("custom_${id}_days", remainingDays.joinToString(",")).apply()
        }
    }

    private fun removeCustomReminderPrefs(context: Context, id: Int) {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val ids = (prefs.getStringSet("custom_ids", mutableSetOf()) ?: mutableSetOf()).toMutableSet()
        ids.remove(id.toString())
        prefs.edit()
            .remove("custom_${id}_text")
            .remove("custom_${id}_hour")
            .remove("custom_${id}_minute")
            .remove("custom_${id}_days")
            .remove("custom_${id}_repeat")
            .remove("custom_${id}_start_date")
            .remove("custom_${id}_active")
            .putStringSet("custom_ids", ids)
            .apply()
    }

    fun rescheduleAllCustomReminders(context: Context) {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val ids = prefs.getStringSet("custom_ids", mutableSetOf()) ?: mutableSetOf()
        val now = Calendar.getInstance()
        val todayStr = "${now.get(Calendar.YEAR)}-${now.get(Calendar.MONTH)}-${now.get(Calendar.DAY_OF_MONTH)}"
        val currentDayOfWeek = now.get(Calendar.DAY_OF_WEEK)

        ids.toList().forEach { idStr ->
            val id = idStr.toIntOrNull() ?: return@forEach
            if (!prefs.getBoolean("custom_${id}_active", false)) return@forEach

            val text = prefs.getString("custom_${id}_text", null) ?: return@forEach
            val hour = prefs.getInt("custom_${id}_hour", -1)
            val minute = prefs.getInt("custom_${id}_minute", -1)
            var days = prefs.getString("custom_${id}_days", "")?.split(",")?.mapNotNull { it.toIntOrNull() } ?: emptyList()
            val repeat = prefs.getBoolean("custom_${id}_repeat", true)
            val startDateMillis = prefs.getLong("custom_${id}_start_date", 0L)

            if (hour !in 0..23 || minute !in 0..59 || days.isEmpty()) return@forEach

            // اگه هنوز به تاریخ شروع نرسیدیم، این یادآوری اصلاً «جامانده» حساب نمیشه؛
            // فقط باید دوباره برای همون تاریخ شروع (یا بعدش) برنامه‌ریزی بشه
            val startDateReached = startDateMillis <= 0 || now.timeInMillis >= startDateMillis

            if (startDateReached && days.contains(currentDayOfWeek)) {
                val targetToday = Calendar.getInstance().apply {
                    set(Calendar.HOUR_OF_DAY, hour)
                    set(Calendar.MINUTE, minute)
                    set(Calendar.SECOND, 0)
                    set(Calendar.MILLISECOND, 0)
                }
                val lastFired = prefs.getString("custom_${id}_last_fired_${currentDayOfWeek}", "")
                if (now.after(targetToday) && lastFired != todayStr) {
                    triggerMissedCustomNotification(context, id, text)
                    prefs.edit().putString("custom_${id}_last_fired_${currentDayOfWeek}", todayStr).apply()

                    if (!repeat) {
                        // این یادآوریِ «بدون تکرار» بود و همین الان (با تاخیر) شلیک شد؛
                        // دیگه نباید برای هفته‌ی بعد دوباره برنامه‌ریزی بشه
                        removeCustomReminderDay(context, id, currentDayOfWeek)
                        days = days.filter { it != currentDayOfWeek }
                    }
                }
            }

            days.forEach { day -> scheduleCustomReminderDay(context, id, text, hour, minute, day, repeat, startDateMillis) }
        }
    }

    private fun triggerMissedCustomNotification(context: Context, id: Int, text: String) {
        val intent = Intent(context, ReminderReceiver::class.java).apply {
            putExtra("TITLE", "⏰ یادآوری (جامانده)")
            putExtra("MESSAGE", text)
            putExtra("TARGET_TAB", "reminders")
        }
        val pendingIntent = PendingIntent.getBroadcast(
            context,
            800000 + id,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        scheduleExactClockAlarm(context, System.currentTimeMillis() + 2500, pendingIntent)
    }

    // ================= ۳. یادآوری‌های یک‌بارمصرف (تاریخ‌دار: اهداف و تسک‌های هفتگی/ماهانه) =================
    // این‌ها قبلاً هیچ‌جا ذخیره نمی‌شدن و با هر ری‌استارت گوشی یا آپدیت اپ کاملاً از بین می‌رفتن.
    // حالا دقیقاً مثل یادآوری‌های روزانه/هفتگی در prefs ذخیره میشن تا بشه بعد از ری‌استارت
    // دوباره‌شون ساخت، و اگر زمانشون گذشته بود، فوری نشونشون داد.
    fun scheduleOneOffReminder(context: Context, title: String, message: String, timeInMillis: Long, reqCode: Int, targetTab: String = "daily") {
        saveOneOffPrefs(context, title, message, timeInMillis, reqCode, targetTab)
        val pendingIntent = buildOneOffPendingIntent(context, title, message, reqCode, targetTab)
        scheduleExactClockAlarm(context, timeInMillis, pendingIntent)
    }

    private fun buildOneOffPendingIntent(context: Context, title: String, message: String, reqCode: Int, targetTab: String): PendingIntent {
        val intent = Intent(context, ReminderReceiver::class.java).apply {
            putExtra("TITLE", title)
            putExtra("MESSAGE", message)
            putExtra("IS_ONEOFF", true)
            putExtra("ONEOFF_REQ_CODE", reqCode)
            putExtra("TARGET_TAB", targetTab)
        }
        return PendingIntent.getBroadcast(
            context, reqCode, intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
    }

    private fun saveOneOffPrefs(context: Context, title: String, message: String, timeInMillis: Long, reqCode: Int, targetTab: String) {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val ids = (prefs.getStringSet("oneoff_ids", mutableSetOf()) ?: mutableSetOf()).toMutableSet()
        ids.add(reqCode.toString())
        prefs.edit()
            .putString("oneoff_${reqCode}_title", title)
            .putString("oneoff_${reqCode}_message", message)
            .putLong("oneoff_${reqCode}_time", timeInMillis)
            .putString("oneoff_${reqCode}_target_tab", targetTab)
            .putStringSet("oneoff_ids", ids)
            .apply()
    }

    // لغو یادآوری یک‌بارمصرف: هم آلارم رو می‌کنسل می‌کنه هم از prefs پاک می‌کنه
    // (اگه فقط آلارم کنسل بشه ولی از prefs پاک نشه، با ری‌استارت بعدی دوباره زنده میشه!)
    fun cancelOneOffReminder(context: Context, reqCode: Int) {
        val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        val intent = Intent(context, ReminderReceiver::class.java)
        val pendingIntent = PendingIntent.getBroadcast(
            context, reqCode, intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        alarmManager.cancel(pendingIntent)
        removeOneOffPrefs(context, reqCode)
    }

    fun removeOneOffPrefs(context: Context, reqCode: Int) {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val ids = (prefs.getStringSet("oneoff_ids", mutableSetOf()) ?: mutableSetOf()).toMutableSet()
        ids.remove(reqCode.toString())
        prefs.edit()
            .remove("oneoff_${reqCode}_title")
            .remove("oneoff_${reqCode}_message")
            .remove("oneoff_${reqCode}_time")
            .remove("oneoff_${reqCode}_target_tab")
            .putStringSet("oneoff_ids", ids)
            .apply()
    }

    fun rescheduleAllOneOffReminders(context: Context) {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val ids = (prefs.getStringSet("oneoff_ids", mutableSetOf()) ?: mutableSetOf()).toMutableSet()
        val now = System.currentTimeMillis()

        ids.toList().forEach { idStr ->
            val reqCode = idStr.toIntOrNull() ?: return@forEach
            val title = prefs.getString("oneoff_${reqCode}_title", null)
            val message = prefs.getString("oneoff_${reqCode}_message", "") ?: ""
            val time = prefs.getLong("oneoff_${reqCode}_time", -1L)
            val targetTab = prefs.getString("oneoff_${reqCode}_target_tab", "daily") ?: "daily"

            if (title == null || time <= 0) {
                removeOneOffPrefs(context, reqCode)
                return@forEach
            }

            if (time <= now) {
                // زمانش گذشته و گوشی خاموش/در دسترس نبوده؛ همین الان نشونش بده و کارش تمومه
                triggerMissedOneOffNotification(context, reqCode, title, message, targetTab)
                removeOneOffPrefs(context, reqCode)
            } else {
                // هنوز نرسیده؛ فقط آلارمش رو (که با ری‌استارت پاک شده) دوباره برقرار کن
                val pendingIntent = buildOneOffPendingIntent(context, title, message, reqCode, targetTab)
                scheduleExactClockAlarm(context, time, pendingIntent)
            }
        }
    }

    private fun triggerMissedOneOffNotification(context: Context, reqCode: Int, title: String, message: String, targetTab: String) {
        val intent = Intent(context, ReminderReceiver::class.java).apply {
            putExtra("TITLE", title)
            putExtra("MESSAGE", message)
            putExtra("TARGET_TAB", targetTab)
        }
        val pendingIntent = PendingIntent.getBroadcast(
            context,
            600000000 + reqCode,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        scheduleExactClockAlarm(context, System.currentTimeMillis() + 1500, pendingIntent)
    }

    // ================= ۴. یادآوری‌های دوره‌ای =================
    // نکته‌ی خیلی مهم: زمان «شلیک بعدی» فقط با شلیک واقعی آلارم یا با جاماندگی واقعی جلو میره،
    // نه با هر بار باز کردن اپ. قبلاً هر بار اپ باز می‌شد، زمان بعدی از «همین الان + N روز»
    // از نو محاسبه می‌شد؛ یعنی اگه کاربر هر روز اپ رو باز می‌کرد، این یادآوری هیچوقت
    // به‌موقع نمی‌رسید چون هر بار به تعویق می‌افتاد. حالا زمان بعدی توی prefs ذخیره میشه
    // و فقط پیش میره (advance)، نه اینکه هر بار از نو حساب بشه.
    private const val PERIODIC_REQ_CODE = 8001

    // ست کردن اولیه از طرف کاربر (از تنظیمات). قبلاً همیشه بدون توجه به اینکه ساعت انتخابی
    // امروز هنوز نیومده یا نه، مستقیم N روز به تاریخ اضافه می‌کرد؛ یعنی مثلاً با «هر ۱ روز»
    // و انتخاب «۱ دقیقه‌ی دیگه»، اولین یادآوری به‌جای همین امروز، برای فردا همون ساعت
    // برنامه‌ریزی می‌شد و کاربر هیچی نمی‌دید. حالا اگه ساعت انتخابی امروز هنوز نگذشته
    // باشه، همون امروز شلیک می‌شه؛ فقط اگه گذشته باشه میره برای دوره‌ی بعدی.
    // targetTab مشخص می‌کنه با زدن روی نوتیف کدوم تب باز بشه (پیش‌فرض «daily» تا رفتار
    // یادآوریِ عمومیِ قبلی دست‌نخورده بمونه)
    fun setupPeriodicReminder(context: Context, intervalDays: Int, hour: Int, minute: Int, title: String, message: String, reqCode: Int, targetTab: String = "daily") {
        val now = Calendar.getInstance()
        val calendar = Calendar.getInstance().apply {
            set(Calendar.HOUR_OF_DAY, hour)
            set(Calendar.MINUTE, minute)
            set(Calendar.SECOND, 0)
            set(Calendar.MILLISECOND, 0)
        }
        if (!calendar.after(now)) {
            calendar.add(Calendar.DATE, intervalDays.coerceAtLeast(1))
        }
        savePeriodicPrefs(context, intervalDays, hour, minute, title, message, reqCode, calendar.timeInMillis, targetTab)
        armPeriodicAlarm(context, title, message, intervalDays, hour, minute, reqCode, calendar.timeInMillis, targetTab)
    }

    // مخصوص تسک‌های هفتگی/ماهانه‌ای که کاربر براشون «تکرار» با تاریخ شروع دلخواه انتخاب کرده.
    // اگه startDateMillis گذشته یا امروز باشه، از همون امروز/ساعت مشخص‌شده شروع میشه (یا اگه
    // ساعتش هم گذشته بود میره سراغ دوره‌ی بعدی)؛ اگه در آینده باشه، دقیقاً همون تاریخ اولین
    // شلیک میشه. reqCode این تسک‌ها جدا از سایر یادآوری‌ها (۸۰۰۱ و یادآورهای یک‌بارمصرف) نگه
    // داشته میشه تا هیچ‌وقت قاطیِ هم نشن؛ آفست این جداسازی توی MainActivity انجام میشه.
    fun scheduleTaskRepeatReminder(context: Context, reqCode: Int, title: String, message: String, hour: Int, minute: Int, intervalDays: Int, startDateMillis: Long, targetTab: String) {
        val interval = intervalDays.coerceAtLeast(1)
        val now = System.currentTimeMillis()
        val intervalMillis = interval * 24L * 60 * 60 * 1000

        val base = Calendar.getInstance().apply {
            if (startDateMillis > 0) timeInMillis = startDateMillis
            set(Calendar.HOUR_OF_DAY, hour)
            set(Calendar.MINUTE, minute)
            set(Calendar.SECOND, 0)
            set(Calendar.MILLISECOND, 0)
        }

        var triggerAt = base.timeInMillis
        while (triggerAt <= now) {
            triggerAt += intervalMillis
        }

        savePeriodicPrefs(context, interval, hour, minute, title, message, reqCode, triggerAt, targetTab)
        armPeriodicAlarm(context, title, message, interval, hour, minute, reqCode, triggerAt, targetTab)
        registerTaskRepeatId(context, reqCode)
    }

    // یادآوری تکرارشونده‌ی یک تسک رو کامل غیرفعال می‌کنه: هم آلارم زنده‌ش کنسل میشه، هم
    // prefsـش پاک میشه (وگرنه با ری‌استارت گوشی دوباره زنده می‌موند)، هم از رجیستری خارج میشه
    fun cancelTaskRepeatReminder(context: Context, reqCode: Int) {
        val intent = Intent(context, ReminderReceiver::class.java)
        val pendingIntent = PendingIntent.getBroadcast(
            context, reqCode, intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        alarmManager.cancel(pendingIntent)
        pendingIntent.cancel()

        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        prefs.edit()
            .remove("periodic_${reqCode}_interval")
            .remove("periodic_${reqCode}_hour")
            .remove("periodic_${reqCode}_minute")
            .remove("periodic_${reqCode}_title")
            .remove("periodic_${reqCode}_message")
            .remove("periodic_${reqCode}_next_trigger")
            .remove("periodic_${reqCode}_target_tab")
            .remove("periodic_${reqCode}_active")
            .apply()

        unregisterTaskRepeatId(context, reqCode)
    }

    private fun registerTaskRepeatId(context: Context, reqCode: Int) {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val ids = (prefs.getStringSet("task_repeat_ids", mutableSetOf()) ?: mutableSetOf()).toMutableSet()
        ids.add(reqCode.toString())
        prefs.edit().putStringSet("task_repeat_ids", ids).apply()
    }

    private fun unregisterTaskRepeatId(context: Context, reqCode: Int) {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val ids = (prefs.getStringSet("task_repeat_ids", mutableSetOf()) ?: mutableSetOf()).toMutableSet()
        ids.remove(reqCode.toString())
        prefs.edit().putStringSet("task_repeat_ids", ids).apply()
    }

    private fun savePeriodicPrefs(context: Context, intervalDays: Int, hour: Int, minute: Int, title: String, message: String, reqCode: Int, nextTrigger: Long, targetTab: String = "daily") {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        prefs.edit()
            .putInt("periodic_${reqCode}_interval", intervalDays)
            .putInt("periodic_${reqCode}_hour", hour)
            .putInt("periodic_${reqCode}_minute", minute)
            .putString("periodic_${reqCode}_title", title)
            .putString("periodic_${reqCode}_message", message)
            .putLong("periodic_${reqCode}_next_trigger", nextTrigger)
            .putString("periodic_${reqCode}_target_tab", targetTab)
            .putBoolean("periodic_${reqCode}_active", true)
            .apply()
    }

    private fun armPeriodicAlarm(context: Context, title: String, message: String, intervalDays: Int, hour: Int, minute: Int, reqCode: Int, triggerAt: Long, targetTab: String = "daily") {
        val intent = Intent(context, ReminderReceiver::class.java).apply {
            putExtra("TITLE", title)
            putExtra("MESSAGE", message)
            putExtra("IS_PERIODIC", true)
            putExtra("PERIODIC_INTERVAL", intervalDays)
            putExtra("PERIODIC_HOUR", hour)
            putExtra("PERIODIC_MINUTE", minute)
            putExtra("PERIODIC_REQ_CODE", reqCode)
            putExtra("TARGET_TAB", targetTab)
        }
        val pendingIntent = PendingIntent.getBroadcast(
            context, reqCode, intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        scheduleExactClockAlarm(context, triggerAt, pendingIntent)
    }

    // وقتی آلارم واقعاً و به‌موقع شلیک شد (از ReminderReceiver صدا زده میشه): زمان بعدی رو
    // نسبت به زمان قبلی جلو می‌بریم (نه نسبت به «همین الان») تا هیچ انحراف تدریجی‌ای پیش نیاد.
    fun advancePeriodicReminder(context: Context, reqCode: Int) {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        if (!prefs.getBoolean("periodic_${reqCode}_active", false)) return

        val intervalDays = prefs.getInt("periodic_${reqCode}_interval", 1).coerceAtLeast(1)
        val hour = prefs.getInt("periodic_${reqCode}_hour", 9)
        val minute = prefs.getInt("periodic_${reqCode}_minute", 0)
        val title = prefs.getString("periodic_${reqCode}_title", "") ?: ""
        val message = prefs.getString("periodic_${reqCode}_message", "") ?: ""
        val targetTab = prefs.getString("periodic_${reqCode}_target_tab", "daily") ?: "daily"
        val prevTrigger = prefs.getLong("periodic_${reqCode}_next_trigger", System.currentTimeMillis())
        val intervalMillis = intervalDays * 24L * 60 * 60 * 1000

        var nextTrigger = prevTrigger + intervalMillis
        val now = System.currentTimeMillis()
        while (nextTrigger <= now) {
            nextTrigger += intervalMillis
        }

        savePeriodicPrefs(context, intervalDays, hour, minute, title, message, reqCode, nextTrigger, targetTab)
        armPeriodicAlarm(context, title, message, intervalDays, hour, minute, reqCode, nextTrigger, targetTab)
    }

    // موقع ری‌استارت گوشی / آپدیت اپ / باز شدن اپ: فقط همون آلارمی که با ری‌استارت پاک شده
    // رو دقیقاً سر همون زمان قبلی دوباره برقرار می‌کنه. اگه اون زمان درحین خاموش بودن گوشی
    // گذشته بود، همون لحظه جبرانش می‌کنه؛ در غیر این صورت هیچ تغییری توی زمان‌بندی نمیده.
    fun reschedulePeriodicReminder(context: Context) {
        rescheduleOnePeriodicReminder(context, PERIODIC_REQ_CODE)
    }

    // نسخه‌ی عمومیِ همون منطق بالا برای یه reqCode دلخواه؛ هم برای یادآوریِ عمومیِ ۸۰۰۱
    // استفاده میشه، هم برای هر کدوم از یادآورهای تکرارشونده‌ی تسک‌های هفتگی/ماهانه
    private fun rescheduleOnePeriodicReminder(context: Context, reqCode: Int) {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        if (!prefs.getBoolean("periodic_${reqCode}_active", false)) return

        val intervalDays = prefs.getInt("periodic_${reqCode}_interval", 1).coerceAtLeast(1)
        val hour = prefs.getInt("periodic_${reqCode}_hour", 9)
        val minute = prefs.getInt("periodic_${reqCode}_minute", 0)
        val title = prefs.getString("periodic_${reqCode}_title", "📅 یادآوری برنامه‌ریز") ?: "📅 یادآوری برنامه‌ریز"
        val message = prefs.getString("periodic_${reqCode}_message", "وقتشه برنامه‌هات رو چک کنی!") ?: "وقتشه برنامه‌هات رو چک کنی!"
        val targetTab = prefs.getString("periodic_${reqCode}_target_tab", "daily") ?: "daily"
        val nextTrigger = prefs.getLong("periodic_${reqCode}_next_trigger", -1L)

        if (nextTrigger <= 0) {
            // یادآوری دوره‌ای از قبل از این آپدیت که هنوز next_trigger نداره؛ از نو بسازش
            setupPeriodicReminder(context, intervalDays, hour, minute, title, message, reqCode, targetTab)
            return
        }

        val now = System.currentTimeMillis()
        if (nextTrigger <= now) {
            triggerMissedPeriodicNotification(context, reqCode, title, message, targetTab)
            val intervalMillis = intervalDays * 24L * 60 * 60 * 1000
            var updated = nextTrigger + intervalMillis
            while (updated <= now) {
                updated += intervalMillis
            }
            savePeriodicPrefs(context, intervalDays, hour, minute, title, message, reqCode, updated, targetTab)
            armPeriodicAlarm(context, title, message, intervalDays, hour, minute, reqCode, updated, targetTab)
        } else {
            armPeriodicAlarm(context, title, message, intervalDays, hour, minute, reqCode, nextTrigger, targetTab)
        }
    }

    // موقع بوت، برای تک‌تک یادآورهای تکرارشونده‌ی تسک‌های هفتگی/ماهانه (که آی‌دیشون توی
    // رجیستری task_repeat_ids ذخیره شده) همون منطق جبران/رعایت زمان قبلی رو اجرا می‌کنه
    fun rescheduleAllTaskRepeatReminders(context: Context) {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val ids = prefs.getStringSet("task_repeat_ids", mutableSetOf()) ?: mutableSetOf()
        for (idStr in ids) {
            val reqCode = idStr.toIntOrNull() ?: continue
            rescheduleOnePeriodicReminder(context, reqCode)
        }
    }

    private fun triggerMissedPeriodicNotification(context: Context, reqCode: Int, title: String, message: String, targetTab: String = "daily") {
        val intent = Intent(context, ReminderReceiver::class.java).apply {
            putExtra("TITLE", title)
            putExtra("MESSAGE", message)
            putExtra("TARGET_TAB", targetTab)
        }
        val pendingIntent = PendingIntent.getBroadcast(
            context,
            400000000 + reqCode,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        scheduleExactClockAlarm(context, System.currentTimeMillis() + 3500, pendingIntent)
    }
}