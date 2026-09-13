# 🎯 برنامه‌ریز هوشمند شخصی | My Planner (Dark Luxury Edition)

<div align="center">

![My Planner Banner](https://img.shields.io/badge/Platform-Android-3DDC84?style=for-the-badge&logo=android&logoColor=white)
![Version](https://img.shields.io/badge/Version-3.1.0-F39C12?style=for-the-badge)
![Kotlin](https://img.shields.io/badge/Kotlin-Native_Hybrid-7F52FF?style=for-the-badge&logo=kotlin&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-00CEC9?style=for-the-badge)
![Telegram](https://img.shields.io/badge/Telegram-Mahdi__3A-229ED9?style=for-the-badge&logo=telegram&logoColor=white)
[![Donate](https://img.shields.io/badge/Sponsor-حمایت_مالی-FF4757?style=for-the-badge&logo=githubsponsors&logoColor=white)](#-حمایت-مالی-دونیت--donation)

<p align="center">
  <b>یک برنامه‌ریز شخصی فوق‌العاده مدرن، سریع، آفلاین و بدون تبلیغات با تقویم شمسی، زمان‌بندی دقیق و طراحی Dark Luxury</b>
</p>

[English Overview](#-english-overview) • [ویژگی‌ها](#-ویژگی‌های-کلیدی) • [دانلود و نصب](#-دانلود-و-نصب-برنامه) • [حمایت مالی (دونیت)](#-حمایت-مالی-دونیت--donation) • [راهنمای توسعه](#-راهنمای-توسعه-و-کامپایل-سورس)

</div>

---

## 📖 معرفی برنامه
**مای‌پلنر (My Planner)** یک اپلیکیشن مدیریت زمان و برنامه‌ریزی جامع است که با هدف افزایش بهره‌وری روزانه، ردیابی عادات و ثبت اهداف بلندمدت طراحی شده است. این اپلیکیشن با معماری هایبرید مدرن (Kotlin Native + Modern Web View) به شکلی ساخته شده که بدون کندی و با مصرف حداقل باتری، قدرتمندترین سیستم‌های یادآوری را در اختیارتان قرار دهد.

---

## ✨ ویژگی‌های کلیدی

### 🌙 ۱. طراحی لوکس و اختصاصی (Dark Luxury UI)
- تم تیره چشم‌نواز با رنگ‌های طلایی و نئونی بدون خستگی چشم در استفاده‌های طولانی
- بازخوردهای صوتی و انیمیشن‌های شادباش (Confetti) هنگام تکمیل موفقیت‌آمیز ۱۰۰٪ کارهای روزانه
- سازگاری کامل با انواع اندازه‌های صفحه نمایش موبایل

### 📅 ۲. تقویم شمسی دقیق و سبک
- محاسبات دقیق روزانه، هفتگی و ماهانه شمسی بدون نیاز به کتابخانه‌های سنگین خارجی
- محاسبه خودکار روزهای همراهی (Streak) از اولین روز استفاده

### ⏰ ۳. سیستم یادآوری فوق‌العاده دقیق و مقاوم (Doze Mode Bypass)
- استفاده از `AlarmManager.setAlarmClock` جهت عبور تضمینی از محدودیت‌های سیستم ذخیره باتری (Doze Mode) اندروید
- **جبران آلارم‌های جامانده:** در صورت خاموش بودن گوشی در ساعت یادآوری، به محض روشن شدن مجدد گوشی، اعلانات جامانده فوراً ارسال و بازسازی می‌شوند (`BootReceiver`).
- **هشدار تمام‌صفحه (Full-Screen Alarm):** حتی هنگام قفل بودن گوشی یا خاموش بودن صفحه، صفحه نمایش روشن شده و پنجره یادآوری با دکمه‌های «تمام شد»، «تعویق ۱۵ دقیقه»، «تعویق ۳۰ دقیقه» یا «ورود به برنامه» نمایش داده می‌شود.
- مدیریت هوشمند آلارم‌ها برای گوشی‌های شیائومی، هوآوی، اوپو، ویوو و وان‌پلاس همراه با ویزارد اختصاصی تنظیمات Autostart.

### ⚡ ۴. عادات ثابت با زیروظایف (Habits & Subtasks)
- ثبت عاداتی که به صورت خودکار به روزهای آینده منتقل می‌شوند.
- قابلیت تعریف زیروظایف تفکیک‌شده برای هر عادت.
- حذف هوشمند: انتخاب بین حذف فقط برای امروز، یا برای امروز و تمام روزهای آینده.

### 🎯 ۵. کارهای روزانه با سطح اولویت
- دسته‌بندی کارها به اولویت‌های «معمولی»، «مهم» و «فوری و مهم».
- نمودار دونات پیشرفت روزانه لحظه‌ای با محاسبه درصد کل.

### 🗓 ۶. برنامه‌ریزی هفتگی و ماهانه با قابلیت تکرار
- برنامه‌ریزی برای هفته‌ها و ماه‌های جاری و آینده.
- قابلیت تکرار خودکار وظایف (مثلاً تکرار هر ۷ روز، هر ۳۰ روز یا هر بازه دلخواه).

### 🏆 ۷. مدیریت اهداف با ددلاین
- ثبت اهداف مهم همراه با توضیحات، تاریخ پایان (ددلاین) و زمان‌بندی یادآوری نوتیفیکیشن.

### 📊 ۸. آرشیو و گزارش‌های آماری (Performance Analytics)
- نمودارهای خطی ماهانه و سالانه جهت ارزیابی میانگین پایبندی به برنامه‌ها همراه با جملات انگیزشی هوشمند.

### 💾 ۹. پشتیبان‌گیری کامل و امن (Backup & Restore)
- پشتیبان‌گیری آفلاین بدون نیاز به اتصال اینترنت به فرمت فایل استاندارد JSON در پوشه `Downloads/MyPlanner`.
- امکان بازگردانی سریع فایل‌های بکاپ با یک لمس.

---

## 📥 دانلود و نصب برنامه

فایل نصبی آماده (APK) برنامه را همیشه می‌توانید از بخش ریلیزهای گیت‌هاب دریافت کنید:

👉 **[صفحه دانلود آخرین نسخه APK (Releases)](https://github.com/Mahdi-Akbari93/MyPlannerApp/releases)**

> **نکته برای یادآوری‌های دقیق:** پس از نصب اولیه، کافیست دسترسی اعلان‌ها را تأیید کرده و در صورت درخواست برنامه، مجوز بهینه‌سازی باتری (Ignore Battery Optimization) را فعال نمایید تا یادآوری‌ها بدون حتی یک ثانیه خطا شلیک شوند.

---

## 💖 حمایت مالی و دونیت (Donation)

این اپلیکیشن کاملاً **رایگان، بدون تبلیغات، مستقل و متن‌باز** توسعه داده شده است.  
اگر مای‌پلنر توانسته به منظم‌تر شدن زندگی یا کارهایتان کمک کند، با حمایت مالی از این پروژه می‌توانید به من انرژی و انگیزه بدهید تا همیشه آن را به‌روز نگه دارم و امکانات بزرگ‌تری به آن اضافه کنم. 🙏❤️

### 💳 پرداخت ریالی (کارت به کارت / شبا):
| مشخصه | مقدار (با کلیک کپی کنید) | توضیحات |
| :--- | :--- | :--- |
| **صاحب حساب** | **مهدی اکبری** | بانک سامان |
| **شماره کارت** | `6219861960904646` | کارت به کارت شتابی |
| **شماره شبا (IBAN)** | `IR590560611828005603767801` | انتقال پایا / ساتنا |

### 💎 پرداخت ارزی (تتر USDT):
| مشخصه | مقدار |
| :--- | :--- |
| **ارز** | **Tether (USDT)** |
| **شبکه** | **TRON (TRC-20)** |
| **آدرس ولت** | `TGXiDt6YFnxnvCBeL6GEYWxNiZzpdLzocp` |

---

## 🛠 راهنمای توسعه و کامپایل سورس

برای توسعه یا کامپایل پروژه بر روی سیستم خود:

### پیش‌نیازها:
- **Android Studio** (نسخه Ladybug / Koala یا جدیدتر)
- **JDK 17** یا بالاتر
- **Android SDK API 36**

### مراحل اجرا:
1. کلون کردن ریپازیتوری:
```bash
git clone https://github.com/Mahdi-Akbari93/MyPlannerApp.git
cd MyPlannerApp
```
2. کامپایل پروژه با گریدل:
```bash
./gradlew assembleDebug
```
3. فایل نصبی APK در مسیر `app/build/outputs/apk/debug/app-debug.apk` ساخته خواهد شد.

---

## 🌐 English Overview

**My Planner (Dark Luxury Edition)** is an offline, modern, high-performance hybrid Android application for personal planning, habit building, and productivity tracking.

### Key Highlights:
- **Dark Luxury Aesthetic:** Sleek, high-contrast dark theme with gold accents and celebration animations.
- **Accurate Jalali/Shamsi Calendar:** Lightweight built-in conversion algorithms.
- **Unstoppable Alarms:** Uses `AlarmManager.setAlarmClock` to bypass Android Doze Mode and vendor battery killers (Xiaomi MIUI, Huawei, Samsung).
- **Full-Screen Alerts:** Wakes and displays full-screen alarm dialogs when the screen is locked, complete with customizable snooze options.
- **Habits & Tasks:** Subtask breakdown, priority management, and repeating intervals.
- **Offline JSON Backups:** Full manual and auto backup storage directly to the device Downloads folder.

---

## 📬 ارتباط با سازنده

- **توسعه‌دهنده:** مهدی اکبری (Mahdi Akbari)
- **تلگرام:** [@Mahdi_3A](https://t.me/Mahdi_3A)
- **ایمیل:** [mahdiakbri93@gmail.com](mailto:mahdiakbri93@gmail.com)
- **گیت‌هاب:** [@Mahdi-Akbari93](https://github.com/Mahdi-Akbari93)

---

## 📄 لایسنس

این پروژه تحت مجوز **[MIT License](LICENSE)** منتشر شده است و استفاده از آن کاملاً آزاد می‌باشد.
