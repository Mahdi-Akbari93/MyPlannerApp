package com.mahdiakbari.myplanner

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.PowerManager

class AutoBackupReceiver : BroadcastReceiver() {

    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != BackupScheduler.ACTION_AUTO_BACKUP) return

        val powerManager = context.getSystemService(Context.POWER_SERVICE) as? PowerManager
        val wakeLock = powerManager?.newWakeLock(
            PowerManager.PARTIAL_WAKE_LOCK,
            "MyPlanner:AutoBackupWakeLock"
        )
        wakeLock?.acquire(60000L) // حداکثر ۶۰ ثانیه برای اطمینان از کامل شدن ذخیره و ارسال

        val pendingResult = goAsync()

        Thread {
            try {
                BackupScheduler.performBackup(context, isAuto = true)
            } finally {
                wakeLock?.let {
                    if (it.isHeld) it.release()
                }
                pendingResult.finish()
            }
        }.start()
    }
}
