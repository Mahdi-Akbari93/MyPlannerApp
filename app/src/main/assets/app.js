let currentDateOffset = 0;
let currentWeekOffset = 0;
let currentMonthOffset = 0;
let isUnlockedManually = false;
let dailyChart = null;
let reportChartInstance = null;
let currentReportType = 'monthly';
let currentEditingItem = { type: null, id: null, tabId: null };
let currentEditingTextItem = { type: null, id: null, tabId: null };
let currentEditingGoalIndex = null;
let currentSubtaskTarget = { type: null, index: null, dateKey: null };
// کلید‌های زیروظیفه‌هایی که کشوشون الان بازه؛ چون همه‌ی لیست‌ها (روزانه/هفتگی/ماهانه) با هر
// تغییری کامل از نو رندر میشن، این Set جدا از DOM نگه داشته میشه تا بعد از رندر دوباره،
// کشوهایی که کاربر باز کرده بود همچنان باز بمونن (وگرنه با هر تیک زدن یه زیروظیفه، کشو بسته می‌شد)
let openSubtaskDrawers = new Set();
// اگه کاربر موقع اضافه‌کردن زیروظیفه‌ی یه عادت، از مودال «فقط امروز/روزهای بعد» با
// ✕ کامل منصرف بشه، متنی که نوشته بود دوباره باید توی همون اینپوتِ افزودن برگرده
// (نه اینکه از دست بره)؛ چون کل لیست دوباره رندر میشه، این مقدار جدا از DOM نگه‌
// داشته میشه تا بعد از رندر دوباره، توی اینپوتِ درستش نشونده بشه
let pendingSubtaskInputRestore = null;
let pendingHabitDeleteId = null;
let pendingDeleteAction = null;
let audioCtx = null;

const shamsiMonthNames = [
    "فروردین",
    "اردیبهشت",
    "خرداد",
    "تیر",
    "مرداد",
    "شهریور",
    "مهر",
    "آبان",
    "آذر",
    "دی",
    "بهمن",
    "اسفند"
];

function getAudioContext() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
    return audioCtx;
}

function playPopSound() {
    try {
        const ctx = getAudioContext();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(600, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + 0.08);
        gain.gain.setValueAtTime(0.2, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.08);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.08);
    } catch(e) {}
}

function triggerCelebration() {
    try {
        if (navigator.vibrate) {
            navigator.vibrate([100, 50, 100, 50, 200]);
        }

        const ctx = getAudioContext();
        const notes = [523.25, 659.25, 783.99, 1046.50];
        notes.forEach((freq, idx) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'triangle';
            osc.frequency.value = freq;
            const startTime = ctx.currentTime + (idx * 0.12);
            gain.gain.setValueAtTime(0.3, startTime);
            gain.gain.exponentialRampToValueAtTime(0.01, startTime + 0.35);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(startTime);
            osc.stop(startTime + 0.35);
        });

        if (window.confetti) {
            confetti({
                particleCount: 100,
                spread: 70,
                origin: { y: 0.6 }
            });
        }

        document.getElementById('victoryModal').classList.add('open');
    } catch(e) {}
}

function g2j(gy, gm, gd) {
    const g_d_m = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
    let jy = (gy <= 1600) ? 0 : 979;
    gy -= (gy <= 1600) ? 621 : 1600;
    let gy2 = (gm > 2) ? (gy + 1) : gy;
    let days = (365 * gy) + Math.floor((gy2 + 3) / 4) - Math.floor((gy2 + 99) / 100) + Math.floor((gy2 + 399) / 400) - 80 + gd + g_d_m[gm - 1];
    jy += 33 * Math.floor(days / 12053);
    days %= 12053;
    jy += 4 * Math.floor(days / 1461);
    days %= 1461;
    jy += Math.floor((days - 1) / 365);
    if (days > 0) days = (days - 1) % 365;
    let jm = (days < 186) ? 1 + Math.floor(days / 31) : 7 + Math.floor((days - 186) / 30);
    let jd = 1 + ((days < 186) ? (days % 31) : ((days - 186) % 30));
    return [jy, jm, jd];
}

function j2g(jy, jm, jd) {
    let gy = (jy <= 979) ? 621 : 1600;
    jy -= (jy <= 979) ? 0 : 979;
    let days = (365 * jy) + Math.floor(jy / 33) * 8 + Math.floor(((jy % 33) + 3) / 4) + 78 + jd + ((jm < 7) ? (jm - 1) * 31 : ((jm - 7) * 30) + 186);
    gy += 400 * Math.floor(days / 146097);
    days %= 146097;
    if (days > 36524) {
        gy += 100 * Math.floor(--days / 36524);
        days %= 36524;
        if (days >= 365) days++;
    }
    gy += 4 * Math.floor(days / 1461);
    days %= 1461;
    gy += Math.floor((days - 1) / 365);
    if (days > 0) days = (days - 1) % 365;
    const g_d_m = [0, 31, ((gy % 4 === 0 && gy % 100 !== 0) || gy % 400 === 0) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    let gm = 0;
    while (days >= g_d_m[gm]) {
        days -= g_d_m[gm];
        gm++;
    }
    let gd = days + 1;
    return new Date(gy, gm - 1, gd);
}

function getShamsiDetails(dateObj) {
    const d = dateObj || getSelectedDate();
    const [jy, jm, jd] = g2j(d.getFullYear(), d.getMonth() + 1, d.getDate());
    return { year: jy, month: jm, day: jd };
}

function getStoredKey(dateObj) {
    const s = getShamsiDetails(dateObj);
    return `${s.year}-${String(s.month).padStart(2, '0')}-${String(s.day).padStart(2, '0')}`;
}

function updateInstallStreakCounter() {
    let validTimestamps = [];
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key.startsWith('planner_13') || key.startsWith('planner_14')) {
            const raw = localStorage.getItem(key);
            if (raw) {
                try {
                    const parsed = JSON.parse(raw);
                    if ((parsed.habits && parsed.habits.length) || (parsed.tasks && parsed.tasks.length)) {
                        const parts = key.replace('planner_', '').split('-');
                        if (parts.length === 3) {
                            const gDate = j2g(parseInt(parts[0]), parseInt(parts[1]), parseInt(parts[2]));
                            validTimestamps.push(gDate.getTime());
                        }
                    }
                } catch(e) {}
            }
        }
    }

    let firstTime = validTimestamps.length > 0 ? Math.min(...validTimestamps) : Date.now();
    const diffDays = Math.floor(Math.max(0, Date.now() - firstTime) / (1000 * 60 * 60 * 24)) + 1;

    const streakCountEl = document.getElementById('streakDaysCount');
    if (streakCountEl) {
        streakCountEl.innerText = diffDays.toString();
    }

    const firstShamsi = getShamsiDetails(new Date(firstTime));
    const subtitleEl = document.getElementById('streakStartSubtitle');
    if (subtitleEl) {
        subtitleEl.innerText = `شروع از ${firstShamsi.day} ${shamsiMonthNames[firstShamsi.month - 1]} ${firstShamsi.year}`;
    }
}

document.addEventListener("DOMContentLoaded", () => {
    migrateLegacyWeeklyKeys();
    migrateSubtaskCompletionStates();
    setupEventListeners();
    updateDateDisplay();
    initCharts();
    loadDayData();
    loadWeeklyData();
    loadMonthlyData();
    loadGoals();
    loadCustomTabs();
    loadReminders();
    loadReminderTimes();
    checkAutoBackup();
    updateInstallStreakCounter();
    setTimeout(syncLatestBackupToAndroid, 2000);
});

function setupEventListeners() {
    document.getElementById('prevDayBtn').onclick = function() {
        changeDay(-1);
    };

    document.getElementById('nextDayBtn').onclick = function() {
        changeDay(1);
    };

    document.getElementById('menuBtn').onclick = toggleMenu;
    document.getElementById('closeMenuBtn').onclick = toggleMenu;
    document.getElementById('menuOverlay').onclick = toggleMenu;

    document.getElementById('addHabitBtn').onclick = addHabit;
    document.getElementById('addTaskBtn').onclick = addTask;
    const addReminderBtnEl = document.getElementById('addReminderBtn');
    if (addReminderBtnEl) addReminderBtnEl.onclick = addReminder;

    const reminderRepeatInputEl = document.getElementById('reminderRepeatInput');
    if (reminderRepeatInputEl) {
        reminderRepeatInputEl.onchange = updateReminderDaysPickerVisibility;
        updateReminderDaysPickerVisibility();
    }

    ['weekly', 'monthly', 'edit'].forEach(function(prefix) {
        const el = document.getElementById(prefix + 'RepeatToggle');
        if (el) {
            el.onchange = function() { updateRepeatFieldsVisibility(prefix); };
            updateRepeatFieldsVisibility(prefix);
        }
    });

    document.getElementById('prevWeekBtn').onclick = function() {
        changeWeek(-1);
    };

    document.getElementById('nextWeekBtn').onclick = function() {
        changeWeek(1);
    };

    document.getElementById('prevMonthBtn').onclick = function() {
        changeMonth(-1);
    };

    document.getElementById('nextMonthBtn').onclick = function() {
        changeMonth(1);
    };

    document.getElementById('exportBtn').onclick = exportBackup;

    const importFileInput = document.getElementById('importFile');
    if (importFileInput) {
        importFileInput.onchange = importBackup;
    }

    const openBackupSettingsBtn = document.getElementById('openBackupSettingsBtn');
    if (openBackupSettingsBtn) {
        openBackupSettingsBtn.onclick = function() {
            toggleMenu();
            openBackupSettingsModal();
        };
    }

    const closeBackupSettingsBtn = document.getElementById('closeBackupSettingsBtn');
    if (closeBackupSettingsBtn) closeBackupSettingsBtn.onclick = closeBackupSettingsModal;

    const cancelBackupSettingsBtn = document.getElementById('cancelBackupSettingsBtn');
    if (cancelBackupSettingsBtn) cancelBackupSettingsBtn.onclick = closeBackupSettingsModal;

    const saveBackupSettingsBtn = document.getElementById('saveBackupSettingsBtn');
    if (saveBackupSettingsBtn) saveBackupSettingsBtn.onclick = saveBackupSettings;

    const testCloudConnectionBtn = document.getElementById('testCloudConnectionBtn');
    if (testCloudConnectionBtn) testCloudConnectionBtn.onclick = testCloudConnection;

    const cloudBackupToggle = document.getElementById('cloudBackupToggle');
    if (cloudBackupToggle) {
        cloudBackupToggle.onchange = function() {
            const container = document.getElementById('cloudFieldsContainer');
            if (container) container.style.display = this.checked ? 'flex' : 'none';
        };
    }

    document.getElementById('saveReminderBtn').onclick = saveReminderTimes;
    document.getElementById('savePeriodicReminderBtn').onclick = savePeriodicReminder;
    document.getElementById('saveCustomSnoozeBtn').onclick = saveCustomSnoozeDurations;

    const batteryWizardBtn = document.getElementById('openBatteryWizardBtn');
    if (batteryWizardBtn) {
        batteryWizardBtn.onclick = function() {
            if (window.AndroidInterface && window.AndroidInterface.openBatterySettingsWizard) {
                window.AndroidInterface.openBatterySettingsWizard();
            } else {
                alert('این قابلیت فقط توی نسخه‌ی اندروید در دسترسه.');
            }
        };
    }

    document.getElementById('openNotificationsModalBtn').onclick = function() {
        toggleMenu();
        document.getElementById('notificationsModal').classList.add('open');
    };

    document.getElementById('closeNotificationsModalBtn').onclick = function() {
        document.getElementById('notificationsModal').classList.remove('open');
    };

    const unlockBtn = document.getElementById('unlockPastBtn');
    if (unlockBtn) {
        unlockBtn.onclick = togglePastLock;
    }

    document.getElementById('openSearchBtn').onclick = function() {
        toggleMenu();
        openSearchModal();
    };
    document.getElementById('closeSearchModalBtn').onclick = closeSearchModal;
    document.getElementById('searchInput').oninput = executeSearch;

    document.getElementById('openAddTabModalBtn').onclick = function(e) {
        e.preventDefault();
        document.getElementById('newTabNameInput').value = '';
        document.getElementById('addTabModal').classList.add('open');
    };

    document.getElementById('closeAddTabModalBtn').onclick = function() {
        document.getElementById('addTabModal').classList.remove('open');
    };
    document.getElementById('confirmAddTabBtn').onclick = confirmAddNewTab;

    document.getElementById('closeEditModalBtn').onclick = function() {
        document.getElementById('editModal').classList.remove('open');
    };
    document.getElementById('confirmEditBtn').onclick = confirmEditItem;

    const closeSubtaskScopeBtn = document.getElementById('closeSubtaskScopeModalBtn');
    if (closeSubtaskScopeBtn) {
        closeSubtaskScopeBtn.onclick = function() {
            document.getElementById('subtaskScopeModal').classList.remove('open');
            if (typeof pendingSubtaskScopeCancel === 'function') {
                const cb = pendingSubtaskScopeCancel;
                pendingSubtaskScopeCancel = null;
                cb();
            }
        };
    }

    document.getElementById('closeEditGoalModalBtn').onclick = function() {
        document.getElementById('editGoalModal').classList.remove('open');
    };
    document.getElementById('confirmEditGoalBtn').onclick = confirmEditGoal;

    document.getElementById('closeNoteModalBtn').onclick = function() {
        document.getElementById('noteModal').classList.remove('open');
    };
    document.getElementById('saveNoteBtn').onclick = saveItemNote;

    document.getElementById('closeVictoryModalBtn').onclick = function() {
        document.getElementById('victoryModal').classList.remove('open');
    };

    document.getElementById('deleteHabitTodayOnlyBtn').onclick = function() {
        if (pendingHabitDeleteId) {
            executeDeleteHabit(pendingHabitDeleteId, false);
        }
        document.getElementById('habitDeleteModal').classList.remove('open');
    };

    document.getElementById('deleteHabitAllOpenDaysBtn').onclick = function() {
        if (pendingHabitDeleteId) {
            executeDeleteHabit(pendingHabitDeleteId, true);
        }
        document.getElementById('habitDeleteModal').classList.remove('open');
    };

    document.getElementById('cancelHabitDeleteBtn').onclick = function() {
        pendingHabitDeleteId = null;
        document.getElementById('habitDeleteModal').classList.remove('open');
    };

    document.getElementById('cancelDeleteBtn').onclick = function() {
        pendingDeleteAction = null;
        document.getElementById('confirmDeleteModal').classList.remove('open');
    };

    document.getElementById('confirmDeleteBtn').onclick = function() {
        if (typeof pendingDeleteAction === 'function') {
            pendingDeleteAction();
        }
        pendingDeleteAction = null;
        document.getElementById('confirmDeleteModal').classList.remove('open');
    };

    document.getElementById('openAboutBtn').onclick = function() {
        toggleMenu();
        document.getElementById('aboutModal').classList.add('open');
    };

    document.getElementById('closeAboutModalBtn').onclick = function() {
        document.getElementById('aboutModal').classList.remove('open');
    };

    const openDonateBtn = document.getElementById('openDonateBtn');
    if (openDonateBtn) {
        openDonateBtn.onclick = function() {
            toggleMenu();
            document.getElementById('donateModal').classList.add('open');
        };
    }

    const aboutDonateBtn = document.getElementById('aboutDonateBtn');
    if (aboutDonateBtn) {
        aboutDonateBtn.onclick = function() {
            document.getElementById('aboutModal').classList.remove('open');
            document.getElementById('donateModal').classList.add('open');
        };
    }

    const closeDonateModalBtn = document.getElementById('closeDonateModalBtn');
    if (closeDonateModalBtn) {
        closeDonateModalBtn.onclick = function() {
            document.getElementById('donateModal').classList.remove('open');
        };
    }

    document.getElementById('openReportBtn').onclick = function() {
        toggleMenu();
        openReportModal();
    };
    document.getElementById('closeReportBtn').onclick = closeReportModal;

    document.getElementById('monthlyReportTabBtn').onclick = function() {
        switchReportType('monthly');
    };
    document.getElementById('yearlyReportTabBtn').onclick = function() {
        switchReportType('yearly');
    };
    document.getElementById('historySelector').onchange = function() {
        renderReport();
    };

    document.querySelectorAll('.tab-btn').forEach(btn => {
        if (!btn.classList.contains('add-tab-btn')) {
            btn.onclick = function(e) {
                const tabName = e.currentTarget.getAttribute('data-tab');
                if (tabName) {
                    switchTab(tabName, e);
                }
            };
        }
    });
}

function askDeleteConfirmation(message, actionCallback) {
    pendingDeleteAction = actionCallback;
    document.getElementById('confirmDeleteMessage').innerText = message || 'آیا از حذف این مورد مطمئن هستید؟';
    document.getElementById('confirmDeleteModal').classList.add('open');
}

let pendingSubtaskScopeCancel = null;

// یه مدال عمومی با چند دکمه‌ی دلخواه (برای پرسیدن «فقط امروز» یا «روزهای بعد هم»
// موقع اضافه/حذف زیروظیفه‌ی عادت‌ها). buttons آرایه‌ای از {label, style, onClick} هست؛
// دکمه‌ای که onClick نداره فقط مدال رو می‌بنده. onCancel هم اختیاریه: وقتی کاربر با
// ✕ واقعاً از کل کار منصرف بشه (نه فقط یکی از گزینه‌ها رو انتخاب کنه) صدا زده میشه —
// مثلاً برای برگردوندن زیروظیفه‌ای که قبل از باز شدن مدال اضافه شده بود
function askSubtaskScope(message, buttons, onCancel) {
    pendingSubtaskScopeCancel = typeof onCancel === 'function' ? onCancel : null;
    document.getElementById('subtaskScopeMessage').innerText = message || '';
    const container = document.getElementById('subtaskScopeButtons');
    container.innerHTML = '';
    buttons.forEach(function(b) {
        const btn = document.createElement('button');
        btn.className = 'btn-test';
        btn.style.background = b.style || '#333';
        btn.innerText = b.label;
        btn.onclick = function() {
            pendingSubtaskScopeCancel = null; // یکی از گزینه‌های واقعی انتخاب شد، دیگه لغو معنی نداره
            document.getElementById('subtaskScopeModal').classList.remove('open');
            if (typeof b.onClick === 'function') b.onClick();
        };
        container.appendChild(btn);
    });
    document.getElementById('subtaskScopeModal').classList.add('open');
}

