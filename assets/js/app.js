/* ============================================================
   کارنگار - فایل اصلی برنامه
   ============================================================ */

const load = document.getElementById("lode");
const display = document.getElementById("display");
const titleTaskinput = document.getElementById("titletask");
const titledisinput = document.getElementById("taskDiscript");
const taskPriceInput = document.getElementById("taskPrice");
const taskDeadlineInput = document.getElementById("taskDeadline");
const formTitle = document.getElementById("form-title");
const formIcon = document.getElementById("form-icon");
const submitText = document.getElementById("submit-text");
const create2 = document.getElementById("create2");
const cancelForm = document.getElementById("cancelForm");
const ask = document.getElementById("ask");
const adduserback = document.getElementById("addblur");
const fabAdd = document.getElementById("fabAdd");
const from = document.getElementById("from");
const searchInput = document.getElementById("search");
const switchCheckDefault = document.getElementById("switchCheckDefault");
const switchCheckDarken = document.getElementById("switchCheckDarken");
const nodeleted = document.getElementById("nodeleted");
const yasdelete = document.getElementById("yasdelete");
const enableNotifBtn = document.getElementById("enableNotif");
const exportPdfBtn = document.getElementById("exportPdfBtn");
const toastContainer = document.getElementById("toast-container");
const invoicePreview = document.getElementById("invoicePreview");
const invoiceRenderArea = document.getElementById("invoiceRenderArea");
const shareInvoiceBtn = document.getElementById("shareInvoiceBtn");
const closePreviewBtn = document.getElementById("closePreviewBtn");

let db = null;
let currentSearchTerm = "";
let showOnlyCompleted = false;
let editingTaskId = null;
let selectedDeadline = null;
let notifiedTasks = new Set();
let pendingDeleteId = null;
let datepickerReady = false;
let datepickerInstance = null;
let loaderHidden = false;
let activeFilter = "all";
let swRegistration = null;
let notifTimers = new Map();
let currentInvoiceTaskId = null;
let currentInvoiceBlob = null;
let notifEnabled = false;
let deadlineWatcherInterval = null;

const STORE_NAME = "صورتحساب";
const STORE_TAGLINE = "";

const PERSIAN_DIGITS = "۰۱۲۳۴۵۶۷۸۹";
const ARABIC_DIGITS = "٠١٢٣٤٥٦٧٨٩";

const NOTIF_PREF_KEY = "yaddashyar_notif_enabled";

/* ============================================================
   توابع کمکی عدد و قیمت
   ============================================================ */
function toEnglishDigits(str) {
  if (str === null || str === undefined) return "";
  return String(str).replace(/[۰-۹٠-٩]/g, (d) => {
    const pIdx = PERSIAN_DIGITS.indexOf(d);
    if (pIdx !== -1) return String(pIdx);
    const aIdx = ARABIC_DIGITS.indexOf(d);
    if (aIdx !== -1) return String(aIdx);
    return d;
  });
}

function extractDigits(str) {
  if (!str) return "";
  return toEnglishDigits(String(str)).replace(/[^\d]/g, "");
}

function parsePrice(priceStr) {
  const digits = extractDigits(priceStr);
  if (!digits) return 0;
  const num = parseInt(digits, 10);
  return isNaN(num) ? 0 : num;
}

function formatPrice(price) {
  if (price === null || price === undefined || price === "") return "";
  const num = typeof price === "number" ? price : parsePrice(price);
  if (!num || isNaN(num) || num === 0) return "";
  return num.toLocaleString("fa-IR");
}

function formatPriceInputLive(input) {
  if (!input) return;
  const rawValue = input.value;
  const caretPos = input.selectionStart || 0;
  const digitsBeforeCaret = extractDigits(rawValue.slice(0, caretPos)).length;
  const allDigits = extractDigits(rawValue);
  if (!allDigits) { input.value = ""; return; }
  const cleanDigits = allDigits.replace(/^0+/, "") || "0";
  const num = parseInt(cleanDigits, 10);
  if (isNaN(num)) { input.value = ""; return; }
  const formatted = num.toLocaleString("en-US");
  let newCaret = formatted.length;
  if (digitsBeforeCaret > 0) {
    let count = 0;
    for (let i = 0; i < formatted.length; i++) {
      if (/\d/.test(formatted[i])) {
        count++;
        if (count === digitsBeforeCaret) { newCaret = i + 1; break; }
      }
    }
  }
  input.value = formatted;
  try { input.setSelectionRange(newCaret, newCaret); } catch (e) {}
}

/* ============================================================
   تبدیل رشته تاریخ شمسی به Date میلادی
   ============================================================ */
function parsePersianDateString(str) {
  if (!str || !str.trim()) return null;
  if (typeof persianDate === "undefined") return null;
  try {
    const normalized = toEnglishDigits(str);
    const m = normalized.match(/(\d{4})\/(\d{1,2})\/(\d{1,2})\s+(\d{1,2}):(\d{1,2})/);
    if (!m) return null;

    const pd = new persianDate();
    pd.year(parseInt(m[1], 10));
    pd.month(parseInt(m[2], 10));
    pd.date(parseInt(m[3], 10));
    pd.hour(parseInt(m[4], 10));
    pd.minute(parseInt(m[5], 10));

    const d = pd.toDate();
    if (d instanceof Date && !isNaN(d.getTime())) return d;
    return null;
  } catch (e) {
    console.warn("parsePersianDateString error:", e);
    return null;
  }
}

/* ============================================================
   لودر
   ============================================================ */
function hideLoader() {
  if (loaderHidden || !load) return;
  loaderHidden = true;
  try {
    load.style.transition = "opacity 0.4s ease";
    load.style.opacity = "0";
    load.style.pointerEvents = "none";
    setTimeout(() => {
      load.style.display = "none";
      load.classList.add("dis-hide");
    }, 450);
  } catch (e) { load.style.display = "none"; }
}

window.addEventListener("load", () => setTimeout(hideLoader, 500));
if (document.readyState === "complete" || document.readyState === "interactive") {
  setTimeout(hideLoader, 800);
} else {
  document.addEventListener("DOMContentLoaded", () => setTimeout(hideLoader, 800));
}
setTimeout(hideLoader, 2500);
window.addEventListener("error", hideLoader);

/* ============================================================
   ذخیره و بازیابی وضعیت نوتیفیکیشن
   ============================================================ */
function saveNotifPref(enabled) {
  try { localStorage.setItem(NOTIF_PREF_KEY, enabled ? "1" : "0"); } catch (e) {}
}

function loadNotifPref() {
  try { return localStorage.getItem(NOTIF_PREF_KEY) === "1"; } catch (e) { return false; }
}

function updateNotifButtonUI() {
  if (!enableNotifBtn) return;
  const icon = enableNotifBtn.querySelector("i");
  const label = enableNotifBtn.querySelector("span");

  if (notifEnabled) {
    enableNotifBtn.classList.add("active");
    if (icon) icon.className = "bi bi-bell-fill";
    if (label) label.textContent = "روشن";
  } else {
    enableNotifBtn.classList.remove("active");
    if (icon) icon.className = "bi bi-bell-slash";
    if (label) label.textContent = "اعلان";
  }
}

async function enableNotifications() {
  if (!("Notification" in window)) {
    showToast("مرورگر شما از نوتیفیکیشن پشتیبانی نمی‌کند", "warning");
    return false;
  }
  try {
    let perm = Notification.permission;
    if (perm === "default") {
      perm = await Notification.requestPermission();
    }
    if (perm !== "granted") {
      showToast("اجازه نوتیفیکیشن داده نشد", "danger");
      notifEnabled = false;
      saveNotifPref(false);
      updateNotifButtonUI();
      return false;
    }
    notifEnabled = true;
    saveNotifPref(true);
    updateNotifButtonUI();
    showToast("نوتیفیکیشن فعال شد ✅", "success");

    if (swRegistration && "periodicSync" in swRegistration) {
      try {
        await swRegistration.periodicSync.register("check-deadlines", {
          minInterval: 60 * 60 * 1000,
        });
        console.log("[App] ✅ Periodic Sync registered");
      } catch (err) {
        console.warn("[App] Periodic Sync not available:", err);
      }
    }

    setTimeout(() => {
      if (swRegistration && notifEnabled) {
        swRegistration.showNotification("🎉 نوتیفیکیشن فعال شد", {
          body: "از این به بعد یادآوری‌ها روی گوشی شما نمایش داده میشه",
          icon: "./assets/img/maskable-512.png",
          badge: "./assets/img/maskable-512.png",
          vibrate: [200, 100, 200],
          tag: "test-enabled",
          requireInteraction: false,
        }).catch(() => {});
      }
    }, 800);

    scheduleAllDeadlineTimers();
    return true;
  } catch (err) {
    showToast("خطا در فعال‌سازی نوتیفیکیشن", "danger");
    return false;
  }
}

