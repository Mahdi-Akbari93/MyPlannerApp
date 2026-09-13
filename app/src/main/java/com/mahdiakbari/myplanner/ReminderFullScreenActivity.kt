package com.mahdiakbari.myplanner

import android.content.Intent
import android.graphics.Color
import android.graphics.Typeface
import android.os.Build
import android.os.Bundle
import android.view.Gravity
import android.view.View
import android.view.WindowManager
import android.widget.Button
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import androidx.activity.ComponentActivity

// این صفحه وقتی گوشی قفله یا صفحه خاموشه، خودش خودکار روی صفحه میاد (سیستم صفحه رو هم
// روشن می‌کنه) — دقیقاً مثل صفحه‌ی هشدارِ اپ‌های آلارم. اگه گوشی باز و روشن باشه، اندروید
// به‌جاش فقط یه نوتیف بالای صفحه (heads-up) نشون میده. با زدن روی خودِ نوتیف (چه از این
// حالت، چه از پنل نوتیف‌ها) هم دقیقاً همین صفحه باز میشه.
//
// launchMode="singleInstance" یعنی همیشه فقط یه نسخه از این اکتیویتی توی کل سیستم هست؛
// اگه وقتی این صفحه باز و رو صفحه‌ست یه یادآوریِ دیگه هم برسه، اندروید همون اینتنتِ جدید رو
// به‌جای ساختنِ یه نسخه‌ی تازه، به onNewIntent همینِ نسخه‌ی موجود می‌فرسته. برای همین این
// اکتیویتی هیچ‌وقت مستقیماً از روی extraهای اینتنتِ خودش رندر نمی‌کنه؛ همیشه از روی کاملِ
// لیستِ «یادآورهای در انتظار» (ReminderScheduler.getAllPendingReminders) رندر می‌کنه — پس
// اگه چندتا هم‌زمان معلق باشن، همه‌شون با هم و هرکدوم با دکمه‌های جدای خودشون نشون داده میشن.
class ReminderFullScreenActivity : ComponentActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // نمایش روی صفحه‌ی قفل + روشن کردن خودکار صفحه، بدون باز کردن قفل امنیتی گوشی
        // (گوشی همچنان قفل می‌مونه، فقط این صفحه روش نمایش داده میشه)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            setShowWhenLocked(true)
            setTurnScreenOn(true)
        } else {
            @Suppress("DEPRECATION")
            window.addFlags(
                WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or
                        WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON
            )
        }
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)

        refreshFromPendingList()
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        // یادآوریِ تازه از قبل توی ReminderReceiver به لیستِ «در انتظار» اضافه شده؛ اینجا
        // فقط کافیه دوباره از روی همون لیستِ کامل رندر بشه
        refreshFromPendingList()
    }

    private fun refreshFromPendingList() {
        val pending = ReminderScheduler.getAllPendingReminders(this)
        if (pending.isEmpty()) {
            finish()
            return
        }
        buildUi(pending)
    }

    private fun buildUi(pending: List<ReminderScheduler.PendingReminder>) {
        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setBackgroundColor(Color.parseColor("#0d0f12"))
            setPadding(48, 120, 48, 60)
        }

        if (pending.size > 1) {
            val headerView = TextView(this).apply {
                text = "⏰ ${pending.size} یادآوریِ رسیدگی‌نشده"
                textSize = 17f
                setTextColor(Color.parseColor("#f1c40f"))
                setTypeface(typeface, Typeface.BOLD)
                gravity = Gravity.CENTER
            }
            root.addView(headerView, matchParams().apply { bottomMargin = 30 })
        } else {
            val icon = TextView(this).apply {
                text = "⏰"
                textSize = 52f
                gravity = Gravity.CENTER
            }
            root.addView(icon, matchParams().apply { bottomMargin = 24 })
        }

        pending.forEachIndexed { index, item ->
            root.addView(buildReminderCard(item))
            if (index != pending.lastIndex) {
                root.addView(
                    View(this).apply { setBackgroundColor(Color.parseColor("#222633")) },
                    LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, 2).apply {
                        topMargin = 30
                        bottomMargin = 30
                    }
                )
            }
        }

        setContentView(ScrollView(this).apply { addView(root) })
    }

    private fun buildReminderCard(item: ReminderScheduler.PendingReminder): LinearLayout {
        val card = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
        }

        val titleView = TextView(this).apply {
            text = item.title
            textSize = 19f
            setTextColor(Color.parseColor("#f1c40f"))
            setTypeface(typeface, Typeface.BOLD)
            gravity = Gravity.CENTER
        }
        card.addView(titleView, matchParams().apply { bottomMargin = 10 })

        val messageView = TextView(this).apply {
            text = item.message
            textSize = 14f
            setTextColor(Color.parseColor("#dddddd"))
            gravity = Gravity.CENTER
        }
        card.addView(messageView, matchParams().apply { bottomMargin = 22 })

        card.addView(buildButton("✅ تمام شد", "#1e8449") {
            ReminderScheduler.handleReminderDone(this, item.id)
            refreshFromPendingList()
        })

        val snoozeOptions = (listOf(15, 30) + ReminderScheduler.getCustomSnoozeDurations(this)).distinct()
        snoozeOptions.forEach { minutes ->
            card.addView(buildButton("⏰ ${formatMinutesLabel(minutes)} دیگه", "#2d3140") {
                ReminderScheduler.handleReminderSnooze(this, item.id, item.title, item.message, item.targetTab, minutes)
                refreshFromPendingList()
            })
        }

        card.addView(buildButton("📱 باز کردن برنامه", "#1a1d24") {
            ReminderScheduler.handleReminderDone(this, item.id)
            val openIntent = Intent(this, MainActivity::class.java).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
                putExtra("OPEN_TAB", item.targetTab)
            }
            startActivity(openIntent)
            finish()
        })

        return card
    }

    private fun buildButton(label: String, colorHex: String, onClick: () -> Unit): Button {
        return Button(this).apply {
            text = label
            textSize = 15f
            isAllCaps = false
            setTextColor(Color.WHITE)
            setBackgroundColor(Color.parseColor(colorHex))
            setPadding(20, 28, 20, 28)
            setOnClickListener { onClick() }
            layoutParams = matchParams().apply { bottomMargin = 14 }
        }
    }

    private fun matchParams() = LinearLayout.LayoutParams(
        LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT
    )

    private fun formatMinutesLabel(minutes: Int): String {
        return if (minutes % 60 == 0 && minutes >= 60) {
            "${minutes / 60} ساعت"
        } else {
            "$minutes دقیقه"
        }
    }
}
