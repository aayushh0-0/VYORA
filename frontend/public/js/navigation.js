// Navigation: left sidebar + SPA section switching (preserves data-target / go()).
(function () {
  const targets = ["home", "vyora", "workout", "training", "diet", "locator", "community", "ovula", "business", "health", "pro"];
  const mobileBar = document.getElementById("mobileBar");
  const sidebar = document.getElementById("appSidebar");
  const backdrop = document.getElementById("sidebarBackdrop");
  const toggleBtn = document.getElementById("sidebarToggle");
  const mobileMenuBtn = document.getElementById("mobileMenuBtn");
  const STORAGE_KEY = "vyora.sidebar.collapsed";

  // Legacy mobile bar (kept in DOM for compatibility; hidden via CSS)
  if (mobileBar && !mobileBar.dataset.built) {
    targets.forEach((t) => {
      const b = document.createElement("button");
      const labels = { locator: "Gyms", training: "Special Training", vyora: "VYORA" };
      b.textContent = labels[t] || t.charAt(0).toUpperCase() + t.slice(1);
      b.dataset.target = t;
      if (t === "home") b.classList.add("active");
      mobileBar.appendChild(b);
    });
    mobileBar.dataset.built = "1";
  }

  function isMobile() {
    return window.matchMedia("(max-width: 900px)").matches;
  }

  function setCollapsed(collapsed) {
    document.body.classList.toggle("sidebar-collapsed", collapsed);
    document.querySelector(".app")?.classList.toggle("sidebar-collapsed", collapsed);
    if (toggleBtn) {
      toggleBtn.setAttribute("aria-label", collapsed ? "Expand sidebar" : "Collapse sidebar");
      toggleBtn.title = collapsed ? "Expand sidebar" : "Collapse sidebar";
    }
    try {
      localStorage.setItem(STORAGE_KEY, collapsed ? "1" : "0");
    } catch (_) {}
  }

  function openMobileNav() {
    document.body.classList.add("sidebar-open");
    document.querySelector(".app")?.classList.add("sidebar-open");
    if (backdrop) backdrop.hidden = false;
    if (mobileMenuBtn) mobileMenuBtn.setAttribute("aria-expanded", "true");
  }

  function closeMobileNav() {
    document.body.classList.remove("sidebar-open");
    document.querySelector(".app")?.classList.remove("sidebar-open");
    if (backdrop) backdrop.hidden = true;
    if (mobileMenuBtn) mobileMenuBtn.setAttribute("aria-expanded", "false");
  }

  function go(target) {
    if (!targets.includes(target)) return;
    targets.forEach((t) => {
      const section = document.getElementById(t);
      if (section) section.classList.toggle("active", t === target);
    });
    document.querySelectorAll("[data-target]").forEach((b) => {
      b.classList.toggle("active", b.dataset.target === target);
    });
    document.body.dataset.section = target;
    // Unlock page scroll when leaving VYORA chat
    if (target === "vyora") {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
      const stage = document.querySelector(".stage");
      if (stage) {
        stage.style.height = "";
        stage.style.overflow = "";
      }
    }
    try {
      window.scrollTo({ top: 0, behavior: "instant" });
    } catch (_) {
      window.scrollTo(0, 0);
    }
    if (isMobile()) closeMobileNav();
  }

  // Event delegation — same as before, keeps nodes / CTAs / mobile buttons working
  document.addEventListener("click", (e) => {
    const b = e.target.closest("[data-target]");
    if (!b) return;
    const target = b.dataset.target;
    if (targets.includes(target)) go(target);
  });

  toggleBtn?.addEventListener("click", () => {
    if (isMobile()) return;
    const collapsed = !document.querySelector(".app")?.classList.contains("sidebar-collapsed");
    setCollapsed(collapsed);
  });

  mobileMenuBtn?.addEventListener("click", () => {
    if (document.querySelector(".app")?.classList.contains("sidebar-open")) closeMobileNav();
    else openMobileNav();
  });

  backdrop?.addEventListener("click", closeMobileNav);

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeMobileNav();
  });

  // Restore collapsed preference on desktop
  try {
    const stored = localStorage.getItem(STORAGE_KEY) === "1";
    if (stored && !isMobile()) setCollapsed(true);
  } catch (_) {}

  window.addEventListener("resize", () => {
    if (!isMobile()) closeMobileNav();
  });

  window.VyoraNavigation = { go, targets, setCollapsed, openMobileNav, closeMobileNav };
})();