function disableNotifications() {
  notifEnabled = false;
  saveNotifPref(false);
  updateNotifButtonUI();
  notifTimers.forEach((timer, key) => {
    if (String(key).startsWith("repeat-")) clearInterval(timer);
    else clearTimeout(timer);
  });
  notifTimers.clear();
  notifiedTasks.clear();
  if (swRegistration && "periodicSync" in swRegistration) {
    try {
      swRegistration.periodicSync.unregister("check-deadlines").catch(() => {});
    } catch (err) {}
  }
  showToast("نوتیفیکیشن خاموش شد 🔕", "info");
}

async function toggleNotifications() {
  if (notifEnabled) disableNotifications();
  else await enableNotifications();
}

/* ============================================================
   Service Worker
   ============================================================ */
async function registerSW() {
  if (!("serviceWorker" in navigator)) return;
  try {
    swRegistration = await navigator.serviceWorker.register("./service-worker.js");
    console.log("[App] ✅ SW registered");

    if (notifEnabled && "periodicSync" in swRegistration) {
      try {
        await swRegistration.periodicSync.register("check-deadlines", {
          minInterval: 60 * 60 * 1000,
        });
      } catch (err) {}
    }
    navigator.serviceWorker.addEventListener("message", handleSWMessage);
  } catch (err) {
    console.warn("[App] SW registration failed:", err);
  }
}

function handleSWMessage(event) {
  const data = event.data || {};
  if (data.type === "MARK_DONE" && data.taskId != null) {
    updateTaskStatus(data.taskId, true);
    showToast("✅ تسک انجام شد", "success");
    cancelNotifTimer(data.taskId);
  }
}

/* ============================================================
   تقویم شمسی
   ============================================================ */
function tryInitDatepicker() {
  if (datepickerReady) return true;
  if (typeof jQuery === "undefined") return false;
  if (!jQuery.fn || !jQuery.fn.persianDatepicker) return false;

  const input = document.getElementById("taskDeadline");
  if (!input) return false;

  try {
    try {
      const oldInstance = jQuery(input).data("persianDatepicker");
      if (oldInstance) jQuery(input).persianDatepicker("destroy");
    } catch (e) {}

    jQuery(input).persianDatepicker({
      format: "YYYY/MM/DD HH:mm",
      initialValue: false,
      autoClose: true,
      persianDigit: true,
      observer: true,
      calendar: {
        persian: {
          locale: "fa",
          showHint: true,
          leapYearMode: "algorithmic",
        },
      },
      timePicker: {
        enabled: true,
        meridiem: { enabled: false },
        second: { enabled: false },
        minute: { enabled: true, step: 1 },
        hour: { enabled: true },
      },
      toolbox: {
        calendarSwitch: { enabled: false },
        todayButton: { enabled: true, text: { fa: "امروز" } },
        submitButton: { enabled: true, text: { fa: "تأیید" } },
      },
      onSelect: function (unix) {
        if (unix && !isNaN(unix)) {
          selectedDeadline = new Date(unix);
          updateClearDeadlineBtn(true);
        }
      },
    });

    datepickerReady = true;
    datepickerInstance = jQuery(input).data("persianDatepicker");
    console.log("✅ Datepicker ready");
    return true;
  } catch (e) {
    console.warn("⚠️ Datepicker init failed:", e);
    return false;
  }
}

let dpAttempts = 0;
const dpInterval = setInterval(() => {
  dpAttempts++;
  if (tryInitDatepicker() || dpAttempts > 20) {
    clearInterval(dpInterval);
  }
}, 250);

/* ============================================================
   نظارت روی input تاریخ
   ============================================================ */
function startDeadlineWatcher() {
  if (!taskDeadlineInput) return;
  if (deadlineWatcherInterval) return;

  taskDeadlineInput.addEventListener("input", handleDeadlineInputChange);
  taskDeadlineInput.addEventListener("change", handleDeadlineInputChange);
  taskDeadlineInput.addEventListener("blur", handleDeadlineInputChange);

  deadlineWatcherInterval = setInterval(() => {
    handleDeadlineInputChange();
  }, 500);
}

function handleDeadlineInputChange() {
  if (!taskDeadlineInput) return;
  const val = taskDeadlineInput.value.trim();

  if (!val) {
    if (selectedDeadline) {
      selectedDeadline = null;
      updateClearDeadlineBtn(false);
    }
    return;
  }

  if (!selectedDeadline) {
    const parsed = parsePersianDateString(val);
    if (parsed) {
      selectedDeadline = parsed;
      updateClearDeadlineBtn(true);
    }
  }
}

/* ============================================================
   دکمه پاک کردن ددلاین
   ============================================================ */
function updateClearDeadlineBtn(show) {
  const btn = document.getElementById("clearDeadlineBtn");
  if (!btn) return;
  if (show && taskDeadlineInput && taskDeadlineInput.value.trim()) {
    btn.classList.remove("dis-hide");
  } else {
    btn.classList.add("dis-hide");
  }
}

function clearDeadline() {
  selectedDeadline = null;
  if (taskDeadlineInput) taskDeadlineInput.value = "";
  updateClearDeadlineBtn(false);
}

/* ============================================================
   تم تاریک
   ============================================================ */
try {
  switchCheckDarken?.addEventListener("click", () => {
    document.body.classList.toggle("dark-background");
    const icon = switchCheckDarken.querySelector("i");
    if (!icon) return;
    if (document.body.classList.contains("dark-background")) {
      icon.classList.remove("bi-moon-stars");
      icon.classList.add("bi-sun");
    } else {
      icon.classList.remove("bi-sun");
      icon.classList.add("bi-moon-stars");
    }
  });
} catch (e) {}

/* ============================================================
   توابع تاریخ
   ============================================================ */
