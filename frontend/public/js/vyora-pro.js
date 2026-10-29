/**
 * VYORA Pro — Premium Personal Coaching Section
 * Interactive frontend logic
 */

(function () {
  "use strict";

  // ---------- Tab Switching ----------
  const navItems = document.querySelectorAll(".nav-item");
  const panels = document.querySelectorAll(".tab-panel");

  function switchTab(tabId) {
    navItems.forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.tab === tabId);
    });
    panels.forEach((panel) => {
      panel.classList.toggle("active", panel.id === `tab-${tabId}`);
    });
    // Scroll content to top
    const content = document.querySelector(".pro-content");
    if (content) content.scrollTop = 0;
  }

  // Expose globally so inline onclick can use it
  window.switchTab = switchTab;

  navItems.forEach((btn) => {
    btn.addEventListener("click", () => {
      switchTab(btn.dataset.tab);
    });
  });

  // ---------- Class Filter Chips ----------
  const chips = document.querySelectorAll(".filter-chips .chip");
  chips.forEach((chip) => {
    chip.addEventListener("click", () => {
      chips.forEach((c) => c.classList.remove("active"));
      chip.classList.add("active");
      // Visual only – real filtering can be wired later
      showToast(`Showing: ${chip.textContent}`);
    });
  });

  // ---------- Symptom Buttons ----------
  document.querySelectorAll(".symptom-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      btn.classList.toggle("active");
    });
  });

  // ---------- Water Tracker ----------
  let waterLiters = 1.8;
  const waterGoal = 3.0;

  window.addWater = function (amount) {
    waterLiters = Math.min(waterLiters + amount, waterGoal + 0.5);
    updateWaterUI();
    showToast(`+${amount * 1000} ml water logged`);
  };

  function updateWaterUI() {
    const filled = Math.round((waterLiters / waterGoal) * 10);
    const glasses = document.querySelectorAll(".water-glasses .glass");
    glasses.forEach((g, i) => {
      g.classList.toggle("filled", i < filled);
    });

    // Update dashboard stat if present
    const waterStat = document.getElementById("water-stat");
    if (waterStat) {
      waterStat.textContent = `${waterLiters.toFixed(1)} / ${waterGoal.toFixed(1)} L`;
    }

    // Update tracker value
    const trackerVal = document.querySelector(
      ".tracker-card .tracker-header .tracker-value"
    );
    // More robust: find the water tracker specifically
    document.querySelectorAll(".tracker-card").forEach((card) => {
      const h3 = card.querySelector("h3");
      if (h3 && h3.textContent.includes("Water")) {
        const val = card.querySelector(".tracker-value");
        if (val) val.innerHTML = `${waterLiters.toFixed(1)} L <small>/ ${waterGoal.toFixed(1)} L</small>`;
      }
    });
  }

  // ---------- Book Session Modal ----------
  const bookModal = document.getElementById("book-modal");
  const bookBtn = document.getElementById("book-session-btn");
  const closeBook = document.getElementById("close-book");
  const cancelBook = document.getElementById("cancel-book");

  function openModal() {
    if (bookModal) bookModal.classList.add("show");
  }
  function closeModal() {
    if (bookModal) bookModal.classList.remove("show");
  }

  if (bookBtn) bookBtn.addEventListener("click", openModal);
  if (closeBook) closeBook.addEventListener("click", closeModal);
  if (cancelBook) cancelBook.addEventListener("click", closeModal);

  if (bookModal) {
    bookModal.addEventListener("click", (e) => {
      if (e.target === bookModal) closeModal();
    });
  }

  // Confirm booking
  const confirmBtn = document.querySelector("#book-modal .modal-footer .btn-primary");
  if (confirmBtn) {
    confirmBtn.addEventListener("click", () => {
      closeModal();
      showToast("Session booked! Coach will confirm shortly.");
    });
  }

  // ---------- Log Meal Button ----------
  const logMealBtn = document.getElementById("log-meal-btn");
  if (logMealBtn) {
    logMealBtn.addEventListener("click", () => {
      showToast("Meal logger opened (connect to your backend)");
    });
  }

  // ---------- Sync Wearable ----------
  const syncBtn = document.getElementById("sync-wearable");
  if (syncBtn) {
    syncBtn.addEventListener("click", () => {
      syncBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Syncing...';
      setTimeout(() => {
        syncBtn.innerHTML = '<i class="fas fa-sync-alt"></i> Sync Wearable';
        showToast("Wearable data synced successfully");
      }, 1500);
    });
  }

  // ---------- Add Custom Reminder ----------
  const addRemBtn = document.getElementById("add-reminder-btn");
  if (addRemBtn) {
    addRemBtn.addEventListener("click", () => {
      showToast("Custom reminder form — connect to your notification service");
    });
  }

  // ---------- Notification Bell ----------
  const notifBell = document.getElementById("notif-bell");
  if (notifBell) {
    notifBell.addEventListener("click", () => {
      showToast("3 new notifications from your coach");
    });
  }

  // ---------- Toast Helper ----------
  function showToast(message) {
    const toast = document.getElementById("toast");
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add("show");
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => {
      toast.classList.remove("show");
    }, 2800);
  }

  // ---------- Demo: Auto-update steps occasionally (optional polish) ----------
  // Uncomment if you want a live feel
  // setInterval(() => {
  //   const stepsEl = document.getElementById("steps-stat");
  //   if (stepsEl) {
  //     const current = parseInt(stepsEl.textContent.replace(/,/g, "")) || 7420;
  //     const next = current + Math.floor(Math.random() * 15);
  //     stepsEl.textContent = next.toLocaleString() + " / 10,000";
  //   }
  // }, 8000);

  console.log("%c VYORA Pro section loaded ", "background:#ff3b5c;color:#fff;padding:4px 8px;border-radius:4px;");
})();