function togglePastLock() {
    isUnlockedManually = !isUnlockedManually;
    loadDayData();
}

function toggleMenu() {
    document.getElementById('sideMenu').classList.toggle('open');
    document.getElementById('menuOverlay').classList.toggle('open');
    updateInstallStreakCounter();
}

function getSelectedDate() {
    const d = new Date();
    d.setDate(d.getDate() + currentDateOffset);
    return d;
}

function isPastDate() {
    return currentDateOffset < 0;
}

function isCurrentDayFrozen() {
    return isPastDate() && !isUnlockedManually;
}

function changeDay(offset) {
    currentDateOffset += offset;
    isUnlockedManually = false;
    updateDateDisplay();
    loadDayData();
}

function updateDateDisplay() {
    const d = getSelectedDate();
    const gregorianStr = d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    const sh = getShamsiDetails(d);
    const dayNameStr = d.toLocaleDateString('fa-IR', { weekday: 'long' });
    const shamsiStr = `${sh.day} ${shamsiMonthNames[sh.month - 1]} ${sh.year}`;

    document.getElementById('dayName').innerText = currentDateOffset === 0 ? `امروز (${dayNameStr})` : dayNameStr;
    document.getElementById('shamsiDate').innerText = shamsiStr;
    document.getElementById('gregorianDate').innerText = gregorianStr;

    const unlockBtn = document.getElementById('unlockPastBtn');
    if (unlockBtn) {
        if (isPastDate()) {
            unlockBtn.style.display = 'inline-block';
            unlockBtn.innerText = isUnlockedManually ? '🔓' : '🔒';
        } else {
            unlockBtn.style.display = 'none';
        }
    }
}

function getMasterHabits() {
    const raw = localStorage.getItem('planner_master_habits') || '[]';
    try {
        const parsed = JSON.parse(raw);
        return parsed.map(function(item) {
            if (typeof item === 'string') {
                return { text: item, createdAt: 0 };
            }
            return item;
        });
    } catch(e) {
        return [];
    }
}

// یه نسخه‌ی «تازه» (بدون تیک) از زیروظیفه‌های قالبِ یه عادت، برای موقعی که یه روزِ
// جدید ساخته میشه (روزهای گذشته اصلاً از این تابع رد نمیشن، طبق همون قانون قبلیِ
// isPastDate که مانع اضافه شدن عادت به روزهای گذشته میشه)
function cloneHabitTemplateSubtasks(masterHabit) {
    if (!masterHabit || !Array.isArray(masterHabit.subtasks)) return [];
    return masterHabit.subtasks.map(function(s) {
        return { text: s.text, completed: false };
    });
}

// وقتی کاربر می‌گه این زیروظیفه به روزهای بعد هم اضافه بشه: هم توی قالبِ خودِ عادت
// (planner_master_habits) ذخیره میشه — برای روزهایی که هنوز اصلاً ساخته/دیده نشدن —
// هم مستقیم توی هر روزِ آینده‌ای که از قبل باز/کش شده بود تزریق میشه. چون همین که
// یه روزِ آینده رو فقط «ببینی» (حتی بدون هیچ تعاملی)، خودش به‌صورت خودکار توی
// localStorage کش میشه؛ اگه فقط قالب رو آپدیت می‌کردیم، هر روزی که قبلاً یه‌بار
// دیده شده بود (و بنابراین کش شده بود) دیگه هیچ‌وقت زیروظیفه‌ی جدید رو نمی‌گرفت —
// همون باگی که باعث می‌شد بعضی روزهای بعد به‌روز بشن و بعضی نه.
function addSubtaskToHabitTemplate(habitText, subtaskText) {
    const raw = localStorage.getItem('planner_master_habits') || '[]';
    let list;
    try { list = JSON.parse(raw); } catch(e) { list = []; }
    list = list.map(function(item) {
        const obj = typeof item === 'string' ? { text: item, createdAt: 0 } : item;
        if (obj.text === habitText) {
            const subs = Array.isArray(obj.subtasks) ? obj.subtasks.slice() : [];
            if (!subs.some(function(s) { return s.text === subtaskText; })) {
                subs.push({ text: subtaskText });
            }
            obj.subtasks = subs;
        }
        return obj;
    });
    localStorage.setItem('planner_master_habits', JSON.stringify(list));

    const todayKey = getStoredKey(new Date());
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (!key || !(key.startsWith('planner_13') || key.startsWith('planner_14'))) continue;
        const dayKey = key.replace('planner_', '');
        if (dayKey <= todayKey) continue;
        try {
            const parsed = JSON.parse(localStorage.getItem(key));
            let changed = false;
            (parsed.habits || []).forEach(function(h) {
                if (h.text === habitText) {
                    if (!Array.isArray(h.subtasks)) h.subtasks = [];
                    if (!h.subtasks.some(function(s) { return s.text === subtaskText; })) {
                        h.subtasks.push({ text: subtaskText, completed: false });
                        changed = true;
                    }
                }
            });
            if (changed) {
                localStorage.setItem(key, JSON.stringify(parsed));
            }
        } catch(e) { /* داده‌ی خراب یا نامرتبط، رد شو */ }
    }
}

// چک می‌کنه که آیا این زیروظیفه (متن مشخص، برای این عادت مشخص) یا توی قالبِ عادت
// هست (یعنی روزهای هنوز‌ساخته‌نشده‌ی آینده هم قراره داشته باشنش)، یا توی یکی از
// روزهای آینده‌ای که از قبل باز/ساخته شده وجود داره
function habitSubtaskExistsInFuture(habitText, subtaskText) {
    const masterHabits = getMasterHabits();
    const master = masterHabits.find(function(m) { return m.text === habitText; });
    if (master && Array.isArray(master.subtasks) && master.subtasks.some(function(s) { return s.text === subtaskText; })) {
        return true;
    }

    const todayKey = getStoredKey(new Date());
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (!key || !(key.startsWith('planner_13') || key.startsWith('planner_14'))) continue;
        const dayKey = key.replace('planner_', '');
        if (dayKey <= todayKey) continue;
        try {
            const parsed = JSON.parse(localStorage.getItem(key));
            const h = (parsed.habits || []).find(function(hh) { return hh.text === habitText; });
            if (h && Array.isArray(h.subtasks) && h.subtasks.some(function(s) { return s.text === subtaskText; })) {
                return true;
            }
        } catch(e) { /* داده‌ی خراب یا نامرتبط، رد شو */ }
    }
    return false;
}

// این زیروظیفه رو هم از قالب عادت حذف می‌کنه (تا روزهای هنوز‌نساخته‌ی آینده دیگه
// نگیرنش)، هم از هر روزِ آینده‌ای که از قبل ساخته شده و همین زیروظیفه رو داره
function removeHabitSubtaskFromFuture(habitText, subtaskText) {
    const raw = localStorage.getItem('planner_master_habits') || '[]';
    let list;
    try { list = JSON.parse(raw); } catch(e) { list = []; }
    list = list.map(function(item) {
        const obj = typeof item === 'string' ? { text: item, createdAt: 0 } : item;
        if (obj.text === habitText && Array.isArray(obj.subtasks)) {
            obj.subtasks = obj.subtasks.filter(function(s) { return s.text !== subtaskText; });
        }
        return obj;
    });
    localStorage.setItem('planner_master_habits', JSON.stringify(list));

    const todayKey = getStoredKey(new Date());
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (!key || !(key.startsWith('planner_13') || key.startsWith('planner_14'))) continue;
        const dayKey = key.replace('planner_', '');
        if (dayKey <= todayKey) continue;
        try {
            const parsed = JSON.parse(localStorage.getItem(key));
            let changed = false;
            (parsed.habits || []).forEach(function(h) {
                if (h.text === habitText && Array.isArray(h.subtasks)) {
                    const newSubs = h.subtasks.filter(function(s) { return s.text !== subtaskText; });
                    if (newSubs.length !== h.subtasks.length) {
                        h.subtasks = newSubs;
                        changed = true;
                    }
                }
            });
            if (changed) {
                localStorage.setItem(key, JSON.stringify(parsed));
            }
        } catch(e) { /* داده‌ی خراب یا نامرتبط، رد شو */ }
    }
}

// دقیقاً مثل removeHabitSubtaskFromFuture، ولی به‌جای حذف، متنِ زیروظیفه رو هم توی قالبِ
// عادت (برای روزهای هنوز‌نساخته)، هم توی هر روزِ آینده‌ای که از قبل کش شده، تغییر می‌ده
function renameHabitSubtaskInFuture(habitText, oldSubtaskText, newSubtaskText) {
    const raw = localStorage.getItem('planner_master_habits') || '[]';
    let list;
    try { list = JSON.parse(raw); } catch(e) { list = []; }
    list = list.map(function(item) {
        const obj = typeof item === 'string' ? { text: item, createdAt: 0 } : item;
        if (obj.text === habitText && Array.isArray(obj.subtasks)) {
            obj.subtasks = obj.subtasks.map(function(s) {
                if (s.text === oldSubtaskText) {
                    return Object.assign({}, s, { text: newSubtaskText });
                }
                return s;
            });
        }
        return obj;
    });
    localStorage.setItem('planner_master_habits', JSON.stringify(list));

    const todayKey = getStoredKey(new Date());
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (!key || !(key.startsWith('planner_13') || key.startsWith('planner_14'))) continue;
        const dayKey = key.replace('planner_', '');
        if (dayKey <= todayKey) continue;
        try {
            const parsed = JSON.parse(localStorage.getItem(key));
            let changed = false;
            (parsed.habits || []).forEach(function(h) {
                if (h.text === habitText && Array.isArray(h.subtasks)) {
                    h.subtasks.forEach(function(s) {
                        if (s.text === oldSubtaskText) {
                            s.text = newSubtaskText;
                            changed = true;
                        }
                    });
                }
            });
            if (changed) {
                localStorage.setItem(key, JSON.stringify(parsed));
            }
        } catch(e) { /* داده‌ی خراب یا نامرتبط، رد شو */ }
    }
}

function getStoredData(dateObj) {
    const targetDate = dateObj || getSelectedDate();
    const key = getStoredKey(targetDate);
    const raw = localStorage.getItem(`planner_${key}`);
    const masterHabits = getMasterHabits();

    if (!raw) {
        const habits = isPastDate() ? [] : masterHabits
            .filter(function(h) {
                return !h.createdAt || h.createdAt <= targetDate.getTime();
            })
            .map(function(h, idx) {
                return {
                    id: 'h_master_' + idx + '_' + h.text.replace(/\s+/g, '_'),
                    text: h.text,
                    completed: false,
                    note: '',
                    subtasks: cloneHabitTemplateSubtasks(h)
                };
            });

        const initialData = { habits: habits, tasks: [], excludedHabits: [] };
        if (!isPastDate() && habits.length > 0) {
            localStorage.setItem(`planner_${key}`, JSON.stringify(initialData));
        }
        return initialData;
    }

    try {
        const parsed = JSON.parse(raw);
        let habits = Array.isArray(parsed.habits) ? parsed.habits : [];
        let tasks = Array.isArray(parsed.tasks) ? parsed.tasks : [];
        let excludedHabits = Array.isArray(parsed.excludedHabits) ? parsed.excludedHabits : [];
        let modified = false;

        if (!isPastDate()) {
            masterHabits.forEach(function(m, idx) {
                const isAllowedByDate = !m.createdAt || m.createdAt <= targetDate.getTime();
                const isExcludedToday = excludedHabits.indexOf(m.text) !== -1;
                const exists = habits.some(function(h) {
                    const hText = typeof h === 'string' ? h : h.text;
                    return hText === m.text;
                });
                if (isAllowedByDate && !exists && !isExcludedToday) {
                    habits.push({
                        id: 'h_master_' + idx + '_' + m.text.replace(/\s+/g, '_'),
                        text: m.text,
                        completed: false,
                        note: '',
                        subtasks: cloneHabitTemplateSubtasks(m)
                    });
                    modified = true;
                }
            });
        }
        if (modified && !isCurrentDayFrozen()) {
            localStorage.setItem(`planner_${key}`, JSON.stringify({ habits: habits, tasks: tasks, excludedHabits: excludedHabits }));
        }
        return { habits: habits, tasks: tasks, excludedHabits: excludedHabits };
    } catch (e) {
        return { habits: [], tasks: [], excludedHabits: [] };
    }
}

function saveData(data) {
    if (isCurrentDayFrozen()) return;
    localStorage.setItem(`planner_${getStoredKey()}`, JSON.stringify(data));
    updateDailyChart(data);
    updateInstallStreakCounter();
}

function loadDayData() {
    // موقعیتِ اسکرول رو قبل از پاک‌کردن/بازسازیِ لیست‌ها نگه می‌داریم؛ وگرنه وقتی تعداد
    // آیتم‌ها کمه (مثلاً فقط یه وظیفه)، لحظه‌ی خالی‌شدنِ لیست باعث میشه صفحه به‌زور به بالا
    // پرت بشه (چون دیگه فضای اسکرول کافی نداره) و بعد از بازسازی هم دیگه برنمی‌گرده
    const savedScrollY = window.scrollY;

    const data = getStoredData();
    const habitsList = document.getElementById('habitsList');
    const tasksList = document.getElementById('tasksList');
    const isFrozen = isCurrentDayFrozen();

    habitsList.innerHTML = '';
    tasksList.innerHTML = '';

    document.getElementById('habitInput').disabled = isFrozen;
    document.getElementById('addHabitBtn').disabled = isFrozen;
    document.getElementById('taskInput').disabled = isFrozen;
    document.getElementById('addTaskBtn').disabled = isFrozen;

    const priorityWeight = { 'urgent': 1, 'high': 2, 'normal': 3 };
    data.tasks.sort(function(a, b) {
        return (priorityWeight[a.priority || 'normal'] || 3) - (priorityWeight[b.priority || 'normal'] || 3);
    });

    data.habits.forEach(function(item) {
        renderItem(item, 'habits', habitsList, isFrozen);
    });
    data.tasks.forEach(function(item) {
        renderItem(item, 'tasks', tasksList, isFrozen);
    });

    updateDailyChart(data);
    updateDateDisplay();

    window.scrollTo(0, savedScrollY);
}

function renderItem(item, type, listElement, isFrozen) {
    const itemTextStr = typeof item === 'string' ? item : (item.text || '');
    const itemNoteStr = (typeof item === 'object' && item.note) ? item.note : '';
    const itemCompleted = (typeof item === 'object' && item.completed) ? true : false;
    const itemSubtasks = (typeof item === 'object' && Array.isArray(item.subtasks)) ? item.subtasks : [];

    const li = document.createElement('li');
    if (type === 'tasks') {
        if (item.priority === 'urgent') {
            li.style.cssText = "border-right: 4px solid #e74c3c !important;";
        } else if (item.priority === 'high') {
            li.style.cssText = "border-right: 4px solid #f1c40f !important;";
        } else {
            li.style.cssText = "border-right: 4px solid #00cec9 !important;";
        }
    }

    const disabledAttr = isFrozen ? 'disabled' : '';
    const hasNote = itemNoteStr && itemNoteStr.trim().length > 0;
    const noteIconColor = hasNote ? '#f1c40f' : 'var(--accent-blue)';
    const formattedText = itemTextStr.replace(/\n/g, '<br>');

    const subtaskCount = itemSubtasks.length;
    const subtaskDone = itemSubtasks.filter(function(s) { return s.completed; }).length;
    // اگه همه‌ی زیروظیفه‌ها تیک خورده باشن، اسم خودِ تسک هم خط می‌خوره (حتی اگه چک‌باکس
    // خودِ تسک هنوز نخورده باشه)؛ ولی این تغییر فقط روی ظاهرِ متنه، نه روی وضعیت واقعیِ
    // تکمیل تسک — چک‌باکس همچنان دست خودِ کاربره
    const allSubtasksDone = subtaskCount > 0 && subtaskDone === subtaskCount;
    li.className = `todo-item ${(itemCompleted || allSubtasksDone) ? 'completed' : ''}`;

    const itemId = item.id || itemTextStr;
    const dateKeyForDrawer = getStoredKey();

    li.innerHTML = `
        <label>
            <input type="checkbox" ${(itemCompleted || allSubtasksDone) ? 'checked' : ''} ${disabledAttr}>
            <span style="${isFrozen ? 'opacity:0.8;' : ''}">${formattedText}</span>
        </label>
        <div class="todo-item-actions">
            ${buildSubtaskToggleBtnHtml(type, itemId, dateKeyForDrawer, itemSubtasks)}
            ${(type === 'tasks' && !itemCompleted) ? `<button class="send-tomorrow-btn" type="button" style="background:none;border:none;color:var(--accent-green);cursor:pointer;font-size:0.9rem;padding:2px;" title="ارسال کپی به فردا (اینجا هم می‌مونه)">📤</button>` : ''}
            ${isFrozen ? '' : `<button class="edit-item-btn" type="button" style="background:none;border:none;color:var(--accent-gold);cursor:pointer;font-size:0.85rem;padding:2px;">✏️</button>`}
            <button class="note-item-btn" type="button" style="background:none;border:none;color:${noteIconColor};cursor:pointer;font-size:0.85rem;padding:2px;">${hasNote ? '📌' : '📝'}</button>
            ${isFrozen ? '' : `<button class="delete-item-btn" type="button" style="background:none;border:none;color:#e74c3c;cursor:pointer;font-weight:bold;padding:2px;font-size:0.85rem;">✕</button>`}
        </div>
    `;

    li.dataset.itemText = itemTextStr;
    li.dataset.itemNote = itemNoteStr;

    const subtaskToggleBtn = li.querySelector('.subtask-toggle-btn');
    if (subtaskToggleBtn) {
        subtaskToggleBtn.onclick = function(e) {
            e.stopPropagation();
            toggleSubtaskDrawer(type, itemId, dateKeyForDrawer);
        };
    }

    const sendTomorrowBtn = li.querySelector('.send-tomorrow-btn');
    if (sendTomorrowBtn) {
        sendTomorrowBtn.onclick = function(e) {
            e.stopPropagation();
            sendTaskToTomorrow(itemId, sendTomorrowBtn);
        };
    }

    const editBtn = li.querySelector('.edit-item-btn');
    if (editBtn) {
        editBtn.onclick = function(e) {
            e.stopPropagation();
            openEditModal(type, itemId, li.dataset.itemText);
        };
    }

    const noteBtn = li.querySelector('.note-item-btn');
    if (noteBtn) {
        noteBtn.onclick = function(e) {
            e.stopPropagation();
            openNoteModal(type, itemId, li.dataset.itemText, li.dataset.itemNote);
        };
    }

    if (!isFrozen) {
        const checkbox = li.querySelector('input[type="checkbox"]');
        if (checkbox) {
            checkbox.onchange = function(e) {
                e.stopPropagation();
                toggleItem(type, itemId);
            };
        }

        const delBtn = li.querySelector('.delete-item-btn');
        if (delBtn) {
            delBtn.onclick = function(e) {
                e.stopPropagation();
                if (type === 'habits') {
                    pendingHabitDeleteId = itemId;
                    document.getElementById('habitDeleteModal').classList.add('open');
                } else {
                    askDeleteConfirmation(`آیا از حذف مطمئن هستید؟`, function() {
                        deleteItem(type, itemId);
                    });
                }
            };
        }
    }

    listElement.appendChild(li);
    listElement.appendChild(buildSubtaskDrawerRowElement(type, itemId, dateKeyForDrawer, itemSubtasks));
}

