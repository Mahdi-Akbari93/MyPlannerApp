// تنظیمات دیتابیس Supabase بدون تحریم
const SUPABASE_URL = "https://buvaqnotwjxgrhsynwfa.supabase.co";
const SUPABASE_KEY = "sb_publishable_a7nPQ2mCfnjgHfZT6B_41w_2477JKGN";
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let currentDateOffset = 0;
let dailyChart = null;

document.addEventListener("DOMContentLoaded", () => {
    setupEventListeners();
    updateDateDisplay();
    initChart();
    loadDayData();
});

function setupEventListeners() {
    document.getElementById('prevDayBtn').addEventListener('click', () => changeDay(-1));
    document.getElementById('nextDayBtn').addEventListener('click', () => changeDay(1));
    document.getElementById('menuBtn').addEventListener('click', toggleMenu);
    document.getElementById('closeMenuBtn').addEventListener('click', toggleMenu);
    document.getElementById('menuOverlay').addEventListener('click', toggleMenu);

    document.getElementById('addHabitBtn').addEventListener('click', addHabit);
    document.getElementById('addTaskBtn').addEventListener('click', addTask);

    document.getElementById('habitInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') addHabit(); });
    document.getElementById('taskInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') addTask(); });

    document.getElementById('exportBtn').addEventListener('click', exportBackup);
    document.getElementById('importFile').addEventListener('change', importBackup);
}

function toggleMenu() {
    document.getElementById('sideMenu').classList.toggle('open');
    document.getElementById('menuOverlay').classList.toggle('open');
}

function getSelectedDate() {
    const d = new Date();
    d.setDate(d.getDate() + currentDateOffset);
    return d;
}