function formatPersianDate(date) {
  try {
    return new Intl.DateTimeFormat("fa-IR", { year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
  } catch (e) { return date.toLocaleDateString("fa-IR"); }
}

function formatPersianTime(date) {
  try {
    return new Intl.DateTimeFormat("fa-IR", { hour: "2-digit", minute: "2-digit", hour12: false }).format(date);
  } catch (e) { return date.toLocaleTimeString("fa-IR"); }
}

function formatPersianDateTime(date) {
  try {
    return new Intl.DateTimeFormat("fa-IR", {
      year: "numeric", month: "long", day: "numeric",
      hour: "2-digit", minute: "2-digit", hour12: false,
    }).format(date);
  } catch (e) { return date.toString(); }
}

function dateToPersianInput(date) {
  if (typeof persianDate === "undefined") return "";
  try {
    const pd = new persianDate(new Date(date));
    const pad = (n) => String(n).padStart(2, "0");
    return `${pd.year()}/${pad(pd.month())}/${pad(pd.date())} ${pad(pd.hour())}:${pad(pd.minute())}`;
  } catch (e) { return ""; }
}

function timeUntil(targetDate) {
  const now = new Date();
  const diff = targetDate - now;
  const absDiff = Math.abs(diff);
  const minutes = Math.floor(absDiff / 60000);
  const hours = Math.floor(absDiff / 3600000);
  const days = Math.floor(absDiff / 86400000);
  let text;
  if (minutes < 60) text = `${minutes} دقیقه`;
  else if (hours < 24) text = `${hours} ساعت`;
  else text = `${days} روز`;
  return diff >= 0 ? `${text} دیگر` : `${text} گذشته`;
}

function getDeadlineStatus(deadline) {
  if (!deadline) return null;
  const now = new Date();
  const diff = deadline - now;
  const hours = diff / 3600000;
  if (diff < 0) return "overdue";
  if (hours < 24) return "urgent";
  if (hours < 72) return "soon";
  return "normal";
}

/* ============================================================
   IndexedDB
   ============================================================ */
function openDatabase() {
  try {
    const request = window.indexedDB.open("To do", 6);
    request.onerror = () => {
      showToast("خطا در باز کردن دیتابیس", "danger");
      hideLoader();
    };
    request.onsuccess = () => {
      db = request.result;
      try {
        displayData();
        setTimeout(checkMissedNotifications, 1500);
        setTimeout(scheduleAllDeadlineTimers, 2000);
      } catch (e) {}
    };
    request.onupgradeneeded = (e) => {
      const dbLocal = e.target.result;
      let store;
      if (!dbLocal.objectStoreNames.contains("To do")) {
        store = dbLocal.createObjectStore("To do", { keyPath: "id", autoIncrement: true });
        store.createIndex("Title", "Title", { unique: false });
        store.createIndex("Body", "Body", { unique: false });
        store.createIndex("completed", "completed", { unique: false });
        store.createIndex("createdAt", "createdAt", { unique: false });
        store.createIndex("deadline", "deadline", { unique: false });
      } else {
        store = e.currentTarget.transaction.objectStore("To do");
        if (!store.indexNames.contains("completed")) store.createIndex("completed", "completed", { unique: false });
        if (!store.indexNames.contains("createdAt")) store.createIndex("createdAt", "createdAt", { unique: false });
        if (!store.indexNames.contains("deadline")) store.createIndex("deadline", "deadline", { unique: false });
      }
    };
  } catch (e) { hideLoader(); }
}

/* ============================================================
   CRUD
   ============================================================ */
function getDeadlineForSave() {
  if (selectedDeadline instanceof Date && !isNaN(selectedDeadline.getTime())) {
    return selectedDeadline;
  }
  if (taskDeadlineInput && taskDeadlineInput.value.trim()) {
    const parsed = parsePersianDateString(taskDeadlineInput.value);
    if (parsed) return parsed;
  }
  return null;
}

function addData(callback) {
  if (!db) { showToast("دیتابیس آماده نیست", "danger"); return; }
  try {
    const priceValue = parsePrice(taskPriceInput?.value || "");
    const deadlineToSave = getDeadlineForSave();

    const newItem = {
      Title: titleTaskinput.value.trim(),
      Body: titledisinput.value.trim(),
      Price: priceValue,
      completed: false,
      createdAt: new Date(),
      deadline: deadlineToSave,
      lastNotificationAt: null,
    };
    const tx = db.transaction(["To do"], "readwrite");
    const req = tx.objectStore("To do").add(newItem);
    req.onsuccess = () => {
      const newId = req.result;
      if (newItem.deadline && !newItem.completed && notifEnabled) {
        scheduleDeadlineTimer(newId, new Date(newItem.deadline), newItem.Title);
      }
    };
    tx.oncomplete = () => { callback?.(); displayData(); };
    tx.onerror = () => showToast("خطا در ذخیره یادداشت", "danger");
  } catch (e) {
    showToast("خطا در ذخیره یادداشت", "danger");
  }
}

function updateTask(id, updates, callback) {
  if (!db) return;
  try {
    const tx = db.transaction(["To do"], "readwrite");
    const store = tx.objectStore("To do");
    const req = store.get(id);
    req.onsuccess = () => {
      const data = req.result;
      if (!data) return;
      Object.assign(data, updates);
      store.put(data);
      tx.oncomplete = () => {
        if (data.completed) cancelNotifTimer(id);
        else if (data.deadline && notifEnabled) scheduleDeadlineTimer(id, new Date(data.deadline), data.Title);
        callback?.();
        displayData();
      };
    };
  } catch (e) {}
}

function updateTaskStatus(id, completed) {
  updateTask(id, { completed }, () => {
    if (showOnlyCompleted) displayData();
    if (completed) cancelNotifTimer(id);
  });
}

function deleteData(id) {
  if (!db) return;
  try {
    const tx = db.transaction(["To do"], "readwrite");
    tx.objectStore("To do").delete(id);
    tx.oncomplete = () => { cancelNotifTimer(id); displayData(); };
  } catch (e) {}
}

function getAllTasks() {
  return new Promise((resolve) => {
    if (!db) return resolve([]);
    try {
      const tx = db.transaction(["To do"], "readonly");
      const req = tx.objectStore("To do").getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => resolve([]);
    } catch (e) { resolve([]); }
  });
}

function getTaskById(id) {
  return new Promise((resolve) => {
    if (!db) return resolve(null);
    try {
      const tx = db.transaction(["To do"], "readonly");
      const req = tx.objectStore("To do").get(id);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    } catch (e) { resolve(null); }
  });
}

/* ============================================================
   فیلتر
   ============================================================ */
function searchTasks(term) {
  currentSearchTerm = term.toLowerCase().trim();
  displayData();
}

function toggleCompletedTasks() {
  showOnlyCompleted = !showOnlyCompleted;
  if (showOnlyCompleted) activeFilter = "done";
  else if (activeFilter === "done") activeFilter = "all";
  updateActiveCard();
  displayData();
}

function setFilter(filter) {
  if (!["all", "done", "urgent"].includes(filter)) return;
  if (activeFilter === filter && !(filter === "done" && !showOnlyCompleted)) {
    if (filter === "done" && !showOnlyCompleted) {
      showOnlyCompleted = true;
      if (switchCheckDefault) switchCheckDefault.checked = true;
      displayData();
    }
    return;
  }
  activeFilter = filter;
  if (filter === "done") {
    showOnlyCompleted = true;
    if (switchCheckDefault) switchCheckDefault.checked = true;
  } else {
    showOnlyCompleted = false;
    if (switchCheckDefault) switchCheckDefault.checked = false;
  }
  updateActiveCard();
  displayData();
}

function updateActiveCard() {
  document.querySelectorAll(".stat-card").forEach((card) => {
    card.classList.toggle("active", card.dataset.filter === activeFilter);
  });
}

/* ============================================================
   رندر
   ============================================================ */
function displayData() {
  if (!db || !from) return;
  try {
    while (from.firstChild) from.removeChild(from.firstChild);
    const tx = db.transaction(["To do"], "readonly");
    const req = tx.objectStore("To do").index("createdAt").openCursor(null, "prev");
    let totalCount = 0;
    let totalDone = 0;
    let totalUrgent = 0;
    let visibleCount = 0;
    req.onsuccess = (e) => {
      const cursor = e.target.result;
      if (!cursor) {
        updateStats(totalCount, totalDone, totalUrgent);
        if (visibleCount === 0) {
          if (currentSearchTerm) showNoResultsMessage();
          else if (activeFilter === "done" || showOnlyCompleted) showNoCompletedTasksMessage();
          else if (activeFilter === "urgent") showNoUrgentTasksMessage();
          else checkEmptyTasks();
        }
        updateCount(visibleCount, totalCount);
        return;
      }
      const value = cursor.value;
      const title = (value.Title || "").trim();
      const description = (value.Body || "").trim();
      const price = value.Price || 0;
      const completed = value.completed || false;
      const taskId = value.id;
      const createdAt = value.createdAt ? new Date(value.createdAt) : new Date();
      const deadline = value.deadline ? new Date(value.deadline) : null;
      if (title !== "") {
        totalCount++;
        if (completed) totalDone++;
        if (deadline && !completed) {
          const st = getDeadlineStatus(deadline);
          if (st === "urgent" || st === "overdue") totalUrgent++;
        }
      }
      if (title === "") { cursor.continue(); return; }
      if (showOnlyCompleted && !completed) { cursor.continue(); return; }
      if (activeFilter === "done" && !completed) { cursor.continue(); return; }
      if (activeFilter === "urgent") {
        if (completed) { cursor.continue(); return; }
        if (!deadline) { cursor.continue(); return; }
        const st = getDeadlineStatus(deadline);
        if (st !== "urgent" && st !== "overdue") { cursor.continue(); return; }
      }
      if (currentSearchTerm) {
        const tMatch = title.toLowerCase().includes(currentSearchTerm);
        const dMatch = description.toLowerCase().includes(currentSearchTerm);
        if (!tMatch && !dMatch) { cursor.continue(); return; }
      }
      visibleCount++;
      try {
        from.appendChild(buildTaskElement({ taskId, title, description, price, completed, createdAt, deadline }));
      } catch (err) {}
      cursor.continue();
    };
  } catch (e) {}
}

/* ============================================================
   ساخت کارت یادداشت
   ============================================================ */
function buildTaskElement({ taskId, title, description, price, completed, createdAt, deadline }) {
  const task = document.createElement("div");
  task.className = "task";
  task.dataset.id = taskId;
  const deadlineStatus = deadline ? getDeadlineStatus(deadline) : null;
  if (completed) task.classList.add("task-completed");
  else if (deadlineStatus === "overdue") task.classList.add("priority-overdue");
  else if (deadlineStatus === "urgent") task.classList.add("priority-urgent");

  const header = document.createElement("div");
  header.className = "task-header";
  const titleEl = document.createElement("div");
  titleEl.className = "task-title";
  if (currentSearchTerm && title.toLowerCase().includes(currentSearchTerm)) {
    const safe = currentSearchTerm.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(`(${safe})`, "gi");
    titleEl.innerHTML = title.replace(re, '<span class="bg-warning px-1 rounded">$1</span>');
  } else {
    titleEl.textContent = title;
  }
  if (completed) titleEl.style.textDecoration = "line-through";
  header.appendChild(titleEl);

  if (deadline) {
    const badge = document.createElement("span");
    badge.className = "task-badge";
    if (completed) {
      badge.classList.add("badge-done");
      badge.innerHTML = `<i class="bi bi-check2"></i> انجام شد`;
    } else if (deadlineStatus === "overdue") {
      badge.classList.add("badge-overdue");
      badge.innerHTML = `<i class="bi bi-exclamation-triangle-fill"></i> ${timeUntil(deadline)}`;
    } else if (deadlineStatus === "urgent") {
      badge.classList.add("badge-urgent");
      badge.innerHTML = `<i class="bi bi-alarm-fill"></i> ${timeUntil(deadline)}`;
    } else if (deadlineStatus === "soon") {
      badge.classList.add("badge-soon");
      badge.innerHTML = `<i class="bi bi-clock-fill"></i> ${timeUntil(deadline)}`;
    } else {
      badge.classList.add("badge-normal");
      badge.innerHTML = `<i class="bi bi-clock"></i> ${timeUntil(deadline)}`;
    }
    header.appendChild(badge);
  }

  const descEl = document.createElement("div");
  descEl.className = "task-desc";
  if (description) {
    if (currentSearchTerm && description.toLowerCase().includes(currentSearchTerm)) {
      const safe = currentSearchTerm.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const re = new RegExp(`(${safe})`, "gi");
      descEl.innerHTML = description.replace(re, '<span class="bg-warning px-1 rounded">$1</span>');
    } else {
      descEl.textContent = description;
    }
    if (completed) descEl.style.textDecoration = "line-through";
  } else {
    descEl.textContent = "بدون توضیحات";
    descEl.style.opacity = "0.5";
    descEl.style.fontStyle = "italic";
  }
  task.appendChild(header);
  task.appendChild(descEl);

  if (price && price > 0) {
    const priceEl = document.createElement("div");
    priceEl.className = "task-price";
    priceEl.innerHTML = `<i class="bi bi-cash-coin"></i><span>${formatPrice(price)} تومان</span>`;
    task.appendChild(priceEl);
  }

  const metaEl = document.createElement("div");
  metaEl.className = "task-meta";
  metaEl.innerHTML = `
    <div class="meta-row">
      <i class="bi bi-calendar-plus"></i>
      <span>ساخته شده: ${formatPersianDate(createdAt)} - ${formatPersianTime(createdAt)}</span>
    </div>
    ${deadline ? `
      <div class="meta-row ${deadlineStatus === "overdue" && !completed ? "text-danger fw-bold" : ""}">
        <i class="bi bi-alarm"></i>
        <span>تاریخ تنظیم : ${formatPersianDate(deadline)} - ${formatPersianTime(deadline)}</span>
      </div>
    ` : ""}
  `;
  task.appendChild(metaEl);

  const actions = document.createElement("div");
  actions.className = "task-actions";
  const doneToggle = document.createElement("label");
  doneToggle.className = "done-toggle";
  doneToggle.innerHTML = `
    <input type="checkbox" ${completed ? "checked" : ""}>
    <span class="check-icon"><i class="bi bi-check-lg"></i></span>
    <span class="${completed ? "text-success fw-bold" : ""}">
      ${completed ? "انجام شده" : "انجام نشده"}
    </span>
  `;
  const checkbox = doneToggle.querySelector("input");
  checkbox.addEventListener("change", () => { updateTaskStatus(taskId, checkbox.checked); });

  const btnGroup = document.createElement("div");
  btnGroup.className = "btn-group-actions";
  const shareBtn = document.createElement("button");
  shareBtn.type = "button";
  shareBtn.className = "action-btn share";
  shareBtn.innerHTML = '<i class="bi bi-share-fill"></i>';
  shareBtn.title = "اشتراک‌گذاری فاکتور";
  shareBtn.addEventListener("click", () => openInvoicePreview(taskId));
  const editBtn = document.createElement("button");
  editBtn.type = "button";
  editBtn.className = "action-btn edit";
  editBtn.innerHTML = '<i class="bi bi-pencil"></i>';
  editBtn.title = "ویرایش";
  editBtn.addEventListener("click", () => openEditForm(taskId));
  const delBtn = document.createElement("button");
  delBtn.type = "button";
  delBtn.className = "action-btn delete";
  delBtn.innerHTML = '<i class="bi bi-trash3"></i>';
  delBtn.title = "حذف";
  delBtn.addEventListener("click", () => openDeleteConfirm(taskId));
  btnGroup.appendChild(shareBtn);
  btnGroup.appendChild(editBtn);
  btnGroup.appendChild(delBtn);
  actions.appendChild(doneToggle);
  actions.appendChild(btnGroup);
  task.appendChild(actions);

  return task;
}

/* ============================================================
   فرم
   ============================================================ */
function openCreateForm() {
  resetForm();
  formTitle.textContent = "یادداشت جدید";
  submitText.textContent = "ذخیره";
  formIcon.className = "bi bi-plus-circle";
  display.classList.remove("dis-hide");
  adduserback.classList.remove("dis-hide");
  setTimeout(() => titleTaskinput?.focus(), 100);
}

function openEditForm(id) {
  if (!db) return;
  try {
    const tx = db.transaction(["To do"], "readonly");
    const req = tx.objectStore("To do").get(id);
    req.onsuccess = () => {
      const data = req.result;
      if (!data) return;
      editingTaskId = id;
      titleTaskinput.value = data.Title || "";
      titledisinput.value = data.Body || "";
      if (taskPriceInput) {
        if (data.Price && data.Price > 0) {
          taskPriceInput.value = Number(data.Price).toLocaleString("en-US");
        } else {
          taskPriceInput.value = "";
        }
      }
      if (data.deadline) {
        const d = new Date(data.deadline);
        if (!isNaN(d.getTime())) {
          selectedDeadline = d;
          if (taskDeadlineInput) taskDeadlineInput.value = dateToPersianInput(d);
          updateClearDeadlineBtn(true);
        }
      } else {
        selectedDeadline = null;
        if (taskDeadlineInput) taskDeadlineInput.value = "";
        updateClearDeadlineBtn(false);
      }
      formTitle.textContent = "ویرایش یادداشت";
      submitText.textContent = "ذخیره";
      formIcon.className = "bi bi-pencil-square";
      display.classList.remove("dis-hide");
      adduserback.classList.remove("dis-hide");
    };
  } catch (e) {}
}

function resetForm() {
  editingTaskId = null;
  selectedDeadline = null;
  if (titleTaskinput) titleTaskinput.value = "";
  if (titledisinput) titledisinput.value = "";
  if (taskPriceInput) taskPriceInput.value = "";
  if (taskDeadlineInput) taskDeadlineInput.value = "";
  if (formTitle) formTitle.textContent = "یادداشت جدید";
  if (submitText) submitText.textContent = "ذخیره";
  if (formIcon) formIcon.className = "bi bi-plus-circle";
  updateClearDeadlineBtn(false);
}

function closeForm() {
  display?.classList.add("dis-hide");
  adduserback?.classList.add("dis-hide");
  resetForm();
}

/* ============================================================
   حذف
   ============================================================ */
function openDeleteConfirm(taskId) {
  pendingDeleteId = taskId;
  ask.classList.remove("dis-hide");
  adduserback.classList.remove("dis-hide");
}

function closeDeleteConfirm() {
  pendingDeleteId = null;
  ask.classList.add("dis-hide");
  adduserback.classList.add("dis-hide");
}

function confirmDelete() {
  if (pendingDeleteId !== null) {
    deleteData(pendingDeleteId);
    showToast("یادداشت حذف شد", "success");
  }
  closeDeleteConfirm();
}

/* ============================================================
   پیام‌های خالی
   ============================================================ */
function showNoResultsMessage() {
  from.innerHTML = `<div class="empty-state"><h5>نتیجه‌ای یافت نشد</h5><p>هیچ یادداشتی با عبارت «${currentSearchTerm}» پیدا نشد</p></div>`;
}

function showNoCompletedTasksMessage() {
  from.innerHTML = `<div class="empty-state"><h5>یادداشت انجام‌شده‌ای وجود ندارد</h5><p>هنوز هیچ یادداشتی را انجام نداده‌اید</p></div>`;
}

function showNoUrgentTasksMessage() {
  from.innerHTML = `<div class="empty-state"><h5>تسک فوری‌ای وجود ندارد</h5><p>هیچ یادداشتی با وضعیت فوری یا گذشته نیست</p></div>`;
}

function checkEmptyTasks() {
  const old = document.getElementById("empty-msg");
  if (old) old.remove();
  setTimeout(() => {
    if (!from) return;
    if (from.querySelector(".task")) return;
    if (from.querySelector(".empty-state")) return;
    const msg = document.createElement("div");
    msg.id = "empty-msg";
    msg.className = "empty-state";
    msg.innerHTML = `<h5>هیچ یادداشتی نداری!</h5><p>برای شروع روی دکمه + پایین صفحه کلیک کن</p>`;
    from.appendChild(msg);
  }, 100);
}

/* ============================================================
   شمارنده و آمار
   ============================================================ */
function updateCount(visibleCount, totalCount) {
  setTimeout(() => {
    const countEl = document.getElementById("count");
    if (!countEl || !from) return;
    const visible = from.querySelectorAll(".task").length;
    countEl.textContent = visible;
    const noFilter = !currentSearchTerm && !showOnlyCompleted && activeFilter === "all";
    if (noFilter) checkEmptyTasks();
  }, 100);
}

function updateStats(total, done, urgent) {
  const elTotal = document.getElementById("stat-total");
  const elDone = document.getElementById("stat-done");
  const elUrgent = document.getElementById("stat-urgent");
  if (elTotal) elTotal.textContent = total;
  if (elDone) elDone.textContent = done;
  if (elUrgent) elUrgent.textContent = urgent;
}

/* ============================================================
   فاکتور
   ============================================================ */
async function openInvoicePreview(taskId) {
  const task = await getTaskById(taskId);
  if (!task) { showToast("تسک پیدا نشد", "danger"); return; }
  currentInvoiceTaskId = taskId;
  currentInvoiceBlob = null;
  invoiceRenderArea.innerHTML = buildInvoiceHTML(task);
  invoicePreview.classList.remove("dis-hide");
  document.body.style.overflow = "hidden";
  setTimeout(() => generateInvoiceImage(), 300);
}

function closeInvoicePreview() {
  invoicePreview.classList.add("dis-hide");
  document.body.style.overflow = "";
  invoiceRenderArea.innerHTML = "";
  currentInvoiceTaskId = null;
  currentInvoiceBlob = null;
}

function buildInvoiceHTML(task) {
  const title = escapeHtml(task.Title || "بدون عنوان");
  const description = task.Body ? escapeHtml(task.Body) : "";
  const price = task.Price || 0;
  const createdAt = task.createdAt ? new Date(task.createdAt) : new Date();
  const deadline = task.deadline ? new Date(task.deadline) : null;
  const invoiceNo = "INV-" + String(task.id).padStart(6, "0");
  const ff = "'Vazirmatn','Vazir','IRANSans',Tahoma,Arial,sans-serif";

  const row = (label, value, bold) => `
    <div dir="rtl" style="display:flex;justify-content:space-between;align-items:center;font-family:${ff};font-size:12px;padding:5px 0;direction:rtl;letter-spacing:0;">
      <span style="color:#64748b;font-weight:500;letter-spacing:0;">${label}</span>
      <span style="color:#1e293b;font-weight:${bold ? "800" : "700"};direction:rtl;white-space:nowrap;letter-spacing:0;">${value}</span>
    </div>`;

  const rows = [];
  rows.push(row("📅 تاریخ ثبت", `${formatPersianDate(createdAt)} - ${formatPersianTime(createdAt)}`));
  if (deadline) {
    rows.push(row("⏰ تاریخ تحویل", `${formatPersianDate(deadline)} - ${formatPersianTime(deadline)}`));
  }
  if (price > 0) {
    rows.push(row("💰 مبلغ", `${formatPrice(price)} تومان`, true));
  }

  const totalHTML = price > 0 ? `
    <div dir="rtl" style="background:#ecfdf5;border:2px solid #10b981;border-radius:14px;padding:16px 18px;margin-top:14px;display:flex;justify-content:space-between;align-items:center;font-family:${ff};direction:rtl;">
      <span style="font-size:14px;font-weight:800;color:#065f46;letter-spacing:0;direction:rtl;">🧾 جمع کل قابل پرداخت</span>
      <span style="font-size:18px;font-weight:800;color:#059669;letter-spacing:0;white-space:nowrap;direction:rtl;">${formatPrice(price)} <span style="font-size:11px;font-weight:500;opacity:0.85;">تومان</span></span>
    </div>` : "";

  return `
    <div class="invoice-card" id="invoiceCard" dir="rtl" lang="fa" style="width:100%;max-width:100%;background:#ffffff;color:#1e293b;font-family:${ff};border-radius:20px;overflow:hidden;direction:rtl;text-align:right;box-shadow:0 4px 20px rgba(0,0,0,0.08);">

      <div class="invoice-header" style="background:linear-gradient(135deg,#1e40af 0%,#2563eb 50%,#3b82f6 100%);color:#ffffff;padding:24px 22px;direction:rtl;position:relative;">
        <h1 class="invoice-store-name" dir="rtl" lang="fa" style="font-family:${ff};font-size:22px;font-weight:800;margin:0 0 8px 0;padding:0;color:#ffffff;line-height:1.7;letter-spacing:0;word-spacing:0;direction:rtl;text-align:right;white-space:nowrap;overflow:visible;">${STORE_NAME}</h1>
        <span dir="rtl" lang="fa" style="display:inline-block;background:rgba(255,255,255,0.22);color:#ffffff;padding:5px 14px;border-radius:99px;font-size:11px;font-weight:700;border:1px solid rgba(255,255,255,0.4);font-family:${ff};letter-spacing:0;">✅ فاکتور رسمی</span>
      </div>

      <div style="height:4px;background:repeating-linear-gradient(90deg,#2563eb 0,#2563eb 10px,transparent 10px,transparent 20px,#10b981 20px,#10b981 30px,transparent 30px,transparent 40px);opacity:0.3;"></div>

      <div dir="rtl" style="padding:18px 22px;display:flex;justify-content:space-between;gap:12px;background:#f8fafc;border-bottom:1px dashed #cbd5e1;font-family:${ff};direction:rtl;">
        <div dir="rtl" style="display:flex;flex-direction:column;gap:4px;">
          <span style="font-size:10px;color:#64748b;font-weight:600;letter-spacing:0;">شماره فاکتور</span>
          <span style="font-size:13px;color:#1e293b;font-weight:700;letter-spacing:0;direction:ltr;">${invoiceNo}</span>
        </div>
        <div dir="rtl" style="display:flex;flex-direction:column;gap:4px;">
          <span style="font-size:10px;color:#64748b;font-weight:600;letter-spacing:0;">تاریخ صدور</span>
          <span style="font-size:13px;color:#1e293b;font-weight:700;letter-spacing:0;">${formatPersianDate(new Date())}</span>
        </div>
      </div>

      <div dir="rtl" style="padding:20px 22px;direction:rtl;">
        <h3 dir="rtl" lang="fa" style="display:flex;align-items:center;gap:8px;font-size:13px;font-weight:700;color:#1e40af;margin:0 0 12px 0;padding:0 0 8px 0;border-bottom:2px solid #e0e7ff;font-family:${ff};letter-spacing:0;direction:rtl;text-align:right;">
          📦 جزئیات سفارش
        </h3>

        <div dir="rtl" style="background:#f8fafc;border-radius:12px;padding:14px 16px;border-right:4px solid #2563eb;font-family:${ff};direction:rtl;">
          <h4 dir="rtl" lang="fa" style="font-size:15px;font-weight:800;color:#0f172a;margin:0 0 6px 0;font-family:${ff};letter-spacing:0;line-height:1.7;direction:rtl;text-align:right;word-break:keep-all;">${title}</h4>
          ${description ? `<p dir="rtl" lang="fa" style="font-size:12px;color:#64748b;margin:0 0 10px 0;line-height:1.7;font-family:${ff};letter-spacing:0;direction:rtl;text-align:right;">${description}</p>` : ""}
          <div dir="rtl" style="display:flex;flex-direction:column;gap:2px;direction:rtl;">
            ${rows.join("")}
          </div>
        </div>

        ${totalHTML}
      </div>

      <div dir="rtl" style="padding:16px 22px 20px;background:#f8fafc;text-align:center;border-top:1px dashed #cbd5e1;font-family:${ff};direction:rtl;">
        <p dir="rtl" lang="fa" style="font-size:14px;font-weight:800;color:#1e40af;margin:0 0 6px 0;font-family:${ff};letter-spacing:0;">سپاس از خرید شما سپاسگزاریم</p>
        <p dir="rtl" lang="fa" style="font-size:11px;color:#64748b;margin:0;line-height:1.8;font-family:${ff};letter-spacing:0;">جهت سفارشات بیشتر و پیگیری با ما در تماس باشید</p>
      </div>

    </div>
  `;
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

async function generateInvoiceImage() {
  if (typeof html2canvas === "undefined") return null;
  const card = document.getElementById("invoiceCard");
  if (!card) return null;
  try {
    if (document.fonts && document.fonts.ready) {
      try { await document.fonts.ready; } catch (e) {}
    }
    await new Promise((r) => setTimeout(r, 250));
    const canvas = await html2canvas(card, {
      scale: 2,
      backgroundColor: "#ffffff",
      useCORS: true,
      allowTaint: false,
      logging: false,
      imageTimeout: 15000,
      width: card.scrollWidth,
      height: card.scrollHeight,
      windowWidth: card.scrollWidth,
      windowHeight: card.scrollHeight,
    });
    return new Promise((resolve) => {
      canvas.toBlob((blob) => {
        currentInvoiceBlob = blob;
        resolve(blob);
      }, "image/png", 1.0);
    });
  } catch (err) { return null; }
}

async function shareInvoice() {
  if (!currentInvoiceTaskId) { showToast("خطا: تسک انتخاب نشده", "danger"); return; }
  const task = await getTaskById(currentInvoiceTaskId);
  if (!task) { showToast("تسک پیدا نشد", "danger"); return; }
  if (!currentInvoiceBlob) {
    showToast("در حال آماده‌سازی تصویر...", "info");
    await generateInvoiceImage();
  }
  if (!currentInvoiceBlob) { showToast("خطا در ساخت تصویر فاکتور", "danger"); return; }
  const fileName = `invoice-${task.id}-${Date.now()}.png`;
  const file = new File([currentInvoiceBlob], fileName, { type: "image/png" });
  const shareText = `🧾 فاکتور از ${STORE_NAME}\n\n📦 ${task.Title}${
    task.Price ? `\n💰 مبلغ: ${formatPrice(task.Price)} تومان` : ""
  }\n\n🙏 از خرید شما سپاسگزاریم`;
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: `فاکتور ${STORE_NAME}`, text: shareText });
      showToast("✅ فاکتور اشتراک‌گذاری شد", "success");
    } catch (err) {
      if (err.name === "AbortError") return;
      downloadInvoiceImage(fileName);
    }
  } else {
    showToast("اشتراک‌گذاری مستقیم پشتیبانی نمی‌شود. تصویر دانلود شد.", "info");
    downloadInvoiceImage(fileName);
  }
}