function openEditModal(type, id, text, tabId = null) {
    currentEditingTextItem = { type: type, id: id, tabId: tabId };
    document.getElementById('editItemTextInput').value = text || '';

    const notifyBox = document.getElementById('editNotifyContainer');
    const repeatBox = document.getElementById('editRepeatContainer');
    if (type === 'weekly' || type === 'monthly') {
        notifyBox.style.display = 'block';
        repeatBox.style.display = 'block';
        const list = JSON.parse(localStorage.getItem(getWeeklyOrMonthlyKey(type)) || '[]');
        if (list[id]) {
            document.getElementById('editNotifyDateInput').value = list[id].notifyDate || '';
            document.getElementById('editNotifyTimeInput').value = list[id].notifyTime || '';
            document.getElementById('editRepeatToggle').checked = !!list[id].repeatEnabled;
            document.getElementById('editRepeatInterval').value = list[id].repeatIntervalDays || 7;
        }
        updateRepeatFieldsVisibility('edit');
    } else {
        notifyBox.style.display = 'none';
        repeatBox.style.display = 'none';
    }

    document.getElementById('editModal').classList.add('open');
}

function confirmEditItem() {
    const newText = document.getElementById('editItemTextInput').value.trim();
    if (!newText || !currentEditingTextItem.type) return;

    const type = currentEditingTextItem.type;
    const id = currentEditingTextItem.id;
    const tabId = currentEditingTextItem.tabId;

    if (type === 'habits' || type === 'tasks') {
        const data = getStoredData();
        const target = data[type].find(function(i) { return String(i.id || i.text) === String(id); });
        if (target) {
            const oldText = target.text;
            target.text = newText;
            if (type === 'habits') {
                let master = getMasterHabits();
                const mTarget = master.find(function(m) { return m.text === oldText; });
                if (mTarget) {
                    mTarget.text = newText;
                    localStorage.setItem('planner_master_habits', JSON.stringify(master));
                }
            }
            saveData(data);
            loadDayData();
        }
    } else if (type === 'weekly' || type === 'monthly') {
        const key = getWeeklyOrMonthlyKey(type);
        const list = JSON.parse(localStorage.getItem(key) || '[]');
        if (list[id]) {
            list[id].text = newText;
            const nDate = document.getElementById('editNotifyDateInput').value;
            let nTime = document.getElementById('editNotifyTimeInput').value;
            const repeatToggle = document.getElementById('editRepeatToggle');
            const repeatEnabled = !!(repeatToggle && repeatToggle.checked);
            // مثل فرم افزودن: اگه تکرار روشنه ولی ساعت خالیه، ۹ صبح پیش‌فرض میشه تا بی‌سروصدا نادیده گرفته نشه
            if (repeatEnabled && !nTime) nTime = '09:00';
            list[id].notifyDate = nDate;
            list[id].notifyTime = nTime;
            list[id].repeatEnabled = repeatEnabled;
            list[id].repeatIntervalDays = repeatEnabled ? Math.max(1, parseInt(document.getElementById('editRepeatInterval').value, 10) || 1) : null;
            if (!list[id].id) list[id].id = Date.now();

            localStorage.setItem(key, JSON.stringify(list));

            scheduleTaskNotification(list[id], type === 'weekly' ? '🗓 تسک هفتگی' : '📌 برنامه ماهانه');

            if (type === 'weekly') loadWeeklyData();
            else loadMonthlyData();
        }
    } else if (type === 'custom' && tabId) {
        const list = JSON.parse(localStorage.getItem(`planner_${tabId}`) || '[]');
        if (list[id]) {
            list[id].text = newText;
            localStorage.setItem(`planner_${tabId}`, JSON.stringify(list));
            loadCustomItems(tabId);
        }
    } else if (type === 'subtask') {
        const pType = currentSubtaskTarget.type;
        const pIndex = currentSubtaskTarget.index;
        if (pType === 'habits' || pType === 'tasks') {
            const data = getStoredData();
            const parent = data[pType].find(function(i) { return String(i.id || i.text) === String(pIndex); });
            if (parent && parent.subtasks && parent.subtasks[id]) {
                const oldSubtaskText = parent.subtasks[id].text;
                parent.subtasks[id].text = newText;
                saveData(data);
                loadDayData();

                // فقط برای عادت‌ها، و فقط اگه متن واقعاً عوض شده باشه: مثل اضافه/حذف زیروظیفه،
                // اگه این زیروظیفه توی روزهای بعد هم وجود داره، بپرس که ویرایش فقط امروز
                // باشه یا روزهای بعد هم همینطوری تغییر کنن
                if (pType === 'habits' && oldSubtaskText !== newText) {
                    const habitText = parent.text;
                    if (habitSubtaskExistsInFuture(habitText, oldSubtaskText)) {
                        askSubtaskScope(
                            `متنِ زیروظیفه‌ی «${oldSubtaskText}» توی روزهای بعدِ این عادت هم همینطوری ویرایش بشه؟`,
                            [
                                { label: 'فقط امروز', style: '#333' },
                                { label: '✏️ روزهای بعد هم', style: 'var(--accent-blue)', onClick: function() {
                                    renameHabitSubtaskInFuture(habitText, oldSubtaskText, newText);
                                } }
                            ]
                        );
                    }
                }
            }
        } else if (pType) {
            const key = getWeeklyOrMonthlyKey(pType);
            const list = JSON.parse(localStorage.getItem(key) || '[]');
            const parent = list[pIndex];
            if (parent && parent.subtasks && parent.subtasks[id]) {
                parent.subtasks[id].text = newText;
                localStorage.setItem(key, JSON.stringify(list));
                if (pType === 'weekly') loadWeeklyData();
                else loadMonthlyData();
            }
        }
    }

    document.getElementById('editModal').classList.remove('open');
}

function openNoteModal(type, id, text, existingNote, tabId = null) {
    currentEditingItem = { type: type, id: id, tabId: tabId };
    document.getElementById('noteModalTitle').innerText = `📌 یادداشت: ${(text || '').slice(0, 20)}...`;
    document.getElementById('itemNoteText').value = existingNote || '';
    document.getElementById('noteModal').classList.add('open');
}

function saveItemNote() {
    const noteText = document.getElementById('itemNoteText').value.trim();
    if (!currentEditingItem.type) return;

    const type = currentEditingItem.type;
    const id = currentEditingItem.id;
    const tabId = currentEditingItem.tabId;

    if (type === 'habits' || type === 'tasks') {
        const data = getStoredData();
        const target = data[type].find(function(i) { return String(i.id || i.text) === String(id); });
        if (target) {
            target.note = noteText;
            saveData(data);
            loadDayData();
        }
    } else if (type === 'weekly' || type === 'monthly') {
        const key = getWeeklyOrMonthlyKey(type);
        const list = JSON.parse(localStorage.getItem(key) || '[]');
        if (list[id]) {
            list[id].note = noteText;
            localStorage.setItem(key, JSON.stringify(list));
            if (type === 'weekly') loadWeeklyData();
            else loadMonthlyData();
        }
    } else if (type === 'goals') {
        const goals = JSON.parse(localStorage.getItem('planner_goals') || '[]');
        if (goals[id]) {
            goals[id].note = noteText;
            localStorage.setItem('planner_goals', JSON.stringify(goals));
            loadGoals();
        }
    } else if (type === 'custom' && tabId) {
        const list = JSON.parse(localStorage.getItem(`planner_${tabId}`) || '[]');
        if (list[id]) {
            list[id].note = noteText;
            localStorage.setItem(`planner_${tabId}`, JSON.stringify(list));
            loadCustomItems(tabId);
        }
    } else if (type === 'subtask') {
        const pType = currentSubtaskTarget.type;
        const pIndex = currentSubtaskTarget.index;
        if (pType === 'habits' || pType === 'tasks') {
            const data = getStoredData();
            const parent = data[pType].find(function(i) { return String(i.id || i.text) === String(pIndex); });
            if (parent && parent.subtasks && parent.subtasks[id]) {
                parent.subtasks[id].note = noteText;
                saveData(data);
                loadDayData();
            }
        } else if (pType) {
            const key = getWeeklyOrMonthlyKey(pType);
            const list = JSON.parse(localStorage.getItem(key) || '[]');
            const parent = list[pIndex];
            if (parent && parent.subtasks && parent.subtasks[id]) {
                parent.subtasks[id].note = noteText;
                localStorage.setItem(key, JSON.stringify(list));
                if (pType === 'weekly') loadWeeklyData();
                else loadMonthlyData();
            }
        }
    }

    document.getElementById('noteModal').classList.remove('open');
}

function addHabit() {
    if (isCurrentDayFrozen()) return;
    const input = document.getElementById('habitInput');
    const val = input.value.trim();
    if (!val) return;

    // بپرس این عادت فقط برای امروز باشه یا از این به بعد توی روزهای دیگه هم تکرار بشه.
    // «فقط امروز» یعنی به قالبِ عادت‌ها (planner_master_habits) اضافه نمیشه، پس روزهای
    // بعد خودشون این عادت رو نمی‌سازن — دقیقاً مثل یه تسکِ یک‌بارمصرفِ روزانه
    askSubtaskScope(
        `عادتِ «${val}» فقط برای امروز باشه یا از فردا هم تکرار بشه؟`,
        [
            { label: 'فقط امروز', style: '#333', onClick: function() { finalizeAddHabit(val, false); } },
            { label: '🔁 روزهای بعد هم', style: 'var(--accent-blue)', onClick: function() { finalizeAddHabit(val, true); } }
        ]
    );
}

function finalizeAddHabit(val, repeatFuture) {
    if (repeatFuture) {
        let oldestOpenTimestamp = getSelectedDate().getTime();
        let tempOffset = currentDateOffset - 1;

        while (tempOffset >= 0) {
            const checkDate = new Date();
            checkDate.setDate(checkDate.getDate() + tempOffset);
            oldestOpenTimestamp = checkDate.getTime();
            tempOffset--;
        }

        const master = getMasterHabits();
        if (!master.some(function(m) { return m.text === val; })) {
            master.push({ text: val, createdAt: oldestOpenTimestamp });
            localStorage.setItem('planner_master_habits', JSON.stringify(master));
        }
    }

    const data = getStoredData();
    if (!data.habits.some(function(h) { return (typeof h === 'string' ? h : h.text) === val; })) {
        data.habits.push({
            id: 'h_master_' + Date.now() + '_' + val.replace(/\s+/g, '_'),
            text: val,
            completed: false,
            note: '',
            subtasks: []
        });
        saveData(data);
    }

    document.getElementById('habitInput').value = '';
    loadDayData();
}

function addTask() {
    if (isCurrentDayFrozen()) return;
    const input = document.getElementById('taskInput');
    const prioritySelect = document.getElementById('taskPriorityInput');
    const val = input.value.trim();
    if (!val) return;

    const data = getStoredData();
    data.tasks.push({
        id: 't_' + Date.now(),
        text: val,
        priority: prioritySelect ? prioritySelect.value : 'normal',
        completed: false,
        note: '',
        subtasks: []
    });
    saveData(data);

    input.value = '';
    loadDayData();
}

function sendTaskToTomorrow(itemId, btnEl) {
    const data = getStoredData();
    const target = data.tasks.find(function(i) { return String(i.id || i.text) === String(itemId); });
    if (!target) return;

    const copiedSubtasks = (target.subtasks || [])
        .map(function(s) { return { text: s.text, completed: !!s.completed, note: s.note || '' }; });

    const newTask = {
        id: 't_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
        text: target.text,
        priority: target.priority || 'normal',
        completed: false,
        note: '',
        subtasks: copiedSubtasks
    };

    const tomorrow = new Date(getSelectedDate());
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowKey = getStoredKey(tomorrow);
    const rawTomorrow = localStorage.getItem(`planner_${tomorrowKey}`);
    let tomorrowData;
    try {
        tomorrowData = rawTomorrow ? JSON.parse(rawTomorrow) : { habits: [], tasks: [], excludedHabits: [] };
    } catch (e) {
        tomorrowData = { habits: [], tasks: [], excludedHabits: [] };
    }
    if (!Array.isArray(tomorrowData.tasks)) tomorrowData.tasks = [];
    if (!Array.isArray(tomorrowData.habits)) tomorrowData.habits = [];
    tomorrowData.tasks.push(newTask);
    localStorage.setItem(`planner_${tomorrowKey}`, JSON.stringify(tomorrowData));

    if (btnEl) {
        const original = btnEl.textContent;
        btnEl.textContent = '✅';
        btnEl.disabled = true;
        setTimeout(function() {
            btnEl.textContent = original;
            btnEl.disabled = false;
        }, 1200);
    }
}

function toggleItem(type, id) {
    if (isCurrentDayFrozen()) return;
    const data = getStoredData();
    const target = data[type].find(function(i) { return String(i.id || i.text) === String(id); });
    if (target) {
        target.completed = !target.completed;
        if (target.completed) {
            playPopSound();
            if (target.id && window.AndroidInterface && window.AndroidInterface.cancelReminder) {
                const reqCode = (parseInt(String(target.id).replace(/\D/g, '')) || Date.now()) % 100000;
                window.AndroidInterface.cancelReminder(reqCode);
            }
        }
        saveData(data);
        loadDayData();
        const allItems = [...data.habits, ...data.tasks];
        if (allItems.length > 0 && allItems.every(function(i) { return i.completed; })) {
            setTimeout(function() { triggerCelebration(); }, 150);
        }
    }
}

function executeDeleteHabit(id, allOpenDays) {
    if (isCurrentDayFrozen()) return;
    const data = getStoredData();
    const index = data.habits.findIndex(function(i) { return String(i.id || i.text) === String(id); });

    if (index !== -1) {
        const deleted = data.habits.splice(index, 1);
        const deletedText = typeof deleted[0] === 'string' ? deleted[0] : deleted[0].text;

        if (allOpenDays) {
            let master = getMasterHabits().filter(function(m) { return m.text !== deletedText; });
            localStorage.setItem('planner_master_habits', JSON.stringify(master));

            // «همه‌ی روزهای باز» یعنی امروز + روزهای آینده، به‌علاوه‌ی همون یه روز گذشته‌ای
            // که همین الان با دکمه‌ی قفل باز شده (اگه داری دقیقاً همون روز رو می‌بینی).
            // قبلاً این حلقه بدون هیچ چکی همه‌ی روزها رو پاک می‌کرد، حتی روزهای قفل‌شده‌ی
            // گذشته که کاربر اصلاً بازشون نکرده بود.
            const selectedKey = getStoredKey(getSelectedDate());
            const viewingUnlockedPastDay = isPastDate() && isUnlockedManually;

            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (!key || !(key.startsWith('planner_13') || key.startsWith('planner_14'))) continue;

                const dateMatch = key.match(/^planner_(\d{3,4})-(\d{2})-(\d{2})$/);
                if (!dateMatch) continue;

                const y = parseInt(dateMatch[1], 10);
                const m = parseInt(dateMatch[2], 10);
                const d = parseInt(dateMatch[3], 10);
                const dayKeyStr = `${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}`;

                const keyDate = j2g(y, m, d);
                keyDate.setHours(0, 0, 0, 0);
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const isPastDay = keyDate.getTime() < today.getTime();

                const isCurrentlyViewedUnlockedDay = viewingUnlockedPastDay && dayKeyStr === selectedKey;
                if (isPastDay && !isCurrentlyViewedUnlockedDay) continue;

                try {
                    const dayData = JSON.parse(localStorage.getItem(key));
                    if (dayData && Array.isArray(dayData.habits)) {
                        dayData.habits = dayData.habits.filter(function(h) {
                            const hText = typeof h === 'string' ? h : h.text;
                            return hText !== deletedText;
                        });
                        localStorage.setItem(key, JSON.stringify(dayData));
                    }
                } catch(e) {}
            }
        } else {
            if (!Array.isArray(data.excludedHabits)) data.excludedHabits = [];
            if (data.excludedHabits.indexOf(deletedText) === -1) {
                data.excludedHabits.push(deletedText);
            }
        }
        saveData(data);
        loadDayData();
    }
    pendingHabitDeleteId = null;
}

function deleteItem(type, id) {
    if (isCurrentDayFrozen()) return;
    const data = getStoredData();
    const index = data[type].findIndex(function(i) { return String(i.id || i.text) === String(id); });
    if (index !== -1) {
        data[type].splice(index, 1);
        saveData(data);
        loadDayData();
    }
}

// مرز دقیق هفته‌ی شمسی (شنبه تا جمعه) برای یک آفست مشخص؛ هم برای ساخت کلید ذخیره‌سازی
// و هم برای متن «از ... تا ...» بالای تب هفتگی از همین یک تابع استفاده میشه تا هیچوقت
// تاریخ نمایش‌داده‌شده با لیست تسک‌های واقعی که نشون داده میشه فرق نکنه.
function getWeekBoundsForOffset(offsetWeeks) {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + (offsetWeeks * 7));

    const daysSinceSaturday = (d.getDay() + 1) % 7;
    const start = new Date(d);
    start.setDate(d.getDate() - daysSinceSaturday);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);

    return { start: start, end: end, startShamsi: getShamsiDetails(start), endShamsi: getShamsiDetails(end) };
}

