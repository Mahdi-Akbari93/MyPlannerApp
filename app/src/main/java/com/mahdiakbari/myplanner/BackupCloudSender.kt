package com.mahdiakbari.myplanner

import android.content.Context
import org.json.JSONObject
import java.io.BufferedReader
import java.io.DataOutputStream
import java.io.File
import java.io.FileInputStream
import java.io.InputStreamReader
import java.net.HttpURLConnection
import java.net.URL
import java.nio.charset.StandardCharsets

object BackupCloudSender {

    private const val PREFS_NAME = "planner_reminders_prefs"

    fun getApiBaseUrl(platform: String): String {
        return if (platform.lowercase() == "bale") {
            "https://tapi.bale.ai"
        } else {
            "https://api.telegram.org"
        }
    }

    // تست اتصال: ارسال یک پیام متنی کوتاه به چت‌آیدی برای اطمینان از صحت توکن و چت‌آیدی
    fun testConnection(platform: String, token: String, chatId: String): Pair<Boolean, String> {
        return try {
            val cleanToken = token.trim()
            val cleanChatId = chatId.trim()
            if (cleanToken.isEmpty() || cleanChatId.isEmpty()) {
                return Pair(false, "توکن ربات و چت‌آیدی نباید خالی باشند.")
            }

            val baseUrl = getApiBaseUrl(platform)
            val url = URL("$baseUrl/bot$cleanToken/sendMessage")
            val conn = (url.openConnection() as HttpURLConnection).apply {
                requestMethod = "POST"
                connectTimeout = 15000
                readTimeout = 15000
                doOutput = true
                setRequestProperty("Content-Type", "application/json; charset=UTF-8")
            }

            val messengerTitle = if (platform.lowercase() == "bale") "بله" else "تلگرام"
            val textMessage = "🎯 ارتباط با ربات $messengerTitle در مای‌پلنر با موفقیت برقرار شد!\n\nاز این پس نسخه‌های پشتیبان شما به این چت ارسال خواهند شد."

            val jsonBody = JSONObject().apply {
                put("chat_id", cleanChatId)
                put("text", textMessage)
            }

            DataOutputStream(conn.outputStream).use { os ->
                val bytes = jsonBody.toString().toByteArray(StandardCharsets.UTF_8)
                os.write(bytes)
                os.flush()
            }

            val responseCode = conn.responseCode
            val responseText = if (responseCode in 200..299) {
                BufferedReader(InputStreamReader(conn.inputStream, StandardCharsets.UTF_8)).use { it.readText() }
            } else {
                val errorStream = conn.errorStream ?: conn.inputStream
                BufferedReader(InputStreamReader(errorStream, StandardCharsets.UTF_8)).use { it.readText() }
            }

            val jsonResponse = try { JSONObject(responseText) } catch (e: Exception) { null }
            val isOk = jsonResponse?.optBoolean("ok", false) ?: (responseCode == 200)

            if (isOk) {
                Pair(true, "پیام تست با موفقیت به ربات $messengerTitle ارسال شد! ✅")
            } else {
                val desc = jsonResponse?.optString("description", "خطا در ارسال") ?: "کد خطای $responseCode"
                Pair(false, "خطا از سرور $messengerTitle: $desc")
            }
        } catch (e: Exception) {
            val isIran = platform.lowercase() != "bale"
            val tip = if (isIran) " (در صورت فیلتر بودن تلگرام، فیلترشکن را روشن کنید یا از پیام‌رسان بله استفاده فرمایید)" else ""
            Pair(false, "خطا در اتصال: ${e.localizedMessage ?: e.message}$tip")
        }
    }