function downloadInvoiceImage(fileName) {
  if (!currentInvoiceBlob) return;
  const url = URL.createObjectURL(currentInvoiceBlob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName || `invoice-${Date.now()}.png`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/* ============================================================
   نوتیفیکیشن (محلی)
   ============================================================ */
function scheduleDeadlineTimer(taskId, deadline, title) {
  if (!notifEnabled) return;
  cancelNotifTimer(taskId);
  const now = Date.now();
  const deadlineMs = deadline.getTime();
  const diff = deadlineMs - now;
  if (diff <= 0) {
    sendDeadlineNotification(taskId, title, true);
    startRepeatTimer(taskId, title);
    return;
  }
  const timer = setTimeout(() => {
    if (!notifEnabled) return;
    sendDeadlineNotification(taskId, title, false);
    startRepeatTimer(taskId, title);
  }, diff);
  notifTimers.set(taskId, timer);
}

function startRepeatTimer(taskId, title) {
  if (!notifEnabled) return;
  const existingKey = "repeat-" + taskId;
  if (notifTimers.has(existingKey)) clearInterval(notifTimers.get(existingKey));
  const repeatTimer = setInterval(async () => {
    if (!notifEnabled) { cancelNotifTimer(taskId); return; }
    const task = await getTaskById(taskId);
    if (!task || task.completed) { cancelNotifTimer(taskId); return; }
    sendDeadlineNotification(taskId, title, true);
  }, 24 * 60 * 60 * 1000);
  notifTimers.set(existingKey, repeatTimer);
}

function cancelNotifTimer(taskId) {
  if (notifTimers.has(taskId)) {
    clearTimeout(notifTimers.get(taskId));
    notifTimers.delete(taskId);
  }
  const repeatKey = "repeat-" + taskId;
  if (notifTimers.has(repeatKey)) {
    clearInterval(notifTimers.get(repeatKey));
    notifTimers.delete(repeatKey);
  }
}

async function sendDeadlineNotification(taskId, title, isOverdue) {
  if (!notifEnabled) return;
  if (!("Notification" in window)) return;
  if (Notification.permission !== "granted") return;

  const notifTitle = isOverdue ? "🔴 موعد کار رسید!" : "⏰ یادآوری کار";
  const notifBody = `"${title}" هنوز انجام نشده`;

  if (swRegistration && "showNotification" in swRegistration) {
    try {
      await swRegistration.showNotification(notifTitle, {
        body: notifBody,
        icon: "./assets/img/maskable-512.png",
        badge: "./assets/img/maskable-512.png",
        tag: "task-" + taskId,
        renotify: true,
        requireInteraction: true,
        vibrate: [300, 100, 300, 100, 300],
        data: { taskId, url: "./" },
        actions: [
          { action: "done", title: "✅ انجام شد" },
          { action: "snooze", title: "⏰ ۲ ساعت بعد" },
        ],
      });
    } catch (err) {
      sendBasicNotification(notifTitle, notifBody, taskId);
    }
  } else {
    sendBasicNotification(notifTitle, notifBody, taskId);
  }
  updateTaskLastNotif(taskId, new Date().toISOString());
}

function sendBasicNotification(title, body, taskId) {
  if (!notifEnabled) return;
  if (!("Notification" in window)) return;
  if (Notification.permission !== "granted") return;
  try {
    const notif = new Notification(title, {
      body,
      icon: "./assets/img/maskable-512.png",
      badge: "./assets/img/maskable-512.png",
      tag: "task-" + taskId,
      requireInteraction: true,
      vibrate: [300, 100, 300, 100, 300],
    });
    notif.onclick = () => { window.focus(); notif.close(); };
  } catch (e) {}
}

function updateTaskLastNotif(taskId, isoString) {
  if (!db) return;
  try {
    const tx = db.transaction(["To do"], "readwrite");
    const store = tx.objectStore("To do");
    const req = store.get(taskId);
    req.onsuccess = () => {
      const data = req.result;
      if (!data) return;
      data.lastNotificationAt = isoString;
      store.put(data);
    };
  } catch (e) {}
}

async function checkMissedNotifications() {
  if (!notifEnabled) return;
  const tasks = await getAllTasks();
  const now = Date.now();
  for (const task of tasks) {
    if (task.completed || !task.deadline) continue;
    const deadline = new Date(task.deadline).getTime();
    if (deadline > now) continue;
    const lastNotif = task.lastNotificationAt ? new Date(task.lastNotificationAt).getTime() : 0;
    const hoursSinceLast = (now - lastNotif) / 3600000;
    if (lastNotif === 0 || hoursSinceLast >= 24) {
      setTimeout(() => {
        if (notifEnabled) sendDeadlineNotification(task.id, task.Title, true);
      }, 1500);
    }
  }
}

async function scheduleAllDeadlineTimers() {
  if (!notifEnabled) return;
  const tasks = await getAllTasks();
  for (const task of tasks) {
    if (task.completed || !task.deadline) continue;
    scheduleDeadlineTimer(task.id, new Date(task.deadline), task.Title);
  }
}

/* ============================================================
   PWA Install Popup — نسخه بهبودیافته برای همه پلتفرم‌ها
   ============================================================ */
let deferredPrompt = null;

window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  deferredPrompt = e;
  console.log("✅ Install prompt captured");
  if (localStorage.getItem("pwa-install-dismissed") !== "true") {
    setTimeout(showPwaPopup, 1500);
  }
});