function getWeeklyOrMonthlyKey(type) {
    if (type === 'weekly') {
        const s = getWeekBoundsForOffset(currentWeekOffset).startShamsi;
        return `planner_weekly_${s.year}_${String(s.month).padStart(2, '0')}_${String(s.day).padStart(2, '0')}`;
    } else {
        const d = new Date();
        const sh = getShamsiDetails(d);
        let m = sh.month + currentMonthOffset;
        let y = sh.year;
        while (m > 12) { m -= 12; y++; }
        while (m < 1) { m += 12; y--; }
        return `planner_monthly_${y}_m${m}`;
    }
}

function findWeekOffsetForKey(targetKey) {
    const match = targetKey.match(/^planner_weekly_(\d+)_(\d+)_(\d+)$/);
    if (!match) return 0;
    const targetY = parseInt(match[1]);
    const targetM = parseInt(match[2]);
    const targetD = parseInt(match[3]);

    const targetStart = j2g(targetY, targetM, targetD);
    targetStart.setHours(0, 0, 0, 0);
    const thisWeekStart = getWeekBoundsForOffset(0).start;
    const diffMs = targetStart.getTime() - thisWeekStart.getTime();
    return Math.round(diffMs / (7 * 24 * 60 * 60 * 1000));
}

// اپ قبلاً هفته‌ها رو با «هر ۷ روز از اول ماه» گروه‌بندی می‌کرد (که با هفته‌ی واقعی شنبه-جمعه
// فرق داشت و باعث می‌شد بازه‌ی نمایش‌داده‌شده با تسک‌های واقعی هماهنگ نباشه). این تابع داده‌های
// قدیمی رو به فرمت جدید منتقل می‌کنه. عمداً هیچ پرچم «فقط یه بار اجرا شو» نداره: چون اگه
// کاربر یه بک‌آپ قدیمی رو بعداً ایمپورت کنه و همون فرمت قدیمی برگرده، باید بازم درست
// مهاجرت بشه. چون بعد از هر مهاجرت، کلید قدیمی حذف میشه، اجرای دوباره‌اش کاملاً بی‌خطر
// و تقریباً رایگانه (چیزی برای مهاجرت پیدا نمی‌کنه).
// روزهای گذشته‌ای که قبل از این اصلاح، همه‌ی زیروظیفه‌هاشون تیک خورده بود ولی خودِ
// تسک/عادت روی داده «تکمیل‌نشده» ثبت مونده بود (چون این حالت قبلاً فقط ظاهری بود، نه
// واقعی) رو درست می‌کنه — وگرنه نمودار روزانه و گزارش ماهانه/سالانه برای همیشه اشتباه
// می‌موند. فقط از حالت «ناتمام» به «تمام» تغییر می‌ده، هیچ‌وقت برعکس؛ پس کاملاً بی‌خطره
// و اجرای دوباره‌ش هم هیچ اثر اضافه‌ای نداره.
function migrateSubtaskCompletionStates() {
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (!key || !(key.startsWith('planner_13') || key.startsWith('planner_14'))) continue;
        try {
            const raw = localStorage.getItem(key);
            if (!raw) continue;
            const parsed = JSON.parse(raw);
            if (!parsed || (!Array.isArray(parsed.habits) && !Array.isArray(parsed.tasks))) continue;

            let changed = false;
            ['habits', 'tasks'].forEach(function(listName) {
                if (!Array.isArray(parsed[listName])) return;
                parsed[listName].forEach(function(item) {
                    if (!item || typeof item !== 'object' || !Array.isArray(item.subtasks) || item.subtasks.length === 0) return;
                    const allDone = item.subtasks.every(function(s) { return s.completed; });
                    if (allDone && !item.completed) {
                        item.completed = true;
                        item.completedBySubtasks = true;
                        changed = true;
                    }
                });
            });

            if (changed) {
                localStorage.setItem(key, JSON.stringify(parsed));
            }
        } catch (e) { /* داده‌ی خراب یا نامرتبط، رد شو */ }
    }
}

function migrateLegacyWeeklyKeys() {
    const legacyPattern = /^planner_weekly_(\d+)_m(\d+)_w(\d+)$/;
    const keysToRemove = [];

    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        const match = key && key.match(legacyPattern);
        if (!match) continue;

        try {
            const y = parseInt(match[1]);
            const m = parseInt(match[2]);
            const w = parseInt(match[3]);
            const firstDayOfChunk = ((w - 1) * 7) + 1;

            const gDate = j2g(y, m, firstDayOfChunk);
            gDate.setHours(0, 0, 0, 0);
            const daysSinceSaturday = (gDate.getDay() + 1) % 7;
            const start = new Date(gDate);
            start.setDate(gDate.getDate() - daysSinceSaturday);
            const sh = getShamsiDetails(start);
            const newKey = `planner_weekly_${sh.year}_${String(sh.month).padStart(2, '0')}_${String(sh.day).padStart(2, '0')}`;

            const oldList = JSON.parse(localStorage.getItem(key) || '[]');
            if (Array.isArray(oldList) && oldList.length > 0) {
                const existing = JSON.parse(localStorage.getItem(newKey) || '[]');
                localStorage.setItem(newKey, JSON.stringify(existing.concat(oldList)));
            }
            keysToRemove.push(key);
        } catch (e) {}
    }

    keysToRemove.forEach(function(k) { localStorage.removeItem(k); });
}

function findMonthOffsetForKey(targetKey) {
    const match = targetKey.match(/^planner_monthly_(\d+)_m(\d+)$/);
    if (!match) return 0;
    const targetY = parseInt(match[1]);
    const targetM = parseInt(match[2]);
    const sh = getShamsiDetails(new Date());
    return (targetY - sh.year) * 12 + (targetM - sh.month);
}

function changeWeek(offset) {
    currentWeekOffset += offset;
    loadWeeklyData();
}

function changeMonth(offset) {
    currentMonthOffset += offset;
    loadMonthlyData();
}

