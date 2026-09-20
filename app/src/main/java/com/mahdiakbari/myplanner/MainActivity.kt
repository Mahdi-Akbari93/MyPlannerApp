package com.mahdiakbari.myplanner

import android.Manifest
import android.app.AlarmManager
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Color
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Environment
import android.provider.Settings
import android.view.Gravity
import android.view.View
import android.webkit.JavascriptInterface
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.ProgressBar
import android.widget.TextView
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.OnBackPressedCallback
import androidx.activity.result.contract.ActivityResultContracts
import androidx.core.app.ActivityCompat
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import org.json.JSONObject
import java.io.File
import java.io.FileWriter

class MainActivity : ComponentActivity() {
    private lateinit var myWebView: WebView
    private lateinit var splashView: LinearLayout
    private var isSplashDismissed = false
    private var filePathCallback: ValueCallback<Array<Uri>>? = null

    // وقتی روی نوتیف زده میشه، این تب همون لحظه (یا به‌محض تموم شدن بارگذاری صفحه) باز میشه
    private var pendingOpenTab: String? = null

    private fun dismissSplash() {
        if (isSplashDismissed) return
        isSplashDismissed = true
        if (::splashView.isInitialized) {
            splashView.animate()
                .alpha(0f)
                .setDuration(300)
                .withEndAction {
                    splashView.visibility = View.GONE
                    maybeShowPermissionOnboarding()
                }
        }
    }

    private val fileChooserLauncher = registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { result ->
        if (filePathCallback == null) return@registerForActivityResult
        val results = if (result.resultCode == RESULT_OK && result.data != null) {
            arrayOf(result.data!!.data!!)
        } else null
        filePathCallback?.onReceiveValue(results as Array<Uri>?)
        filePathCallback = null
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        pendingOpenTab = intent?.getStringExtra("OPEN_TAB")

        checkPermissions()
        ReminderScheduler.createNotificationChannel(this)
        BackupScheduler.createBackupNotificationChannel(this)

        // بازسازی آلارم‌ها و جبران فوری اعلان‌های جامانده به محض باز شدن برنامه توسط کاربر
        ReminderScheduler.rescheduleAllDailyReminders(this)
        ReminderScheduler.rescheduleAllCustomReminders(this)
        ReminderScheduler.reschedulePeriodicReminder(this)
        ReminderScheduler.rescheduleAllOneOffReminders(this)

        // زمان‌بندی و بررسی بک‌آپ خودکار روزانه
        BackupScheduler.scheduleDailyAutoBackup(this)
        BackupScheduler.checkMissedBackup(this)

        val rootLayout = FrameLayout(this).apply {
            setBackgroundColor(Color.parseColor("#0d0f12"))
            layoutParams = FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.MATCH_PARENT
            )
        }

        myWebView = WebView(this).apply {
            layoutParams = FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.MATCH_PARENT
            )
            @Suppress("SetJavaScriptEnabled")
            settings.javaScriptEnabled = true
            settings.domStorageEnabled = true
            settings.allowFileAccess = true
            settings.allowContentAccess = true
            settings.cacheMode = WebSettings.LOAD_DEFAULT

            webViewClient = object : WebViewClient() {
                override fun shouldOverrideUrlLoading(view: WebView?, request: android.webkit.WebResourceRequest?): Boolean {
                    val url = request?.url?.toString() ?: return false
                    if (url.startsWith("http://") || url.startsWith("https://") || url.startsWith("tg://") || url.startsWith("mailto:")) {
                        try {
                            val intent = Intent(Intent.ACTION_VIEW, Uri.parse(url)).apply {
                                flags = Intent.FLAG_ACTIVITY_NEW_TASK
                            }
                            startActivity(intent)
                            return true
                        } catch (e: Exception) {
                            return false
                        }
                    }
                    return false
                }

                @Deprecated("Deprecated in Java")
                override fun shouldOverrideUrlLoading(view: WebView?, url: String?): Boolean {
                    if (url == null) return false
                    if (url.startsWith("http://") || url.startsWith("https://") || url.startsWith("tg://") || url.startsWith("mailto:")) {
                        try {
                            val intent = Intent(Intent.ACTION_VIEW, Uri.parse(url)).apply {
                                flags = Intent.FLAG_ACTIVITY_NEW_TASK
                            }
                            startActivity(intent)
                            return true
                        } catch (e: Exception) {
                            return false
                        }
                    }
                    return false
                }

                override fun onPageFinished(view: WebView?, url: String?) {
                    super.onPageFinished(view, url)
                    dismissSplash()

                    pendingOpenTab?.let { tab ->
                        myWebView.evaluateJavascript(
                            "if (typeof switchTab === 'function') { switchTab('$tab'); }",
                            null
                        )
                        pendingOpenTab = null
                    }
                }

                override fun onReceivedError(
                    view: WebView?,
                    errorCode: Int,
                    description: String?,
                    failingUrl: String?
                ) {
                    super.onReceivedError(view, errorCode, description, failingUrl)
                    dismissSplash()
                }
            }