window.addEventListener("appinstalled", () => {
  console.log("🎉 PWA installed");
  hidePwaPopup();
  localStorage.setItem("pwa-install-dismissed", "true");
  showToast("اپ با موفقیت نصب شد 🎉", "success");
});

function isIOS() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent) ||
         (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

function isStandalone() {
  return window.matchMedia("(display-mode: standalone)").matches ||
         window.navigator.standalone === true;
}

function showPwaPopup() {
  if (isStandalone()) {
    console.log("[PWA] Already installed");
    return;
  }
  if (localStorage.getItem("pwa-install-dismissed") === "true") {
    console.log("[PWA] User dismissed before");
    return;
  }

  const popup = document.getElementById("pwaInstallPopup");
  const installBtn = document.getElementById("pwaInstallBtn");
  const iosSteps = document.getElementById("pwaIosInstructions");
  if (!popup) {
    console.warn("[PWA] Popup element missing");
    return;
  }

  // ریست هر دو
  installBtn.classList.add("dis-hide");
  iosSteps.classList.add("dis-hide");

  if (isIOS()) {
    console.log("[PWA] iOS mode → instructions");
    iosSteps.classList.remove("dis-hide");
  } else {
    console.log("[PWA] Non-iOS mode → install button");
    installBtn.classList.remove("dis-hide");
  }

  popup.classList.remove("dis-hide");
  console.log("[PWA] Popup shown");
}

function hidePwaPopup() {
  document.getElementById("pwaInstallPopup")?.classList.add("dis-hide");
}

document.getElementById("pwaInstallBtn")?.addEventListener("click", async () => {
  if (!deferredPrompt) {
    console.log("[PWA] No deferredPrompt — showing manual instructions");
    showToast("برای نصب، از منوی مرورگر گزینه Add to Home Screen رو بزن", "info");
    return;
  }
  deferredPrompt.prompt();
  const { outcome } = await deferredPrompt.userChoice;
  console.log("[PWA] Install outcome:", outcome);
  if (outcome === "accepted") {
    hidePwaPopup();
    localStorage.setItem("pwa-install-dismissed", "true");
  }
  deferredPrompt = null;
});

document.getElementById("pwaCloseBtn")?.addEventListener("click", () => {
  hidePwaPopup();
  localStorage.setItem("pwa-install-dismissed", "true");
});

// نمایش خودکار پاپ‌آپ روی همه پلتفرم‌ها بعد ۳ ثانیه
window.addEventListener("load", () => {
  setTimeout(() => {
    if (!isStandalone() && localStorage.getItem("pwa-install-dismissed") !== "true") {
      showPwaPopup();
    }
  }, 3000);
});

/* ============================================================
   رویدادها
   ============================================================ */
function bindEvents() {
  fabAdd?.addEventListener("click", openCreateForm);
  cancelForm?.addEventListener("click", closeForm);
  nodeleted?.addEventListener("click", closeDeleteConfirm);
  yasdelete?.addEventListener("click", confirmDelete);

  adduserback?.addEventListener("click", () => {
    closeForm();
    closeDeleteConfirm();
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      closeForm();
      closeDeleteConfirm();
      closeInvoicePreview();
    }
  });

  create2?.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    const title = titleTaskinput?.value.trim() || "";
    if (!title) {
      showToast("عنوان یادداشت را وارد کنید!", "warning");
      titleTaskinput?.focus();
      return;
    }
    const priceValue = parsePrice(taskPriceInput?.value || "");
    const deadlineToSave = getDeadlineForSave();

    if (editingTaskId !== null) {
      updateTask(editingTaskId, {
        Title: title,
        Body: titledisinput.value.trim(),
        Price: priceValue,
        deadline: deadlineToSave,
      }, () => {
        closeForm();
        showToast("یادداشت ویرایش شد", "success");
      });
    } else {
      addData(() => {
        closeForm();
        showToast("یادداشت اضافه شد", "success");
      });
    }
  });

  if (taskPriceInput) {
    taskPriceInput.addEventListener("input", function () { formatPriceInputLive(this); });
    taskPriceInput.addEventListener("keypress", function (e) {
      const char = String.fromCharCode(e.which);
      if (!/[\d۰-۹٠-٩]/.test(char)) e.preventDefault();
    });
    taskPriceInput.addEventListener("paste", function (e) {
      e.preventDefault();
      const pasted = (e.clipboardData || window.clipboardData).getData("text");
      const digits = extractDigits(pasted);
      if (digits) {
        const num = parseInt(digits, 10);
        if (!isNaN(num)) this.value = num.toLocaleString("en-US");
      }
    });
  }

  const clearDeadlineBtn = document.getElementById("clearDeadlineBtn");
  if (clearDeadlineBtn) {
    clearDeadlineBtn.addEventListener("click", () => {
      clearDeadline();
      showToast("تاریخ حذف شد", "info");
    });
  }

  searchInput?.addEventListener("input", function () { searchTasks(this.value); });
  searchInput?.addEventListener("keydown", function (e) {
    if (e.key === "Escape") {
      this.value = "";
      currentSearchTerm = "";
      displayData();
    }
  });

  switchCheckDefault?.addEventListener("change", toggleCompletedTasks);

  document.querySelectorAll(".stat-card").forEach((card) => {
    card.addEventListener("click", () => setFilter(card.dataset.filter));
    card.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        setFilter(card.dataset.filter);
      }
    });
  });

  document.addEventListener("submit", (e) => e.preventDefault());

  shareInvoiceBtn?.addEventListener("click", shareInvoice);
  closePreviewBtn?.addEventListener("click", closeInvoicePreview);
  invoicePreview?.addEventListener("click", (e) => {
    if (e.target === invoicePreview) closeInvoicePreview();
  });

  enableNotifBtn?.addEventListener("click", toggleNotifications);
  exportPdfBtn?.addEventListener("click", generateInvoicePDF);

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      setTimeout(checkMissedNotifications, 1000);
    }
  });
}

