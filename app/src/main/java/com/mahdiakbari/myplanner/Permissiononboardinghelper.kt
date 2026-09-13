package com.mahdiakbari.myplanner

import android.app.Activity
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.PowerManager
import android.provider.Settings
import android.widget.Toast

// این فایل مسئولِ دوتا کاره: (۱) تشخیصِ اینکه گوشیِ فعلی به تنظیمِ اضافه‌ی «شروع خودکار»
// (Autostart) نیاز داره یا نه، (۲) تلاش برای باز کردنِ مستقیمِ صفحه‌ی درستِ همون گوشی.
// این صفحه‌ها مستندِ رسمیِ گوگل نیستن (هر سازنده‌ای خودش این محدودیت رو اضافه کرده)، برای
// همین همه‌جا با try/catch محافظت شده‌ن: اگه یه Intent روی یه ورژنِ خاص از رام جواب نده،
// می‌ره سراغِ گزینه‌ی بعدی، و اگه هیچ‌کدوم جواب نداد، بدونِ کرش، می‌ره صفحه‌ی اطلاعاتِ
// عادیِ اپ (که همیشه وجود داره).
object PermissionOnboardingHelper {

    private fun manufacturer(): String = Build.MANUFACTURER.lowercase()
    private fun brand(): String = Build.BRAND.lowercase()

    private fun isXiaomi() = manufacturer().contains("xiaomi") || brand().contains("redmi") || brand().contains("poco")
    private fun isHuawei() = manufacturer().contains("huawei") || manufacturer().contains("honor")
    private fun isOppo() = manufacturer().contains("oppo") || manufacturer().contains("realme")
    private fun isVivo() = manufacturer().contains("vivo") || manufacturer().contains("iqoo")
    private fun isOnePlus() = manufacturer().contains("oneplus")

    // این گوشی اصلاً همچین محدودیتِ اضافه‌ای داره یا نه. سامسونگ، گوگل، موتورولا، سونی، و
    // اندرویدِ خالص همچین صفحه‌ی جدایی ندارن، پس این مرحله اصلاً بهشون نشون داده نمیشه —
    // که همون چیزیه که خواسته شده بود: «فقط اونایی که نیاز هست»
    fun needsAutostartStep(): Boolean = isXiaomi() || isHuawei() || isOppo() || isVivo() || isOnePlus()

    fun isIgnoringBatteryOptimizations(context: Context): Boolean {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) return true
        val pm = context.getSystemService(Context.POWER_SERVICE) as PowerManager
        return pm.isIgnoringBatteryOptimizations(context.packageName)
    }

    // درخواستِ رسمیِ خودِ اندروید برای معافیت از بهینه‌سازیِ باتری — یه دیالوگِ سیستمیِ
    // مستقیمِ «اجازه بده/اجازه نده» نشون میده. این روی همه‌ی گوشی‌ها (حتی شیائومی/سامسونگ)
    // کار می‌کنه چون بخشِ اجباریِ خودِ اندرویده، نه چیزِ اختصاصیِ یه سازنده
    fun openBatteryOptimizationSettings(activity: Activity) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) return
        if (isIgnoringBatteryOptimizations(activity)) {
            Toast.makeText(activity, "این تنظیم از قبل فعاله ✅", Toast.LENGTH_SHORT).show()
            return
        }
        try {
            val intent = Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS).apply {
                data = Uri.parse("package:${activity.packageName}")
            }
            activity.startActivity(intent)
        } catch (e: Exception) {
            openAppSettingsFallback(activity)
        }
    }

    // مرحله‌ی «شروع خودکار»: مخصوصِ گوشی‌هایی که این محدودیتِ اضافه رو دارن. هر سازنده یه
    // یا چند مسیرِ احتمالی داره (بسته به ورژنِ رام)؛ اولین موردی که جواب بده استفاده میشه
    fun openAutostartSettings(activity: Activity) {
        val candidates = mutableListOf<Intent>()

        if (isXiaomi()) {
            candidates.add(Intent().setComponent(
                ComponentName("com.miui.securitycenter", "com.miui.permcenter.autostart.AutoStartManagementActivity")
            ))
        }
        if (isHuawei()) {
            candidates.add(Intent().setComponent(
                ComponentName("com.huawei.systemmanager", "com.huawei.systemmanager.startupmgr.ui.StartupNormalAppListActivity")
            ))
            candidates.add(Intent().setComponent(
                ComponentName("com.huawei.systemmanager", "com.huawei.systemmanager.optimize.process.ProtectActivity")
            ))
        }
        if (isOppo()) {
            candidates.add(Intent().setComponent(
                ComponentName("com.coloros.safecenter", "com.coloros.safecenter.permission.startup.StartupAppListActivity")
            ))
            candidates.add(Intent().setComponent(
                ComponentName("com.coloros.safecenter", "com.coloros.privacypermissionsentry.PermissionTopActivity")
            ))
        }
        if (isVivo()) {
            candidates.add(Intent().setComponent(
                ComponentName("com.vivo.permissionmanager", "com.vivo.permissionmanager.activity.BgStartUpManagerActivity")
            ))
            candidates.add(Intent().setComponent(
                ComponentName("com.iqoo.secure", "com.iqoo.secure.ui.phoneoptimize.AddWhiteListActivity")
            ))
        }
        if (isOnePlus()) {
            candidates.add(Intent().setComponent(
                ComponentName("com.oneplus.security", "com.oneplus.security.chainlaunch.view.ChainLaunchAppListActivity")
            ))
        }

        for (intent in candidates) {
            try {
                activity.startActivity(intent)
                return
            } catch (e: Exception) {
                // این مسیر روی این گوشی/ورژنِ رام جواب نداد؛ بعدی رو امتحان کن
            }
        }

        // هیچ‌کدوم از مسیرهای شناخته‌شده جواب نداد؛ به‌جای کرش یا صفحه‌ی خالی، می‌بریمش
        // صفحه‌ی اطلاعاتِ عادیِ اپ که همیشه وجود داره
        openAppSettingsFallback(activity)
        Toast.makeText(
            activity,
            "این گوشی صفحه‌ی جداگانه‌ی «شروع خودکار» نداشت؛ از همین صفحه دنبال بخش «مجوزها» یا «شروع خودکار» بگرد",
            Toast.LENGTH_LONG
        ).show()
    }

    private fun openAppSettingsFallback(activity: Activity) {
        try {
            val intent = Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS).apply {
                data = Uri.parse("package:${activity.packageName}")
            }
            activity.startActivity(intent)
        } catch (e: Exception) {
            // اگه این هم جواب نداد، دیگه کاری از دستمون برنمیاد؛ بی‌سروصدا رد میشیم تا اپ کرش نکنه
        }
    }
}