function getStoredKey() {
    const d = getSelectedDate();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function changeDay(offset) {
    currentDateOffset += offset;
    updateDateDisplay();
    loadDayData();
}

function updateDateDisplay() {
    const d = getSelectedDate();
    const gregorianStr = d.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    const shamsiStr = d.toLocaleDateString('fa-IR', { year: 'numeric', month: 'long', day: 'numeric' });
    const dayNameStr = d.toLocaleDateString('fa-IR', { weekday: 'long' });

    document.getElementById('dayName').innerText = currentDateOffset === 0 ? `امروز (${dayNameStr})` : dayNameStr;
    document.getElementById('shamsiDate').innerText = shamsiStr;
    document.getElementById('gregorianDate').innerText = gregorianStr;
}

function updateSyncUI(status) {
    const dot = document.getElementById('syncDot');
    const text = document.getElementById('syncText');
    if (status === 'synced') {
        dot.className = 'sync-dot green';
        text.innerText = 'همگام شد';
    } else if (status === 'syncing') {
        dot.className = 'sync-dot yellow';
        text.innerText = 'سینک...';
    } else {
        dot.className = 'sync-dot red';
        text.innerText = 'آفلاین';
    }
}

// عادات ثابت (الگو)
function getMasterHabits() {
    return JSON.parse(localStorage.getItem('planner_master_habits') || '[]');
}

function getStoredData() {
    const key = getStoredKey();
    const raw = localStorage.getItem(`planner_${key}`);
    const masterHabits = getMasterHabits();

    if (!raw) {
        const habits = masterHabits.map(h => ({ id: Date.now() + Math.random(), text: h, completed: false }));
        return { habits, tasks: [] };
    }

    try {
        const parsed = JSON.parse(raw);
        let habits = Array.isArray(parsed.habits) ? parsed.habits : [];

        masterHabits.forEach(m => {
            if (!habits.some(h => h.text === m)) {
                habits.push({ id: Date.now() + Math.random(), text: m, completed: false });
            }
        });

        return { habits, tasks: Array.isArray(parsed.tasks) ? parsed.tasks : [] };
    } catch (e) {
        return { habits: [], tasks: [] };
    }
}

async function saveData(data) {
    const key = getStoredKey();
    localStorage.setItem(`planner_${key}`, JSON.stringify(data));
    updateChart(data);

    // سینک آنلاین با دیتابیس بدون تحریم
    updateSyncUI('syncing');
    try {
        const { error } = await supabaseClient
            .from('planner_data')
            .upsert({ id: key, data: data, updated_at: new Date() });

        if (error) throw error;
        updateSyncUI('synced');
    } catch (err) {
        console.error("Sync Error:", err);
        updateSyncUI('offline');
    }
}

async function loadDayData() {
    const key = getStoredKey();

    // تلاش برای دریافت آخرین نسخه از ابر
    try {
        const { data, error } = await supabaseClient
            .from('planner_data')
            .select('data')
            .eq('id', key)
            .single();

        if (data && data.data) {
            localStorage.setItem(`planner_${key}`, JSON.stringify(data.data));
            updateSyncUI('synced');
        }
    } catch (e) { updateSyncUI('offline'); }

    const localData = getStoredData();
    const habitsList = document.getElementById('habitsList');
    const tasksList = document.getElementById('tasksList');

    habitsList.innerHTML = '';
    tasksList.innerHTML = '';

    localData.habits.forEach(item => renderItem(item, 'habits', habitsList));
    localData.tasks.forEach(item => renderItem(item, 'tasks', tasksList));

    updateChart(localData);
}

function renderItem(item, type, listElement) {
    const li = document.createElement('li');
    li.className = `todo-item ${item.completed ? 'completed' : ''}`;
    li.innerHTML = `
        <label style="display:flex;align-items:center;gap:8px;cursor:pointer;">
            <input type="checkbox" ${item.completed ? 'checked' : ''}>
            <span>${item.text}</span>
        </label>
        <button style="background:none;border:none;color:#e74c3c;cursor:pointer;font-weight:bold;">✕</button>
    `;

    li.querySelector('input').addEventListener('change', () => toggleItem(type, item.id));
    li.querySelector('button').addEventListener('click', () => deleteItem(type, item.id));

    listElement.appendChild(li);
}

function addHabit() {
    const input = document.getElementById('habitInput');
    const val = input.value.trim();
    if (!val) return;

    const master = getMasterHabits();
    if (!master.includes(val)) {
        master.push(val);
        localStorage.setItem('planner_master_habits', JSON.stringify(master));
    }

    const data = getStoredData();
    data.habits.push({ id: Date.now(), text: val, completed: false });
    saveData(data);

    input.value = '';
    loadDayData();
}

function addTask() {
    const input = document.getElementById('taskInput');
    const val = input.value.trim();
    if (!val) return;

    const data = getStoredData();
    data.tasks.push({ id: Date.now(), text: val, completed: false });
    saveData(data);

    input.value = '';
    loadDayData();
}

function toggleItem(type, id) {
    const data = getStoredData();
    const target = data[type].find(i => i.id === id);
    if (target) {
        target.completed = !target.completed;
        saveData(data);
        loadDayData();
    }
}

function deleteItem(type, id) {
    const data = getStoredData();
    const index = data[type].findIndex(i => i.id === id);
    if (index !== -1) {
        const deleted = data[type].splice(index, 1);
        if (type === 'habits' && deleted.length) {
            let master = getMasterHabits().filter(m => m !== deleted[0].text);
            localStorage.setItem('planner_master_habits', JSON.stringify(master));
        }
        saveData(data);
        loadDayData();
    }
}

function initChart() {
    const ctx = document.getElementById('dailyChart').getContext('2d');
    dailyChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['عادات', 'تسک‌ها'],
            datasets: [{ data: [0, 0], backgroundColor: ['#f39c12', '#00cec9'], borderRadius: 6 }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: { y: { beginAtZero: true, max: 100 } }
        }
    });
}

function updateChart(data) {
    if (!dailyChart) return;
    const hDone = data.habits.length ? Math.round((data.habits.filter(h => h.completed).length / data.habits.length) * 100) : 0;
    const tDone = data.tasks.length ? Math.round((data.tasks.filter(t => t.completed).length / data.tasks.length) * 100) : 0;

    dailyChart.data.datasets[0].data = [hDone, tDone];
    dailyChart.update();

    const all = [...data.habits, ...data.tasks];
    const total = all.length ? Math.round((all.filter(i => i.completed).length / all.length) * 100) : 0;
    document.getElementById('totalPercent').innerText = `${total}%`;
}

function exportBackup() {
    const backupData = {};
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key.startsWith('planner_')) {
            backupData[key] = localStorage.getItem(key);
        }
    }
    const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `planner_backup_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
}

function importBackup(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(evt) {
        try {
            const data = JSON.parse(evt.target.result);
            Object.keys(data).forEach(k => localStorage.setItem(k, data[k]));
            alert("پشتیبان‌گیری بازیابی شد!");
            loadDayData();
        } catch (err) {
            alert("خطا در بازگردانی فایل!");
        }
    };
    reader.readAsText(file);
}