function getTodayDateInputValue() {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

// خط کوچیک زیر متن تسک که نشون میده این تسک تکرار داره یا نه
function buildRepeatInfoHtml(item) {
    if (!item.repeatEnabled) return '';
    const interval = item.repeatIntervalDays || 1;
    const start = item.notifyDate || 'امروز';
    return `<div style="font-size:0.68rem; color:#00cec9;">🔁 هر ${interval} روز (شروع از ${start})</div>`;
}

// یادآور قبلیِ این تسک (چه یک‌بار مصرف چه تکرارشونده) رو کنسل می‌کنه
function cancelTaskNotifications(reqCode) {
    if (!window.AndroidInterface) return;
    if (window.AndroidInterface.cancelReminder) window.AndroidInterface.cancelReminder(reqCode);
    if (window.AndroidInterface.cancelRecurringTaskReminder) window.AndroidInterface.cancelRecurringTaskReminder(reqCode);
}

// بر اساس notifyDate/notifyTime/repeatEnabled روی خودِ تسک، یادآور مناسب رو (یک‌بار مصرف
// یا تکرارشونده) روی گوشی تنظیم می‌کنه. همیشه اول یادآور قبلی همون تسک کنسل میشه
function scheduleTaskNotification(taskObj, typeLabel) {
    const reqCode = (taskObj.id || Date.now()) % 100000;
    cancelTaskNotifications(reqCode);

    if (!taskObj.notifyTime) return;

    if (taskObj.repeatEnabled) {
        const interval = Math.max(1, parseInt(taskObj.repeatIntervalDays, 10) || 1);
        const startDateStr = taskObj.notifyDate || getTodayDateInputValue();
        const startDateTime = new Date(`${startDateStr}T${taskObj.notifyTime}:00`).getTime();
        if (window.AndroidInterface && window.AndroidInterface.setRecurringTaskReminder && !isNaN(startDateTime)) {
            window.AndroidInterface.setRecurringTaskReminder(taskObj.text, typeLabel, startDateTime, interval, reqCode);
        }
    } else if (taskObj.notifyTime) {
        // اگه فقط ساعت ست شده و تاریخ خالی مونده، مثل حالت تکرار، امروز ملاک قرار می‌گیره
        const dateStr = taskObj.notifyDate || getTodayDateInputValue();
        const targetDateTime = new Date(`${dateStr}T${taskObj.notifyTime}:00`).getTime();
        if (targetDateTime > Date.now() && window.AndroidInterface && window.AndroidInterface.setTaskReminder) {
            window.AndroidInterface.setTaskReminder(taskObj.text, typeLabel, targetDateTime, reqCode);
        }
    }
}

function updateRepeatFieldsVisibility(prefix) {
    const toggle = document.getElementById(prefix + 'RepeatToggle');
    const box = document.getElementById(prefix + 'RepeatIntervalBox');
    if (!toggle) return;
    const on = toggle.checked;
    if (box) box.classList.toggle('show', on);
}

function addWeeklyTask() {
    const input = document.getElementById('weeklyInput');
    const notifyDate = document.getElementById('weeklyNotifyDate').value;
    const repeatToggle = document.getElementById('weeklyRepeatToggle');
    const repeatEnabled = !!(repeatToggle && repeatToggle.checked);
    const repeatIntervalDays = repeatEnabled ? Math.max(1, parseInt(document.getElementById('weeklyRepeatInterval').value, 10) || 1) : null;
    // اگه تکرار روشنه ولی ساعت خالی مونده، ۹ صبح پیش‌فرض در نظر گرفته میشه؛ وگرنه بدون
    // ساعت مشخص، تکرار اصلاً معنی نداره و بی‌سروصدا نادیده گرفته می‌شد (که گیج‌کننده بود)
    let notifyTime = document.getElementById('weeklyNotifyTime').value;
    if (repeatEnabled && !notifyTime) notifyTime = '09:00';
    const val = input.value.trim();
    if (!val) return;

    const key = getWeeklyOrMonthlyKey('weekly');
    const list = JSON.parse(localStorage.getItem(key) || '[]');
    const taskId = Date.now();
    const taskObj = { id: taskId, text: val, notifyDate: notifyDate, notifyTime: notifyTime, subtasks: [], completed: false, note: '', repeatEnabled: repeatEnabled, repeatIntervalDays: repeatIntervalDays };
    list.push(taskObj);
    localStorage.setItem(key, JSON.stringify(list));

    scheduleTaskNotification(taskObj, "🗓 تسک هفتگی");

    input.value = '';
    document.getElementById('weeklyNotifyDate').value = '';
    document.getElementById('weeklyNotifyTime').value = '';
    if (repeatToggle) repeatToggle.checked = false;
    updateRepeatFieldsVisibility('weekly');
    loadWeeklyData();
    updateInstallStreakCounter();
}

function loadWeeklyData() {
    const savedScrollY = window.scrollY;

    const bounds = getWeekBoundsForOffset(currentWeekOffset);
    const shStart = bounds.startShamsi;
    const shEnd = bounds.endShamsi;

    const titleEl = document.getElementById('weeklyTitleText');
    if (titleEl) {
        if (shStart.month === shEnd.month) {
            titleEl.innerText = `🗓 از ${shStart.day} تا ${shEnd.day} ${shamsiMonthNames[shStart.month - 1]} ${shStart.year}`;
        } else {
            titleEl.innerText = `🗓 از ${shStart.day} ${shamsiMonthNames[shStart.month - 1]} تا ${shEnd.day} ${shamsiMonthNames[shEnd.month - 1]} ${shEnd.year}`;
        }
    }

    const key = getWeeklyOrMonthlyKey('weekly');
    const list = JSON.parse(localStorage.getItem(key) || '[]');
    const el = document.getElementById('weeklyList');
    if (!el) return;
    el.innerHTML = '';

    list.forEach(function(item, i) {
        const li = document.createElement('li');
        const hasNote = item.note && item.note.trim().length > 0;
        const formattedText = (item.text || '').replace(/\n/g, '<br>');
        const notifyText = (item.notifyDate && item.notifyTime) ? `<div style="font-size:0.7rem; color:#888;">🔔 ${item.notifyDate} ${item.notifyTime}</div>` : '';
        const repeatText = buildRepeatInfoHtml(item);
        const itemSubtasks = Array.isArray(item.subtasks) ? item.subtasks : [];
        const allSubtasksDone = itemSubtasks.length > 0 && itemSubtasks.every(function(s) { return s.completed; });
        li.className = `todo-item ${(item.completed || allSubtasksDone) ? 'completed' : ''}`;

        li.innerHTML = `
            <label><input type="checkbox" ${(item.completed || allSubtasksDone) ? 'checked' : ''} onchange="toggleWeekly(${i})"> <span>${formattedText}${notifyText}${repeatText}</span></label>
            <div class="todo-item-actions">
                ${buildSubtaskToggleBtnHtml('weekly', i, null, itemSubtasks)}
                <button class="edit-btn" style="background:none;border:none;color:var(--accent-gold);cursor:pointer;font-size:0.85rem;padding:2px;">✏️</button>
                <button class="note-btn" style="background:none;border:none;color:${hasNote ? '#f1c40f' : 'var(--accent-blue)'};cursor:pointer;font-size:0.85rem;padding:2px;">${hasNote ? '📌' : '📝'}</button>
                <button class="del-btn" style="background:none;border:none;color:#e74c3c;cursor:pointer;font-weight:bold;padding:2px;font-size:0.85rem;">✕</button>
            </div>
        `;

        li.dataset.itemText = item.text || '';
        li.dataset.itemNote = item.note || '';

        li.querySelector('.subtask-toggle-btn').onclick = function() { toggleSubtaskDrawer('weekly', i, null); };
        li.querySelector('.edit-btn').onclick = function() { openEditModal('weekly', i, li.dataset.itemText); };
        li.querySelector('.note-btn').onclick = function() { openNoteModal('weekly', i, li.dataset.itemText, li.dataset.itemNote); };
        li.querySelector('.del-btn').onclick = function() { confirmDeleteWeekly(i); };

        el.appendChild(li);
        el.appendChild(buildSubtaskDrawerRowElement('weekly', i, null, itemSubtasks));
    });

    window.scrollTo(0, savedScrollY);
}

function confirmDeleteWeekly(i) {
    askDeleteConfirmation(`آیا از حذف این تسک هفتگی مطمئن هستید؟`, function() { deleteWeekly(i); });
}

function toggleWeekly(i) {
    const key = getWeeklyOrMonthlyKey('weekly');
    const list = JSON.parse(localStorage.getItem(key) || '[]');
    if(list[i]){
        list[i].completed = !list[i].completed;
        if(list[i].completed) {
            playPopSound();
            cancelTaskNotifications((list[i].id || Date.now()) % 100000);
        }
    }
    localStorage.setItem(key, JSON.stringify(list));
    loadWeeklyData();
}

function deleteWeekly(i) {
    const key = getWeeklyOrMonthlyKey('weekly');
    const list = JSON.parse(localStorage.getItem(key) || '[]');
    if(list[i]) {
        cancelTaskNotifications((list[i].id || Date.now()) % 100000);
    }
    list.splice(i, 1);
    localStorage.setItem(key, JSON.stringify(list));
    loadWeeklyData();
}

function addMonthlyTask() {
    const input = document.getElementById('monthlyInput');
    const notifyDate = document.getElementById('monthlyNotifyDate').value;
    const repeatToggle = document.getElementById('monthlyRepeatToggle');
    const repeatEnabled = !!(repeatToggle && repeatToggle.checked);
    const repeatIntervalDays = repeatEnabled ? Math.max(1, parseInt(document.getElementById('monthlyRepeatInterval').value, 10) || 1) : null;
    let notifyTime = document.getElementById('monthlyNotifyTime').value;
    if (repeatEnabled && !notifyTime) notifyTime = '09:00';
    const val = input.value.trim();
    if (!val) return;

    const key = getWeeklyOrMonthlyKey('monthly');
    const list = JSON.parse(localStorage.getItem(key) || '[]');
    const taskId = Date.now();
    const taskObj = { id: taskId, text: val, notifyDate: notifyDate, notifyTime: notifyTime, subtasks: [], completed: false, note: '', repeatEnabled: repeatEnabled, repeatIntervalDays: repeatIntervalDays };
    list.push(taskObj);
    localStorage.setItem(key, JSON.stringify(list));

    scheduleTaskNotification(taskObj, "📌 برنامه ماهانه");

    input.value = '';
    document.getElementById('monthlyNotifyDate').value = '';
    document.getElementById('monthlyNotifyTime').value = '';
    if (repeatToggle) repeatToggle.checked = false;
    updateRepeatFieldsVisibility('monthly');
    loadMonthlyData();
    updateInstallStreakCounter();
}

function loadMonthlyData() {
    const savedScrollY = window.scrollY;

    const d = new Date();
    const sh = getShamsiDetails(d);
    let m = sh.month + currentMonthOffset;
    let y = sh.year;
    while (m > 12) { m -= 12; y++; }
    while (m < 1) { m += 12; y--; }

    const titleEl = document.getElementById('monthlyTitleText');
    if (titleEl) {
        titleEl.innerText = `📌 برنامه ماه ${shamsiMonthNames[m - 1]} ${y}`;
    }

    const key = getWeeklyOrMonthlyKey('monthly');
    const list = JSON.parse(localStorage.getItem(key) || '[]');
    const el = document.getElementById('monthlyList');
    if (!el) return;
    el.innerHTML = '';

    list.forEach(function(item, i) {
        const li = document.createElement('li');
        const hasNote = item.note && item.note.trim().length > 0;
        const formattedText = (item.text || '').replace(/\n/g, '<br>');
        const notifyText = (item.notifyDate && item.notifyTime) ? `<div style="font-size:0.7rem; color:#888;">🔔 ${item.notifyDate} ${item.notifyTime}</div>` : '';
        const repeatText = buildRepeatInfoHtml(item);
        const itemSubtasks = Array.isArray(item.subtasks) ? item.subtasks : [];
        const allSubtasksDone = itemSubtasks.length > 0 && itemSubtasks.every(function(s) { return s.completed; });
        li.className = `todo-item ${(item.completed || allSubtasksDone) ? 'completed' : ''}`;

        li.innerHTML = `
            <label><input type="checkbox" ${(item.completed || allSubtasksDone) ? 'checked' : ''} onchange="toggleMonthly(${i})"> <span>${formattedText}${notifyText}${repeatText}</span></label>
            <div class="todo-item-actions">
                ${buildSubtaskToggleBtnHtml('monthly', i, null, itemSubtasks)}
                <button class="edit-btn" style="background:none;border:none;color:var(--accent-gold);cursor:pointer;font-size:0.85rem;padding:2px;">✏️</button>
                <button class="note-btn" style="background:none;border:none;color:${hasNote ? '#f1c40f' : 'var(--accent-blue)'};cursor:pointer;font-size:0.85rem;padding:2px;">${hasNote ? '📌' : '📝'}</button>
                <button class="del-btn" style="background:none;border:none;color:#e74c3c;cursor:pointer;font-weight:bold;padding:2px;font-size:0.85rem;">✕</button>
            </div>
        `;

        li.dataset.itemText = item.text || '';
        li.dataset.itemNote = item.note || '';

        li.querySelector('.subtask-toggle-btn').onclick = function() { toggleSubtaskDrawer('monthly', i, null); };
        li.querySelector('.edit-btn').onclick = function() { openEditModal('monthly', i, li.dataset.itemText); };
        li.querySelector('.note-btn').onclick = function() { openNoteModal('monthly', i, li.dataset.itemText, li.dataset.itemNote); };
        li.querySelector('.del-btn').onclick = function() { confirmDeleteMonthly(i); };

        el.appendChild(li);
        el.appendChild(buildSubtaskDrawerRowElement('monthly', i, null, itemSubtasks));
    });

    window.scrollTo(0, savedScrollY);
}

function confirmDeleteMonthly(i) {
    askDeleteConfirmation(`آیا از حذف این برنامه ماهانه مطمئن هستید؟`, function() { deleteMonthly(i); });
}

function toggleMonthly(i) {
    const key = getWeeklyOrMonthlyKey('monthly');
    const list = JSON.parse(localStorage.getItem(key) || '[]');
    if(list[i]){
        list[i].completed = !list[i].completed;
        if(list[i].completed) {
            playPopSound();
            cancelTaskNotifications((list[i].id || Date.now()) % 100000);
        }
    }
    localStorage.setItem(key, JSON.stringify(list));
    loadMonthlyData();
}

function deleteMonthly(i) {
    const key = getWeeklyOrMonthlyKey('monthly');
    const list = JSON.parse(localStorage.getItem(key) || '[]');
    if(list[i]) {
        cancelTaskNotifications((list[i].id || Date.now()) % 100000);
    }
    list.splice(i, 1);
    localStorage.setItem(key, JSON.stringify(list));
    loadMonthlyData();
}

// ============== زیروظیفه‌ها به‌صورت کشویی زیر خودِ تسک (بدون مودال) ==============

function subtaskDrawerKey(type, itemId, dateKey) {
    return type + '::' + itemId + '::' + (dateKey || '');
}

function isSubtaskDrawerOpen(type, itemId, dateKey) {
    return openSubtaskDrawers.has(subtaskDrawerKey(type, itemId, dateKey));
}

// با کلیک روی دکمه‌ی زیروظیفه‌ها، همون لیست (روزانه/هفتگی/ماهانه) کامل دوباره رندر میشه؛
// چون وضعیت باز/بسته بودن هر کشو توی openSubtaskDrawers (جدا از DOM) نگه داشته میشه،
// این رندر دوباره باعث بسته شدن بقیه‌ی کشوهای بازشده نمیشه
function toggleSubtaskDrawer(type, itemId, dateKey) {
    const key = subtaskDrawerKey(type, itemId, dateKey);
    if (openSubtaskDrawers.has(key)) {
        openSubtaskDrawers.delete(key);
    } else {
        openSubtaskDrawers.add(key);
    }
    reloadListForSubtaskType(type);
}

function reloadListForSubtaskType(type) {
    if (type === 'habits' || type === 'tasks') loadDayData();
    else if (type === 'weekly') loadWeeklyData();
    else if (type === 'monthly') loadMonthlyData();
}

// دکمه‌ی کوچیک کنار هر تسک: وقتی زیروظیفه‌ای نداره خیلی کم‌رنگ و بی‌سروصداست (فقط یه
// آیکون کوچیک، بدون شمارنده) تا نظم لیست به‌هم نخوره؛ به محض اضافه شدن اولین زیروظیفه،
// با رنگ روشن‌تر و شمارنده‌ی «انجام‌شده/کل» کاملاً قابل دیدن میشه
function buildSubtaskToggleBtnHtml(type, itemId, dateKey, subtasks) {
    const count = subtasks.length;
    const done = subtasks.filter(function(s) { return s.completed; }).length;
    const isOpen = isSubtaskDrawerOpen(type, itemId, dateKey);
    const cls = 'subtask-toggle-btn' + (count > 0 ? ' has-items' : '') + (isOpen ? ' open' : '');
    const badge = count > 0 ? `<span class="subtask-count-badge">${done}/${count}</span>` : '';
    return `<button type="button" class="${cls}" title="زیروظیفه‌ها"><span class="subtask-toggle-icon">📋</span>${badge}<span class="subtask-caret">▾</span></button>`;
}

// ردیف کشویی که باید بلافاصله بعد از <li> خودِ تسک، توی همون <ul> اضافه بشه. با CSS
// (max-height) باز/بسته میشه، پس همیشه توی DOM هست ولی وقتی بسته‌ست جایی اشغال نمی‌کنه
function buildSubtaskDrawerRowElement(type, itemId, dateKey, subtasks) {
    const key = subtaskDrawerKey(type, itemId, dateKey);
    const isOpen = isSubtaskDrawerOpen(type, itemId, dateKey);

    const rowsHtml = subtasks.map(function(s, idx) {
        const hasNote = s.note && s.note.trim().length > 0;
        const formattedSubText = (s.text || '').replace(/\n/g, '<br>');
        return `
        <li class="subtask-row ${s.completed ? 'completed' : ''}" data-sub-idx="${idx}">
            <label><input type="checkbox" class="subtask-check" ${s.completed ? 'checked' : ''}> <span>${formattedSubText}</span></label>
            <div class="subtask-row-actions">
                <button type="button" class="subtask-edit-btn" title="ویرایش زیروظیفه">✏️</button>
                <button type="button" class="subtask-note-btn" title="یادداشت زیروظیفه" style="color:${hasNote ? '#f1c40f' : 'var(--accent-blue)'};">${hasNote ? '📌' : '📝'}</button>
                <button type="button" class="subtask-del-btn" title="حذف زیروظیفه">✕</button>
            </div>
        </li>`;
    }).join('');

    const wrapLi = document.createElement('li');
    wrapLi.className = 'subtask-drawer-wrap' + (isOpen ? ' open' : '');
    wrapLi.dataset.drawerKey = key;
    wrapLi.innerHTML = `
        <div class="subtask-drawer">
            ${subtasks.length ? `<ul class="subtask-drawer-list">${rowsHtml}</ul>` : `<div class="subtask-empty-hint">هنوز زیروظیفه‌ای اضافه نشده</div>`}
            <div class="subtask-add-row">
                <input type="text" class="subtask-add-input" placeholder="افزودن زیروظیفه...">
                <button type="button" class="subtask-add-btn">افزودن</button>
            </div>
        </div>
    `;

    wrapLi.querySelectorAll('.subtask-row').forEach(function(rowEl) {
        const idx = parseInt(rowEl.dataset.subIdx, 10);
        rowEl.querySelector('.subtask-check').onchange = function() {
            currentSubtaskTarget = { type: type, index: itemId, dateKey: dateKey };
            toggleSubtask(idx);
        };
        rowEl.querySelector('.subtask-edit-btn').onclick = function() {
            currentSubtaskTarget = { type: type, index: itemId, dateKey: dateKey };
            editSubtaskItem(idx);
        };
        rowEl.querySelector('.subtask-note-btn').onclick = function() {
            currentSubtaskTarget = { type: type, index: itemId, dateKey: dateKey };
            noteSubtaskItem(idx);
        };
        rowEl.querySelector('.subtask-del-btn').onclick = function() {
            currentSubtaskTarget = { type: type, index: itemId, dateKey: dateKey };
            deleteSubtask(idx);
        };
    });

    const addInput = wrapLi.querySelector('.subtask-add-input');
    const addBtn = wrapLi.querySelector('.subtask-add-btn');

    if (pendingSubtaskInputRestore && pendingSubtaskInputRestore.key === key) {
        addInput.value = pendingSubtaskInputRestore.text;
        pendingSubtaskInputRestore = null;
        setTimeout(function() { addInput.focus(); }, 0);
    }

    function doAdd() {
        const val = addInput.value.trim();
        if (!val) return;
        currentSubtaskTarget = { type: type, index: itemId, dateKey: dateKey };
        addSubtaskText(val);
    }
    addBtn.onclick = doAdd;
    addInput.onkeydown = function(e) {
        if (e.key === 'Enter') { e.preventDefault(); doAdd(); }
    };

    return wrapLi;
}

// از نتیجه‌ی جست‌وجو یا هر جای دیگه صدا زده میشه تا کشوی یه زیروظیفه‌ی خاص رو باز کنه
function openSubtaskDrawerFor(type, itemId, dateKey) {
    openSubtaskDrawers.add(subtaskDrawerKey(type, itemId, dateKey));
    reloadListForSubtaskType(type);
}

function getSubtaskParentTarget() {
    const type = currentSubtaskTarget.type;
    const index = currentSubtaskTarget.index;
    if (!type) return null;
    if (type === 'habits' || type === 'tasks') {
        const data = getStoredData();
        return data[type].find(function(i) { return String(i.id || i.text) === String(index); });
    } else {
        const key = getWeeklyOrMonthlyKey(type);
        const list = JSON.parse(localStorage.getItem(key) || '[]');
        return list[index];
    }
}

function editSubtaskItem(idx) {
    const target = getSubtaskParentTarget();
    if (!target || !target.subtasks || !target.subtasks[idx]) return;
    openEditModal('subtask', idx, target.subtasks[idx].text);
}

function noteSubtaskItem(idx) {
    const target = getSubtaskParentTarget();
    if (!target || !target.subtasks || !target.subtasks[idx]) return;
    openNoteModal('subtask', idx, target.subtasks[idx].text, target.subtasks[idx].note || '');
}

function addSubtaskText(val) {
    if (!val || !currentSubtaskTarget.type) return;

    const type = currentSubtaskTarget.type;
    const index = currentSubtaskTarget.index;

    if (type === 'habits' || type === 'tasks') {
        const data = getStoredData();
        const target = data[type].find(function(i) { return String(i.id || i.text) === String(index); });
        if (target) {
            if (!target.subtasks) target.subtasks = [];
            target.subtasks.push({ text: val, completed: false });
            saveData(data);
            loadDayData();

            // فقط برای عادت‌ها: بپرس این زیروظیفه به روزهای بعدِ همین عادت هم اضافه بشه یا نه
            // (هیچ‌وقت به روزهای گذشته اضافه نمیشه)
            if (type === 'habits') {
                const habitText = target.text;
                const habitId = index;
                const drawerKeyForRestore = subtaskDrawerKey('habits', habitId, currentSubtaskTarget.dateKey);
                askSubtaskScope(
                    `این زیروظیفه («${val}») توی روزهای بعدِ این عادت هم خودکار اضافه بشه؟`,
                    [
                        { label: 'فقط امروز', style: '#333' },
                        { label: '✅ بله، روزهای بعد هم', style: 'var(--accent-blue)', onClick: function() {
                            addSubtaskToHabitTemplate(habitText, val);
                        } }
                    ],
                    function() {
                        // ✕ = انصراف واقعی از کل کار: همین زیروظیفه‌ای که تازه برای امروز
                        // اضافه شده بود رو کامل برمی‌گردونه (نه فقط از پیشنهاد تکرار صرف‌نظر می‌کنه)
                        // و متنی که نوشته بودی رو دوباره توی اینپوتِ افزودن می‌ذاره
                        const freshData = getStoredData();
                        const freshTarget = freshData.habits.find(function(i) { return String(i.id || i.text) === String(habitId); });
                        if (freshTarget && freshTarget.subtasks) {
                            const idx2 = freshTarget.subtasks.findIndex(function(s) { return s.text === val; });
                            if (idx2 !== -1) freshTarget.subtasks.splice(idx2, 1);
                            saveData(freshData);
                        }
                        pendingSubtaskInputRestore = { key: drawerKeyForRestore, text: val };
                        loadDayData();
                    }
                );
            }
        }
    } else {
        const key = getWeeklyOrMonthlyKey(type);
        const list = JSON.parse(localStorage.getItem(key) || '[]');
        const target = list[index];
        if (target) {
            if (!target.subtasks) target.subtasks = [];
            target.subtasks.push({ text: val, completed: false });
            localStorage.setItem(key, JSON.stringify(list));
            if (type === 'weekly') loadWeeklyData();
            else loadMonthlyData();
        }
    }
}

function toggleSubtask(subtaskIndex) {
    const type = currentSubtaskTarget.type;
    const index = currentSubtaskTarget.index;

    if (type === 'habits' || type === 'tasks') {
        const data = getStoredData();
        const target = data[type].find(function(i) { return String(i.id || i.text) === String(index); });
        if (target && target.subtasks && target.subtasks[subtaskIndex]) {
            target.subtasks[subtaskIndex].completed = !target.subtasks[subtaskIndex].completed;
            const subtaskJustCompleted = target.subtasks[subtaskIndex].completed;

            // اگه با همین تیک، همه‌ی زیروظیفه‌ها تموم شدن، خودِ تسک/عادت هم واقعاً (نه
            // فقط ظاهری) تکمیل‌شده حساب میشه — وگرنه توی نمودار روزانه و گزارش ماهانه/
            // سالانه به‌حساب نمی‌اومد و آهنگ پیروزیِ آخر روز هم پخش نمی‌شد. اگه بعداً یکی
            // از همین زیروظیفه‌ها دوباره باز بشه، فقط در صورتی که این تکمیل خودکار بوده
            // (نه اینکه خودِ کاربر دستی روی چک‌باکس اصلی زده باشه) به حالت ناتمام برمی‌گرده؛
            // تکمیلِ دستیِ کاربر همیشه دست‌نخورده و مستقل باقی می‌مونه.
            const allSubtasksDone = target.subtasks.length > 0 && target.subtasks.every(function(s) { return s.completed; });
            let parentJustAutoCompleted = false;
            if (allSubtasksDone && !target.completed) {
                target.completed = true;
                target.completedBySubtasks = true;
                parentJustAutoCompleted = true;
                if (target.id && window.AndroidInterface && window.AndroidInterface.cancelReminder) {
                    const reqCode = (parseInt(String(target.id).replace(/\D/g, '')) || Date.now()) % 100000;
                    window.AndroidInterface.cancelReminder(reqCode);
                }
            } else if (!allSubtasksDone && target.completedBySubtasks) {
                target.completed = false;
                target.completedBySubtasks = false;
            }

            if (subtaskJustCompleted || parentJustAutoCompleted) {
                playPopSound();
            }

            saveData(data);
            loadDayData();

            const allItems = [...data.habits, ...data.tasks];
            if (allItems.length > 0 && allItems.every(function(i) { return i.completed; })) {
                setTimeout(function() { triggerCelebration(); }, 150);
            }
        }
    } else {
        const key = getWeeklyOrMonthlyKey(type);
        const list = JSON.parse(localStorage.getItem(key) || '[]');
        const target = list[index];
        if (target && target.subtasks && target.subtasks[subtaskIndex]) {
            target.subtasks[subtaskIndex].completed = !target.subtasks[subtaskIndex].completed;
            if (target.subtasks[subtaskIndex].completed) {
                playPopSound();
            }
            localStorage.setItem(key, JSON.stringify(list));
            if (type === 'weekly') loadWeeklyData();
            else loadMonthlyData();
        }
    }
}

function deleteSubtask(subtaskIndex) {
    const type = currentSubtaskTarget.type;
    const index = currentSubtaskTarget.index;

    if (type === 'habits') {
        const data = getStoredData();
        const target = data.habits.find(function(i) { return String(i.id || i.text) === String(index); });
        if (!target || !target.subtasks || !target.subtasks[subtaskIndex]) return;

        const subtaskText = target.subtasks[subtaskIndex].text;
        const habitText = target.text;

        const deleteTodayOnly = function() {
            const freshData = getStoredData();
            const freshTarget = freshData.habits.find(function(i) { return String(i.id || i.text) === String(index); });
            if (freshTarget && freshTarget.subtasks) {
                const idx2 = freshTarget.subtasks.findIndex(function(s) { return s.text === subtaskText; });
                if (idx2 !== -1) freshTarget.subtasks.splice(idx2, 1);
                saveData(freshData);
                loadDayData();
            }
        };

        // فقط اگه این زیروظیفه واقعاً توی روزهای بعد هم وجود داره (یا توی قالبِ عادت
        // ثبت شده)، سؤال پرسیده میشه؛ وگرنه فقط همین امروز مستقیم پاک میشه
        if (habitSubtaskExistsInFuture(habitText, subtaskText)) {
            askSubtaskScope(
                `زیروظیفه‌ی «${subtaskText}» توی روزهای بعدِ این عادت هم هست. چطور پاک بشه؟`,
                [
                    { label: 'فقط امروز', style: '#333', onClick: deleteTodayOnly },
                    { label: '🗑️ امروز و روزهای بعد', style: '#e74c3c', onClick: function() {
                        deleteTodayOnly();
                        removeHabitSubtaskFromFuture(habitText, subtaskText);
                    } }
                ]
            );
        } else {
            deleteTodayOnly();
        }
    } else if (type === 'tasks') {
        const data = getStoredData();
        const target = data.tasks.find(function(i) { return String(i.id || i.text) === String(index); });
        if (target && target.subtasks) {
            target.subtasks.splice(subtaskIndex, 1);
            saveData(data);
            loadDayData();
        }
    } else {
        const key = getWeeklyOrMonthlyKey(type);
        const list = JSON.parse(localStorage.getItem(key) || '[]');
        const target = list[index];
        if (target && target.subtasks) {
            target.subtasks.splice(subtaskIndex, 1);
            localStorage.setItem(key, JSON.stringify(list));
            if (type === 'weekly') loadWeeklyData();
            else loadMonthlyData();
        }
    }
}

function openSearchModal() {
    document.getElementById('searchModal').classList.add('open');
    document.getElementById('searchInput').focus();
}

function closeSearchModal() {
    document.getElementById('searchModal').classList.remove('open');
}

function executeSearch() {
    const query = document.getElementById('searchInput').value.trim().toLowerCase();
    const container = document.getElementById('searchResultsList');
    container.innerHTML = '';
    if (!query) return;

    // مشخص می‌کنه کدوم بخش از آیتم (متن اصلی، یادداشت، یا توضیحات هدف) با عبارت
    // جست‌وجو مچ شده؛ این تشخیص لازمه تا بدونیم بعد از کلیک، کدوم مودال رو باز کنیم
    function matchInfo(item) {
        if (typeof item === 'string') {
            return item.toLowerCase().includes(query) ? { label: item, field: 'text' } : null;
        }
        if (!item || typeof item !== 'object') return null;
        const mainText = item.text || item.title || '';
        if (mainText && mainText.toLowerCase().includes(query)) {
            return { label: mainText, field: 'text' };
        }
        if (item.note && item.note.toLowerCase().includes(query)) {
            return { label: mainText || item.note, field: 'note' };
        }
        if (item.desc && item.desc.toLowerCase().includes(query)) {
            return { label: mainText || item.desc, field: 'desc' };
        }
        return null;
    }

    function checkAndPush(item, base) {
        const info = matchInfo(item);
        if (info) {
            renderSearchResult(Object.assign({}, base, {
                label: info.label,
                matchField: info.field,
                isSubtask: false
            }), container);
        }
        if (item && typeof item === 'object' && Array.isArray(item.subtasks)) {
            item.subtasks.forEach(function(st, stIdx) {
                const stInfo = matchInfo(st);
                if (stInfo) {
                    renderSearchResult(Object.assign({}, base, {
                        label: '↳ ' + stInfo.label,
                        matchField: stInfo.field,
                        isSubtask: true,
                        subtaskIndex: stIdx
                    }), container);
                }
            });
        }
    }

    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (!key || !key.startsWith('planner_')) continue;
        if (key === 'planner_master_habits' || key === 'planner_custom_tabs' || key === 'planner_custom_reminders') continue;

        try {
            const parsed = JSON.parse(localStorage.getItem(key));

            if (key.startsWith('planner_weekly_') || key.startsWith('planner_monthly_')) {
                const itemType = key.startsWith('planner_weekly_') ? 'weekly' : 'monthly';
                if (Array.isArray(parsed)) {
                    parsed.forEach(function(item, idx) {
                        checkAndPush(item, { key: key, itemType: itemType, itemId: idx });
                    });
                }
            } else if (key === 'planner_goals') {
                if (Array.isArray(parsed)) {
                    parsed.forEach(function(item, idx) {
                        checkAndPush(item, { key: key, itemType: 'goals', itemId: idx });
                    });
                }
            } else if (key.startsWith('planner_custom_')) {
                const tabId = key.replace('planner_', '');
                if (Array.isArray(parsed)) {
                    parsed.forEach(function(item, idx) {
                        checkAndPush(item, { key: key, itemType: 'custom', itemId: idx, tabId: tabId });
                    });
                }
            } else if (parsed && (parsed.tasks || parsed.habits)) {
                (parsed.habits || []).forEach(function(item) {
                    checkAndPush(item, { key: key, itemType: 'habits', itemId: (item.id || item.text) });
                });
                (parsed.tasks || []).forEach(function(item) {
                    checkAndPush(item, { key: key, itemType: 'tasks', itemId: (item.id || item.text) });
                });
            }
        } catch(e) {}
    }
}

