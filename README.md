# 🎯 My Planner | Personal Smart Planner (Dark Luxury Edition)

<div align="center">

![My Planner Banner](https://img.shields.io/badge/Platform-Android-3DDC84?style=for-the-badge&logo=android&logoColor=white)
![Version](https://img.shields.io/badge/Version-3.1.0-F39C12?style=for-the-badge)
![Kotlin](https://img.shields.io/badge/Kotlin-Native_Hybrid-7F52FF?style=for-the-badge&logo=kotlin&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-00CEC9?style=for-the-badge)
![Telegram](https://img.shields.io/badge/Telegram-Mahdi__3A-229ED9?style=for-the-badge&logo=telegram&logoColor=white)
[![Donate](https://img.shields.io/badge/Sponsor-Donate-FF4757?style=for-the-badge&logo=githubsponsors&logoColor=white)](#donation)

<p align="center">
  <b>An ultra-modern, high-performance, offline, ad-free personal productivity planner with precision reminders, habit tracking, and a sleek Dark Luxury design.</b>
</p>

### 🌐 Languages / زبان‌ها
**[🇬🇧 English](README.md)** • **[🇮🇷 نسخه فارسی](README.fa.md)**

---

[Features](#-key-features) • [Download APK](#-download--installation) • [Sponsor & Donate](#donation) • [Build Guide](#-developer--build-guide) • [Contact](#-contact)

</div>

---

## 📖 About The Project

**My Planner** is an all-in-one productivity suite built to help you master time management, cultivate disciplined daily habits, and achieve short and long-term milestones.

Engineered with a high-performance hybrid architecture (**Kotlin Native + Modern Web View**), it delivers zero-lag interactions and rock-solid background reminder scheduling while keeping battery consumption to a bare minimum.

---

## ✨ Key Features

### 🌙 1. Dark Luxury Aesthetics
- Custom-tailored dark palette with gold and neon accents designed for extended daily use without eye strain.
- Synthetic audio effects and celebratory confetti animations upon achieving 100% daily completion.
- Fully responsive layout optimized for all modern Android form factors.

### ⏰ 2. Rock-Solid Reminders (Doze Mode Bypass)
- **Precision Alarms:** Leverages Android `AlarmManager.setAlarmClock` to bypass strict system battery savers (Doze Mode) and aggressive vendor task-killers (Xiaomi MIUI/HyperOS, Huawei EMUI, Samsung, Oppo).
- **Missed Alarm Recovery:** If the device was powered off or rebooted at reminder time, `BootReceiver` immediately reschedules and triggers pending notifications upon restart.
- **Full-Screen Wakeup Alert:** When your device is locked or screen is off, the screen automatically lights up displaying a full-screen alarm dialog with actions (`Done`, `15m Snooze`, `30m Snooze`, `Custom Snooze`, or `Open App`).
- **Autostart & Battery Wizard:** Built-in guidance wizard for Xiaomi, Huawei, Vivo, Oppo, and OnePlus autostart permissions.

### ⚡ 3. Habits with Hierarchical Subtasks
- Fixed habits automatically rollover across days.
- Add granular, collapsible subtasks to every habit.
- Smart deletion: Choose between deleting for today only, or deleting for today and all future dates.

### 🎯 4. Priority-Based Daily Tasks
- Categorize tasks into **Normal**, **Important**, and **Urgent & Important**.
- Real-time Donut Progress Chart calculating total completion percentage dynamically.

### 🗓 5. Weekly & Monthly Planning with Recurring Tasks
- Dedicated weekly and monthly viewports.
- Interval-based repeating tasks (e.g., repeat every 7 days, 30 days, or custom interval).

### 🏆 6. Goal Tracking with Deadlines
- Define key life and professional goals with descriptions, deadlines, and precise reminder timestamps.

### 📅 7. Built-in Shamsi (Jalali) & Gregorian Engine
- Ultra-lightweight conversion algorithms (`g2j` / `j2g`) without heavy third-party bundle bloat.
- Automated daily streak counter tracking your journey from day one.

### 📊 8. Performance Analytics & History
- Interactive monthly and yearly Chart.js progress graphs to track consistency and adherence over time.

### 💾 9. Safe Offline Backup & Restore
- 100% offline data privacy: Backup your complete planner database as a clean JSON file directly to `Downloads/MyPlanner`.
- One-click restore system.

---

## 📥 Download & Installation

You can always download the latest pre-compiled **APK** directly from GitHub Releases:

👉 **[Download Latest APK Release](https://github.com/Mahdi-Akbari93/MyPlannerApp/releases)**

> **Tip for Unstoppable Reminders:** Upon installation, allow notification access and enable "Ignore Battery Optimizations" when prompted so your alarms fire with split-second accuracy.

---

<a id="donation"></a>
## 💖 Sponsorship & Donation

My Planner is completely **free, ad-free, independent, and open-source**.  
If this project has brought clarity, discipline, or value to your daily life, your sponsorship will directly empower ongoing maintenance, new features, and continuous updates. Thank you wholeheartedly for your support! 🙏❤️

### 💎 International / Crypto Donation (USDT):
| Asset | Value | Notes |
| :--- | :--- | :--- |
| **Currency** | **Tether (USDT)** | Stablecoin |
| **Network** | **TRON (TRC-20)** | Fast & low fee |
| **Wallet Address** | `TGXiDt6YFnxnvCBeL6GEYWxNiZzpdLzocp` | Tap to copy |

### 💳 Iranian Rial (Shetab / IBAN):
| Details | Value | Bank / Name |
| :--- | :--- | :--- |
| **Account Holder** | **مهدی اکبری (Mahdi Akbari)** | Saman Bank |
| **Card Number** | `6219861960904646` | Card-to-Card |
| **IBAN (شبا)** | `IR590560611828005603767801` | Satna / Paya |

---

## 🛠 Developer & Build Guide

To build and compile the project locally:

### Prerequisites:
- **Android Studio** (Ladybug / Koala or newer)
- **JDK 17** or higher
- **Android SDK Platform 36**

### Steps:
1. Clone the repository:
```bash
git clone https://github.com/Mahdi-Akbari93/MyPlannerApp.git
cd MyPlannerApp
```
2. Build debug APK using Gradle:
```bash
./gradlew assembleDebug
```
3. The generated APK will be available at:
`app/build/outputs/apk/debug/app-debug.apk`

---

## 📬 Contact

- **Developer:** Mahdi Akbari (مهدی اکبری)
- **Telegram:** [@Mahdi_3A](https://t.me/Mahdi_3A)
- **Email:** [mahdiakbri93@gmail.com](mailto:mahdiakbri93@gmail.com)
- **GitHub:** [@Mahdi-Akbari93](https://github.com/Mahdi-Akbari93)

---

## 📄 License

This project is open-source and released under the **[MIT License](LICENSE)**.