/* ============================================================
   Toast
   ============================================================ */
function showToast(message, type = "info") {
  if (!toastContainer) return;
  const toast = document.createElement("div");
  toast.className = `custom-toast ${type}`;
  const icons = {
    success: "check-circle-fill",
    warning: "exclamation-triangle-fill",
    danger: "x-circle-fill",
    info: "info-circle-fill",
  };
  toast.innerHTML = `<i class="bi bi-${icons[type] || "info-circle-fill"}"></i><span>${message}</span>`;
  toastContainer.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateY(-20px)";
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

/* ============================================================
   PDF
   ============================================================ */
let _vazirFontCache = null;

async function getVazirFont() {
  if (_vazirFontCache) return _vazirFontCache;
  const fontUrl = "https://cdn.jsdelivr.net/gh/rastikerdar/vazirmatn@v33.003/fonts/ttf/Vazirmatn-Regular.ttf";
  const res = await fetch(fontUrl);
  const buffer = await res.arrayBuffer();
  let binary = "";
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunkSize));
  }
  _vazirFontCache = btoa(binary);
  return _vazirFontCache;
}

async function generateInvoicePDF() {
  if (!window.jspdf || !window.jspdf.jsPDF) {
    showToast("کتابخانه PDF بارگذاری نشده", "danger");
    return;
  }
  showToast("در حال ساخت فاکتور...", "info");
  try {
    const { jsPDF } = window.jspdf;
    const allTasks = await getAllTasks();
    if (!allTasks || allTasks.length === 0) {
      showToast("هیچ یادداشتی برای فاکتور وجود ندارد", "warning");
      return;
    }
    allTasks.sort((a, b) => {
      const da = new Date(a.createdAt || 0);
      const dbb = new Date(b.createdAt || 0);
      return dbb - da;
    });
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    let fontLoaded = false;
    try {
      const fontBase64 = await getVazirFont();
      doc.addFileToVFS("Vazirmatn-Regular.ttf", fontBase64);
      doc.addFont("Vazirmatn-Regular.ttf", "Vazirmatn", "normal");
      doc.setFont("Vazirmatn");
      fontLoaded = true;
    } catch (err) {}
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const margin = 15;
    const contentW = pageW - margin * 2;
    doc.setFillColor(30, 64, 175);
    doc.rect(0, 0, pageW, 35, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(20);
    if (fontLoaded) doc.setFont("Vazirmatn", "normal");
    doc.text(STORE_NAME, pageW - margin, 15, { align: "right" });
    doc.setFontSize(9);
    doc.text(`تاریخ: ${formatPersianDateTime(new Date())}`, pageW - margin, 31, { align: "right" });
    let y = 45;
    const total = allTasks.length;
    const doneCount = allTasks.filter((t) => t.completed).length;
    const pendingCount = total - doneCount;
    const totalPrice = allTasks.reduce((sum, t) => sum + (t.Price || 0), 0);
    const cardW = (contentW - 8) / 3;
    const cardH = 20;
    const cards = [
      { label: "کل", value: total, color: [37, 99, 235] },
      { label: "انجام شده", value: doneCount, color: [22, 163, 74] },
      { label: "در انتظار", value: pendingCount, color: [245, 158, 11] },
    ];
    cards.forEach((card, i) => {
      const x = pageW - margin - (i + 1) * cardW - i * 4;
      doc.setFillColor(card.color[0], card.color[1], card.color[2]);
      doc.roundedRect(x, y, cardW, cardH, 3, 3, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(9);
      doc.text(card.label, x + cardW / 2, y + 7, { align: "center" });
      doc.setFontSize(14);
      doc.text(String(card.value), x + cardW / 2, y + 16, { align: "center" });
    });
    y += cardH + 6;
    if (totalPrice > 0) {
      doc.setFillColor(236, 253, 245);
      doc.roundedRect(margin, y, contentW, 12, 3, 3, "F");
      doc.setTextColor(5, 150, 105);
      doc.setFontSize(11);
      doc.text(`جمع کل مبالغ: ${formatPrice(totalPrice)} تومان`, pageW - margin - 3, y + 8, { align: "right" });
      y += 16;
    }
    doc.setFillColor(30, 41, 59);
    doc.rect(margin, y, contentW, 9, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(9);
    const colTitleX = pageW - margin - 3;
    const colPriceX = pageW - margin - contentW * 0.45;
    const colStatusX = pageW - margin - contentW * 0.75;
    doc.text("عنوان", colTitleX, y + 6, { align: "right" });
    doc.text("مبلغ", colPriceX, y + 6, { align: "center" });
    doc.text("وضعیت", colStatusX, y + 6, { align: "center" });
    y += 9;
    const rowH = 8;
    let rowIndex = 0;
    for (const task of allTasks) {
      if (y + rowH > pageH - 25) {
        doc.addPage();
        y = margin;
        doc.setFillColor(30, 41, 59);
        doc.rect(margin, y, contentW, 9, "F");
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(9);
        doc.text("عنوان", colTitleX, y + 6, { align: "right" });
        doc.text("مبلغ", colPriceX, y + 6, { align: "center" });
        doc.text("وضعیت", colStatusX, y + 6, { align: "center" });
        y += 9;
      }
      if (rowIndex % 2 === 0) {
        doc.setFillColor(248, 250, 252);
        doc.rect(margin, y, contentW, rowH, "F");
      }
      doc.setDrawColor(226, 232, 240);
      doc.line(margin, y + rowH, pageW - margin, y + rowH);
      doc.setTextColor(30, 41, 59);
      doc.setFontSize(8);
      let titleTxt = (task.Title || "بدون عنوان").trim();
      if (titleTxt.length > 25) titleTxt = titleTxt.substring(0, 23) + "…";
      doc.text(titleTxt, colTitleX, y + 5.5, { align: "right" });
      const priceTxt = task.Price ? formatPrice(task.Price) : "—";
      doc.text(priceTxt, colPriceX, y + 5.5, { align: "center" });
      if (task.completed) {
        doc.setTextColor(22, 163, 74);
        doc.text("انجام شده", colStatusX, y + 5.5, { align: "center" });
      } else {
        doc.setTextColor(100, 116, 139);
        doc.text("در انتظار", colStatusX, y + 5.5, { align: "center" });
      }
      y += rowH;
      rowIndex++;
    }
    const totalPages = doc.internal.getNumberOfPages();
    for (let p = 1; p <= totalPages; p++) {
      doc.setPage(p);
      doc.setDrawColor(226, 232, 240);
      doc.line(margin, pageH - 15, pageW - margin, pageH - 15);
      doc.setTextColor(148, 163, 184);
      doc.setFontSize(8);
      doc.text("کارنگار — فاکتور خودکار", margin, pageH - 9, { align: "left" });
      doc.text(`صفحه ${p} از ${totalPages}`, pageW - margin, pageH - 9, { align: "right" });
    }
    const fileName = `invoice-${new Date().toISOString().slice(0, 10)}.pdf`;
    doc.save(fileName);
    showToast("فاکتور PDF دانلود شد ✅", "success");
  } catch (err) {
    showToast("خطا در ساخت فاکتور", "danger");
  }
}

/* ============================================================
   Scroll
   ============================================================ */
function initHeaderScroll() {
  const appHeader = document.getElementById("appHeader");
  if (!appHeader) return;
  let ticking = false;
  window.addEventListener("scroll", () => {
    if (!ticking) {
      window.requestAnimationFrame(() => {
        if (window.scrollY > 20) appHeader.classList.add("scrolled");
        else appHeader.classList.remove("scrolled");
        ticking = false;
      });
      ticking = true;
    }
  }, { passive: true });
}

/* ============================================================
   Init
   ============================================================ */
function init() {
  console.log("🚀 init()");

  try { bindEvents(); } catch (e) { console.error("bindEvents:", e); }
  try { startDeadlineWatcher(); } catch (e) { console.error("deadlineWatcher:", e); }

  notifEnabled = loadNotifPref();
  if (notifEnabled && "Notification" in window && Notification.permission !== "granted") {
    notifEnabled = false;
    saveNotifPref(false);
  }
  updateNotifButtonUI();

  try { registerSW(); } catch (e) { console.error("SW:", e); }
  try { openDatabase(); } catch (e) { console.error("DB:", e); hideLoader(); }
  try { initHeaderScroll(); } catch (e) {}
  updateCount(0, 0);
  checkEmptyTasks();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}