function renderSearchResult(d, container) {
    const div = document.createElement('div');
    div.style.cssText = "background:#0d0f12; border:1px solid #222633; padding:8px 10px; border-radius:6px; font-size:0.8rem; cursor:pointer; color:#fff;";

    let placeLabel;
    if (d.itemType === 'weekly') placeLabel = 'هفتگی';
    else if (d.itemType === 'monthly') placeLabel = 'ماهانه';
    else if (d.itemType === 'goals') placeLabel = 'اهداف';
    else if (d.itemType === 'custom') placeLabel = 'برچسب سفارشی';
    else placeLabel = d.key.replace('planner_', '');

    const fieldTag = d.matchField === 'note' ? ' 📝' : (d.matchField === 'desc' ? ' 📄' : '');
    div.innerText = `📌 ${d.label}${fieldTag} (${placeLabel})`;

    div.onclick = function() {
        closeSearchModal();
        goToSearchResult(d);
    };
    container.appendChild(div);
}

// بعد از رفتن به روز/تب درست، دقیقاً همون آیتم (یا زیرتسک) و مودال یادداشتش رو -اگه
// مچ روی یادداشت بوده- باز می‌کنه؛ یعنی دیگه لازم نیست دستی توی صفحه دنبالش بگردی
function goToSearchResult(d) {
    if (d.itemType === 'weekly' || d.itemType === 'monthly') {
        if (d.itemType === 'weekly') {
            currentWeekOffset = findWeekOffsetForKey(d.key);
            switchTab('weekly', null, true);
        } else {
            currentMonthOffset = findMonthOffsetForKey(d.key);
            switchTab('monthly', null, true);
        }
        const list = JSON.parse(localStorage.getItem(d.key) || '[]');
        const item = list[d.itemId];
        if (!item) return;
        if (d.isSubtask) {
            openSubtaskDrawerFor(d.itemType, d.itemId, null);
            if (d.matchField === 'note') {
                const st = (item.subtasks || [])[d.subtaskIndex];
                if (st) {
                    currentSubtaskTarget = { type: d.itemType, index: d.itemId, dateKey: null };
                    openNoteModal('subtask', d.subtaskIndex, st.text, st.note || '');
                }
            }
        } else if (d.matchField === 'note') {
            openNoteModal(d.itemType, d.itemId, item.text, item.note || '');
        }
    } else if (d.itemType === 'goals') {
        switchTab('goals');
        const goals = JSON.parse(localStorage.getItem('planner_goals') || '[]');
        const g = goals[d.itemId];
        if (!g) return;
        if (d.matchField === 'note') {
            openNoteModal('goals', d.itemId, g.title, g.note || '');
        } else if (d.matchField === 'desc') {
            openEditGoalModal(d.itemId);
        }
    } else if (d.itemType === 'custom') {
        switchTab(d.tabId);
        if (d.matchField === 'note') {
            const list = JSON.parse(localStorage.getItem(`planner_${d.tabId}`) || '[]');
            const it = list[d.itemId];
            if (it) openNoteModal('custom', d.itemId, it.text, it.note || '', d.tabId);
        }
    } else if (d.itemType === 'habits' || d.itemType === 'tasks') {
        const dateLabel = d.key.replace('planner_', '');
        const parts = dateLabel.split('-');
        if (parts.length === 3) {
            const targetYear = parseInt(parts[0]);
            const targetMonth = parseInt(parts[1]);
            const targetDay = parseInt(parts[2]);

            const targetGDate = j2g(targetYear, targetMonth, targetDay);
            const todayGDate = new Date();

            todayGDate.setHours(0, 0, 0, 0);
            targetGDate.setHours(0, 0, 0, 0);

            const diffTime = targetGDate.getTime() - todayGDate.getTime();
            const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

            currentDateOffset = diffDays;
            isUnlockedManually = true;
            switchTab('daily', null, true);
            updateDateDisplay();
            loadDayData();

            const data = getStoredData();
            const list = data[d.itemType] || [];
            const item = list.find(function(i) { return String(i.id || i.text) === String(d.itemId); });
            if (!item) return;
            if (d.isSubtask) {
                const dKey = getStoredKey();
                openSubtaskDrawerFor(d.itemType, d.itemId, dKey);
                if (d.matchField === 'note') {
                    const st = (item.subtasks || [])[d.subtaskIndex];
                    if (st) {
                        currentSubtaskTarget = { type: d.itemType, index: d.itemId, dateKey: dKey };
                        openNoteModal('subtask', d.subtaskIndex, st.text, st.note || '');
                    }
                }
            } else if (d.matchField === 'note') {
                openNoteModal(d.itemType, d.itemId, item.text, item.note || '');
            }
        } else {
            switchTab('daily');
        }
    }
}

function savePeriodicReminder() {
    const days = parseInt(document.getElementById('periodicDaysInput').value);
    if (!days || days < 1) {
        alert("لطفاً تعداد روز معتبر وارد کنید!");
        return;
    }
    const timeVal = document.getElementById('periodicTimeInput').value || '09:00';
    const timeParts = timeVal.split(':');
    const hour = parseInt(timeParts[0], 10);
    const minute = parseInt(timeParts[1], 10);

    localStorage.setItem('planner_periodic_days', String(days));
    localStorage.setItem('planner_periodic_time', timeVal);

    if (window.AndroidInterface && window.AndroidInterface.setPeriodicReminder) {
        window.AndroidInterface.setPeriodicReminder(days, hour, minute, "📅 یادآوری برنامه‌ریز", "وقتشه برنامه‌های هفتگی و ماهانه‌ت رو چک کنی!", 8001);
    }
}

function addGoal() {
    const title = document.getElementById('goalTitle').value.trim();
    const desc = document.getElementById('goalDesc').value.trim();
    const deadlineDate = document.getElementById('goalDate').value;
    const notifyDate = document.getElementById('goalNotifyDate').value;
    const notifyTime = document.getElementById('goalNotifyTime').value;

    if (!title) return;

    const goals = JSON.parse(localStorage.getItem('planner_goals') || '[]');
    const goalId = Date.now();
    goals.push({
        id: goalId,
        title: title,
        desc: desc,
        deadlineDate: deadlineDate,
        notifyDate: notifyDate,
        notifyTime: notifyTime,
        progress: 0,
        note: ''
    });
    localStorage.setItem('planner_goals', JSON.stringify(goals));

    if (notifyDate && notifyTime && window.AndroidInterface && window.AndroidInterface.setGoalReminder) {
        const targetDateTime = new Date(`${notifyDate}T${notifyTime}:00`).getTime();
        if (targetDateTime > Date.now()) {
            window.AndroidInterface.setGoalReminder(title, desc, targetDateTime, goalId % 100000);
        }
    }

    document.getElementById('goalTitle').value = '';
    document.getElementById('goalDesc').value = '';
    loadGoals();
    updateInstallStreakCounter();
}

function openEditGoalModal(index) {
    const goals = JSON.parse(localStorage.getItem('planner_goals') || '[]');
    const g = goals[index];
    if (!g) return;

    currentEditingGoalIndex = index;
    document.getElementById('editGoalTitleInput').value = g.title || '';
    document.getElementById('editGoalDescInput').value = g.desc || '';
    document.getElementById('editGoalDateInput').value = g.deadlineDate || g.date || '';
    document.getElementById('editGoalNotifyDateInput').value = g.notifyDate || '';
    document.getElementById('editGoalNotifyTimeInput').value = g.notifyTime || g.time || '';

    document.getElementById('editGoalModal').classList.add('open');
}

function confirmEditGoal() {
    if (currentEditingGoalIndex === null) return;
    const goals = JSON.parse(localStorage.getItem('planner_goals') || '[]');
    const g = goals[currentEditingGoalIndex];
    if (!g) return;

    const title = document.getElementById('editGoalTitleInput').value.trim();
    const desc = document.getElementById('editGoalDescInput').value.trim();
    const deadlineDate = document.getElementById('editGoalDateInput').value;
    const notifyDate = document.getElementById('editGoalNotifyDateInput').value;
    const notifyTime = document.getElementById('editGoalNotifyTimeInput').value;

    if (!title) return;

    g.title = title;
    g.desc = desc;
    g.deadlineDate = deadlineDate;
    g.notifyDate = notifyDate;
    g.notifyTime = notifyTime;
    localStorage.setItem('planner_goals', JSON.stringify(goals));

    if (notifyDate && notifyTime && window.AndroidInterface && window.AndroidInterface.setGoalReminder) {
        const targetDateTime = new Date(`${notifyDate}T${notifyTime}:00`).getTime();
        if (targetDateTime > Date.now()) {
            window.AndroidInterface.setGoalReminder(title, desc, targetDateTime, (g.id || Date.now()) % 100000);
        }
    }

    document.getElementById('editGoalModal').classList.remove('open');
    currentEditingGoalIndex = null;
    loadGoals();
}

function loadGoals() {
    const goals = JSON.parse(localStorage.getItem('planner_goals') || '[]');
    const container = document.getElementById('goalsContainer');
    if (!container) return;
    container.innerHTML = '';
    goals.forEach(function(g, i) {
        const div = document.createElement('div');
        div.className = 'goal-card';
        const hasNote = g.note && g.note.trim().length > 0;
        const formattedDesc = (g.desc || '').replace(/\n/g, '<br>');
        const deadlineText = g.deadlineDate || g.date || 'نامشخص';
        const notifyText = (g.notifyDate && g.notifyTime) ? `${g.notifyDate} ساعت ${g.notifyTime}` : (g.time ? `ساعت ${g.time}` : 'تنظیم نشده');

        div.innerHTML = `
            <div class="goal-header"><span>${g.title}</span> <span>ددلاین: ${deadlineText}</span></div>
            <div class="goal-desc">${formattedDesc}</div>
            <div style="font-size:0.75rem; color:#888; margin-bottom:6px;">🔔 یادآوری: ${notifyText}</div>
            <div style="display:flex;align-items:center;gap:10px;">
                <input type="range" min="0" max="100" value="${g.progress}" onchange="updateGoalProgress(${i}, this.value)">
                <span>${g.progress}%</span>
                <div style="margin-right:auto; display:flex; gap:5px; flex-shrink:0;">
                    <button class="edit-goal-btn" style="background:none;border:none;color:var(--accent-gold);cursor:pointer;" title="ویرایش کامل هدف">✏️</button>
                    <button class="note-goal-btn" style="background:none;border:none;color:${hasNote ? '#f1c40f' : 'var(--accent-blue)'};cursor:pointer;">${hasNote ? '📌' : '📝'}</button>
                    <button class="del-goal-btn" style="background:none;border:none;color:#e74c3c;cursor:pointer;">✕</button>
                </div>
            </div>
            <div class="goal-progress-bar"><div class="goal-progress-fill" style="width:${g.progress}%"></div></div>
        `;

        div.dataset.goalTitle = g.title || '';
        div.dataset.goalNote = g.note || '';

        div.querySelector('.edit-goal-btn').onclick = function() { openEditGoalModal(i); };
        div.querySelector('.note-goal-btn').onclick = function() { openNoteModal('goals', i, div.dataset.goalTitle, div.dataset.goalNote); };
        div.querySelector('.del-goal-btn').onclick = function() { confirmDeleteGoal(i); };

        container.appendChild(div);
    });
}

function confirmDeleteGoal(i) {
    askDeleteConfirmation(`آیا از حذف این هدف مطمئن هستید؟`, function() { deleteGoal(i); });
}

function updateGoalProgress(i, val) {
    const goals = JSON.parse(localStorage.getItem('planner_goals') || '[]');
    if (goals[i]) {
        goals[i].progress = val;
        localStorage.setItem('planner_goals', JSON.stringify(goals));
        loadGoals();
    }
}

function deleteGoal(i) {
    const goals = JSON.parse(localStorage.getItem('planner_goals') || '[]');
    const target = goals[i];
    if (target && window.AndroidInterface && window.AndroidInterface.cancelReminder) {
        window.AndroidInterface.cancelReminder((target.id || Date.now()) % 100000);
    }
    goals.splice(i, 1);
    localStorage.setItem('planner_goals', JSON.stringify(goals));
    loadGoals();
}

const PERSIAN_DAY_NAMES = { 1: 'یکشنبه', 2: 'دوشنبه', 3: 'سه‌شنبه', 4: 'چهارشنبه', 5: 'پنجشنبه', 6: 'جمعه', 7: 'شنبه' };

function loadReminders() {
    const container = document.getElementById('remindersContainer');
    if (!container) return;
    const list = JSON.parse(localStorage.getItem('planner_custom_reminders') || '[]');
    container.innerHTML = '';

    if (list.length === 0) {
        container.innerHTML = '<p style="color:var(--text-muted); font-size:0.8rem; text-align:center; padding:10px 0;">هنوز یادآوری‌ای ثبت نشده.</p>';
        return;
    }

    list.forEach(function(r, i) {
        const daysLabel = (r.days || []).slice().sort().map(function(d) { return PERSIAN_DAY_NAMES[d] || ''; }).join('، ');
        const timeLabel = String(r.hour).padStart(2, '0') + ':' + String(r.minute).padStart(2, '0');
        let startDateLabel = '';
        if (r.startDate) {
            if (!r.repeat) {
                startDateLabel = `<div class="goal-desc">📆 تاریخ: ${r.startDate}</div>`;
            } else if (r.startDate > getLocalDateKey()) {
                startDateLabel = `<div class="goal-desc">📆 شروع از: ${r.startDate}</div>`;
            }
        }
        const div = document.createElement('div');
        div.className = 'goal-card';
        div.innerHTML = `
            <div class="goal-header">
                <span>⏰ ${r.text}</span>
                <div style="display:flex; gap:8px;">
                    <button class="edit-reminder-btn" type="button" style="background:none;border:none;color:var(--accent-gold);cursor:pointer;font-size:0.9rem;">✏️</button>
                    <button class="delete-reminder-btn" type="button" style="background:none;border:none;color:#e74c3c;cursor:pointer;font-weight:bold;">✕</button>
                </div>
            </div>
            <div class="goal-desc">🗓 ${daysLabel} — ساعت ${timeLabel}</div>
            <div class="goal-desc">${r.repeat ? '🔁 هر هفته تکرار میشه' : '1️⃣ فقط همین یک‌بار'}</div>
            ${startDateLabel}
        `;
        div.querySelector('.edit-reminder-btn').onclick = function() {
            editReminderItem(i);
        };
        div.querySelector('.delete-reminder-btn').onclick = function() {
            askDeleteConfirmation('این یادآوری حذف بشه؟', function() {
                deleteReminder(i);
            });
        };
        container.appendChild(div);
    });
}

let editingReminderId = null;

