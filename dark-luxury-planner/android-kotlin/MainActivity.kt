package com.mahdiakbari.myplanner

import android.Manifest
import android.content.ContentValues
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.provider.MediaStore
import android.webkit.JavascriptInterface
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.ComponentActivity
import androidx.activity.OnBackPressedCallback
import androidx.activity.result.ActivityResultLauncher
import androidx.activity.result.contract.ActivityResultContracts
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat

class MainActivity : ComponentActivity() {
    private lateinit var myWebView: WebView
    private var fileChooserCallback: ValueCallback<Array<Uri>>? = null
    private lateinit var fileChooserLauncher: ActivityResultLauncher<Intent>
    private lateinit var notificationPermissionLauncher: ActivityResultLauncher<String>

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        ReminderReceiver.createChannel(this)

        // نتیجه‌ی انتخاب فایل (برای بازگردانی بک‌آپ) رو برمی‌گردونه به input[type=file] توی صفحه
        fileChooserLauncher = registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { result ->
            val data = result.data
            val results: Array<Uri>? = if (result.resultCode == RESULT_OK && data?.data != null) {
                arrayOf(data.data!!)
            } else null
            fileChooserCallback?.onReceiveValue(results)
            fileChooserCallback = null
        }

        notificationPermissionLauncher = registerForActivityResult(ActivityResultContracts.RequestPermission()) { }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
            ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED
        ) {
            notificationPermissionLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
        }

        myWebView = WebView(this).apply {
            @Suppress("SetJavaScriptEnabled")
            settings.javaScriptEnabled = true
            settings.domStorageEnabled = true
            settings.allowFileAccess = true
            settings.allowContentAccess = true
            settings.cacheMode = WebSettings.LOAD_DEFAULT

            webViewClient = WebViewClient()

            // پیش‌فرض onShowFileChooser رو پیاده نمی‌کنه — همون دلیلیه که انتخاب فایل بک‌آپ باز نمی‌شد
            webChromeClient = object : WebChromeClient() {
                override fun onShowFileChooser(
                    webView: WebView?,
                    filePathCallback: ValueCallback<Array<Uri>>?,
                    fileChooserParams: FileChooserParams?
                ): Boolean {
                    fileChooserCallback = filePathCallback
                    val intent = Intent(Intent.ACTION_GET_CONTENT).apply {
                        type = "*/*"
                        addCategory(Intent.CATEGORY_OPENABLE)
                    }
                    fileChooserLauncher.launch(Intent.createChooser(intent, "انتخاب فایل بک‌آپ"))
                    return true
                }
            }

            addJavascriptInterface(AndroidBridge(this@MainActivity), "AndroidBridge")

            loadUrl("file:///android_asset/index.html")
        }

        setContentView(myWebView)

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

    // پل بین جاوااسکریپت داخل WebView و قابلیت‌های بومی اندروید
    inner class AndroidBridge(private val context: Context) {

        // ذخیره‌ی واقعی فایل بک‌آپ در پوشه‌ی Download گوشی
        @JavascriptInterface
        fun saveBackup(json: String, filename: String) {
            try {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    val resolver = context.contentResolver
                    val values = ContentValues().apply {
                        put(MediaStore.Downloads.DISPLAY_NAME, filename)
                        put(MediaStore.Downloads.MIME_TYPE, "application/json")
                        put(MediaStore.Downloads.IS_PENDING, 1)
                    }
                    val uri = resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values)
                    uri?.let {
                        resolver.openOutputStream(it)?.use { out -> out.write(json.toByteArray()) }
                        values.clear()
                        values.put(MediaStore.Downloads.IS_PENDING, 0)
                        resolver.update(it, values, null, null)
                    }
                } else {
                    // اندروید ۹ و پایین‌تر (API زیر ۲۹): MediaStore.Downloads وجود نداره، مستقیم توی Download عمومی می‌نویسیم
                    @Suppress("DEPRECATION")
                    val downloadsDir = android.os.Environment.getExternalStoragePublicDirectory(
                        android.os.Environment.DIRECTORY_DOWNLOADS
                    )
                    if (!downloadsDir.exists()) downloadsDir.mkdirs()
                    java.io.File(downloadsDir, filename).writeText(json)
                }
            } catch (e: Exception) {
                e.printStackTrace()
            }
        }

        // زمان‌بندی دو یادآوری روزانه با AlarmManager — مستقل از باز بودن اپ
        @JavascriptInterface
        fun scheduleReminders(time1: String, time2: String) {
            runOnUiThread {
                ReminderScheduler.schedule(context, time1, 1, "یادآوری نوبت اول")
                ReminderScheduler.schedule(context, time2, 2, "یادآوری نوبت دوم")
            }
        }

        // نوتیف تست فوری و بومی
        @JavascriptInterface
        fun testNotification() {
            runOnUiThread {
                ReminderReceiver.createChannel(context)
                val notification = NotificationCompat.Builder(context, ReminderReceiver.CHANNEL_ID)
                    .setSmallIcon(android.R.drawable.ic_popup_reminder)
                    .setContentTitle("تست یادآوری")
                    .setContentText("سیستم نوتیفیکیشن فعاله ✅")
                    .setPriority(NotificationCompat.PRIORITY_HIGH)
                    .setAutoCancel(true)
                    .build()
                NotificationManagerCompat.from(context).notify(999, notification)
            }
        }
    }
}
