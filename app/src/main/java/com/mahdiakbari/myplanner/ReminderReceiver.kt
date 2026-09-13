package com.mahdiakbari.myplanner

import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.app.ActivityCompat
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import java.util.Calendar

class ReminderReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        val title = intent.getStringExtra("TITLE") ?: "⏰ زمان بررسی برنامه‌ها!"
        val message = intent.getStringExtra("MESSAGE") ?: "امروز چقدر از کارهای روزانه‌ت رو انجام دادی؟ وارد برنامه شو!"
        val targetTab = intent.getStringExtra("TARGET_TAB") ?: "daily"

        // این شلیک، چکِ «۱۵ دقیقه بعد از نمایشِ اولیه هنوز رسیدگی نشده؟» ه — نه یه یادآوریِ
        // تازه. اگه کاربر تا الان بهش رسیدگی کرده (تمام زده، تاخیر انداخته، یا از طریق باز
        // کردنِ برنامه پاکش کرده)، دیگه توی لیستِ «در انتظار» نیست و نباید دوباره ظاهر بشه
        val isPendingRecheck = intent.getBooleanExtra("IS_PENDING_RECHECK", false)
        if (isPendingRecheck) {
            val checkId = intent.getIntExtra("NOTIFICATION_ID", -1)
            if (checkId == -1 || !ReminderScheduler.isPendingReminder(context, checkId)) {
                return
            }
        }

        // نکته‌ی مهم: اگه اجازه‌ی نمایش نوتیفیکیشن (POST_NOTIFICATIONS) در همین لحظه غیرفعال
        // بود، فقط از نمایش خودِ نوتیف صرف‌نظر می‌کنیم؛ ولی زنجیره‌ی تکرار (روزانه/هفتگی/دوره‌ای)
        // باید همچنان جلو بره. قبلاً یه return زودهنگام اینجا بود که کل زمان‌بندیِ دفعه‌ی بعد
        // رو هم نادیده می‌گرفت؛ یعنی اگه یه بار اجازه‌ی نوتیف قطع می‌شد (چه دستی چه خودکار)،
        // تکرارِ یادآوری‌ها برای همیشه متوقف می‌شد تا کاربر خودش دستی اپ رو باز کنه.
        val canShowNotification = Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU ||
                ActivityCompat.checkSelfPermission(context, android.Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED

        if (canShowNotification) {
            // برای چکِ ۱۵-دقیقه‌ای، همون notificationId قبلی حفظ میشه (تا لیستِ «در انتظار»
            // و صفحه‌ی تمام‌صفحه پیوسته بمونن)؛ برای هر شلیکِ دیگه (روزانه/دوره‌ای/یک‌بارمصرف/
            // تاخیرِ دستی)، مثل قبل یه آیدیِ تازه ساخته میشه
            val notificationId = if (isPendingRecheck) {
                intent.getIntExtra("NOTIFICATION_ID", (System.currentTimeMillis() % 100000).toInt())
            } else {
                (System.currentTimeMillis() % 100000).toInt()
            }

            // با زدن روی خودِ نوتیف (چه از بالای صفحه، چه از پنل نوتیف‌ها)، به‌جای ورودِ مستقیم
            // به برنامه، همون صفحه‌ی تمام‌صفحه‌ی هشدار باز میشه — با دکمه‌های تمام/تاخیر/ورود.
            // این صفحه خودش از روی کاملِ لیستِ «در انتظار» رندر میشه (نه فقط همین یکی)، پس اگه
            // چندتا یادآوریِ دیگه هم معلق باشن، همه با هم نشون داده میشن.
            val contentIntent = Intent(context, ReminderFullScreenActivity::class.java).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP
                putExtra("NOTIFICATION_ID", notificationId)
                putExtra("TITLE", title)
                putExtra("MESSAGE", message)
                putExtra("TARGET_TAB", targetTab)
            }
            val contentPendingIntent = PendingIntent.getActivity(
                context, notificationId, contentIntent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )

            val doneIntent = Intent(context, NotificationActionReceiver::class.java).apply {
                action = NotificationActionReceiver.ACTION_DONE
                putExtra("NOTIFICATION_ID", notificationId)
            }
            val donePendingIntent = PendingIntent.getBroadcast(
                context, notificationId + 1, doneIntent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )

            // دو گزینه‌ی تاخیر: ۱۵ دقیقه و ۳۰ دقیقه — هر کدوم reqCode جدا دارن تا با هم تداخل نکنن
            fun buildSnoozePendingIntent(minutes: Int, extraReqCode: Int): PendingIntent {
                val snoozeIntent = Intent(context, NotificationActionReceiver::class.java).apply {
                    action = NotificationActionReceiver.ACTION_SNOOZE
                    putExtra("NOTIFICATION_ID", notificationId)
                    putExtra("TITLE", title)
                    putExtra("MESSAGE", message)
                    putExtra("SNOOZE_MINUTES", minutes)
                    putExtra("TARGET_TAB", targetTab)
                }
                return PendingIntent.getBroadcast(
                    context, notificationId + extraReqCode, snoozeIntent,
                    PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
                )
            }

            val snooze15PendingIntent = buildSnoozePendingIntent(15, 2)
            val snooze30PendingIntent = buildSnoozePendingIntent(30, 3)

            // وقتی نوتیف با کشیدنِ انگشت کنار گذاشته بشه (نه با «تمام»، نه با باز کردنش)،
            // این PendingIntent صدا زده میشه؛ ولی الان کارِ خاصی انجام نمی‌ده، چون چکِ
            // ۱۵-دقیقه‌ایِ پایینِ همین تابع (schedulePendingRecheck) از قبل مستقل از این
            // مسیر، همین نتیجه رو تضمین می‌کنه
            val dismissIntent = Intent(context, NotificationActionReceiver::class.java).apply {
                action = NotificationActionReceiver.ACTION_DISMISSED
                putExtra("NOTIFICATION_ID", notificationId)
            }
            val dismissPendingIntent = PendingIntent.getBroadcast(
                context, notificationId + 4, dismissIntent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )

            // صفحه‌ی تمام‌صفحه‌ی هشدار: وقتی گوشی قفله یا صفحه خاموشه، اندروید همین اکتیویتی
            // رو مستقیم باز می‌کنه و صفحه رو روشن می‌کنه (دقیقاً مثل اپ‌های آلارم)؛ وقتی گوشی
            // باز و روشنه، سیستم به‌جاش فقط یه نوتیف بالای صفحه (heads-up) نشون میده
            val fullScreenIntent = Intent(context, ReminderFullScreenActivity::class.java).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP or
                        Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_NO_USER_ACTION
                putExtra("NOTIFICATION_ID", notificationId)
                putExtra("TITLE", title)
                putExtra("MESSAGE", message)
                putExtra("TARGET_TAB", targetTab)
            }
            val fullScreenPendingIntent = PendingIntent.getActivity(
                context, notificationId + 5, fullScreenIntent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )

            val builder = NotificationCompat.Builder(context, ReminderScheduler.CHANNEL_ID)
                .setSmallIcon(R.mipmap.ic_launcher)
                .setContentTitle(title)
                .setContentText(message)
                .setStyle(NotificationCompat.BigTextStyle().bigText(message))
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setCategory(NotificationCompat.CATEGORY_ALARM)
                .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                .setDefaults(NotificationCompat.DEFAULT_ALL)
                .setAutoCancel(true)
                .setContentIntent(contentPendingIntent)
                .setDeleteIntent(dismissPendingIntent)
                .setFullScreenIntent(fullScreenPendingIntent, true)
                .addAction(0, "✅ تمام", donePendingIntent)
                .addAction(0, "⏰ ۱۵ دقیقه", snooze15PendingIntent)
                .addAction(0, "⏰ ۳۰ دقیقه", snooze30PendingIntent)

            with(NotificationManagerCompat.from(context)) {
                notify(notificationId, builder.build())
            }

            // این یادآوری به لیستِ «در انتظار» اضافه میشه و یه چکِ ۱۵-دقیقه‌ای براش ثبت میشه:
            // اگه تا اون موقع بهش رسیدگی نشده باشه (نه تمام، نه تاخیر، نه بازکردنِ برنامه)،
            // دوباره ظاهر میشه — چه کشیده شده باشه کنار، چه فقط بدون هیچ واکنشی بالای صفحه
            // مونده باشه. اگه چندتا یادآوریِ دیگه هم هم‌زمان معلق باشن، صفحه‌ی تمام‌صفحه همه‌شون
            // رو با هم نشون میده.
            ReminderScheduler.addPendingReminder(context, notificationId, title, message, targetTab)
            ReminderScheduler.schedulePendingRecheck(context, notificationId, title, message, targetTab)
        }

        val now = Calendar.getInstance()
        val todayStr = "${now.get(Calendar.YEAR)}-${now.get(Calendar.MONTH)}-${now.get(Calendar.DAY_OF_MONTH)}"

        // ثبت تاریخ آخرین شلیک برای یادآوری روزانه
        if (intent.getBooleanExtra("IS_DAILY", false)) {
            val hour = intent.getIntExtra("DAILY_HOUR", -1)
            val minute = intent.getIntExtra("DAILY_MINUTE", -1)
            val reqCode = intent.getIntExtra("DAILY_REQ_CODE", -1)

            context.getSharedPreferences("planner_reminders_prefs", Context.MODE_PRIVATE)
                .edit()
                .putString("daily_${reqCode}_last_fired", todayStr)
                .apply()

            if (hour in 0..23 && minute in 0..59 && reqCode != -1) {
                ReminderScheduler.scheduleDailyReminder(context, hour, minute, reqCode)
            }
        }

        // ثبت تاریخ آخرین شلیک برای یادآوری سفارشی هفتگی
        if (intent.getBooleanExtra("IS_WEEKLY", false)) {
            val hour = intent.getIntExtra("WEEKLY_HOUR", -1)
            val minute = intent.getIntExtra("WEEKLY_MINUTE", -1)
            val day = intent.getIntExtra("WEEKLY_DAY", -1)
            val id = intent.getIntExtra("WEEKLY_ID", -1)
            val repeat = intent.getBooleanExtra("WEEKLY_REPEAT", false)
            val startDateMillis = intent.getLongExtra("WEEKLY_START_DATE", 0L)

            context.getSharedPreferences("planner_reminders_prefs", Context.MODE_PRIVATE)
                .edit()
                .putString("custom_${id}_last_fired_${day}", todayStr)
                .apply()

            if (id != -1 && day in 1..7) {
                if (repeat && hour in 0..23 && minute in 0..59) {
                    ReminderScheduler.scheduleCustomReminderDay(context, id, message, hour, minute, day, true, startDateMillis)
                } else if (!repeat) {
                    // یادآوری «بدون تکرار هر هفته» بود؛ این روز کارش تمومه و نباید دوباره
                    // با ری‌استارت گوشی یا چک بعدی زنده بشه
                    ReminderScheduler.removeCustomReminderDay(context, id, day)
                }
            }
        }

        // تکرار خودکار یادآوری دوره‌ای - زمان بعدی نسبت به زمان قبلی جلو میره، نه از "الان"
        if (intent.getBooleanExtra("IS_PERIODIC", false)) {
            val reqCode = intent.getIntExtra("PERIODIC_REQ_CODE", 8001)
            ReminderScheduler.advancePeriodicReminder(context, reqCode)
        }

        // یادآوری یک‌بارمصرف (هدف/تسک تاریخ‌دار) کارش تمومه؛ از prefs پاکش کن تا با
        // ری‌استارت گوشی دوباره زنده نشه
        if (intent.getBooleanExtra("IS_ONEOFF", false)) {
            val reqCode = intent.getIntExtra("ONEOFF_REQ_CODE", -1)
            if (reqCode != -1) {
                ReminderScheduler.removeOneOffPrefs(context, reqCode)
            }
        }
    }
}