// تاریخ (فرمت YYYY-MM-DD گرگوری، همون فرمت input[type=date]) رو به شماره‌ی روز هفته‌ای
// که بقیه‌ی برنامه استفاده می‌کنه (شنبه=۷ ... جمعه=۶، دقیقاً منطبق با Calendar.DAY_OF_WEEK
// توی کاتلین) تبدیل می‌کنه.
function getAppDayOfWeekFromDate(dateStr) {
    const d = new Date(dateStr + 'T00:00:00');
    return d.getDay() + 1; // JS: یکشنبه=۰...شنبه=۶  →  اپ: یکشنبه=۱...شنبه=۷
}

// روزهای هفته فقط وقتی معنی دارن که «تکرار هر هفته» فعال باشه؛ برای یادآوریِ یک‌بارمصرف
// روزش خودکار از روی تاریخ محاسبه میشه، پس این بخش رو مخفی می‌کنیم تا گیج‌کننده نباشه.
function updateReminderDaysPickerVisibility() {
    const repeatInput = document.getElementById('reminderRepeatInput');
    const daysPickerBox = document.getElementById('reminderDaysPicker');
    if (!repeatInput || !daysPickerBox) return;
    const wrapper = daysPickerBox.parentElement;
    if (wrapper) {
        wrapper.style.display = repeatInput.checked ? '' : 'none';
    }
}

function editReminderItem(index) {
    const list = JSON.parse(localStorage.getItem('planner_custom_reminders') || '[]');
    const r = list[index];
    if (!r) return;

    document.getElementById('reminderTextInput').value = r.text;
    document.getElementById('reminderTimeInput').value = String(r.hour).padStart(2, '0') + ':' + String(r.minute).padStart(2, '0');
    document.getElementById('reminderRepeatInput').checked = !!r.repeat;
    document.getElementById('reminderStartDateInput').value = r.startDate || '';
    document.querySelectorAll('#reminderDaysPicker input[type="checkbox"]').forEach(function(cb) {
        cb.checked = (r.days || []).indexOf(parseInt(cb.value, 10)) !== -1;
    });
    updateReminderDaysPickerVisibility();

    editingReminderId = r.id;
    const btn = document.getElementById('addReminderBtn');
    if (btn) btn.textContent = '💾 ذخیره ویرایش';

    const formSection = document.getElementById('remindersTab');
    if (formSection) formSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function addReminder() {
    const textInput = document.getElementById('reminderTextInput');
    const timeInput = document.getElementById('reminderTimeInput');
    const repeatInput = document.getElementById('reminderRepeatInput');
    const startDateInput = document.getElementById('reminderStartDateInput');
    const text = textInput.value.trim();
    const time = timeInput.value;
    const repeat = repeatInput.checked;

    // اگه تاریخ خالی گذاشته بشه، پیش‌فرض همین امروزه
    const startDate = startDateInput.value || getLocalDateKey();

    let days;
    if (repeat) {
        // حالت تکرار هفتگی: روزهایی که تیک زده شدن، به‌علاوه‌ی تاریخ شروع که از اون
        // به بعد این الگو فعال میشه
        const dayCheckboxes = document.querySelectorAll('#reminderDaysPicker input[type="checkbox"]:checked');
        days = Array.from(dayCheckboxes).map(function(cb) { return parseInt(cb.value, 10); });
        if (!text || !time || days.length === 0) return;
    } else {
        // حالت یک‌بارمصرف: فقط دقیقاً همون تاریخ و ساعت انتخابی، بدون در نظر گرفتن
        // چک‌باکس‌های روزهای هفته (روزش خودش از روی تاریخ محاسبه میشه)
        if (!text || !time || !startDate) return;
        days = [getAppDayOfWeekFromDate(startDate)];
    }

    const timeParts = time.split(':');
    const hour = parseInt(timeParts[0], 10);
    const minute = parseInt(timeParts[1], 10);

    const list = JSON.parse(localStorage.getItem('planner_custom_reminders') || '[]');
    let savedItem = null;

    if (editingReminderId !== null) {
        const idx = list.findIndex(function(r) { return String(r.id) === String(editingReminderId); });
        if (idx !== -1) {
            const oldDays = list[idx].days || [];
            if (window.AndroidInterface && window.AndroidInterface.cancelCustomReminder) {
                window.AndroidInterface.cancelCustomReminder(list[idx].id, oldDays.join(','));
            }
            list[idx] = { id: editingReminderId, text: text, hour: hour, minute: minute, days: days, repeat: repeat, startDate: startDate };
            savedItem = list[idx];
        }
        editingReminderId = null;
        const btn = document.getElementById('addReminderBtn');
        if (btn) btn.textContent = '➕ افزودن یادآوری';
    } else {
        const id = Math.floor(Date.now() / 1000) % 1000000;
        savedItem = { id: id, text: text, hour: hour, minute: minute, days: days, repeat: repeat, startDate: startDate };
        list.push(savedItem);
    }

    localStorage.setItem('planner_custom_reminders', JSON.stringify(list));

    if (savedItem && window.AndroidInterface && window.AndroidInterface.setCustomReminder) {
        window.AndroidInterface.setCustomReminder(savedItem.id, savedItem.text, savedItem.hour, savedItem.minute, savedItem.days.join(','), savedItem.repeat, savedItem.startDate);
    }

    textInput.value = '';
    timeInput.value = '';
    startDateInput.value = '';
    repeatInput.checked = true;
    document.querySelectorAll('#reminderDaysPicker input[type="checkbox"]').forEach(function(cb) { cb.checked = false; });
    updateReminderDaysPickerVisibility();
    loadReminders();
}

function deleteReminder(index) {
    const list = JSON.parse(localStorage.getItem('planner_custom_reminders') || '[]');
    const target = list[index];
    if (!target) return;

    if (editingReminderId !== null && String(editingReminderId) === String(target.id)) {
        editingReminderId = null;
        const btn = document.getElementById('addReminderBtn');
        if (btn) btn.textContent = '➕ افزودن یادآوری';
    }

    list.splice(index, 1);
    localStorage.setItem('planner_custom_reminders', JSON.stringify(list));

    if (window.AndroidInterface && window.AndroidInterface.cancelCustomReminder) {
        window.AndroidInterface.cancelCustomReminder(target.id, (target.days || []).join(','));
    }
    loadReminders();
}

function confirmAddNewTab() {
    const input = document.getElementById('newTabNameInput');
    const name = input.value.trim();
    if (!name) return;

    const tabs = JSON.parse(localStorage.getItem('planner_custom_tabs') || '[]');
    const id = `custom_${Date.now()}`;
    tabs.push({ id: id, name: name });
    localStorage.setItem('planner_custom_tabs', JSON.stringify(tabs));

    document.getElementById('addTabModal').classList.remove('open');
    loadCustomTabs();
    switchTab(id);
}

function loadCustomTabs() {
    const tabs = JSON.parse(localStorage.getItem('planner_custom_tabs') || '[]');
    const nav = document.getElementById('tabNav');
    const container = document.getElementById('customTabsContainer');
    if (!nav) return;

    document.querySelectorAll('.custom-tab-btn').forEach(function(el) { el.remove(); });
    const addBtn = document.getElementById('openAddTabModalBtn');

    tabs.forEach(function(tab) {
        const btn = document.createElement('button');
        btn.className = 'tab-btn custom-tab-btn';
        btn.setAttribute('data-tab', tab.id);
        btn.innerHTML = `<span>${tab.name}</span> <span style="margin-right:5px;color:#e74c3c;font-weight:bold;" onclick="removeCustomTab('${tab.id}', '${tab.name}', event)">✕</span>`;
        btn.onclick = function(e) { switchTab(tab.id, e); };

        if (addBtn) nav.insertBefore(btn, addBtn);
        else nav.appendChild(btn);

        if (container && !document.getElementById(`${tab.id}Tab`)) {
            const div = document.createElement('div');
            div.id = `${tab.id}Tab`;
            div.className = 'tab-content';
            div.innerHTML = `
                <section class="card">
                    <h3>📌 ${tab.name}</h3>
                    <div class="input-group">
                        <textarea id="input_${tab.id}" placeholder="مورد جدید..." rows="1" style="flex:1; background:#0d0f12; color:#fff; border:1px solid var(--card-border); border-radius:8px; padding:8px; font-family:inherit; font-size:0.85rem; resize:none;"></textarea>
                        <button onclick="addCustomItem('${tab.id}')">افزودن</button>
                    </div>
                    <ul id="list_${tab.id}" class="todo-list"></ul>
                </section>
            `;
            container.appendChild(div);
        }
        loadCustomItems(tab.id);
    });
}

function removeCustomTab(tabId, tabName, event) {
    event.stopPropagation();
    askDeleteConfirmation(`آیا از حذف کامل تب "${tabName}" مطمئن هستید؟`, function() {
        let tabs = JSON.parse(localStorage.getItem('planner_custom_tabs') || '[]');
        localStorage.setItem('planner_custom_tabs', JSON.stringify(tabs.filter(function(t) { return t.id !== tabId; })));
        localStorage.removeItem(`planner_${tabId}`);
        const tabElement = document.getElementById(`${tabId}Tab`);
        if (tabElement) tabElement.remove();
        switchTab('daily');
        loadCustomTabs();
    });
}

function addCustomItem(tabId) {
    const input = document.getElementById(`input_${tabId}`);
    if (!input || !input.value.trim()) return;
    const list = JSON.parse(localStorage.getItem(`planner_${tabId}`) || '[]');
    list.push({ text: input.value.trim(), completed: false, note: '' });
    localStorage.setItem(`planner_${tabId}`, JSON.stringify(list));
    input.value = '';
    loadCustomItems(tabId);
}

function loadCustomItems(tabId) {
    const list = JSON.parse(localStorage.getItem(`planner_${tabId}`) || '[]');
    const el = document.getElementById(`list_${tabId}`);
    if (!el) return;
    el.innerHTML = '';
    list.forEach(function(item, i) {
        const li = document.createElement('li');
        li.className = `todo-item ${item.completed ? 'completed' : ''}`;
        const hasNote = item.note && item.note.trim().length > 0;
        const formattedText = (item.text || '').replace(/\n/g, '<br>');

        li.innerHTML = `
            <label><input type="checkbox" ${item.completed ? 'checked' : ''} onchange="toggleCustomItem('${tabId}', ${i})"> <span>${formattedText}</span></label>
            <div class="todo-item-actions">
                <button class="edit-btn" style="background:none;border:none;color:var(--accent-gold);cursor:pointer;font-size:0.85rem;padding:2px;">✏️</button>
                <button class="note-btn" style="background:none;border:none;color:${hasNote ? '#f1c40f' : 'var(--accent-blue)'};cursor:pointer;font-size:0.85rem;padding:2px;">${hasNote ? '📌' : '📝'}</button>
                <button class="del-btn" style="background:none;border:none;color:#e74c3c;cursor:pointer;font-weight:bold;padding:2px;font-size:0.85rem;">✕</button>
            </div>
        `;

        li.dataset.itemText = item.text || '';
        li.dataset.itemNote = item.note || '';

        li.querySelector('.edit-btn').onclick = function() { openEditModal('custom', i, li.dataset.itemText, tabId); };
        li.querySelector('.note-btn').onclick = function() { openNoteModal('custom', i, li.dataset.itemText, li.dataset.itemNote, tabId); };
        li.querySelector('.del-btn').onclick = function() { confirmDeleteCustomItem(tabId, i); };

        el.appendChild(li);
    });
}

function confirmDeleteCustomItem(tabId, i) {
    askDeleteConfirmation(`آیا از حذف این مورد مطمئن هستید؟`, function() { deleteCustomItem(tabId, i); });
}

function toggleCustomItem(tabId, i) {
    const list = JSON.parse(localStorage.getItem(`planner_${tabId}`) || '[]');
    if(list[i]){
        list[i].completed = !list[i].completed;
        if(list[i].completed) playPopSound();
    }
    localStorage.setItem(`planner_${tabId}`, JSON.stringify(list));
    loadCustomItems(tabId);
}

function deleteCustomItem(tabId, i) {
    const list = JSON.parse(localStorage.getItem(`planner_${tabId}`) || '[]');
    list.splice(i, 1);
    localStorage.setItem(`planner_${tabId}`, JSON.stringify(list));
    loadCustomItems(tabId);
}

function saveReminderTimes() {
    const t1 = document.getElementById('reminderTime1').value;
    const t2 = document.getElementById('reminderTime2').value;
    if (!t1 && !t2) {
        alert("لطفاً حداقل یک ساعت یادآوری انتخاب کنید!");
        return;
    }
    if (t1) {
        localStorage.setItem('planner_reminder_time1', t1);
        const [h, m] = t1.split(':');
        if (window.AndroidInterface && window.AndroidInterface.setReminderTime) {
            window.AndroidInterface.setReminderTime(parseInt(h), parseInt(m), 1);
        }
    }
    if (t2) {
        localStorage.setItem('planner_reminder_time2', t2);
        const [h, m] = t2.split(':');
        if (window.AndroidInterface && window.AndroidInterface.setReminderTime) {
            window.AndroidInterface.setReminderTime(parseInt(h), parseInt(m), 2);
        }
    }
    alert("زمان‌های یادآوری روزانه با موفقیت تنظیم شدند!");
}

function loadReminderTimes() {
    document.getElementById('reminderTime1').value = localStorage.getItem('planner_reminder_time1') || "09:00";
    document.getElementById('reminderTime2').value = localStorage.getItem('planner_reminder_time2') || "21:00";

    const periodicDays = localStorage.getItem('planner_periodic_days');
    const periodicTime = localStorage.getItem('planner_periodic_time');
    if (periodicDays) document.getElementById('periodicDaysInput').value = periodicDays;
    if (periodicTime) document.getElementById('periodicTimeInput').value = periodicTime;

    const snooze1 = localStorage.getItem('planner_custom_snooze_1');
    const snooze2 = localStorage.getItem('planner_custom_snooze_2');
    if (snooze1) document.getElementById('customSnooze1Input').value = snooze1;
    if (snooze2) document.getElementById('customSnooze2Input').value = snooze2;
}

// دو تا گزینه‌ی تاخیرِ دلخواه (به دقیقه) که علاوه بر ۱۵/۳۰ دقیقه‌ی پیش‌فرض، توی صفحه‌ی
// تمام‌صفحه‌ی یادآوری نشون داده میشن. خالی گذاشتن یعنی همون گزینه غیرفعاله (۰ می‌فرسته)
function saveCustomSnoozeDurations() {
    const v1 = document.getElementById('customSnooze1Input').value;
    const v2 = document.getElementById('customSnooze2Input').value;
    const minutes1 = v1 ? Math.max(1, parseInt(v1, 10) || 0) : 0;
    const minutes2 = v2 ? Math.max(1, parseInt(v2, 10) || 0) : 0;

    if (minutes1) localStorage.setItem('planner_custom_snooze_1', String(minutes1));
    else localStorage.removeItem('planner_custom_snooze_1');

    if (minutes2) localStorage.setItem('planner_custom_snooze_2', String(minutes2));
    else localStorage.removeItem('planner_custom_snooze_2');

    if (window.AndroidInterface && window.AndroidInterface.setCustomSnoozeDurations) {
        window.AndroidInterface.setCustomSnoozeDurations(minutes1, minutes2);
    }

    alert("گزینه‌های تاخیر دلخواه ثبت شدند!");
}


function initCharts() {
    const dailyCtx = document.getElementById('dailyChart');
    if (dailyCtx) {
        dailyChart = new Chart(dailyCtx.getContext('2d'), {
            type: 'bar',
            data: {
                labels: ['عادات', 'تسک‌ها'],
                datasets: [{ label: 'درصد پیشرفت', data: [0, 0], backgroundColor: ['#f39c12', '#00cec9'], borderRadius: 6 }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: { y: { beginAtZero: true, max: 100 } }
            }
        });
    }
}

function updateDailyChart(data) {
    if (!dailyChart) return;
    const hDone = data.habits.length ? Math.round((data.habits.filter(function(h) { return h.completed; }).length / data.habits.length) * 100) : 0;
    const tDone = data.tasks.length ? Math.round((data.tasks.filter(function(t) { return t.completed; }).length / data.tasks.length) * 100) : 0;

    dailyChart.data.datasets[0].data = [hDone, tDone];
    dailyChart.update();

    const all = [...data.habits, ...data.tasks];
    document.getElementById('totalPercent').innerText = `${all.length ? Math.round((all.filter(function(i) { return i.completed; }).length / all.length) * 100) : 0}%`;
}

function openReportModal() {
    document.getElementById('reportModal').classList.add('open');
    populateHistorySelector();
    renderReport();
}

function closeReportModal() {
    document.getElementById('reportModal').classList.remove('open');
}

function switchReportType(type) {
    currentReportType = type;
    const mBtn = document.getElementById('monthlyReportTabBtn');
    const yBtn = document.getElementById('yearlyReportTabBtn');

    if (type === 'monthly') {
        mBtn.style.background = '#6c5ce7';
        mBtn.style.color = '#fff';
        yBtn.style.background = 'transparent';
        yBtn.style.color = '#aaa';
        document.getElementById('historySelectLabel').innerText = "انتخاب ماه:";
    } else {
        yBtn.style.background = '#6c5ce7';
        yBtn.style.color = '#fff';
        mBtn.style.background = 'transparent';
        mBtn.style.color = '#aaa';
        document.getElementById('historySelectLabel').innerText = "انتخاب سال:";
    }

    populateHistorySelector();
    renderReport();
}

function populateHistorySelector() {
    const selector = document.getElementById('historySelector');
    selector.innerHTML = '';
    const nowShamsi = getShamsiDetails(new Date());

    if (currentReportType === 'monthly') {
        shamsiMonthNames.forEach(function(mName, index) {
            const opt = document.createElement('option');
            opt.value = index + 1;
            opt.innerText = `${mName} ${nowShamsi.year}`;
            if ((index + 1) === nowShamsi.month) opt.selected = true;
            selector.appendChild(opt);
        });
    } else {
        for (let y = nowShamsi.year; y >= nowShamsi.year - 4; y--) {
            const opt = document.createElement('option');
            opt.value = y;
            opt.innerText = `سال ${y}`;
            if (y === nowShamsi.year) opt.selected = true;
            selector.appendChild(opt);
        }
    }
}

function renderReport() {
    if (currentReportType === 'monthly') renderMonthlyReport();
    else renderYearlyReport();
}

function renderMonthlyReport() {
    const selectedMonth = parseInt(document.getElementById('historySelector').value || getShamsiDetails(new Date()).month);
    const nowShamsi = getShamsiDetails(new Date());
    document.getElementById('reportAvgTitle').innerText = `میانگین پایبندی (${shamsiMonthNames[selectedMonth - 1]} ${nowShamsi.year}):`;

    const daysData = [];
    const labels = [];
    let totalSum = 0;
    const daysInMonth = selectedMonth <= 6 ? 31 : 30;

    for (let day = 1; day <= daysInMonth; day++) {
        const raw = localStorage.getItem(`planner_${getStoredKey(j2g(nowShamsi.year, selectedMonth, day))}`);
        let dayPercent = 0;
        if (raw) {
            try {
                const parsed = JSON.parse(raw);
                const all = [...(parsed.habits || []), ...(parsed.tasks || [])];
                if (all.length > 0) {
                    dayPercent = Math.round((all.filter(function(x) { return x.completed; }).length / all.length) * 100);
                }
            } catch(e) {}
        }
        daysData.push(dayPercent);
        labels.push(day % 2 === 1 ? day.toString() : '');
        totalSum += dayPercent;
    }

    const avg = Math.round(totalSum / daysInMonth);
    document.getElementById('reportAvgPercent').innerText = `${avg}%`;
    document.getElementById('reportMotivationalText').innerText = avg >= 80 ? "🔥 فوق‌العاده‌ای! در این ماه عالی درخشیدی." : (avg >= 50 ? "👏 عملکرد خوبی داشتی!" : "💪 به قدم‌های کوچک باور داشته باش.");
    drawReportChart(labels, daysData, 'پیشرفت روزانه', '#00cec9', 'rgba(0, 206, 201, 0.1)');
}

function renderYearlyReport() {
    const selectedYear = parseInt(document.getElementById('historySelector').value || getShamsiDetails(new Date()).year);
    document.getElementById('reportAvgTitle').innerText = `گزارش کامل سال ${selectedYear}:`;
    const monthsData = [];
    let totalYearSum = 0;

    for (let m = 1; m <= 12; m++) {
        let monthSum = 0;
        let daysInMonthCount = m <= 6 ? 31 : 30;

        for (let day = 1; day <= daysInMonthCount; day++) {
            const raw = localStorage.getItem(`planner_${getStoredKey(j2g(selectedYear, m, day))}`);
            if (raw) {
                try {
                    const parsed = JSON.parse(raw);
                    const all = [...(parsed.habits || []), ...(parsed.tasks || [])];
                    if (all.length > 0) {
                        monthSum += Math.round((all.filter(function(x) { return x.completed; }).length / all.length) * 100);
                    }
                } catch(e) {}
            }
        }
        const monthAvg = Math.round(monthSum / daysInMonthCount);
        monthsData.push(monthAvg);
        totalYearSum += monthAvg;
    }

    const displayAvg = (totalYearSum / 12).toFixed(1);
    document.getElementById('reportAvgPercent').innerText = `${displayAvg}%`;
    document.getElementById('reportMotivationalText').innerText = displayAvg >= 80 ? "👑 یک سال استقامت شاهکار!" : "🌟 تلاش مداوم مهمه، پرقدرت ادامه بده!";
    drawReportChart(shamsiMonthNames, monthsData, 'پیشرفت ماهانه', '#f1c40f', 'rgba(241, 196, 15, 0.1)');
}

function drawReportChart(labels, data, datasetLabel, color, bgColor) {
    const ctx = document.getElementById('reportChart');
    if (ctx) {
        if (reportChartInstance) reportChartInstance.destroy();
        reportChartInstance = new Chart(ctx.getContext('2d'), {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: datasetLabel,
                    data: data,
                    borderColor: color,
                    backgroundColor: bgColor,
                    fill: true,
                    tension: 0.3,
                    pointRadius: 4,
                    pointHoverRadius: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: { enabled: true, callbacks: { label: function(c) { return ` میزان پیشرفت: ${c.parsed.y}%`; } } }
                },
                scales: {
                    y: { beginAtZero: true, max: 100, ticks: { color: '#888' } },
                    x: { ticks: { color: '#888', font: { size: 9 } } }
                }
            }
        });
    }
}