    // ارسال فایل سند پشتیبان به ربات بله یا تلگرام
    fun sendBackupDocument(context: Context, backupFile: File, caption: String): Pair<Boolean, String> {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val cloudEnabled = prefs.getBoolean("backup_cloud_enabled", false)
        if (!cloudEnabled) return Pair(false, "پشتیبان‌گیری ابری غیرفعال است.")

        val platform = prefs.getString("backup_platform", "bale") ?: "bale"
        val token = prefs.getString("backup_bot_token", "")?.trim() ?: ""
        val chatId = prefs.getString("backup_chat_id", "")?.trim() ?: ""

        if (token.isEmpty() || chatId.isEmpty() || !backupFile.exists()) {
            return Pair(false, "اطلاعات ربات ناقص است یا فایل یافت نشد.")
        }

        return try {
            val cleanPlatform = platform.lowercase().trim()
            val cleanToken = token.trim()
            val cleanChatId = chatId.trim()
            val baseUrl = getApiBaseUrl(cleanPlatform)
            val encodedChatId = java.net.URLEncoder.encode(cleanChatId, "UTF-8")
            val url = URL("$baseUrl/bot$cleanToken/sendDocument?chat_id=$encodedChatId")

            // استفاده از boundary کاملاً استاندارد بدون کاراکترهای = تا در پارسر multipart سرور بله/تلگرام خطا ایجاد نشود
            val boundary = "MyPlannerBoundary" + System.currentTimeMillis()
            val lineEnd = "\r\n"
            val twoHyphens = "--"

            val conn = (url.openConnection() as HttpURLConnection).apply {
                requestMethod = "POST"
                connectTimeout = 30000
                readTimeout = 30000
                doOutput = true
                useCaches = false
                setRequestProperty("Connection", "Keep-Alive")
                setRequestProperty("User-Agent", "MyPlanner/3.2.0")
                setRequestProperty("Content-Type", "multipart/form-data; boundary=$boundary")
            }

            conn.outputStream.use { os ->
                fun writeUtf8(text: String) {
                    os.write(text.toByteArray(StandardCharsets.UTF_8))
                }

                // ۱. فیلد chat_id در بدنه multipart
                writeUtf8("$twoHyphens$boundary$lineEnd")
                writeUtf8("Content-Disposition: form-data; name=\"chat_id\"$lineEnd$lineEnd")
                writeUtf8("$cleanChatId$lineEnd")

                // ۲. فیلد caption (در صورت وجود)
                if (caption.isNotBlank()) {
                    writeUtf8("$twoHyphens$boundary$lineEnd")
                    writeUtf8("Content-Disposition: form-data; name=\"caption\"$lineEnd$lineEnd")
                    writeUtf8("$caption$lineEnd")
                }

                // ۳. فیلد document (فایل اصلی بکاپ)
                writeUtf8("$twoHyphens$boundary$lineEnd")
                writeUtf8("Content-Disposition: form-data; name=\"document\"; filename=\"${backupFile.name}\"$lineEnd")
                writeUtf8("Content-Type: application/octet-stream$lineEnd$lineEnd")

                FileInputStream(backupFile).use { fis ->
                    val buffer = ByteArray(4096)
                    var bytesRead: Int
                    while (fis.read(buffer).also { bytesRead = it } != -1) {
                        os.write(buffer, 0, bytesRead)
                    }
                }
                writeUtf8(lineEnd)

                // پایان بخش‌های multipart
                writeUtf8("$twoHyphens$boundary$twoHyphens$lineEnd")
                os.flush()
            }

            val responseCode = conn.responseCode
            val responseText = if (responseCode in 200..299) {
                BufferedReader(InputStreamReader(conn.inputStream, StandardCharsets.UTF_8)).use { it.readText() }
            } else {
                val errorStream = conn.errorStream ?: conn.inputStream
                BufferedReader(InputStreamReader(errorStream, StandardCharsets.UTF_8)).use { it.readText() }
            }

            val jsonResponse = try { JSONObject(responseText) } catch (e: Exception) { null }
            val isOk = jsonResponse?.optBoolean("ok", false) ?: (responseCode == 200)

            if (isOk) {
                Pair(true, "فایل با موفقیت به پیام‌رسان ارسال شد.")
            } else {
                val desc = jsonResponse?.optString("description", "")?.ifEmpty { null } ?: responseText
                Pair(false, "خطا در ارسال فایل: $desc")
            }
        } catch (e: Exception) {
            Pair(false, "خطای ارتباط: ${e.localizedMessage ?: e.message}")
        }
    }
}