            webChromeClient = object : WebChromeClient() {
                override fun onShowFileChooser(
                    webView: WebView?,
                    filePathCallback: ValueCallback<Array<Uri>>?,
                    fileChooserParams: FileChooserParams?
                ): Boolean {
                    this@MainActivity.filePathCallback?.onReceiveValue(null)
                    this@MainActivity.filePathCallback = filePathCallback

                    val intent = Intent(Intent.ACTION_GET_CONTENT).apply {
                        addCategory(Intent.CATEGORY_OPENABLE)
                        type = "*/*"
                    }
                    fileChooserLauncher.launch(Intent.createChooser(intent, "انتخاب فایل بک آپ"))
                    return true
                }
            }

            addJavascriptInterface(WebAppInterface(this@MainActivity), "AndroidInterface")
            loadUrl("file:///android_asset/index.html")
        }

        splashView = LinearLayout(this).apply {
            layoutParams = FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.MATCH_PARENT
            )
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER
            setBackgroundColor(Color.parseColor("#0d0f12"))

            val logoText = TextView(this@MainActivity).apply {
                text = "🎯"
                textSize = 64f
                gravity = Gravity.CENTER
            }

            val titleText = TextView(this@MainActivity).apply {
                text = "برنامه‌ریز هوشمند"
                textSize = 22f
                setTextColor(Color.parseColor("#f39c12"))
                gravity = Gravity.CENTER
                setPadding(0, 15, 0, 25)
            }

            val progressBar = ProgressBar(this@MainActivity).apply {
                indeterminateDrawable.setColorFilter(
                    Color.parseColor("#6c5ce7"),
                    android.graphics.PorterDuff.Mode.SRC_IN
                )
            }

            val subTitleText = TextView(this@MainActivity).apply {
                text = "Dark Luxury Edition"
                textSize = 12f
                setTextColor(Color.parseColor("#95a5a6"))
                gravity = Gravity.CENTER
                setPadding(0, 25, 0, 0)
            }

            addView(logoText)
            addView(titleText)
            addView(progressBar)
            addView(subTitleText)
        }

        rootLayout.addView(myWebView)
        rootLayout.addView(splashView)

        // اطمینان از بسته شدن اسپلش تحت هر شرایطی حداکثر پس از ۱.۲ ثانیه
        splashView.postDelayed({
            dismissSplash()
        }, 1200)

        setContentView(rootLayout)

        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                if (myWebView.canGoBack()) {
                    myWebView.goBack()
                } else {
                    finish()
                }
            }
        })
    }

    // وقتی اپ از قبل باز/در پس‌زمینه‌ست و روی نوتیف زده میشه، اندروید به‌جای ساختن یه
    // نمونه‌ی جدید از اکتیویتی (که باعث می‌شد چند تا کپی روی هم تلنبار بشه)، همین متد رو
    // صدا می‌زنه؛ چون WebView از قبل بارگذاری شده، مستقیم می‌تونیم تب رو عوض کنیم
    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        val tab = intent.getStringExtra("OPEN_TAB")
        if (!tab.isNullOrEmpty() && ::myWebView.isInitialized) {
            myWebView.evaluateJavascript(
                "if (typeof switchTab === 'function') { switchTab('$tab'); }",
                null
            )
        }
    }

    // موقع اولین باز شدنِ اپ (فقط یه‌بار)، کاربر رو با یه توضیحِ کوتاه راهنمایی می‌کنیم که
    // بره تنظیماتِ باتری رو درست کنه، و اگه گوشیش نیاز داشت (شیائومی/هوآوی/اوپو/ویوو/
    // وان‌پلاس)، تنظیمِ «شروع خودکار» رو هم. سامسونگ و گوشی‌های اندرویدِ خالص همچین مرحله‌ی
    // اضافه‌ای نمی‌بینن — دقیقاً به همون دلیلی که خواسته شده بود.
    private fun maybeShowPermissionOnboarding() {
        val prefs = getSharedPreferences("planner_reminders_prefs", Context.MODE_PRIVATE)
        if (prefs.getBoolean("onboarding_permissions_shown", false)) return
        showOnboardingBatteryDialog(prefs)
    }

    private fun showOnboardingBatteryDialog(prefs: android.content.SharedPreferences) {
        if (PermissionOnboardingHelper.isIgnoringBatteryOptimizations(this)) {
            if (PermissionOnboardingHelper.needsAutostartStep()) {
                showOnboardingAutostartDialog(prefs)
            } else {
                markOnboardingShown(prefs)
            }
            return
        }

        android.app.AlertDialog.Builder(this)
            .setTitle("🔋 یک تنظیم مهم برای یادآوری‌ها")
            .setMessage("برای اینکه یادآوری‌های مای‌پلنر هیچ‌وقت توسط خودِ گوشی بی‌سروصدا قطع نشن، لازمه یه اجازه‌ی کوچیک بدی. الان یه پنجره‌ی سیستمی باز میشه — فقط کافیه «Allow» یا «اجازه بده» رو بزنی.")
            .setCancelable(false)
            .setPositiveButton("باشه، برو") { _, _ ->
                PermissionOnboardingHelper.openBatteryOptimizationSettings(this)
                if (PermissionOnboardingHelper.needsAutostartStep()) {
                    showOnboardingAutostartDialog(prefs)
                } else {
                    markOnboardingShown(prefs)
                }
            }
            .setNegativeButton("بعداً") { _, _ ->
                markOnboardingShown(prefs)
            }
            .show()
    }

    private fun showOnboardingAutostartDialog(prefs: android.content.SharedPreferences) {
        android.app.AlertDialog.Builder(this)
            .setTitle("🚀 یک تنظیم دیگه، مخصوص همین گوشی")
            .setMessage("گوشیت یه تنظیمِ اضافه به اسم «شروع خودکار» (Autostart) داره که اگه روشن نشه، ممکنه یادآوری‌ها بعد از مدتی قطع بشن. الان می‌ریم اونجا — کافیه مای‌پلنر رو توی لیست پیدا کنی و روشنش کنی.")
            .setCancelable(false)
            .setPositiveButton("باشه، برو") { _, _ ->
                PermissionOnboardingHelper.openAutostartSettings(this)
                markOnboardingShown(prefs)
            }
            .setNegativeButton("رد کن") { _, _ ->
                markOnboardingShown(prefs)
            }
            .show()
    }

    private fun markOnboardingShown(prefs: android.content.SharedPreferences) {
        prefs.edit().putBoolean("onboarding_permissions_shown", true).apply()
    }

    private fun createBackupNotificationChannel(context: Context) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                "backup_notifications",
                "پشتیبان‌گیری خودکار",
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = "اعلان‌های پشتیبان‌گیری فایل‌ها"
            }
            val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            manager.createNotificationChannel(channel)
        }
    }

    private fun checkPermissions() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
                ActivityCompat.requestPermissions(this, arrayOf(Manifest.permission.POST_NOTIFICATIONS), 101)
            }
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            val alarmManager = getSystemService(Context.ALARM_SERVICE) as AlarmManager
            if (!alarmManager.canScheduleExactAlarms()) {
                try {
                    val intent = Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM)
                    startActivity(intent)
                } catch (e: Exception) {
                    // بعضی گوشی‌ها این صفحه تنظیمات رو ندارن؛ نادیده می‌گیریم تا اپ کرش نکنه
                }
            }
        }

        // درخواست معافیت از بهینه‌سازی باتری. اندروید (و مخصوصاً گوشی‌های شیائومی/هواوی/سامسونگ)
        // می‌تونن این اجازه رو خودشون به‌مرور و بی‌سروصدا پس بگیرن؛ برای همین هر بار که اپ باز
        // میشه دوباره چک می‌کنیم، نه فقط یه بار موقع اولین نصب.
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            val powerManager = getSystemService(Context.POWER_SERVICE) as android.os.PowerManager
            if (!powerManager.isIgnoringBatteryOptimizations(packageName)) {
                try {
                    val intent = Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS).apply {
                        data = Uri.parse("package:$packageName")
                    }
                    startActivity(intent)
                } catch (e: Exception) {
                    // بعضی گوشی‌ها این صفحه رو مسدود کردن؛ نادیده می‌گیریم
                }
            }
        }
    }

    inner class WebAppInterface(private val context: Context) {
        @JavascriptInterface
        fun setReminderTime(hour: Int, minute: Int, reqCode: Int) {
            runOnUiThread {
                ReminderScheduler.scheduleDailyReminder(context, hour, minute, reqCode)
                Toast.makeText(context, "یادآوری روزانه تنظیم شد", Toast.LENGTH_SHORT).show()
            }
        }

        @JavascriptInterface
        fun setCustomReminder(id: Int, text: String, hour: Int, minute: Int, daysCsv: String, repeat: Boolean, startDate: String) {
            runOnUiThread {
                val days = daysCsv.split(",").mapNotNull { it.trim().toIntOrNull() }
                val startDateMillis = parseStartDateMillis(startDate)
                ReminderScheduler.scheduleCustomReminder(context, id, text, hour, minute, days, repeat, startDateMillis)
                Toast.makeText(context, "یادآوری تنظیم شد", Toast.LENGTH_SHORT).show()
            }
        }

        // startDate با فرمت "YYYY-MM-DD" (همون فرمت input[type=date]) میاد؛ اگه خالی یا
        // نامعتبر باشه، ۰ برمی‌گردونه یعنی «بدون محدودیت تاریخ شروع» (رفتار قبل از این تغییر)
        private fun parseStartDateMillis(startDate: String): Long {
            if (startDate.isBlank()) return 0L
            return try {
                val parts = startDate.trim().split("-")
                if (parts.size != 3) return 0L
                val year = parts[0].toInt()
                val month = parts[1].toInt() - 1
                val day = parts[2].toInt()
                java.util.Calendar.getInstance().apply {
                    set(year, month, day, 0, 0, 0)
                    set(java.util.Calendar.MILLISECOND, 0)
                }.timeInMillis
            } catch (e: Exception) {
                0L
            }
        }

        @JavascriptInterface
        fun cancelCustomReminder(id: Int, daysCsv: String) {
            runOnUiThread {
                val days = daysCsv.split(",").mapNotNull { it.trim().toIntOrNull() }
                ReminderScheduler.cancelCustomReminder(context, id, days)
            }
        }

        @JavascriptInterface
        fun setGoalReminder(title: String, desc: String, timeInMillis: Long, reqCode: Int) {
            runOnUiThread {
                val notificationTitle = "🎯 هدف مهم: $title"
                val notificationMessage = if (!desc.isNullOrBlank()) {
                    "$desc\n📌 زمان رسیدن به این هدف فوق‌العاده فرا رسید!"
                } else {
                    "📌 زمان رسیدن به هدف «$title» فرا رسید. پرقدرت ادامه بده!"
                }

                // یادآوری‌های اهداف/تسک‌ها حالا ذخیره میشن تا با ری‌استارت گوشی یا آپدیت اپ
                // از بین نرن و اگه زمانشون گذشت، جبران بشن. با زدن روی نوتیف، مستقیم میره تب اهداف
                ReminderScheduler.scheduleOneOffReminder(context, notificationTitle, notificationMessage, timeInMillis, reqCode, "goals")

                Toast.makeText(context, "یادآوری اختصاصی تنظیم شد!", Toast.LENGTH_SHORT).show()
            }
        }

        @JavascriptInterface
        fun setTaskReminder(title: String, typeLabel: String, timeInMillis: Long, reqCode: Int) {
            runOnUiThread {
                val notificationTitle = "$typeLabel: $title"
                val notificationMessage = "📌 زمان انجام این برنامه فرا رسید. وارد اپلیکیشن بشو!"

                // typeLabel از قبل مشخص می‌کنه این تسک هفتگیه یا ماهانه؛ همون رو برای تشخیص
                // تبی که با زدن روی نوتیف باید باز بشه استفاده می‌کنیم
                val targetTab = if (typeLabel.contains("هفتگی")) "weekly" else "monthly"

                ReminderScheduler.scheduleOneOffReminder(context, notificationTitle, notificationMessage, timeInMillis, reqCode, targetTab)

                Toast.makeText(context, "یادآوری تنظیم شد!", Toast.LENGTH_SHORT).show()
            }
        }

        // نسخه‌ی تکرارشونده‌ی setTaskReminder: برای تسک‌های هفتگی/ماهانه‌ای که کاربر گفته
        // «هر N روز یکبار» تکرار بشه. startDateTime میلی‌ثانیه‌ی تاریخ+ساعت شروعه (اگه صفر یا
        // منفی باشه یعنی از همین الان شروع کن). reqCode همون reqCode ساده‌ایه که سمت جاوااسکریپت
        // از قبل برای این تسک استفاده می‌شد (id % 100000)؛ اینجا با یه آفست جدا (700000000+)
        // به یه فضای کاملاً مجزا از یادآورهای یک‌بارمصرف و یادآور عمومی ۸۰۰۱ منتقل میشه تا
        // هیچ‌وقت قاطیِ هم نشن.
        @JavascriptInterface
        fun setRecurringTaskReminder(title: String, typeLabel: String, startDateTime: Long, intervalDays: Int, reqCode: Int) {
            runOnUiThread {
                val notificationTitle = "$typeLabel: $title"
                val notificationMessage = "📌 زمان انجام این برنامه فرا رسید. وارد اپلیکیشن بشو!"
                val targetTab = if (typeLabel.contains("هفتگی")) "weekly" else "monthly"
                val cal = java.util.Calendar.getInstance().apply {
                    if (startDateTime > 0) timeInMillis = startDateTime
                }
                val hour = cal.get(java.util.Calendar.HOUR_OF_DAY)
                val minute = cal.get(java.util.Calendar.MINUTE)

                ReminderScheduler.scheduleTaskRepeatReminder(
                    context, 700000000 + reqCode, notificationTitle, notificationMessage,
                    hour, minute, intervalDays, startDateTime, targetTab
                )

                Toast.makeText(context, "یادآوری تکرارشونده هر $intervalDays روز تنظیم شد!", Toast.LENGTH_SHORT).show()
            }
        }

        @JavascriptInterface
        fun cancelRecurringTaskReminder(reqCode: Int) {
            runOnUiThread {
                ReminderScheduler.cancelTaskRepeatReminder(context, 700000000 + reqCode)
            }
        }

        @JavascriptInterface
        fun cancelReminder(reqCode: Int) {
            runOnUiThread {
                // این هم آلارم زنده رو کنسل می‌کنه، هم اگه یادآوری یک‌بارمصرفی با همین reqCode
                // در prefs ذخیره شده بود پاکش می‌کنه (وگرنه با ری‌استارت گوشی دوباره زنده میشه)
                ReminderScheduler.cancelOneOffReminder(context, reqCode)
            }
        }

        // دو تا گزینه‌ی تاخیرِ دلخواه (به دقیقه) که کاربر از تنظیمات اپ مشخص می‌کنه؛ توی
        // صفحه‌ی تمام‌صفحه‌ی یادآوری، علاوه بر ۱۵ و ۳۰ دقیقه‌ی پیش‌فرض نشون داده میشن.
        // ۰ یا کمتر یعنی اون اسلات غیرفعاله
        @JavascriptInterface
        fun setCustomSnoozeDurations(minutes1: Int, minutes2: Int) {
            runOnUiThread {
                ReminderScheduler.setCustomSnoozeDurations(context, minutes1, minutes2)
            }
        }

        // اگه کاربر موقعِ اولین بازِ اپ، مرحله‌ی تنظیمِ باتری/شروع خودکار رو رد کرده باشه، از
        // منوی تنظیماتِ خودِ اپ می‌تونه دوباره صداش بزنه
        @JavascriptInterface
        fun openBatterySettingsWizard() {
            runOnUiThread {
                val prefs = getSharedPreferences("planner_reminders_prefs", Context.MODE_PRIVATE)
                showOnboardingBatteryDialog(prefs)
            }
        }

        @JavascriptInterface
        fun setPeriodicReminder(intervalDays: Int, hour: Int, minute: Int, title: String, message: String, reqCode: Int) {
            runOnUiThread {
                ReminderScheduler.setupPeriodicReminder(context, intervalDays, hour, minute, title, message, reqCode)
                Toast.makeText(context, "یادآوری دوره‌ای هر $intervalDays روز فعال شد!", Toast.LENGTH_SHORT).show()
            }
        }

        @JavascriptInterface
        fun syncLatestBackupData(jsonContent: String) {
            BackupScheduler.saveLatestDataCache(context, jsonContent)
        }

        @JavascriptInterface
        fun getBackupSettings(): String {
            val prefs = context.getSharedPreferences("planner_reminders_prefs", Context.MODE_PRIVATE)
            val autoEnabled = prefs.getBoolean("auto_backup_enabled", true)
            val hour = prefs.getInt("auto_backup_hour", 23)
            val minute = prefs.getInt("auto_backup_minute", 30)
            val cloudEnabled = prefs.getBoolean("backup_cloud_enabled", false)
            val platform = prefs.getString("backup_platform", "bale") ?: "bale"
            val botToken = prefs.getString("backup_bot_token", "") ?: ""
            val chatId = prefs.getString("backup_chat_id", "") ?: ""

            val json = JSONObject().apply {
                put("autoEnabled", autoEnabled)
                put("hour", hour)
                put("minute", minute)
                put("cloudEnabled", cloudEnabled)
                put("platform", platform)
                put("botToken", botToken)
                put("chatId", chatId)
            }
            return json.toString()
        }

        @JavascriptInterface
        fun saveBackupSettings(hour: Int, minute: Int, autoEnabled: Boolean, cloudEnabled: Boolean, platform: String, token: String, chatId: String) {
            val prefs = context.getSharedPreferences("planner_reminders_prefs", Context.MODE_PRIVATE)
            prefs.edit().apply {
                putBoolean("auto_backup_enabled", autoEnabled)
                putInt("auto_backup_hour", hour)
                putInt("auto_backup_minute", minute)
                putBoolean("backup_cloud_enabled", cloudEnabled)
                putString("backup_platform", platform)
                putString("backup_bot_token", token.trim())
                putString("backup_chat_id", chatId.trim())
                apply()
            }
            BackupScheduler.scheduleDailyAutoBackup(context)
            runOnUiThread {
                Toast.makeText(context, "تنظیمات بک‌آپ با موفقیت ذخیره شد ✅", Toast.LENGTH_SHORT).show()
            }
        }

        @JavascriptInterface
        fun testCloudConnection(platform: String, token: String, chatId: String) {
            Thread {
                val (success, message) = BackupCloudSender.testConnection(platform, token.trim(), chatId.trim())
                runOnUiThread {
                    if (success) {
                        Toast.makeText(context, "اتصال به ${if (platform == "bale") "بله" else "تلگرام"} موفق بود! پیام تستی ارسال شد ✅", Toast.LENGTH_LONG).show()
                    } else {
                        Toast.makeText(context, "خطا در اتصال: $message", Toast.LENGTH_LONG).show()
                    }
                    myWebView.evaluateJavascript("if (typeof onCloudTestComplete === 'function') onCloudTestComplete($success, '${message.replace("'", "\\'")}');", null)
                }
            }.start()
        }

        @JavascriptInterface
        fun saveBackupToFile(jsonContent: String) {
            BackupScheduler.saveLatestDataCache(context, jsonContent)
            Thread {
                val (ok, msg) = BackupScheduler.performBackup(context, isAuto = false, directJson = jsonContent)
                runOnUiThread {
                    if (ok) {
                        Toast.makeText(context, "بک‌آپ در Downloads/MyPlanner ذخیره شد!", Toast.LENGTH_SHORT).show()
                    } else {
                        Toast.makeText(context, msg, Toast.LENGTH_LONG).show()
                    }
                    myWebView.evaluateJavascript("if (typeof onBackupComplete === 'function') onBackupComplete($ok, '${msg.replace("'", "\\'")}');", null)
                }
            }.start()
        }

        @JavascriptInterface
        fun autoBackupToFile(jsonContent: String) {
            BackupScheduler.saveLatestDataCache(context, jsonContent)
            Thread {
                BackupScheduler.performBackup(context, isAuto = true, directJson = jsonContent)
            }.start()
        }

        @JavascriptInterface
        fun copyToClipboard(text: String, label: String) {
            runOnUiThread {
                try {
                    val clipboard = context.getSystemService(Context.CLIPBOARD_SERVICE) as android.content.ClipboardManager
                    val clip = android.content.ClipData.newPlainText(label, text)
                    clipboard.setPrimaryClip(clip)
                    Toast.makeText(context, "$label با موفقیت کپی شد ✅", Toast.LENGTH_SHORT).show()
                } catch (e: Exception) {
                    Toast.makeText(context, "خطا در کپی: ${e.message}", Toast.LENGTH_SHORT).show()
                }
            }
        }

        @JavascriptInterface
        fun openExternalUrl(url: String) {
            runOnUiThread {
                try {
                    val intent = Intent(Intent.ACTION_VIEW, Uri.parse(url)).apply {
                        flags = Intent.FLAG_ACTIVITY_NEW_TASK
                    }
                    context.startActivity(intent)
                } catch (e: Exception) {
                    Toast.makeText(context, "برنامه‌ای برای باز کردن این پیوند یافت نشد", Toast.LENGTH_SHORT).show()
                }
            }
        }
    }
}