let syncBackupDebounceTimer = null;
function scheduleBackupSync() {
    clearTimeout(syncBackupDebounceTimer);
    syncBackupDebounceTimer = setTimeout(function() {
        syncLatestBackupToAndroid();
    }, 1200);
}

function syncLatestBackupToAndroid() {
    if (window.AndroidInterface && window.AndroidInterface.syncLatestBackupData) {
        try {
            const dataStr = getBackupJSON();
            window.AndroidInterface.syncLatestBackupData(dataStr);
        } catch (e) {}
    }
}

// همگام‌سازی خودکار آخرین داده‌ها در حافظه کش اندروید برای پشتیبان‌گیری پس‌زمینه
(function() {
    const origSetItem = localStorage.setItem.bind(localStorage);
    localStorage.setItem = function(key, value) {
        origSetItem(key, value);
        if (typeof key === 'string' && key.startsWith('planner_')) {
            scheduleBackupSync();
        }
    };
})();

function getBackupJSON() {
    const backupData = {};
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key.startsWith('planner_')) backupData[key] = localStorage.getItem(key);
    }
    return JSON.stringify(backupData, null, 2);
}

function exportBackup() {
    const jsonString = getBackupJSON();
    syncLatestBackupToAndroid();
    if (window.AndroidInterface && window.AndroidInterface.saveBackupToFile) {
        window.AndroidInterface.saveBackupToFile(jsonString);
    } else {
        const blob = new Blob([jsonString], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL ? URL.createObjectURL(blob) : '';
        a.download = `planner_backup_${new Date().toISOString().split('T')[0]}.json`;
        a.click();
    }
}

function openBackupSettingsModal() {
    const modal = document.getElementById('backupSettingsModal');
    if (!modal) return;

    let settings = {
        autoEnabled: true,
        hour: 23,
        minute: 30,
        cloudEnabled: false,
        platform: 'bale',
        botToken: '',
        chatId: ''
    };

    if (window.AndroidInterface && window.AndroidInterface.getBackupSettings) {
        try {
            const raw = window.AndroidInterface.getBackupSettings();
            if (raw) {
                const parsed = JSON.parse(raw);
                settings = Object.assign(settings, parsed);
            }
        } catch (e) {}
    } else {
        try {
            const saved = localStorage.getItem('planner_auto_backup_settings');
            if (saved) settings = Object.assign(settings, JSON.parse(saved));
        } catch (e) {}
    }

    const autoToggle = document.getElementById('autoBackupToggle');
    const autoTime = document.getElementById('autoBackupTime');
    const cloudToggle = document.getElementById('cloudBackupToggle');
    const cloudContainer = document.getElementById('cloudFieldsContainer');
    const platformSelect = document.getElementById('cloudPlatformSelect');
    const botTokenInput = document.getElementById('cloudBotToken');
    const chatIdInput = document.getElementById('cloudChatId');

    if (autoToggle) autoToggle.checked = !!settings.autoEnabled;
    if (autoTime) {
        const h = String(settings.hour !== undefined ? settings.hour : 23).padStart(2, '0');
        const m = String(settings.minute !== undefined ? settings.minute : 30).padStart(2, '0');
        autoTime.value = `${h}:${m}`;
    }
    if (cloudToggle) {
        cloudToggle.checked = !!settings.cloudEnabled;
        if (cloudContainer) {
            cloudContainer.style.display = settings.cloudEnabled ? 'flex' : 'none';
        }
    }
    if (platformSelect) platformSelect.value = settings.platform || 'bale';
    if (botTokenInput) botTokenInput.value = settings.botToken || '';
    if (chatIdInput) chatIdInput.value = settings.chatId || '';

    modal.classList.add('open');
}

function closeBackupSettingsModal() {
    const modal = document.getElementById('backupSettingsModal');
    if (modal) modal.classList.remove('open');
}

function saveBackupSettings() {
    const autoToggle = document.getElementById('autoBackupToggle');
    const autoTime = document.getElementById('autoBackupTime');
    const cloudToggle = document.getElementById('cloudBackupToggle');
    const platformSelect = document.getElementById('cloudPlatformSelect');
    const botTokenInput = document.getElementById('cloudBotToken');
    const chatIdInput = document.getElementById('cloudChatId');

    const autoEnabled = autoToggle ? autoToggle.checked : true;
    const timeVal = (autoTime && autoTime.value) ? autoTime.value : '23:30';
    const timeParts = timeVal.split(':');
    const hour = parseInt(timeParts[0], 10) || 23;
    const minute = parseInt(timeParts[1], 10) || 30;

    const cloudEnabled = cloudToggle ? cloudToggle.checked : false;
    const platform = platformSelect ? platformSelect.value : 'bale';
    const botToken = botTokenInput ? botTokenInput.value.trim() : '';
    const chatId = chatIdInput ? chatIdInput.value.trim() : '';

    if (cloudEnabled && (!botToken || !chatId)) {
        alert('لطفاً توکن ربات و شناسه چت (Chat ID) را برای ارسال ابری وارد کنید.');
        return;
    }

    if (window.AndroidInterface && window.AndroidInterface.saveBackupSettings) {
        window.AndroidInterface.saveBackupSettings(hour, minute, autoEnabled, cloudEnabled, platform, botToken, chatId);
    } else {
        alert('تنظیمات بک‌آپ با موفقیت ذخیره شد ✅');
    }

    localStorage.setItem('planner_auto_backup_settings', JSON.stringify({
        autoEnabled: autoEnabled,
        hour: hour,
        minute: minute,
        cloudEnabled: cloudEnabled,
        platform: platform,
        botToken: botToken,
        chatId: chatId
    }));

    syncLatestBackupToAndroid();
    closeBackupSettingsModal();
}

function testCloudConnection() {
    const platformSelect = document.getElementById('cloudPlatformSelect');
    const botTokenInput = document.getElementById('cloudBotToken');
    const chatIdInput = document.getElementById('cloudChatId');

    const platform = platformSelect ? platformSelect.value : 'bale';
    const botToken = botTokenInput ? botTokenInput.value.trim() : '';
    const chatId = chatIdInput ? chatIdInput.value.trim() : '';

    if (!botToken || !chatId) {
        alert('لطفاً ابتدا توکن ربات و شناسه چت را وارد کنید.');
        return;
    }

    if (window.AndroidInterface && window.AndroidInterface.testCloudConnection) {
        window.AndroidInterface.testCloudConnection(platform, botToken, chatId);
    } else {
        alert('تست اتصال فقط درون نسخه اندروید اجرا می‌شود.');
    }
}

function getLocalDateKey(d) {
    const dt = d || new Date();
    return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}

function checkAutoBackup() {
    // در نسخه جدید (v3.2.0)، زمان‌بندی بک‌آپ خودکار و جبران زمان‌های خاموشی به صورت دقیق
    // توسط سیستم نیتیو اندروید (BackupScheduler و AlarmManager) مدیریت می‌شود.
    // بنابراین در اندروید کاری انجام نمی‌شود تا از ایجاد هرگونه بک‌آپ تکراری یا دوبل جلوگیری شود.
    if (window.AndroidInterface) {
        return;
    }

    const todayKey = getLocalDateKey();
    const lastBackupDate = localStorage.getItem('planner_last_auto_backup_date');
    if (lastBackupDate !== todayKey) {
        localStorage.setItem('planner_last_auto_backup_date', todayKey);
    }
}

function importBackup(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(evt) {
        try {
            const data = JSON.parse(evt.target.result);
            Object.keys(data).forEach(function(k) {
                localStorage.setItem(k, data[k]);
            });

            // اگه بک‌آپ مال قبل از این آپدیت بود، ممکنه کلیدهای هفتگی با فرمت قدیمی برگردن؛
            // همینجا دوباره مهاجرتشون می‌کنیم تا تسک‌های هفتگی گم نشن
            migrateLegacyWeeklyKeys();

            alert("پشتیبان‌گیری با موفقیت بازیابی شد!");

            currentDateOffset = 0;
            isUnlockedManually = false;
            updateDateDisplay();
            loadDayData();
            loadWeeklyData();
            loadMonthlyData();
            loadGoals();
            loadCustomTabs();
            loadReminders();
            loadReminderTimes();
            updateInstallStreakCounter();

            if (window.AndroidInterface) {
                const t1 = localStorage.getItem('planner_reminder_time1');
                const t2 = localStorage.getItem('planner_reminder_time2');
                if (t1 && window.AndroidInterface.setReminderTime) {
                    const p1 = t1.split(':');
                    window.AndroidInterface.setReminderTime(parseInt(p1[0], 10), parseInt(p1[1], 10), 1);
                }
                if (t2 && window.AndroidInterface.setReminderTime) {
                    const p2 = t2.split(':');
                    window.AndroidInterface.setReminderTime(parseInt(p2[0], 10), parseInt(p2[1], 10), 2);
                }
                if (window.AndroidInterface.setCustomReminder) {
                    const restoredReminders = JSON.parse(localStorage.getItem('planner_custom_reminders') || '[]');
                    restoredReminders.forEach(function(r) {
                        window.AndroidInterface.setCustomReminder(r.id, r.text, r.hour, r.minute, (r.days || []).join(','), r.repeat, r.startDate || '');
                    });
                }
                const periodicDays = localStorage.getItem('planner_periodic_days');
                const periodicTime = localStorage.getItem('planner_periodic_time');
                if (periodicDays && window.AndroidInterface.setPeriodicReminder) {
                    const pt = (periodicTime || '09:00').split(':');
                    window.AndroidInterface.setPeriodicReminder(
                        parseInt(periodicDays, 10), parseInt(pt[0], 10), parseInt(pt[1], 10),
                        "📅 یادآوری برنامه‌ریز", "وقتشه برنامه‌های هفتگی و ماهانه‌ت رو چک کنی!", 8001
                    );
                }

                // یادآوری اهداف (که تاریخ/ساعت مشخصی داشتن) هم باید دوباره توی اندروید فعال بشن؛
                // چون بک‌آپ فقط داده‌ی خودِ اهداف رو برمی‌گردونه، نه آلارم‌های اندرویدیشون رو
                if (window.AndroidInterface.setGoalReminder) {
                    const restoredGoals = JSON.parse(localStorage.getItem('planner_goals') || '[]');
                    restoredGoals.forEach(function(g) {
                        if (g.notifyDate && g.notifyTime) {
                            const targetDateTime = new Date(`${g.notifyDate}T${g.notifyTime}:00`).getTime();
                            if (targetDateTime > Date.now()) {
                                window.AndroidInterface.setGoalReminder(g.title || '', g.desc || '', targetDateTime, (g.id || Date.now()) % 100000);
                            }
                        }
                    });
                }

                // همین‌طور یادآوری تسک‌های هفتگی/ماهانه‌ی تاریخ‌دار، از روی همه‌ی کلیدهای
                // planner_weekly_* و planner_monthly_* که همین الان از بک‌آپ برگشتن
                if (window.AndroidInterface.setTaskReminder) {
                    for (let i = 0; i < localStorage.length; i++) {
                        const key = localStorage.key(i);
                        if (!key || !(key.startsWith('planner_weekly_') || key.startsWith('planner_monthly_'))) continue;

                        let list;
                        try {
                            list = JSON.parse(localStorage.getItem(key) || '[]');
                        } catch (e) { continue; }
                        if (!Array.isArray(list)) continue;

                        const typeLabel = key.startsWith('planner_weekly_') ? '🗓 تسک هفتگی' : '📌 برنامه ماهانه';
                        list.forEach(function(item) {
                            if (item && item.notifyDate && item.notifyTime && !item.completed) {
                                const targetDateTime = new Date(`${item.notifyDate}T${item.notifyTime}:00`).getTime();
                                if (targetDateTime > Date.now()) {
                                    window.AndroidInterface.setTaskReminder(item.text || '', typeLabel, targetDateTime, (item.id || Date.now()) % 100000);
                                }
                            }
                        });
                    }
                }
            }
        } catch (err) {
            alert("خطا در فرمت فایل بک آپ!");
        }
    };
    reader.readAsText(file);
}

function switchTab(tabName, evt, keepOffset) {
    document.querySelectorAll('.tab-btn').forEach(function(btn) { btn.classList.remove('active'); });
    document.querySelectorAll('.tab-content').forEach(function(content) { content.classList.remove('active'); });

    let targetBtn = evt ? evt.currentTarget : document.querySelector(`[data-tab="${tabName}"]`);
    if (targetBtn) targetBtn.classList.add('active');

    const targetContent = document.getElementById(`${tabName}Tab`);
    if (targetContent) targetContent.classList.add('active');

    if (tabName === 'weekly') {
        if (!keepOffset) currentWeekOffset = 0;
        loadWeeklyData();
    } else if (tabName === 'monthly') {
        if (!keepOffset) currentMonthOffset = 0;
        loadMonthlyData();
    } else if (tabName === 'daily') {
        if (!keepOffset) currentDateOffset = 0;
        loadDayData();
    } else if (tabName === 'reminders') {
        loadReminders();
    }
}

function openExternalBrowser(url) {
    if (window.AndroidInterface && window.AndroidInterface.openExternalUrl) {
        window.AndroidInterface.openExternalUrl(url);
    } else {
        window.open(url, '_blank');
    }
}

function copyDonateText(text, label) {
    let copiedInAndroid = false;
    if (window.AndroidInterface && window.AndroidInterface.copyToClipboard) {
        window.AndroidInterface.copyToClipboard(text, label);
        copiedInAndroid = true;
    }

    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(function() {
            if (!copiedInAndroid) {
                alert(label + " با موفقیت کپی شد! ✅");
            }
        }).catch(function() {
            if (!copiedInAndroid) {
                fallbackCopyText(text, label);
            }
        });
    } else if (!copiedInAndroid) {
        fallbackCopyText(text, label);
    }
}

function fallbackCopyText(text, label) {
    const tempInput = document.createElement('input');
    tempInput.value = text;
    document.body.appendChild(tempInput);
    tempInput.select();
    try {
        document.execCommand('copy');
        alert(label + " با موفقیت کپی شد! ✅");
    } catch (e) {
        prompt("لطفاً این مقدار را دستی کپی کنید:", text);
    }
    document.body.removeChild(tempInput);
}