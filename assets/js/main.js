/* ==========================================================================
   bai tap · 3D portfolio engine
   Three.js r150 (vendored) — no external assets, procedural textures.
   ========================================================================== */
(function () {
  "use strict";

  /* ------------------------------ helpers ------------------------------- */
  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth = (t) => {
    t = clamp(t, 0, 1);
    return t * t * (3 - 2 * t);
  };
  const damp = (a, b, lambda, dt) => lerp(a, b, 1 - Math.exp(-lambda * dt));
  const isCoarse = window.matchMedia("(pointer: coarse)").matches;
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const N = 5;
  const SECTION_IDS = ["about", "skills", "projects", "contact", "overview"];
  const STATION_NAMES = ["Cổng vào", "Kỹ năng", "Dự án", "Liên hệ", "Toàn cảnh"];
  const ACCENTS = [0x38bdf8, 0xa78bfa, 0xfb923c, 0x34d399, 0xdbeafe];
  const debugStation = (() => {
    const raw = new URLSearchParams(location.search).get("station");
    if (raw === null) return null;
    const n = parseInt(raw, 10);
    return Number.isNaN(n) ? null : clamp(n, 0, 4);
  })();

  const state = {
    ready: false,
    progress: 0,
    target: 0,
    stationPos: 0,
    station: 0,
    theme: "night",
    themeMix: 0,
    targetThemeMix: 0,
    time: 0,
    start: performance.now(),
    pointer: { x: 0, y: 0, nx: 0, ny: 0 },
    pointerDown: { x: 0, y: 0, time: 0 },
    dragging: false,
    dragYaw: 0,
    dragPitch: 0,
    dragTargetYaw: 0,
    dragTargetPitch: 0,
    overUI: false,
    hover3D: null,
    avatarHover: false,
    avatarHoverAt: -10,
    waveUntil: 0,
    bubbleUntil: 0,
    planetHover: -1,
    cardHover: -1,
    socialHover: -1,
    isMobile: window.innerWidth < 760,
    scrollTween: null,
    pointerType: "mouse",
    lastTrail: 0,
    firstStation: true,
  };

  /* ------------------------------ DOM refs ------------------------------ */
  const dom = {
    loader: $("#loader"),
    loaderBar: $("#loaderBar"),
    loaderPercent: $("#loaderPercent"),
    loaderLabel: $("#loaderLabel"),
    loaderFallback: $("#loaderFallback"),
    webgl: $("#webgl"),
    header: $("#siteHeader"),
    themeToggle: $("#themeToggle"),
    menuToggle: $("#menuToggle"),
    mainNav: $("#mainNav"),
    stationIndex: $("#stationIndex"),
    stationName: $("#stationName"),
    journeyFill: $("#journeyFill"),
    scrollFill: $("#scrollProgressFill"),
    planetTip: $("#planetTip"),
    planetTipName: $("#planetTipName"),
    planetTipMeta: $("#planetTipMeta"),
    planetTipFill: $("#planetTipFill"),
    planetTipLevel: $("#planetTipLevel"),
    bubble: $("#avatarBubble"),
    bubbleText: $("#avatarBubbleText"),
    toast: $("#toast"),
    closeNav: null,
  };

  /* --------------------------- loader / errors -------------------------- */
  function setLoad(percent, label) {
    if (dom.loaderBar) dom.loaderBar.style.width = percent + "%";
    if (dom.loaderPercent) dom.loaderPercent.textContent = String(Math.round(percent));
    if (label && dom.loaderLabel) dom.loaderLabel.textContent = label;
  }

  function fail(message, error) {
    console.error("[portfolio]", message, error || "");
    window.__portfolioError = {
      message: message,
      stack: error && error.stack ? error.stack : null,
    };
    document.body.classList.remove("is-loading");
    document.body.classList.add("no-webgl");
    if (dom.loaderFallback) dom.loaderFallback.hidden = false;
    if (dom.loader) {
      dom.loader.classList.add("is-done");
      dom.loader.style.display = "none";
    }
    const hero = $('.station[data-station="0"]');
    if (hero) {
      hero.classList.add("is-visible", "is-active");
      hero.style.opacity = "1";
      hero.style.visibility = "visible";
      hero.style.transform = "none";
      hero.removeAttribute("aria-hidden");
      hero.removeAttribute("inert");
    }
  }

  const tick = () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));

  /* ------------------------------ theme --------------------------------- */
  const validTheme = (t) => (t === "day" ? "day" : "night");
  try {
    state.theme = validTheme(localStorage.getItem("bt-theme"));
  } catch (e) {
    state.theme = "night";
  }
  state.targetThemeMix = state.theme === "day" ? 1 : 0;
  state.themeMix = state.targetThemeMix;
  document.documentElement.classList.toggle("theme-day", state.theme === "day");
  document.documentElement.classList.toggle("theme-night", state.theme !== "day");

  function applyTheme(theme, announce) {
    state.theme = validTheme(theme);
    state.targetThemeMix = state.theme === "day" ? 1 : 0;
    document.documentElement.classList.toggle("theme-day", state.theme === "day");
    document.documentElement.classList.toggle("theme-night", state.theme !== "day");
    try {
      localStorage.setItem("bt-theme", state.theme);
    } catch (e) { /* ignore */ }
    if (dom.themeToggle) {
      dom.themeToggle.setAttribute("aria-pressed", String(state.theme === "day"));
      dom.themeToggle.setAttribute(
        "aria-label",
        state.theme === "day" ? "Chuyển sang chế độ ban đêm" : "Chuyển sang chế độ ban ngày"
      );
    }
    const meta = $('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", state.theme === "day" ? "#e9f2fb" : "#05060f");
    if (announce) showToast(state.theme === "day" ? "Đã bật ánh sáng ban ngày" : "Đã trở về bầu trời đêm");
  }

  applyTheme(state.theme, false);

  /* ------------------------------- toast -------------------------------- */
  let toastTimer = 0;
  function showToast(message) {
    if (!dom.toast) return;
    dom.toast.textContent = message;
    dom.toast.classList.add("is-on");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => dom.toast.classList.remove("is-on"), 2600);
  }

  /* ------------------------------ scroll -------------------------------- */
  function maxScroll() {
    return Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
  }

  function progressForStation(i) {
    return clamp(i / (N - 1), 0, 1);
  }

  function scrollToStation(index, duration) {
    const targetTop = progressForStation(index) * maxScroll();
    if (reducedMotion || duration === 0) {
      window.scrollTo(0, targetTop);
      state.target = targetTop / maxScroll();
      return;
    }
    if (state.scrollTween) cancelAnimationFrame(state.scrollTween.raf);
    const start = window.scrollY;
    const delta = targetTop - start;
    const started = performance.now();
    const total = duration || 1500;
    const tween = { raf: 0 };
    const step = (now) => {
      const t = clamp((now - started) / total, 0, 1);
      const e = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
      window.scrollTo(0, start + delta * e);
      if (t < 1) tween.raf = requestAnimationFrame(step);
      else state.scrollTween = null;
    };
    state.scrollTween = tween;
    tween.raf = requestAnimationFrame(step);
  }

  function closeNav() {
    document.body.classList.remove("nav-open");
    if (dom.menuToggle) dom.menuToggle.setAttribute("aria-expanded", "false");
  }

  /* --------------------------- UI interactions -------------------------- */
  function bindUI() {
    document.addEventListener("click", (event) => {
      const gotoEl = event.target.closest("[data-goto]");
      if (gotoEl) {
        event.preventDefault();
        const idx = parseInt(gotoEl.getAttribute("data-goto"), 10);
        if (!Number.isNaN(idx)) {
          closeNav();
          scrollToStation(idx, 1500);
        }
        return;
      }
      const anchor = event.target.closest('a[href^="#"]');
      if (anchor) {
        const id = anchor.getAttribute("href").slice(1);
        const idx = SECTION_IDS.indexOf(id);
        if (idx >= 0) {
          event.preventDefault();
          closeNav();
          scrollToStation(idx, 1500);
          return;
        }
      }
      if (dom.mainNav && document.body.classList.contains("nav-open") && !event.target.closest("#mainNav, #menuToggle")) {
        closeNav();
      }
    });

    if (dom.menuToggle) {
      dom.menuToggle.addEventListener("click", () => {
        const open = !document.body.classList.contains("nav-open");
        document.body.classList.toggle("nav-open", open);
        dom.menuToggle.setAttribute("aria-expanded", String(open));
        dom.menuToggle.setAttribute("aria-label", open ? "Đóng menu" : "Mở menu");
      });
    }

    if (dom.themeToggle) {
      dom.themeToggle.addEventListener("click", () => {
        applyTheme(state.theme === "day" ? "night" : "day", true);
      });
    }

    const copyBtn = $("#copyEmail");
    if (copyBtn) {
      copyBtn.addEventListener("click", async () => {
        const email = copyBtn.getAttribute("data-email") || "puppy@example.com";
        let copied = false;
        try {
          await navigator.clipboard.writeText(email);
          copied = true;
        } catch (err) {
          const ta = document.createElement("textarea");
          ta.value = email;
          ta.style.position = "fixed";
          ta.style.opacity = "0";
          document.body.appendChild(ta);
          ta.select();
          try { copied = document.execCommand("copy"); } catch (e) { copied = false; }
          document.body.removeChild(ta);
        }
        showToast(copied ? "Đã sao chép email ✦" : "Email: " + email);
      });
    }

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        closeNav();
        if (THREE_SCENE_READY()) {
          cards.forEach((card) => { card.userData.flipTarget = 0; card.userData.flipped = false; });
        }
      }
      const tag = (event.target.tagName || "").toLowerCase();
      if (tag === "input" || tag === "textarea" || event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.key === "Home") {
        event.preventDefault();
        scrollToStation(0, 1400);
      } else if (event.key === "End") {
        event.preventDefault();
        scrollToStation(4, 1600);
      } else if (/^[1-5]$/.test(event.key)) {
        event.preventDefault();
        scrollToStation(parseInt(event.key, 10) - 1, 1400);
      }
    });

    window.addEventListener("scroll", () => {
      if (dom.header) dom.header.classList.toggle("is-scrolled", window.scrollY > 40);
    }, { passive: true });

    window.addEventListener("wheel", () => {
      if (state.scrollTween) {
        cancelAnimationFrame(state.scrollTween.raf);
        state.scrollTween = null;
      }
    }, { passive: true });
    window.addEventListener("touchstart", () => {
      if (state.scrollTween) {
        cancelAnimationFrame(state.scrollTween.raf);
        state.scrollTween = null;
      }
    }, { passive: true });
  }

  function THREE_SCENE_READY() {
    return state.ready;
  }

  /* ----------------------------- cursor --------------------------------- */
  const cursor = {
    x: window.innerWidth / 2,
    y: window.innerHeight / 2,
    rx: window.innerWidth / 2,
    ry: window.innerHeight / 2,
    dot: $(".cursor-dot"),
    ring: $(".cursor-ring"),
    trail: $("#cursorTrail"),
    hoverSources: new Set(),
    active: false,
  };

  function syncCursorHover() {
    document.body.classList.toggle("cursor-hover", cursor.hoverSources.size > 0);
  }

  function initCursor() {
    if (isCoarse || reducedMotion) return;
    cursor.active = true;
    const move = (event) => {
      if (event.pointerType === "touch") return;
      state.pointerType = event.pointerType || "mouse";
      state.pointer.x = event.clientX;
      state.pointer.y = event.clientY;
      state.pointer.nx = (event.clientX / window.innerWidth) * 2 - 1;
      state.pointer.ny = -((event.clientY / window.innerHeight) * 2 - 1);
      cursor.x = event.clientX;
      cursor.y = event.clientY;
      document.body.classList.add("has-cursor");
      state.overUI = !!event.target.closest("a, button, .contact-card, .skills-legend, .project-hint, .console-note, .site-footer, .holo-tag");
      if (event.target.closest("a, button")) {
        cursor.hoverSources.add("dom");
      } else {
        cursor.hoverSources.delete("dom");
      }
      syncCursorHover();

      const now = performance.now();
      if (now - state.lastTrail > 26 && !reducedMotion) {
        state.lastTrail = now;
        const dot = document.createElement("span");
        dot.className = "trail-dot";
        dot.style.left = event.clientX + "px";
        dot.style.top = event.clientY + "px";
        dot.style.background = "rgba(125,211,252," + (0.25 + Math.random() * 0.3) + ")";
        cursor.trail.appendChild(dot);
        setTimeout(() => dot.remove(), 700);
      }
    };
    document.addEventListener("pointermove", move, { passive: true });
    document.addEventListener("pointerdown", (event) => {
      if (event.pointerType === "touch") return;
      document.body.classList.add("cursor-down");
      state.pointer.x = event.clientX;
      state.pointer.y = event.clientY;
      state.pointerDown = { x: event.clientX, y: event.clientY, time: performance.now() };
      if (!event.target.closest("a, button, .contact-card, .skills-legend, .site-footer")) {
        state.dragging = true;
        state.dragTargetYaw = state.dragYaw;
        state.dragTargetPitch = state.dragPitch;
      }
    });
    document.addEventListener("pointerup", (event) => {
      document.body.classList.remove("cursor-down");
      if (state.dragging) {
        state.dragging = false;
      }
    });
    document.addEventListener("pointerleave", () => {
      document.body.classList.remove("has-cursor");
    });
    document.addEventListener("pointermove", (event) => {
      if (!state.dragging || event.pointerType === "touch") return;
      const dx = event.clientX - state.pointerDown.x;
      const dy = event.clientY - state.pointerDown.y;
      state.dragYaw = clamp(state.dragTargetYaw - dx * 0.0028, -1.1, 1.1);
      state.dragPitch = clamp(state.dragTargetPitch + dy * 0.0022, -0.7, 0.7);
    }, { passive: true });
  }

  function updateCursor() {
    if (!cursor.active) return;
    if (cursor.dot) cursor.dot.style.transform = `translate3d(${cursor.x}px, ${cursor.y}px, 0)`;
    cursor.rx = damp(cursor.rx, cursor.x, 14, 1 / 60);
    cursor.ry = damp(cursor.ry, cursor.y, 14, 1 / 60);
    if (cursor.ring) cursor.ring.style.transform = `translate3d(${cursor.rx}px, ${cursor.ry}px, 0)`;
  }

  /* --------------------------- click ripples ---------------------------- */
  const rippleLayer = document.createElement("div");
  rippleLayer.className = "ripple-layer";
  rippleLayer.setAttribute("aria-hidden", "true");
  document.body.appendChild(rippleLayer);

  function domRipple(x, y, color) {
    const el = document.createElement("span");
    el.className = "click-ripple";
    el.style.left = x + "px";
    el.style.top = y + "px";
    el.style.borderColor = color || "rgba(94,234,212,.55)";
    rippleLayer.appendChild(el);
    setTimeout(() => el.remove(), 900);
  }

  /* =========================================================================
     THREE SCENE
     ========================================================================= */
  let scene, camera, renderer, raycaster;
  let ambient, hemi, keyLight, rimLight, stationLight;
  let stars = [], dust, starGroups = [], cloudGroup = null;
  let gridMat = null;
  let avatar = null, avatarHead = null, avatarBody = null, avatarArmR = null, avatarArmL = null;
  let avatarEyes = [], avatarHits = [], avatarParticles = null, avatarParticleData = [];
  let avatarRings = [];
  let solarSystem = null, sun = null, sunLight = null, planets = [], planetHits = [];
  let projectGroup = null, cards = [];
  let consoleGroup = null, screenScan = null, socials = [], socialHits = [];
  let glowSprites = [];
  let journeyLine = null;
  let stationBeacons = [];
  let overviewGroup = null, overviewMats = [];
  let camCurve = null, lookCurve = null;
  let camKeys = [], lookKeys = [];
  let floorRipples = [];
  let gridPlane = null;
  let themeMixCurrent = state.themeMix;
  let accentCurrent = new THREE.Color(ACCENTS[0]);
  let lastFrame = performance.now();
  let blinkAt = 2.5;
  let blinkUntil = 0;
  const tmpVec = new THREE.Vector3();
  const tmpVec2 = new THREE.Vector3();

  const SKILLS = [
    { name: "HTML5 / CSS3", level: 92, color: 0x2dd4bf, radius: 2.05, size: 0.38, speed: 0.42, tilt: 0.06 },
    { name: "JavaScript / TypeScript", level: 88, color: 0x3b82f6, radius: 2.75, size: 0.48, speed: 0.33, tilt: -0.2 },
    { name: "Python", level: 86, color: 0xeab308, radius: 3.42, size: 0.53, speed: 0.27, tilt: 0.13 },
    { name: "SQL & Data", level: 80, color: 0xf97316, radius: 4.08, size: 0.47, speed: 0.22, tilt: -0.11 },
    { name: "Git / GitHub", level: 84, color: 0xec4899, radius: 4.75, size: 0.4, speed: 0.19, tilt: 0.25 },
    { name: "Responsive Design", level: 78, color: 0x8b5cf6, radius: 5.4, size: 0.37, speed: 0.16, tilt: -0.24 },
    { name: "Figma / Wireframe", level: 68, color: 0xd946ef, radius: 6.02, size: 0.32, speed: 0.135, tilt: 0.18 },
    { name: "Docker", level: 60, color: 0x0ea5e9, radius: 6.6, size: 0.29, speed: 0.11, tilt: -0.3 },
  ];

  const PROJECTS = [
    {
      id: "flap-rush",
      num: "01",
      title: "Flap Rush",
      tag: "ENDLESS FLYER",
      accent: "#5eead4",
      accent2: "#0ea5e9",
      art: "flap",
      desc: "Game bay không giới hạn với ống neon, vật lý mượt và bảng kỷ lục cá nhân. Một cú chạm là đủ để bắt đầu.",
      tech: ["HTML5", "CSS3", "Canvas", "JS"],
      features: ["Điều khiển chuột / phím cách / cảm ứng", "Độ khó tăng theo điểm số", "Lưu kỷ lục trong máy"],
      link: "./games/flap-rush/",
    },
    {
      id: "snake",
      num: "02",
      title: "Rắn săn mồi",
      tag: "NEON ARCADE",
      accent: "#a3e635",
      accent2: "#22c55e",
      art: "snake",
      desc: "Phiên bản neon của trò chơi kinh điển: ăn, lớn lên, né tường và chính mình. Tốc độ tăng dần theo từng miếng ăn.",
      tech: ["JavaScript", "Canvas", "Grid", "LocalStorage"],
      features: ["Điều khiển phím và vuốt cảm ứng", "Tốc độ tăng dần", "Tạm dừng và chơi lại tức thì"],
      link: "./games/snake/",
    },
    {
      id: "chess",
      num: "03",
      title: "Cờ tướng",
      tag: "STRATEGY / 2P",
      accent: "#fb923c",
      accent2: "#ef4444",
      art: "chess",
      desc: "Bàn cờ 9×10 với đầy đủ nước đi hợp lệ, luật cản mã, cản tượng và kiểm tra chiếu tướng. Chơi hai người trên cùng thiết bị.",
      tech: ["JavaScript", "Canvas", "Game Rules", "UI"],
      features: ["Kiểm tra nước đi hợp lệ", "Luật cản mã và cản tượng", "Undo và ván mới"],
      link: "./games/chess/",
    },
    {
      id: "o-an-quan",
      num: "04",
      title: "Ô ăn quan",
      tag: "FOLK GAME",
      accent: "#fcd34d",
      accent2: "#f97316",
      art: "oanquan",
      desc: "Trò chơi dân gian Việt Nam trên nền tảng web: rải sỏi, bắt quân, đấu với máy hoặc bạn bè trong cùng một không gian.",
      tech: ["HTML5", "CSS", "JavaScript", "DOM"],
      features: ["Luật rải và bắt quân", "Chế độ 2 người / đấu máy", "Giao diện responsive"],
      link: "./games/o-an-quan/",
    },
  ];

  /* --------------------------- canvas helpers --------------------------- */
  function hexA(hex, alpha) {
    const c = new THREE.Color(hex);
    return `rgba(${Math.round(c.r * 255)},${Math.round(c.g * 255)},${Math.round(c.b * 255)},${alpha})`;
  }
  function mixHex(a, b, t) {
    const ca = new THREE.Color(a);
    const cb = new THREE.Color(b);
    return "#" + ca.lerp(cb, t).getHexString();
  }
  function roundRect(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
  function canvasTexture(w, h, draw) {
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    draw(ctx, w, h);
    const texture = new THREE.CanvasTexture(canvas);
    texture.encoding = THREE.sRGBEncoding;
    texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    texture.needsUpdate = true;
    return texture;
  }
  function glowTexture(hex) {
    return canvasTexture(256, 256, (ctx, w, h) => {
      const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
      g.addColorStop(0, "rgba(255,255,255,1)");
      g.addColorStop(0.14, hexA(hex, 0.95));
      g.addColorStop(0.4, hexA(hex, 0.32));
      g.addColorStop(1, hexA(hex, 0));
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    });
  }
  function planetTexture(hex) {
    const base = new THREE.Color(hex);
    const light = base.clone().lerp(new THREE.Color(0xffffff), 0.62);
    const dark = base.clone().lerp(new THREE.Color(0x03040c), 0.66);
    return canvasTexture(256, 256, (ctx, w, h) => {
      ctx.fillStyle = "#" + dark.getHexString();
      ctx.fillRect(0, 0, w, h);
      const g = ctx.createRadialGradient(w * 0.36, h * 0.3, 4, w * 0.52, h * 0.52, w * 0.64);
      g.addColorStop(0, "#" + light.getHexString());
      g.addColorStop(0.42, "#" + base.getHexString());
      g.addColorStop(1, "#" + dark.getHexString());
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(w / 2, h / 2, w / 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 0.14;
      for (let i = 0; i < 7; i++) {
        ctx.strokeStyle = i % 2 ? "#ffffff" : "#000000";
        ctx.lineWidth = 2 + Math.random() * 8;
        ctx.beginPath();
        ctx.ellipse(w * 0.5, h * 0.35 + i * 22, w * 0.46, 5 + Math.random() * 8, -0.25, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      const shade = ctx.createRadialGradient(w * 0.4, h * 0.34, w * 0.1, w * 0.52, h * 0.52, w * 0.55);
      shade.addColorStop(0, "rgba(255,255,255,0.08)");
      shade.addColorStop(0.7, "rgba(0,0,0,0)");
      shade.addColorStop(1, "rgba(0,0,0,0.4)");
      ctx.fillStyle = shade;
      ctx.beginPath();
      ctx.arc(w / 2, h / 2, w / 2, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  function sunTexture() {
    return canvasTexture(512, 512, (ctx, w, h) => {
      const g = ctx.createRadialGradient(w * 0.42, h * 0.38, 6, w * 0.5, h * 0.5, w * 0.52);
      g.addColorStop(0, "#fff8ff");
      g.addColorStop(0.16, "#f3d9ff");
      g.addColorStop(0.36, "#c084fc");
      g.addColorStop(0.66, "#7c3aed");
      g.addColorStop(1, "#2e1065");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
      ctx.globalAlpha = 0.18;
      for (let i = 0; i < 12; i++) {
        ctx.strokeStyle = i % 3 === 0 ? "#ffffff" : "#4c1d95";
        ctx.lineWidth = 3 + Math.random() * 12;
        ctx.beginPath();
        ctx.arc(w * 0.5, h * 0.5, 30 + i * 21, i * 0.7, i * 0.7 + 2.4);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    });
  }

  function makeGlow(hex, size, opacity) {    const tex = glowTexture(hex);
    const mat = new THREE.SpriteMaterial({
      map: tex,
      color: 0xffffff,
      transparent: true,
      opacity: opacity,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(size, size, 1);
    sprite.userData.baseOpacity = opacity;
    sprite.userData.isGlow = true;
    glowSprites.push(sprite);
    return sprite;
  }
  function makeLabel(text, hex, fontSize) {
    const texture = canvasTexture(640, 160, (ctx, w, h) => {
      ctx.clearRect(0, 0, w, h);
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      let size = fontSize || 54;
      ctx.font = `600 ${size}px "Be Vietnam Pro", sans-serif`;
      while (ctx.measureText(text).width > w - 48 && size > 26) {
        size -= 2;
        ctx.font = `600 ${size}px "Be Vietnam Pro", sans-serif`;
      }
      ctx.shadowColor = hexA(hex, 0.9);
      ctx.shadowBlur = 18;
      ctx.fillStyle = "#f4fbff";
      ctx.fillText(text, w / 2, h / 2 + 2);
      ctx.shadowBlur = 0;
      ctx.fillStyle = hexA(hex, 0.9);
      ctx.fillRect(w / 2 - 18, h - 30, 36, 3);
    });
    const mat = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      depthWrite: false,
      depthTest: false,
      opacity: 0.92,
    });
    const sprite = new THREE.Sprite(mat);
    sprite.renderOrder = 30;
    return sprite;
  }
  function drawTechChips(ctx, list, x, y, accent, maxW) {
    let cx = x;
    let cy = y;
    ctx.font = '500 18px "Be Vietnam Pro", sans-serif';
    list.forEach((label) => {
      const w = ctx.measureText(label).width + 28;
      if (maxW && cx + w > x + maxW) {
        cx = x;
        cy += 42;
      }
      roundRect(ctx, cx, cy, w, 32, 7);
      ctx.fillStyle = hexA(accent, 0.1);
      ctx.fill();
      ctx.strokeStyle = hexA(accent, 0.24);
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.fillStyle = hexA(accent, 0.92);
      ctx.fillText(label, cx + 14, cy + 22);
      cx += w + 10;
    });
    return cy + 32;
  }
  function drawWrapped(ctx, text, x, y, maxWidth, lineHeight, maxLines, color) {
    const words = text.split(" ");
    let line = "";
    let lines = 0;
    ctx.fillStyle = color || "rgba(214,228,248,.68)";
    for (let i = 0; i < words.length; i++) {
      const test = line ? line + " " + words[i] : words[i];
      if (ctx.measureText(test).width > maxWidth && line) {
        if (maxLines && lines >= maxLines - 1) {
          line = line.replace(/[.,;:]?$/, "") + "…";
          ctx.fillText(line, x, y + lines * lineHeight);
          return y + lines * lineHeight;
        }
        ctx.fillText(line, x, y + lines * lineHeight);
        lines++;
        line = words[i];
      } else {
        line = test;
      }
    }
    if (line) {
      ctx.fillText(line, x, y + lines * lineHeight);
      lines++;
    }
    return y + (lines - 1) * lineHeight;
  }

  /* --------------------------- procedural art --------------------------- */
  function drawFlapArt(ctx, x, y, w, h, p) {
    const sky = ctx.createLinearGradient(x, y, x, y + h);
    sky.addColorStop(0, "#07142d");
    sky.addColorStop(0.55, "#0b3a55");
    sky.addColorStop(1, "#06202f");
    ctx.fillStyle = sky;
    ctx.fillRect(x, y, w, h);
    for (let i = 0; i < 46; i++) {
      const sx = x + Math.random() * w;
      const sy = y + Math.random() * h * 0.62;
      ctx.fillStyle = `rgba(190,240,255,${0.15 + Math.random() * 0.55})`;
      ctx.fillRect(sx, sy, Math.random() < 0.2 ? 2.5 : 1.4, Math.random() < 0.2 ? 2.5 : 1.4);
    }
    const moonX = x + w * 0.79;
    const moonY = y + h * 0.24;
    const mGlow = ctx.createRadialGradient(moonX, moonY, 4, moonX, moonY, 76);
    mGlow.addColorStop(0, "rgba(94,234,212,.55)");
    mGlow.addColorStop(1, "rgba(94,234,212,0)");
    ctx.fillStyle = mGlow;
    ctx.fillRect(moonX - 90, moonY - 90, 180, 180);
    ctx.fillStyle = "#c9fbff";
    ctx.beginPath();
    ctx.arc(moonX, moonY, 27, 0, Math.PI * 2);
    ctx.fill();
    const cityY = y + h * 0.72;
    for (let i = 0; i < 16; i++) {
      const bw = 20 + Math.random() * 34;
      const bh = 24 + Math.random() * 105;
      const bx = x + i * (w / 16) - 6;
      ctx.fillStyle = i % 3 === 0 ? "#082234" : "#061a2a";
      ctx.fillRect(bx, cityY - bh, bw, bh);
      ctx.fillStyle = "rgba(94,234,212,.4)";
      for (let wy = cityY - bh + 10; wy < cityY - 8; wy += 15) {
        for (let wx = bx + 6; wx < bx + bw - 6; wx += 12) {
          if (Math.random() > 0.56) ctx.fillRect(wx, wy, 3, 4);
        }
      }
    }
    const pipe = (px, top, gap, color) => {
      ctx.save();
      ctx.shadowColor = color;
      ctx.shadowBlur = 22;
      const g = ctx.createLinearGradient(px, 0, px + 74, 0);
      g.addColorStop(0, "#0b5d54");
      g.addColorStop(0.45, color);
      g.addColorStop(1, "#063e3c");
      ctx.fillStyle = g;
      roundRect(ctx, px, top, 74, y + h - 40 - top - gap, 8);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = color;
      roundRect(ctx, px - 7, top - 18, 88, 20, 5);
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,.2)";
      ctx.fillRect(px + 10, top + 6, 6, y + h - 80 - top - gap);
      ctx.restore();
    };
    pipe(x + w * 0.2, y + h * 0.58, 125, "#2dd4bf");
    pipe(x + w * 0.68, y - 20, 150, "#34d399");
    const bx = x + w * 0.46;
    const by = y + h * 0.48;
    ctx.save();
    ctx.translate(bx, by);
    ctx.rotate(-0.16);
    ctx.shadowColor = "rgba(250,204,21,.8)";
    ctx.shadowBlur = 26;
    const body = ctx.createRadialGradient(-8, -8, 4, 0, 0, 48);
    body.addColorStop(0, "#fff7c2");
    body.addColorStop(0.5, "#fbbf24");
    body.addColorStop(1, "#f59e0b");
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.ellipse(0, 0, 44, 34, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = "#f59e0b";
    ctx.beginPath();
    ctx.moveTo(-8, 4);
    ctx.quadraticCurveTo(-42, 26, -34, -8);
    ctx.quadraticCurveTo(-22, 4, -8, 4);
    ctx.fill();
    ctx.fillStyle = "#e0f2fe";
    ctx.beginPath();
    ctx.arc(14, -10, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#082f49";
    ctx.beginPath();
    ctx.arc(17, -10, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#fb923c";
    ctx.beginPath();
    ctx.moveTo(38, -3);
    ctx.lineTo(56, 3);
    ctx.lineTo(38, 10);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    ctx.strokeStyle = "rgba(125,211,252,.45)";
    ctx.lineWidth = 2;
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.moveTo(bx - 95 - i * 15, by + 16 + i * 13);
      ctx.lineTo(bx - 65 - i * 15, by + 16 + i * 13);
      ctx.stroke();
    }
    ctx.fillStyle = "rgba(214,245,255,.7)";
    ctx.font = '600 15px "Be Vietnam Pro", sans-serif';
    ctx.textAlign = "left";
    ctx.fillText("TAP · SPACE · FLY", x + 24, y + h - 22);
    ctx.textAlign = "right";
    ctx.fillText("SCORE  000", x + w - 24, y + h - 22);
    ctx.textAlign = "left";
  }

  function drawSnakeArt(ctx, x, y, w, h) {
    const bg = ctx.createLinearGradient(x, y, x + w, y + h);
    bg.addColorStop(0, "#071209");
    bg.addColorStop(1, "#071b18");
    ctx.fillStyle = bg;
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = "rgba(163,230,53,.09)";
    ctx.lineWidth = 1;
    for (let gx = x; gx < x + w; gx += 38) {
      ctx.beginPath(); ctx.moveTo(gx, y); ctx.lineTo(gx, y + h); ctx.stroke();
    }
    for (let gy = y; gy < y + h; gy += 38) {
      ctx.beginPath(); ctx.moveTo(x, gy); ctx.lineTo(x + w, gy); ctx.stroke();
    }
    ctx.save();
    ctx.shadowColor = "rgba(163,230,53,.55)";
    ctx.shadowBlur = 18;
    ctx.strokeStyle = "rgba(163,230,53,.45)";
    ctx.lineWidth = 3;
    roundRect(ctx, x + 18, y + 18, w - 36, h - 36, 14);
    ctx.stroke();
    ctx.restore();
    const pts = [
      [0.17, 0.73], [0.25, 0.73], [0.33, 0.66], [0.42, 0.66], [0.5, 0.57],
      [0.58, 0.57], [0.65, 0.48], [0.65, 0.38], [0.58, 0.31], [0.49, 0.34],
    ].map((q) => [x + q[0] * w, y + q[1] * h]);
    ctx.save();
    ctx.shadowColor = "rgba(74,222,128,.7)";
    ctx.shadowBlur = 24;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    for (let pass = 0; pass < 2; pass++) {
      ctx.strokeStyle = pass === 0 ? "rgba(74,222,128,.22)" : "#4ade80";
      ctx.lineWidth = pass === 0 ? 34 : 22;
      ctx.beginPath();
      ctx.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
      ctx.stroke();
    }
    ctx.shadowBlur = 0;
    for (let i = 1; i < pts.length - 1; i++) {
      ctx.fillStyle = i % 2 ? "rgba(6,40,24,.35)" : "rgba(190,255,160,.22)";
      ctx.beginPath();
      ctx.arc(pts[i][0], pts[i][1], 8, 0, Math.PI * 2);
      ctx.fill();
    }
    const head = pts[pts.length - 1];
    ctx.fillStyle = "#bbf7d0";
    ctx.beginPath();
    ctx.arc(head[0], head[1], 15, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#052e16";
    ctx.beginPath(); ctx.arc(head[0] - 4, head[1] - 4, 2.6, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(head[0] + 5, head[1] - 4, 2.6, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#f43f5e";
    ctx.beginPath(); ctx.arc(head[0] + 1, head[1] + 6, 3.4, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    const fx = x + w * 0.79;
    const fy = y + h * 0.26;
    ctx.save();
    ctx.shadowColor = "rgba(244,63,94,.9)";
    ctx.shadowBlur = 28;
    const fg = ctx.createRadialGradient(fx - 4, fy - 5, 2, fx, fy, 22);
    fg.addColorStop(0, "#fecdd3");
    fg.addColorStop(0.45, "#fb7185");
    fg.addColorStop(1, "#e11d48");
    ctx.fillStyle = fg;
    ctx.beginPath(); ctx.arc(fx, fy, 19, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = "#4ade80";
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(fx, fy - 18); ctx.quadraticCurveTo(fx + 9, fy - 32, fx + 18, fy - 25); ctx.stroke();
    ctx.restore();
    ctx.fillStyle = "rgba(214,255,225,.7)";
    ctx.font = '600 15px "Be Vietnam Pro", sans-serif';
    ctx.fillText("SWIPE · ARROWS · WASD", x + 24, y + h - 22);
    ctx.textAlign = "right";
    ctx.fillText("HIGH  SCORE  014", x + w - 24, y + h - 22);
    ctx.textAlign = "left";
  }

  function drawChessArt(ctx, x, y, w, h) {
    const bg = ctx.createLinearGradient(x, y, x + w, y + h);
    bg.addColorStop(0, "#2a110b");
    bg.addColorStop(0.5, "#3a1710");
    bg.addColorStop(1, "#180a08");
    ctx.fillStyle = bg;
    ctx.fillRect(x, y, w, h);
    const bw = w * 0.82;
    const bh = h * 0.84;
    const bx = x + (w - bw) / 2;
    const by = y + (h - bh) / 2;
    ctx.save();
    ctx.shadowColor = "rgba(251,146,60,.28)";
    ctx.shadowBlur = 30;
    ctx.fillStyle = "#4a2014";
    roundRect(ctx, bx, by, bw, bh, 10);
    ctx.fill();
    ctx.restore();
    ctx.strokeStyle = "rgba(253,186,116,.42)";
    ctx.lineWidth = 1.2;
    for (let i = 0; i <= 8; i++) {
      const gx = bx + (bw / 8) * i;
      ctx.beginPath(); ctx.moveTo(gx, by); ctx.lineTo(gx, by + bh); ctx.stroke();
    }
    for (let j = 0; j <= 9; j++) {
      const gy = by + (bh / 9) * j;
      ctx.beginPath(); ctx.moveTo(bx, gy); ctx.lineTo(bx + bw, gy); ctx.stroke();
    }
    ctx.fillStyle = "rgba(21,7,5,.35)";
    ctx.fillRect(bx, by + bh * 0.44, bw, bh * 0.12);
    ctx.fillStyle = "rgba(253,186,116,.4)";
    ctx.font = '600 16px "Be Vietnam Pro", sans-serif';
    ctx.textAlign = "center";
    ctx.fillText("SÔNG  ·  GIỚI TUYẾN", bx + bw / 2, by + bh * 0.51);
    ctx.textAlign = "left";
    const piece = (col, row, char, red, r) => {
      const px = bx + (bw / 8) * col;
      const py = by + (bh / 9) * row;
      ctx.save();
      ctx.shadowColor = red ? "rgba(248,113,113,.72)" : "rgba(203,213,225,.48)";
      ctx.shadowBlur = 16;
      const pg = ctx.createRadialGradient(px - 5, py - 6, 2, px, py, r);
      pg.addColorStop(0, red ? "#fca5a5" : "#e2e8f0");
      pg.addColorStop(1, red ? "#991b1b" : "#1e293b");
      ctx.fillStyle = pg;
      ctx.beginPath(); ctx.arc(px, py, r, 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = red ? "rgba(254,202,202,.75)" : "rgba(226,232,240,.45)";
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(px, py, r - 3, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = red ? "#fff1f2" : "#f8fafc";
      ctx.font = `700 ${Math.round(r * 1.15)}px "Be Vietnam Pro", serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(char, px, py + 1);
      ctx.textAlign = "left";
      ctx.textBaseline = "alphabetic";
      ctx.restore();
    };
    piece(4, 0, "將", false, 20);
    piece(1, 3, "車", false, 18);
    piece(7, 6, "砲", false, 18);
    piece(4, 9, "帥", true, 22);
    piece(2, 6, "傌", true, 18);
    piece(6, 3, "俥", true, 18);
    ctx.strokeStyle = "rgba(251,146,60,.22)";
    ctx.lineWidth = 2;
    ctx.strokeRect(bx - 10, by - 10, bw + 20, bh + 20);
    ctx.fillStyle = "rgba(255,237,213,.65)";
    ctx.font = '600 15px "Be Vietnam Pro", sans-serif';
    ctx.fillText("2 NGƯỜI · LUẬT ĐẦY ĐỦ", x + 24, y + h - 22);
    ctx.textAlign = "right";
    ctx.fillText("CHIẾU TƯỚNG", x + w - 24, y + h - 22);
    ctx.textAlign = "left";
  }

  function drawOanQuanArt(ctx, x, y, w, h) {
    const bg = ctx.createLinearGradient(x, y, x + w, y + h);
    bg.addColorStop(0, "#2b1b0c");
    bg.addColorStop(0.5, "#3c2a14");
    bg.addColorStop(1, "#1d1208");
    ctx.fillStyle = bg;
    ctx.fillRect(x, y, w, h);
    const bx = x + 28;
    const by = y + 40;
    const bw = w - 56;
    const bh = h - 80;
    ctx.save();
    ctx.shadowColor = "rgba(252,211,77,.22)";
    ctx.shadowBlur = 28;
    ctx.fillStyle = "rgba(80,53,25,.9)";
    roundRect(ctx, bx, by, bw, bh, 16);
    ctx.fill();
    ctx.restore();
    ctx.strokeStyle = "rgba(253,224,71,.45)";
    ctx.lineWidth = 2;
    roundRect(ctx, bx, by, bw, bh, 16);
    ctx.stroke();
    const quanW = bw * 0.14;
    const cellW = (bw - quanW * 2) / 10;
    const cellH = bh * 0.42;
    ctx.strokeStyle = "rgba(253,224,71,.3)";
    ctx.lineWidth = 1.4;
    for (let i = 0; i < 10; i++) {
      const cx = bx + quanW + i * cellW;
      ctx.strokeRect(cx, by + bh * 0.08, cellW, cellH);
      ctx.strokeRect(cx, by + bh * 0.5, cellW, cellH);
    }
    [bx, bx + bw - quanW].forEach((qx) => {
      ctx.beginPath();
      ctx.ellipse(qx + quanW / 2, by + bh / 2, quanW / 2, bh * 0.3, 0, 0, Math.PI * 2);
      ctx.stroke();
    });
    const stone = (sx, sy, color) => {
      ctx.save();
      ctx.shadowColor = color;
      ctx.shadowBlur = 8;
      ctx.fillStyle = color;
      ctx.beginPath(); ctx.arc(sx, sy, 6, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    };
    for (let i = 0; i < 10; i++) {
      const cx = bx + quanW + i * cellW + cellW / 2;
      const count = 2 + ((i * 3) % 5);
      for (let s = 0; s < count; s++) {
        stone(cx + Math.cos(s * 2.4) * 13, by + bh * 0.29 + Math.sin(s * 2.4) * 9, s % 2 ? "#fde68a" : "#fbbf24");
      }
      for (let s = 0; s < 3; s++) {
        stone(cx + Math.cos(s * 2) * 12, by + bh * 0.71 + Math.sin(s * 2) * 8, s % 2 ? "#fcd34d" : "#f59e0b");
      }
    }
    for (let s = 0; s < 8; s++) {
      const ang = (s / 8) * Math.PI * 2;
      stone(bx + quanW / 2 + Math.cos(ang) * 15, by + bh / 2 + Math.sin(ang) * 22, "#fbbf24");
      stone(bx + bw - quanW / 2 + Math.cos(ang) * 15, by + bh / 2 + Math.sin(ang) * 22, "#fbbf24");
    }
    ctx.fillStyle = "rgba(255,247,214,.7)";
    ctx.font = '600 15px "Be Vietnam Pro", sans-serif';
    ctx.fillText("RẢI SỎI · BẮT QUÂN", x + 28, y + h - 22);
    ctx.textAlign = "right";
    ctx.fillText("DÂN GIAN VIỆT NAM", x + w - 28, y + h - 22);
    ctx.textAlign = "left";
  }

  const ART_FNS = { flap: drawFlapArt, snake: drawSnakeArt, chess: drawChessArt, oanquan: drawOanQuanArt };

  function drawCardFront(p) {
    return canvasTexture(768, 1020, (ctx, w, h) => {
      const bg = ctx.createLinearGradient(0, 0, w, h);
      bg.addColorStop(0, "#060b18");
      bg.addColorStop(0.58, "#0a1124");
      bg.addColorStop(1, mixHex(p.accent, "#060b18", 0.82));
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);
      const rg = ctx.createRadialGradient(w * 0.5, 400, 10, w * 0.5, 400, 470);
      rg.addColorStop(0, hexA(p.accent, 0.2));
      rg.addColorStop(1, hexA(p.accent, 0));
      ctx.fillStyle = rg;
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = "rgba(255,255,255,.032)";
      ctx.lineWidth = 1;
      for (let gx = 0; gx < w; gx += 48) { ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, h); ctx.stroke(); }
      for (let gy = 0; gy < h; gy += 48) { ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(w, gy); ctx.stroke(); }

      ctx.font = '600 16px "Be Vietnam Pro", sans-serif';
      ctx.fillStyle = "rgba(235,245,255,.48)";
      ctx.fillText("PROJECT // " + p.num, 46, 64);
      ctx.textAlign = "right";
      ctx.fillText("2026 · PLAYABLE", w - 46, 64);
      ctx.textAlign = "left";

      ctx.save();
      roundRect(ctx, 44, 100, w - 88, 548, 20);
      ctx.clip();
      ART_FNS[p.art](ctx, 44, 100, w - 88, 548, p);
      ctx.restore();
      roundRect(ctx, 44, 100, w - 88, 548, 20);
      ctx.strokeStyle = hexA(p.accent, 0.36);
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.fillStyle = "rgba(255,255,255,.06)";
      ctx.font = '800 180px "Be Vietnam Pro", sans-serif';
      ctx.textAlign = "right";
      ctx.fillText(p.num, w - 38, 1000);
      ctx.textAlign = "left";

      ctx.font = '800 62px "Be Vietnam Pro", sans-serif';
      ctx.fillStyle = "#f6fbff";
      ctx.fillText(p.title, 44, 754);
      ctx.fillStyle = p.accent;
      ctx.fillRect(44, 780, 58, 3);
      ctx.font = '600 20px "Be Vietnam Pro", sans-serif';
      ctx.fillStyle = p.accent;
      ctx.fillText(p.tag, 44, 825);

      ctx.font = '400 21px "Be Vietnam Pro", sans-serif';
      drawWrapped(ctx, p.desc, 44, 872, w - 160, 32, 2, "rgba(209,224,246,.62)");
      drawTechChips(ctx, p.tech, 44, 945, p.accent, w - 100);

      ctx.font = '500 15px "Be Vietnam Pro", sans-serif';
      ctx.fillStyle = "rgba(232,244,255,.4)";
      ctx.fillText("↻  LẬT THẺ ĐỂ XEM CHI TIẾT", 44, 1000);
      ctx.textAlign = "right";
      ctx.fillText(p.num + " / 04", w - 44, 1000);
      ctx.textAlign = "left";
    });
  }

  function drawCardBack(p) {
    return canvasTexture(768, 1020, (ctx, w, h) => {
      const bg = ctx.createLinearGradient(0, 0, w, h);
      bg.addColorStop(0, "#070d1c");
      bg.addColorStop(0.55, "#0a1226");
      bg.addColorStop(1, mixHex(p.accent, "#050912", 0.78));
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);
      const rg = ctx.createRadialGradient(w * 0.2, 120, 5, w * 0.2, 120, 500);
      rg.addColorStop(0, hexA(p.accent, 0.18));
      rg.addColorStop(1, hexA(p.accent, 0));
      ctx.fillStyle = rg;
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = hexA(p.accent, 0.28);
      ctx.lineWidth = 1.5;
      roundRect(ctx, 28, 28, w - 56, h - 56, 22);
      ctx.stroke();
      ctx.strokeStyle = "rgba(255,255,255,.04)";
      for (let gx = 0; gx < w; gx += 48) { ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, h); ctx.stroke(); }
      for (let gy = 0; gy < h; gy += 48) { ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(w, gy); ctx.stroke(); }

      ctx.font = '600 15px "Be Vietnam Pro", sans-serif';
      ctx.fillStyle = hexA(p.accent, 0.8);
      ctx.fillText("HỒ SƠ DỰ ÁN  //  " + p.num, 60, 88);
      ctx.textAlign = "right";
      ctx.fillStyle = "rgba(235,245,255,.38)";
      ctx.fillText("↻  ESC ĐỂ LẬT LẠI", w - 60, 88);
      ctx.textAlign = "left";

      ctx.font = '800 58px "Be Vietnam Pro", sans-serif';
      ctx.fillStyle = "#f5fbff";
      ctx.fillText(p.title, 60, 172);
      ctx.fillStyle = p.accent;
      ctx.fillRect(60, 200, 70, 3);

      ctx.font = '400 22px "Be Vietnam Pro", sans-serif';
      drawWrapped(ctx, p.desc, 60, 252, w - 120, 36, 4, "rgba(213,228,248,.72)");

      ctx.font = '600 13px "Be Vietnam Pro", sans-serif';
      ctx.fillStyle = "rgba(235,245,255,.38)";
      ctx.fillText("TECH STACK", 60, 442);
      drawTechChips(ctx, p.tech, 60, 462, p.accent, w - 120);

      ctx.font = '600 13px "Be Vietnam Pro", sans-serif';
      ctx.fillStyle = "rgba(235,245,255,.38)";
      ctx.fillText("ĐIỂM NỔI BẬT", 60, 558);
      ctx.font = '400 20px "Be Vietnam Pro", sans-serif';
      p.features.forEach((f, i) => {
        const yy = 600 + i * 40;
        ctx.fillStyle = p.accent;
        ctx.beginPath(); ctx.arc(68, yy - 6, 4, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "rgba(213,228,248,.74)";
        ctx.fillText(f, 88, yy);
      });

      const ctaG = ctx.createLinearGradient(60, 0, w - 60, 0);
      ctaG.addColorStop(0, hexA(p.accent, 0.18));
      ctaG.addColorStop(1, hexA(p.accent2, 0.08));
      ctx.fillStyle = ctaG;
      roundRect(ctx, 60, 778, w - 120, 140, 16);
      ctx.fill();
      ctx.strokeStyle = hexA(p.accent, 0.46);
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.fillStyle = "#f4fbff";
      ctx.font = '700 34px "Be Vietnam Pro", sans-serif';
      ctx.fillText("CHƠI NGAY", 92, 840);
      ctx.font = '400 17px "Be Vietnam Pro", sans-serif';
      ctx.fillStyle = "rgba(216,233,250,.6)";
      ctx.fillText("Bấm lần nữa để mở trò chơi", 92, 874);
      ctx.fillStyle = p.accent;
      ctx.font = '700 44px "Be Vietnam Pro", sans-serif';
      ctx.textAlign = "right";
      ctx.fillText("↗", w - 100, 850);
      ctx.textAlign = "left";

      ctx.font = '600 14px "Be Vietnam Pro", sans-serif';
      ctx.fillStyle = "rgba(235,245,255,.33)";
      ctx.fillText("PROJECT " + p.num + " / 04", 60, 970);
      ctx.textAlign = "right";
      ctx.fillText("bai tap · 2026", w - 60, 970);
      ctx.textAlign = "left";
    });
  }

  /* ------------------------------ scene init ---------------------------- */
  async function initScene() {
    if (!window.THREE) {
      fail("Không tải được Three.js.");
      return;
    }
    setLoad(8, "nạp hạt sáng");
    await tick();

    renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: "high-performance",
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, state.isMobile ? 1.5 : 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.04;
    dom.webgl.appendChild(renderer.domElement);
    renderer.domElement.setAttribute("aria-hidden", "true");

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x05060f);
    scene.fog = new THREE.FogExp2(0x05060f, 0.013);

    camera = new THREE.PerspectiveCamera(state.isMobile ? 58 : 52, window.innerWidth / window.innerHeight, 0.1, 400);
    raycaster = new THREE.Raycaster();
    raycaster.params.Points.threshold = 0.2;

    ambient = new THREE.AmbientLight(0x8798bf, 0.8);
    scene.add(ambient);
    hemi = new THREE.HemisphereLight(0x8ec5ff, 0x05060f, 0.6);
    scene.add(hemi);
    keyLight = new THREE.DirectionalLight(0xffffff, 1.6);
    keyLight.position.set(9, 14, 8);
    scene.add(keyLight);
    rimLight = new THREE.PointLight(0x38bdf8, 2.2, 42, 2);
    rimLight.position.set(-5, 5, 7);
    scene.add(rimLight);
    stationLight = new THREE.PointLight(0xa78bfa, 2.6, 60, 2);
    stationLight.position.set(0, 8, -26);
    scene.add(stationLight);

    setLoad(20, "dựng trường tinh tú");
    await tick();
    createStars();
    createGrid();
    createJourneyLine();
    createOverview();
    createClouds();

    setLoad(38, "triệu hồi avatar");
    await tick();
    createAvatar();

    setLoad(55, "gieo quỹ đạo kỹ năng");
    await tick();
    createSolarSystem();

    setLoad(72, "treo thẻ dự án");
    await tick();
    createProjects();

    setLoad(86, "kết nối đài liên lạc");
    await tick();
    createContact();

    setLoad(94, "căn chỉnh camera");
    await tick();
    buildCameraPath();
    layoutResponsive();
    updateSceneColors(0.016);

    // initial state from URL / scroll position
    if (debugStation === null) setupHash();
    state.progress = state.target = debugStation === null
      ? window.scrollY / maxScroll()
      : progressForStation(debugStation);
    state.stationPos = state.progress * (N - 1);
    updatePanels();
    updateCamera(0.016, true);

    setLoad(100, "sẵn sàng");
    startLoop();
    state.ready = true;
    setTimeout(() => {
      document.body.classList.remove("is-loading");
      if (dom.loader) dom.loader.classList.add("is-done");
      setTimeout(() => {
        if (dom.loader) dom.loader.style.display = "none";
      }, 850);
      showBubble("Chào bạn! Mình là bai tap ✦", 4300);
      state.waveUntil = state.time + 2.2;
    }, 420);
  }

  function setupHash() {
    const hash = (location.hash || "").replace("#", "");
    const idx = SECTION_IDS.indexOf(hash);
    if (idx > 0) {
      window.scrollTo(0, progressForStation(idx) * maxScroll());
    }
  }

  /* ------------------------------- stars -------------------------------- */
  function createStars() {
    const count = state.isMobile ? 900 : 1900;
    const layers = [
      { n: Math.round(count * 0.55), size: 0.11, opacity: 0.85, z: [8, -150], spread: 1.0 },
      { n: Math.round(count * 0.3), size: 0.24, opacity: 0.55, z: [0, -170], spread: 1.3 },
      { n: Math.round(count * 0.15), size: 0.38, opacity: 0.35, z: [-10, -180], spread: 1.7 },
    ];
    const palette = [0xffffff, 0x9be8ff, 0xbfc8ff, 0xffd9a8, 0xd6b7ff];
    layers.forEach((layer, li) => {
      const positions = new Float32Array(layer.n * 3);
      const colors = new Float32Array(layer.n * 3);
      const color = new THREE.Color();
      for (let i = 0; i < layer.n; i++) {
        const spread = layer.spread;
        positions[i * 3] = (Math.random() - 0.5) * 150 * spread;
        positions[i * 3 + 1] = (Math.random() - 0.15) * 70 * spread - 4;
        positions[i * 3 + 2] = layer.z[0] + Math.random() * (layer.z[1] - layer.z[0]);
        color.setHex(palette[Math.floor(Math.random() * palette.length)]);
        color.multiplyScalar(0.65 + Math.random() * 0.5);
        colors[i * 3] = color.r;
        colors[i * 3 + 1] = color.g;
        colors[i * 3 + 2] = color.b;
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
      geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
      const mat = new THREE.PointsMaterial({
        size: layer.size,
        map: glowTexture(0xffffff),
        vertexColors: true,
        transparent: true,
        opacity: layer.opacity,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        sizeAttenuation: true,
        fog: false,
      });
      const points = new THREE.Points(geo, mat);
      points.userData.baseOpacity = layer.opacity;
      scene.add(points);
      stars.push(points);
    });

    // near dust — subtle drifting particles near the path
    const dustCount = state.isMobile ? 120 : 280;
    const pos = new Float32Array(dustCount * 3);
    for (let i = 0; i < dustCount; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 40;
      pos[i * 3 + 1] = Math.random() * 16 - 1;
      pos[i * 3 + 2] = 6 - Math.random() * 100;
    }
    const dustGeo = new THREE.BufferGeometry();
    dustGeo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    dust = new THREE.Points(
      dustGeo,
      new THREE.PointsMaterial({
        size: 0.09,
        map: glowTexture(0x7dd3fc),
        color: 0x9be8ff,
        transparent: true,
        opacity: 0.42,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        sizeAttenuation: true,
      })
    );
    dust.userData.baseOpacity = 0.42;
    scene.add(dust);
  }

  /* -------------------------------- grid -------------------------------- */
  function createGrid() {
    const geo = new THREE.PlaneGeometry(260, 360);
    gridMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uTime: { value: 0 },
        uColor: { value: new THREE.Color(0x38bdf8) },
        uScroll: { value: 0 },
        uOpacity: { value: 0.5 },
      },
      vertexShader: `
        varying vec3 vWorld;
        void main() {
          vec4 world = modelMatrix * vec4(position, 1.0);
          vWorld = world.xyz;
          gl_Position = projectionMatrix * viewMatrix * world;
        }
      `,
      fragmentShader: `
        uniform float uTime;
        uniform float uScroll;
        uniform float uOpacity;
        uniform vec3 uColor;
        varying vec3 vWorld;
        float gridLine(vec2 p, float scale) {
          vec2 coord = p * scale;
          vec2 deriv = fwidth(coord);
          vec2 grid = abs(fract(coord - 0.5) - 0.5) / max(deriv, vec2(0.0001));
          float line = min(grid.x, grid.y);
          return 1.0 - min(line, 1.0);
        }
        void main() {
          vec2 p = vWorld.xz;
          p.y += uScroll;
          float minor = gridLine(p, 0.45);
          float major = gridLine(p, 0.09);
          float lines = minor * 0.28 + major * 0.82;
          float dist = length(vWorld.xz - vec2(0.0, -44.0));
          float fade = 1.0 - smoothstep(24.0, 118.0, dist);
          float pulse = 0.74 + 0.26 * sin(vWorld.z * 0.1 + uTime * 0.55);
          float alpha = lines * fade * uOpacity * pulse;
          if (alpha < 0.004) discard;
          gl_FragColor = vec4(uColor, alpha);
        }
      `,
    });
    gridPlane = new THREE.Mesh(geo, gridMat);
    gridPlane.rotation.x = -Math.PI / 2;
    gridPlane.position.set(0, -1.55, -50);
    scene.add(gridPlane);
  }

  function createJourneyLine() {
    const points = [
      new THREE.Vector3(0, -1.4, 9),
      new THREE.Vector3(0.5, -1.4, -5),
      new THREE.Vector3(0, -1.4, -24),
      new THREE.Vector3(-0.4, -1.4, -40),
      new THREE.Vector3(0, -1.4, -54),
      new THREE.Vector3(0.4, -1.4, -68),
      new THREE.Vector3(0, -1.4, -80),
      new THREE.Vector3(0, -1.4, -92),
    ];
    const curve = new THREE.CatmullRomCurve3(points);
    const geo = new THREE.BufferGeometry().setFromPoints(curve.getPoints(160));
    const colors = [];
    const stops = [
      new THREE.Color(0x38bdf8),
      new THREE.Color(0xa78bfa),
      new THREE.Color(0xfb923c),
      new THREE.Color(0x34d399),
      new THREE.Color(0xbfe6ff),
    ];
    for (let i = 0; i < 161; i++) {
      const t = i / 160;
      const seg = Math.min(stops.length - 2, Math.floor(t * (stops.length - 1)));
      const local = t * (stops.length - 1) - seg;
      const c = stops[seg].clone().lerp(stops[seg + 1], local);
      colors.push(c.r, c.g, c.b);
    }
    geo.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
    const mat = new THREE.LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.55,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    journeyLine = new THREE.Line(geo, mat);
    scene.add(journeyLine);

    const beacons = [
      { z: 0, y: 2.2, color: 0x38bdf8, size: 5.5 },
      { z: -24, y: 3.4, color: 0xa78bfa, size: 7.5 },
      { z: -54, y: 3.2, color: 0xfb923c, size: 6.5 },
      { z: -78, y: 3.2, color: 0x34d399, size: 6.2 },
    ];
    beacons.forEach((b) => {
      const glow = makeGlow(b.color, b.size, 0.1);
      glow.position.set(0, b.y, b.z);
      scene.add(glow);
      stationBeacons.push(glow);
    });
  }

  function createOverview() {
    overviewGroup = new THREE.Group();
    const stations = [
      { z: 0, color: 0x38bdf8, name: "CỔNG VÀO" },
      { z: -24, color: 0xa78bfa, name: "KỸ NĂNG" },
      { z: -54, color: 0xfb923c, name: "DỰ ÁN" },
      { z: -78, color: 0x34d399, name: "LIÊN HỆ" },
    ];
    stations.forEach((s) => {
      const ringMat = new THREE.MeshBasicMaterial({
        color: s.color,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const ring = new THREE.Mesh(new THREE.TorusGeometry(2.7, 0.03, 6, 80), ringMat);
      ring.rotation.x = Math.PI / 2;
      ring.position.set(0, -1.3, s.z);
      overviewGroup.add(ring);

      const dot = makeGlow(s.color, 3.2, 0.0001);
      dot.position.set(0, 1.4, s.z);
      overviewMats.push({ material: dot.material, base: 0.35 });

      overviewMats.push({ material: ringMat, base: 0.5 });
    });
    scene.add(overviewGroup);
  }

  function createClouds() {    cloudGroup = new THREE.Group();
    const cloudTex = canvasTexture(512, 256, (ctx, w, h) => {
      ctx.clearRect(0, 0, w, h);
      const blobs = [
        [0.3, 0.55, 0.26], [0.46, 0.44, 0.32], [0.62, 0.52, 0.27],
        [0.74, 0.6, 0.2], [0.4, 0.66, 0.24], [0.56, 0.68, 0.24],
      ];
      blobs.forEach(([bx, by, br]) => {
        const g = ctx.createRadialGradient(bx * w, by * h, 0, bx * w, by * h, br * w);
        g.addColorStop(0, "rgba(255,255,255,.85)");
        g.addColorStop(0.55, "rgba(255,255,255,.32)");
        g.addColorStop(1, "rgba(255,255,255,0)");
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, h);
      });
    });
    for (let i = 0; i < 7; i++) {
      const mat = new THREE.SpriteMaterial({
        map: cloudTex,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        fog: false,
      });
      const sprite = new THREE.Sprite(mat);
      sprite.position.set((Math.random() - 0.5) * 70, 8 + Math.random() * 18, 5 - Math.random() * 110);
      const s = 20 + Math.random() * 26;
      sprite.scale.set(s, s * 0.38, 1);
      sprite.userData.baseX = sprite.position.x;
      sprite.userData.speed = 0.2 + Math.random() * 0.4;
      sprite.userData.phase = Math.random() * 10;
      cloudGroup.add(sprite);
    }
    scene.add(cloudGroup);
  }

  /* ------------------------------- avatar -------------------------------- */
  function createAvatar() {
    avatar = new THREE.Group();
    avatar.position.set(2.7, 0, 0);
    scene.add(avatar);

    const suitMat = new THREE.MeshStandardMaterial({
      color: 0xdff4ff,
      roughness: 0.42,
      metalness: 0.22,
      emissive: 0x0a3a55,
      emissiveIntensity: 0.22,
      flatShading: false,
    });
    const darkMat = new THREE.MeshStandardMaterial({
      color: 0x081527,
      roughness: 0.38,
      metalness: 0.65,
      emissive: 0x072538,
      emissiveIntensity: 0.5,
    });
    const accentMat = new THREE.MeshStandardMaterial({
      color: 0x5eead4,
      emissive: 0x22d3ee,
      emissiveIntensity: 1.3,
      roughness: 0.3,
      metalness: 0.2,
    });
    const visorMat = new THREE.MeshPhysicalMaterial({
      color: 0x051226,
      roughness: 0.08,
      metalness: 0.85,
      clearcoat: 1,
      clearcoatRoughness: 0.08,
      emissive: 0x083b58,
      emissiveIntensity: 0.55,
    });

    // platform
    const base = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 1.42, 0.16, 56), darkMat);
    base.position.y = 0.02;
    avatar.add(base);
    const baseTop = new THREE.Mesh(new THREE.CylinderGeometry(1.02, 1.02, 0.035, 56), accentMat);
    baseTop.position.y = 0.11;
    baseTop.material = new THREE.MeshBasicMaterial({ color: 0x5eead4, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending });
    avatar.add(baseTop);
    avatarRings.push(baseTop);
    for (let i = 0; i < 3; i++) {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(1.1 + i * 0.14, 0.008, 6, 80),
        new THREE.MeshBasicMaterial({ color: 0x5eead4, transparent: true, opacity: 0.36 - i * 0.08, blending: THREE.AdditiveBlending })
      );
      ring.rotation.x = Math.PI / 2;
      ring.position.y = 0.13 + i * 0.02;
      ring.userData.spin = 0.1 + i * 0.06;
      avatar.add(ring);
      avatarRings.push(ring);
    }
    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.94, 1.06, 3.7, 36, 1, true),
      new THREE.MeshBasicMaterial({
        color: 0x5eead4,
        transparent: true,
        opacity: 0.045,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    beam.position.y = 1.95;
    avatar.add(beam);

    avatarBody = new THREE.Group();
    avatarBody.position.y = 0.22;
    avatar.add(avatarBody);

    // legs
    const makeLeg = (side) => {
      const pivot = new THREE.Group();
      pivot.position.set(side * 0.25, 0.94, 0);
      const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.145, 0.46, 6, 12), suitMat);
      leg.position.y = -0.35;
      pivot.add(leg);
      const boot = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.18, 0.4), darkMat);
      boot.position.set(0, -0.72, 0.05);
      pivot.add(boot);
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.28, 0.02), accentMat);
      stripe.position.set(side * 0.11, -0.4, 0.15);
      pivot.add(stripe);
      avatarBody.add(pivot);
      return pivot;
    };
    const legL = makeLeg(-1);
    const legR = makeLeg(1);
    legL.rotation.x = 0.06;
    legR.rotation.x = -0.04;
    legL.userData.baseRotX = 0.06;
    legR.userData.baseRotX = -0.04;
    avatar.userData.legs = [legL, legR];

    // torso
    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.46, 0.5, 8, 20), suitMat);
    torso.position.y = 1.62;
    avatarBody.add(torso);
    const chest = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.28, 0.1), darkMat);
    chest.position.set(0, 1.72, 0.42);
    avatarBody.add(chest);
    const chestLight = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.035, 0.02), accentMat);
    chestLight.position.set(0, 1.75, 0.48);
    avatarBody.add(chestLight);
    const belt = new THREE.Mesh(new THREE.TorusGeometry(0.43, 0.035, 8, 32), darkMat);
    belt.position.y = 1.22;
    belt.rotation.x = Math.PI / 2;
    avatarBody.add(belt);
    const beltGlow = new THREE.Mesh(new THREE.TorusGeometry(0.44, 0.008, 6, 40), accentMat);
    beltGlow.position.y = 1.22;
    beltGlow.rotation.x = Math.PI / 2;
    avatarBody.add(beltGlow);

    // backpack
    const pack = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.62, 0.2), darkMat);
    pack.position.set(0, 1.7, -0.44);
    avatarBody.add(pack);
    [-0.14, 0.14].forEach((x) => {
      const cell = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.34, 0.02), accentMat);
      cell.position.set(x, 1.7, -0.55);
      avatarBody.add(cell);
    });

    // arms
    const makeArm = (side) => {
      const pivot = new THREE.Group();
      pivot.position.set(side * 0.56, 2.02, 0);
      const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.12, 0.48, 6, 12), suitMat);
      arm.position.y = -0.34;
      pivot.add(arm);
      const cuff = new THREE.Mesh(new THREE.TorusGeometry(0.125, 0.025, 6, 20), accentMat);
      cuff.position.y = -0.14;
      cuff.rotation.x = Math.PI / 2;
      pivot.add(cuff);
      const hand = new THREE.Mesh(new THREE.SphereGeometry(0.125, 14, 12), darkMat);
      hand.position.y = -0.66;
      pivot.add(hand);
      const knuckle = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 8), accentMat);
      knuckle.position.set(0, -0.66, 0.11);
      pivot.add(knuckle);
      pivot.rotation.z = side * 0.16;
      pivot.userData.baseRotZ = side * 0.16;
      avatarBody.add(pivot);
      return pivot;
    };
    avatarArmL = makeArm(-1);
    avatarArmR = makeArm(1);

    // neck + head
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.18, 0.16, 16), darkMat);
    neck.position.y = 2.24;
    avatarBody.add(neck);

    avatarHead = new THREE.Group();
    avatarHead.position.y = 2.68;
    avatarBody.add(avatarHead);
    const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.52, 28, 22), suitMat);
    helmet.scale.set(1, 1.03, 1);
    avatarHead.add(helmet);
    const helmetRing = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.028, 8, 40), accentMat);
    helmetRing.rotation.x = Math.PI / 2;
    helmetRing.position.y = -0.2;
    avatarHead.add(helmetRing);
    const visor = new THREE.Mesh(new THREE.SphereGeometry(0.47, 28, 20), visorMat);
    visor.scale.set(0.95, 0.62, 0.72);
    visor.position.set(0, 0.02, 0.28);
    avatarHead.add(visor);
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0x9ffcff });
    [-0.13, 0.13].forEach((x) => {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.042, 10, 10), eyeMat);
      eye.position.set(x, 0.05, 0.6);
      avatarHead.add(eye);
      avatarEyes.push(eye);
    });
    const antenna = new THREE.Group();
    antenna.position.set(0.28, 0.42, 0);
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.018, 0.24, 6), darkMat);
    stem.position.y = 0.1;
    antenna.add(stem);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.055, 12, 10), accentMat);
    bulb.position.y = 0.24;
    antenna.add(bulb);
    avatarHead.add(antenna);
    const earL = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.1, 14), darkMat);
    earL.rotation.z = Math.PI / 2;
    earL.position.set(-0.5, 0, 0);
    avatarHead.add(earL);
    const earR = earL.clone();
    earR.position.x = 0.5;
    avatarHead.add(earR);

    // holo rings around body
    [1.28, 2.05].forEach((y, i) => {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(0.82 + i * 0.1, 0.006, 6, 80),
        new THREE.MeshBasicMaterial({ color: i ? 0xa78bfa : 0x5eead4, transparent: true, opacity: 0.4, blending: THREE.AdditiveBlending })
      );
      ring.position.y = y;
      ring.rotation.x = Math.PI / 2 + (i ? 0.22 : -0.15);
      ring.rotation.z = 0.2;
      ring.userData.spin = i ? -0.3 : 0.2;
      avatarBody.add(ring);
      avatarRings.push(ring);
    });

    const glow = makeGlow(0x38bdf8, 7.5, 0.16);
    glow.position.set(0, 1.8, -0.4);
    avatar.add(glow);

    // avatar hover hits
    [helmet, torso, chest, pack].forEach((mesh) => {
      mesh.userData.avatarHit = true;
      avatarHits.push(mesh);
    });

    // floating particles
    const pCount = state.isMobile ? 32 : 64;
    const positions = new Float32Array(pCount * 3);
    for (let i = 0; i < pCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const radius = 0.75 + Math.random() * 1.1;
      avatarParticleData.push({
        angle,
        radius,
        y: Math.random() * 3.6,
        speed: 0.15 + Math.random() * 0.35,
        wobble: Math.random() * Math.PI * 2,
      });
      positions[i * 3] = Math.cos(angle) * radius;
      positions[i * 3 + 1] = Math.random() * 3.6;
      positions[i * 3 + 2] = Math.sin(angle) * radius;
    }
    const pGeo = new THREE.BufferGeometry();
    pGeo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    const pMat = new THREE.PointsMaterial({
      size: 0.065,
      map: glowTexture(0x7dd3fc),
      color: 0x9be8ff,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true,
    });
    avatarParticles = new THREE.Points(pGeo, pMat);
    avatar.add(avatarParticles);
  }

  /* ---------------------------- solar system ---------------------------- */
  function createSolarSystem() {
    solarSystem = new THREE.Group();
    solarSystem.position.set(state.isMobile ? 0 : 2.7, state.isMobile ? 2.3 : 1.9, state.isMobile ? -24 : -30);
    scene.add(solarSystem);

    const sunMat = new THREE.MeshBasicMaterial({ map: sunTexture() });
    sun = new THREE.Mesh(new THREE.IcosahedronGeometry(1.02, 3), sunMat);
    solarSystem.add(sun);
    const sunWire = new THREE.Mesh(
      new THREE.IcosahedronGeometry(1.2, 1),
      new THREE.MeshBasicMaterial({ color: 0xd8b4fe, wireframe: true, transparent: true, opacity: 0.22 })
    );
    sun.add(sunWire);
    sunWire.userData.spin = 0.15;
    const sunGlow = makeGlow(0xa78bfa, 7.2, 0.55);
    sunGlow.position.set(0, 0, 1.4);
    solarSystem.add(sunGlow);
    sun.userData.glow = sunGlow;
    const sunCoreGlow = makeGlow(0xffffff, 2.6, 0.75);
    sunCoreGlow.position.set(0, 0, 1.5);
    solarSystem.add(sunCoreGlow);
    sun.userData.coreGlow = sunCoreGlow;

    const corona = new THREE.Mesh(
      new THREE.TorusGeometry(1.42, 0.012, 6, 100),
      new THREE.MeshBasicMaterial({ color: 0xe9d5ff, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending })
    );
    corona.rotation.x = Math.PI / 2.4;
    solarSystem.add(corona);
    corona.userData.spin = -0.18;
    solarSystem.userData.corona = corona;

    sunLight = new THREE.PointLight(0xc4b5fd, 4.2, 28, 2);
    sunLight.position.set(0, 0, 0);
    solarSystem.add(sunLight);

    SKILLS.forEach((skill, i) => {
      const orbit = new THREE.Group();
      orbit.rotation.x = skill.tilt;
      orbit.rotation.y = (i / SKILLS.length) * Math.PI * 2;
      orbit.userData.speed = skill.speed;
      orbit.userData.phase = i * 1.7;
      solarSystem.add(orbit);

      const points = [];
      for (let n = 0; n <= 128; n++) {
        const a = (n / 128) * Math.PI * 2;
        points.push(new THREE.Vector3(Math.cos(a) * skill.radius, 0, Math.sin(a) * skill.radius));
      }
      const orbitLine = new THREE.LineLoop(
        new THREE.BufferGeometry().setFromPoints(points),
        new THREE.LineBasicMaterial({ color: skill.color, transparent: true, opacity: 0.14, blending: THREE.AdditiveBlending })
      );
      orbit.add(orbitLine);

      const planetGroup = new THREE.Group();
      planetGroup.position.set(skill.radius, 0, 0);
      orbit.add(planetGroup);

      const planetMat = new THREE.MeshBasicMaterial({ map: planetTexture(skill.color) });
      const mesh = new THREE.Mesh(new THREE.SphereGeometry(skill.size, 26, 20), planetMat);
      mesh.userData.skillIndex = i;
      planetGroup.add(mesh);

      const wire = new THREE.Mesh(
        new THREE.SphereGeometry(skill.size * 1.08, 12, 10),
        new THREE.MeshBasicMaterial({ color: 0xffffff, wireframe: true, transparent: true, opacity: 0.07 })
      );
      planetGroup.add(wire);

      if (i === 2 || i === 5) {
        const ring = new THREE.Mesh(
          new THREE.TorusGeometry(skill.size * 1.55, skill.size * 0.09, 6, 42),
          new THREE.MeshBasicMaterial({ color: skill.color, transparent: true, opacity: 0.55 })
        );
        ring.rotation.x = Math.PI / 2.2;
        ring.rotation.z = 0.25;
        planetGroup.add(ring);
      }
      const glow = makeGlow(skill.color, skill.size * 5.2, 0.24);
      planetGroup.add(glow);

      const label = makeLabel(skill.name, skill.color, 48);
      label.position.set(0, skill.size + 0.72, 0);
      label.scale.set(2.3 + skill.name.length * 0.075, 0.88, 1);
      label.material.opacity = 0;
      label.userData.baseScaleX = label.scale.x;
      label.userData.baseScaleY = label.scale.y;
      planetGroup.add(label);

      const hit = new THREE.Mesh(
        new THREE.SphereGeometry(skill.size * 1.9, 8, 8),
        new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false })
      );
      hit.userData.skillIndex = i;
      planetGroup.add(hit);
      planetHits.push(hit);

      planets.push({ orbit, group: planetGroup, mesh, label, glow, data: skill, index: i, scale: 1, targetScale: 1 });
    });

  }

  /* ------------------------------ projects ------------------------------ */
  function createProjects() {
    projectGroup = new THREE.Group();
    projectGroup.position.set(0, 0, -54);
    scene.add(projectGroup);

    PROJECTS.forEach((p, i) => {
      const accent = new THREE.Color(p.accent);
      const group = new THREE.Group();

      const frontTex = drawCardFront(p);
      const backTex = drawCardBack(p);
      backTex.wrapS = THREE.RepeatWrapping;
      backTex.repeat.x = -1;
      backTex.offset.x = 1;
      backTex.needsUpdate = true;

      const frontMat = new THREE.MeshBasicMaterial({ map: frontTex });
      const backMat = new THREE.MeshBasicMaterial({ map: backTex, side: THREE.DoubleSide });
      const sideMat = new THREE.MeshStandardMaterial({
        color: 0x0a1224,
        roughness: 0.5,
        metalness: 0.65,
        emissive: accent,
        emissiveIntensity: 0.2,
      });
      const materials = [sideMat, sideMat, sideMat, sideMat, frontMat, backMat];
      const geo = new THREE.BoxGeometry(3.02, 4.18, 0.14);
      const mesh = new THREE.Mesh(geo, materials);
      group.add(mesh);

      const edges = new THREE.LineSegments(
        new THREE.EdgesGeometry(geo),
        new THREE.LineBasicMaterial({ color: accent, transparent: true, opacity: 0.65 })
      );
      group.add(edges);

      const glow = makeGlow(p.accent, 5.6, 0.16);
      glow.position.z = -0.45;
      group.add(glow);

      const hit = new THREE.Mesh(
        new THREE.BoxGeometry(3.2, 4.4, 0.55),
        new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false })
      );
      hit.userData.cardIndex = i;
      group.add(hit);

      group.userData = {
        index: i,
        project: p,
        baseX: 0,
        baseY: 2.7,
        baseZ: 0,
        baseRotY: 0,
        baseRotX: 0,
        baseRotZ: 0,
        hover: false,
        flip: 0,
        flipTarget: 0,
        flipped: false,
        phase: i * 1.35,
        scale: 1,
        targetScale: 1,
        glow,
        edges,
        mesh,
      };
      projectGroup.add(group);
      cards.push(group);
    });
    layoutProjects();
  }

  function layoutProjects() {
    if (!cards.length) return;
    if (state.isMobile) {
      const coords = [
        { x: -1.58, y: 1.28 },
        { x: 1.58, y: 1.28 },
        { x: -1.58, y: 4.98 },
        { x: 1.58, y: 4.98 },
      ];
      cards.forEach((card, i) => {
        const c = coords[i];
        card.userData.baseX = c.x;
        card.userData.baseY = c.y;
        card.userData.baseZ = 0;
        card.userData.baseRotY = 0;
        card.userData.baseRotX = 0;
        card.userData.baseRotZ = 0;
        card.scale.setScalar(0.72);
      });
    } else {
      const coords = [
        { x: -5.05, y: 1.62, z: 0.45, ry: 0.2 },
        { x: -1.68, y: 1.55, z: 0.12, ry: 0.06 },
        { x: 1.68, y: 1.55, z: 0.12, ry: -0.06 },
        { x: 5.05, y: 1.62, z: 0.45, ry: -0.2 },
      ];
      cards.forEach((card, i) => {
        const c = coords[i];
        card.userData.baseX = c.x;
        card.userData.baseY = c.y;
        card.userData.baseZ = c.z;
        card.userData.baseRotY = c.ry;
        card.userData.baseRotX = 0;
        card.userData.baseRotZ = 0;
        card.scale.setScalar(1.06);
      });
    }
    cards.forEach((card) => {
      card.position.set(card.userData.baseX, card.userData.baseY, card.userData.baseZ);
      card.rotation.set(card.userData.baseRotX, card.userData.baseRotY + card.userData.flip * Math.PI, card.userData.baseRotZ);
    });
  }

  /* ------------------------------- contact ------------------------------ */
  function createContact() {
    consoleGroup = new THREE.Group();
    consoleGroup.position.set(0, 0, -78);
    scene.add(consoleGroup);

    const dark = new THREE.MeshStandardMaterial({
      color: 0x07121f,
      metalness: 0.78,
      roughness: 0.28,
      emissive: 0x062b2a,
      emissiveIntensity: 0.35,
    });
    const green = new THREE.MeshStandardMaterial({
      color: 0x0b3a33,
      emissive: 0x34d399,
      emissiveIntensity: 0.9,
      roughness: 0.3,
      metalness: 0.3,
    });

    const base = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.75, 0.3, 48), dark);
    base.position.y = 0.06;
    consoleGroup.add(base);
    const baseRing = new THREE.Mesh(
      new THREE.TorusGeometry(2.38, 0.02, 6, 90),
      new THREE.MeshBasicMaterial({ color: 0x34d399, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending })
    );
    baseRing.rotation.x = Math.PI / 2;
    baseRing.position.y = 0.23;
    consoleGroup.add(baseRing);
    const baseGlow = makeGlow(0x34d399, 6.5, 0.12);
    baseGlow.position.y = 0.3;
    consoleGroup.add(baseGlow);

    const screenGroup = new THREE.Group();
    screenGroup.position.y = 2.06;
    screenGroup.rotation.x = -0.16;
    consoleGroup.add(screenGroup);

    const frame = new THREE.Mesh(new THREE.BoxGeometry(3.78, 2.04, 0.17), dark);
    screenGroup.add(frame);
    const screenTex = canvasTexture(1024, 560, (ctx, w, h) => {
      const bg = ctx.createLinearGradient(0, 0, 0, h);
      bg.addColorStop(0, "#03120f");
      bg.addColorStop(1, "#020a0a");
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = "rgba(52,211,153,.12)";
      ctx.lineWidth = 1;
      for (let gy = 0; gy < h; gy += 34) {
        ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(w, gy); ctx.stroke();
      }
      ctx.fillStyle = "rgba(52,211,153,.12)";
      ctx.fillRect(0, 0, w, 48);
      [20, 42, 64].forEach((x, i) => {
        ctx.fillStyle = ["#f87171", "#fbbf24", "#34d399"][i];
        ctx.beginPath(); ctx.arc(x, 24, 5, 0, Math.PI * 2); ctx.fill();
      });
      ctx.font = '500 17px "Be Vietnam Pro", sans-serif';
      ctx.fillStyle = "rgba(167,243,208,.55)";
      ctx.fillText("bai-tap://contact  —  zsh", 88, 30);
      ctx.textAlign = "right";
      ctx.fillText("● LIVE", w - 22, 30);
      ctx.textAlign = "left";
      const line = (y, prefix, text, color) => {
        ctx.font = '500 24px ui-monospace, monospace';
        ctx.fillStyle = "rgba(52,211,153,.75)";
        ctx.fillText(prefix, 34, y);
        ctx.fillStyle = color || "#d7fff3";
        ctx.fillText(text, 34 + 34, y);
      };
      line(106, "$", "whoami");
      line(150, ">", "bai tap  ·  backend & data engineer", "#a7f3d0");
      line(206, "$", "status --now");
      line(250, ">", "OPEN TO WORK   ·   UTC+7", "#5eead4");
      line(306, "$", "contact --list");
      line(350, ">", "email     puppy@example.com", "#d1fae5");
      line(394, ">", "github    github.com/puppy", "#d1fae5");
      line(438, ">", "linkedin  linkedin.com/in/puppy", "#d1fae5");
      ctx.font = '500 24px ui-monospace, monospace';
      ctx.fillStyle = "rgba(52,211,153,.75)";
      ctx.fillText("$", 34, 500);
      ctx.fillStyle = "#34d399";
      ctx.fillRect(68, 480, 12, 25);
      ctx.strokeStyle = "rgba(52,211,153,.2)";
      ctx.lineWidth = 2;
      ctx.strokeRect(14, 14, w - 28, h - 28);
    });
    const screen = new THREE.Mesh(
      new THREE.PlaneGeometry(3.48, 1.78),
      new THREE.MeshBasicMaterial({ map: screenTex })
    );
    screen.position.z = 0.1;
    screenGroup.add(screen);

    screenScan = new THREE.Mesh(
      new THREE.PlaneGeometry(3.42, 0.06),
      new THREE.MeshBasicMaterial({ color: 0x5eead4, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending })
    );
    screenScan.position.set(0, -0.7, 0.12);
    screenGroup.add(screenScan);

    const screenGlow = makeGlow(0x34d399, 5.2, 0.22);
    screenGlow.position.set(0, 2.1, -0.5);
    consoleGroup.add(screenGlow);

    // console side towers
    [-1.92, 1.92].forEach((x) => {
      const tower = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.62, 0.32), green);
      tower.position.set(x, 1.42, 0);
      consoleGroup.add(tower);
      const lightStrip = new THREE.Mesh(
        new THREE.BoxGeometry(0.03, 0.5, 0.03),
        new THREE.MeshBasicMaterial({ color: 0x5eead4 })
      );
      lightStrip.position.set(x, 1.42, 0.18);
      consoleGroup.add(lightStrip);
    });

    // holographic keyboard / console strip
    const pad = new THREE.Mesh(
      new THREE.BoxGeometry(2.9, 0.06, 0.68),
      new THREE.MeshStandardMaterial({ color: 0x061a18, roughness: 0.4, metalness: 0.5, emissive: 0x0f766e, emissiveIntensity: 0.35 })
    );
    pad.position.set(0, 1.18, 0.55);
    pad.rotation.x = 0.22;
    consoleGroup.add(pad);
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 12; col++) {
        const key = new THREE.Mesh(
          new THREE.BoxGeometry(0.16, 0.015, 0.09),
          new THREE.MeshBasicMaterial({ color: 0x34d399, transparent: true, opacity: 0.28 + row * 0.08 })
        );
        key.position.set(-1.32 + col * 0.24, 1.23, 0.28 + row * 0.16);
        key.rotation.x = 0.22;
        consoleGroup.add(key);
      }
    }

    // social icons
    const ICONS = [
      { label: "EMAIL", color: "#5eead4", href: "mailto:puppy@example.com", glyph: "@", x: -1.62 },
      { label: "GITHUB", color: "#a78bfa", href: "https://github.com/puppy", glyph: "GH", x: 0 },
      { label: "LINKEDIN", color: "#38bdf8", href: "https://linkedin.com/in/puppy", glyph: "in", x: 1.62 },
    ];
    ICONS.forEach((icon, i) => {
      const group = new THREE.Group();
      group.position.set(icon.x, 3.56 + (i === 1 ? 0.22 : 0), 0.55);
      group.userData.baseY = group.position.y;
      group.userData.phase = i * 2.1;
      group.userData.icon = icon;
      group.userData.targetScale = 1;
      group.userData.scale = 1;

      const tileTex = canvasTexture(256, 256, (ctx, w, h) => {
        ctx.clearRect(0, 0, w, h);
        roundRect(ctx, 12, 12, w - 24, h - 24, 38);
        const bg = ctx.createLinearGradient(0, 0, w, h);
        bg.addColorStop(0, hexA(icon.color, 0.28));
        bg.addColorStop(1, hexA(icon.color, 0.06));
        ctx.fillStyle = bg;
        ctx.fill();
        ctx.strokeStyle = hexA(icon.color, 0.65);
        ctx.lineWidth = 2.5;
        ctx.stroke();
        ctx.fillStyle = "#f4ffff";
        ctx.font = '700 92px "Be Vietnam Pro", sans-serif';
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(icon.glyph, w / 2, h / 2 - 4);
        ctx.fillStyle = hexA(icon.color, 0.9);
        ctx.font = '600 16px "Be Vietnam Pro", sans-serif';
        ctx.fillText(icon.label, w / 2, h - 34);
      });
      const tile = new THREE.Mesh(
        new THREE.PlaneGeometry(0.9, 0.9),
        new THREE.MeshBasicMaterial({ map: tileTex, transparent: true, side: THREE.DoubleSide })
      );
      group.add(tile);
      const tileGlow = makeGlow(icon.color, 1.9, 0.3);
      tileGlow.position.z = -0.05;
      group.add(tileGlow);
      const label = makeLabel(icon.label, icon.color, 40);
      label.scale.set(1.1, 0.28, 1);
      label.position.y = 0.68;
      group.add(label);
      const hit = new THREE.Mesh(
        new THREE.PlaneGeometry(1.2, 1.25),
        new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false })
      );
      hit.userData.socialIndex = i;
      group.add(hit);
      socialHits.push(hit);
      group.userData.label = label;
      consoleGroup.add(group);
      socials.push(group);
    });

    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(2.15, 2.5, 4.6, 40, 1, true),
      new THREE.MeshBasicMaterial({
        color: 0x34d399,
        transparent: true,
        opacity: 0.018,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    beam.position.y = 2.3;
    consoleGroup.add(beam);
  }

  /* ---------------------------- camera path ----------------------------- */
  function buildCameraPath() {
    const desktopCam = [
      new THREE.Vector3(0, 2.15, 10.8),
      new THREE.Vector3(0, 3.15, -9.5),
      new THREE.Vector3(0, 2.35, -40.5),
      new THREE.Vector3(0, 2.55, -66),
      new THREE.Vector3(0, 15.5, -94),
    ];
    const desktopLook = [
      new THREE.Vector3(0, 2.02, 0),
      new THREE.Vector3(0.25, 2.15, -30),
      new THREE.Vector3(0, 2.15, -54),
      new THREE.Vector3(-1.35, 2.05, -78),
      new THREE.Vector3(0, 0.8, -38),
    ];
    const mobileCam = [
      new THREE.Vector3(0, 2.2, 11.6),
      new THREE.Vector3(0, 3.15, -3.5),
      new THREE.Vector3(0, 3.2, -36),
      new THREE.Vector3(0, 2.5, -64),
      new THREE.Vector3(0, 15.5, -94),
    ];
    const mobileLook = [
      new THREE.Vector3(0, 1.95, 0),
      new THREE.Vector3(0, 2.25, -22),
      new THREE.Vector3(0, 3.2, -54),
      new THREE.Vector3(0, 2.25, -78),
      new THREE.Vector3(0, 0.8, -38),
    ];
    camKeys = state.isMobile ? mobileCam : desktopCam;
    lookKeys = state.isMobile ? mobileLook : desktopLook;
    camCurve = new THREE.CatmullRomCurve3(camKeys, false, "centripetal", 0.5);
    lookCurve = new THREE.CatmullRomCurve3(lookKeys, false, "centripetal", 0.5);
  }

  function updateCamera(dt, instant) {
    if (!camera || !camCurve) return;
    const p = clamp(state.progress, 0, 1) * (N - 1);
    const i = clamp(Math.floor(p), 0, N - 2);
    const f = smooth(p - i);
    const t = (i + f) / (N - 1);
    const camPos = camCurve.getPoint(clamp(t, 0, 1));
    const lookPos = lookCurve.getPoint(clamp(t, 0, 1));

    // mouse parallax + free-look drag
    const px = reducedMotion ? 0 : state.pointer.nx * (state.isMobile ? 0.12 : 0.55) + state.dragYaw;
    const py = reducedMotion ? 0 : state.pointer.ny * (state.isMobile ? 0.06 : 0.26) + state.dragPitch;
    camPos.x += px;
    camPos.y += py;

    // gentle idle breathing
    if (!reducedMotion) {
      camPos.x += Math.sin(state.time * 0.19) * 0.075;
      camPos.y += Math.sin(state.time * 0.27 + 1.4) * 0.045;
      lookPos.x += Math.sin(state.time * 0.11) * 0.05;
      lookPos.y += Math.sin(state.time * 0.21 + 0.7) * 0.04;
    }

    if (instant) {
      camera.position.copy(camPos);
      camera.lookAt(lookPos);
    } else {
      camera.position.x = damp(camera.position.x, camPos.x, 8, dt);
      camera.position.y = damp(camera.position.y, camPos.y, 8, dt);
      camera.position.z = damp(camera.position.z, camPos.z, 9, dt);
      if (!camera.userData.look) camera.userData.look = lookPos.clone();
      camera.userData.look.x = damp(camera.userData.look.x, lookPos.x, 8, dt);
      camera.userData.look.y = damp(camera.userData.look.y, lookPos.y, 8, dt);
      camera.userData.look.z = damp(camera.userData.look.z, lookPos.z, 9, dt);
      camera.lookAt(camera.userData.look);
    }
    if (!camera.userData.look) camera.userData.look = lookPos.clone();
  }

  /* --------------------------- responsive ------------------------------- */
  function layoutResponsive() {
    state.isMobile = window.innerWidth < 760;
    if (camera) {
      camera.fov = state.isMobile ? 58 : 52;
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
    }
    if (renderer) {
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, state.isMobile ? 1.5 : 2));
      renderer.setSize(window.innerWidth, window.innerHeight);
    }
    buildCameraPath();
    if (avatar) {
      avatar.position.x = state.isMobile ? 1.32 : 2.7;
      avatar.userData.baseScale = state.isMobile ? 0.92 : 1;
      avatar.scale.setScalar(avatar.userData.baseScale);
    }
    if (solarSystem) {
      solarSystem.userData.baseScale = state.isMobile ? 0.68 : 1;
      solarSystem.scale.setScalar(solarSystem.userData.baseScale);
      solarSystem.position.set(state.isMobile ? 0 : 3.1, state.isMobile ? 2.3 : 1.9, state.isMobile ? -24 : -30);
    }
    if (projectGroup) projectGroup.userData.baseScale = 1;
    if (consoleGroup) consoleGroup.userData.baseScale = 1;
    layoutProjects();
  }

  /* ----------------------------- theme/colors --------------------------- */
  const nightSky = new THREE.Color(0x05060f);
  const daySky = new THREE.Color(0xdcecf8);

  function updateSceneColors(dt) {
    if (!scene) return;
    state.themeMix = damp(state.themeMix, state.targetThemeMix, 4.5, dt);
    themeMixCurrent = state.themeMix;

    const pos = clamp(state.progress, 0, 1) * (N - 1);
    const i = clamp(Math.floor(pos), 0, N - 2);
    const local = smooth(pos - i);
    const targetAccent = new THREE.Color(ACCENTS[i]).lerp(new THREE.Color(ACCENTS[i + 1]), local);
    accentCurrent.lerp(targetAccent, 1 - Math.exp(-4 * dt));

    const sky = nightSky.clone().lerp(daySky, state.themeMix).lerp(accentCurrent, 0.045 + state.themeMix * 0.02);
    scene.background.copy(sky);
    scene.fog.color.copy(sky);
    const fogDensity = lerp(lerp(0.0135, 0.009, state.themeMix), 0.0042, smooth((state.progress - 0.78) / 0.22));
    scene.fog.density = fogDensity;

    if (ambient) ambient.intensity = lerp(0.8, 1.55, state.themeMix);
    if (hemi) hemi.intensity = lerp(0.6, 1.15, state.themeMix);
    if (keyLight) {
      keyLight.intensity = lerp(1.6, 2.5, state.themeMix);
      keyLight.color.copy(new THREE.Color(0xffffff).lerp(new THREE.Color(0xfff3df), state.themeMix));
    }
    if (rimLight) {
      rimLight.color.copy(accentCurrent);
      rimLight.intensity = lerp(2.2, 1.2, state.themeMix);
    }
    if (stationLight) {
      stationLight.color.copy(accentCurrent);
      stationLight.position.z = -24 - state.progress * 60;
      stationLight.intensity = lerp(2.6, 1.4, state.themeMix);
    }
    if (gridMat) {
      gridMat.uniforms.uTime.value = state.time;
      gridMat.uniforms.uColor.value.copy(accentCurrent);
      gridMat.uniforms.uOpacity.value = lerp(0.52, 0.18, state.themeMix);
      gridMat.uniforms.uScroll.value = state.progress * 64;
      const wantBlending = state.themeMix > 0.5 ? THREE.NormalBlending : THREE.AdditiveBlending;
      if (gridMat.blending !== wantBlending) {
        gridMat.blending = wantBlending;
        gridMat.needsUpdate = true;
      }
    }
    stars.forEach((s) => {
      s.material.opacity = s.userData.baseOpacity * lerp(1, 0.1, state.themeMix);
    });
    if (dust) dust.material.opacity = dust.userData.baseOpacity * lerp(1, 0.35, state.themeMix);
    if (cloudGroup) {
      cloudGroup.children.forEach((cloud) => {
        cloud.material.opacity = state.themeMix * 0.5;
      });
    }
    glowSprites.forEach((g) => {
      if (g.userData.isGlow) g.material.opacity = g.userData.baseOpacity * lerp(1, 0.5, state.themeMix);
    });
    if (journeyLine) journeyLine.material.opacity = lerp(0.55, 0.24, state.themeMix);
    if (sunLight) sunLight.intensity = lerp(4.2, 2.0, state.themeMix);
    if (consoleGroup) {
      consoleGroup.children.forEach((child) => {
        if (child.isMesh && child.material && child.material.emissiveIntensity !== undefined) {
          // keep as-is; lighting handles the rest
        }
      });
    }
  }

  /* ------------------------------- animate ------------------------------ */
  function startLoop() {
    const loop = (now) => {
      requestAnimationFrame(loop);
      if (document.hidden) return;
      const dt = Math.min(0.05, (now - lastFrame) / 1000 || 0.016);
      lastFrame = now;
      state.time = (now - state.start) / 1000;
      animate(dt);
      renderer.render(scene, camera);
    };
    requestAnimationFrame(loop);
  }

  function animate(dt) {
    if (debugStation !== null) {
      state.target = progressForStation(debugStation);
      state.progress = state.target;
    } else {
      state.target = clamp(window.scrollY / maxScroll(), 0, 1);
      state.progress = damp(state.progress, state.target, reducedMotion ? 20 : 7.5, dt);
      if (Math.abs(state.progress - state.target) < 0.0002) state.progress = state.target;
    }
    state.stationPos = state.progress * (N - 1);

    // drag spring back
    if (!state.dragging) {
      state.dragYaw = damp(state.dragYaw, 0, 0.8, dt);
      state.dragPitch = damp(state.dragPitch, 0, 0.8, dt);
    }

    updateCamera(dt, false);
    updateSceneColors(dt);
    updateStationPresence();
    animateStars(dt);
    animateAvatar(dt);
    animateSolar(dt);
    animateProjects(dt);
    animateContact(dt);
    animateRipples(dt);
    updatePanels();
    updateHUD();
    updateRayHover();
    updateBubble();
    updateCursor();
  }

  function updateStationPresence() {
    const pos = state.stationPos;
    const show = (start, endStart) => smooth((pos - start) / 0.22) * (1 - smooth((pos - endStart) / 0.22));
    const pAvatar = 1 - smooth((pos - 0.2) / 0.3);
    const pSkills = show(0.24, 1.28);
    const pProjects = show(1.28, 2.3);
    const pContact = show(2.3, 3.3);

    if (avatar) {
      const s = (avatar.userData.baseScale || 1) * Math.max(pAvatar, 0.0001);
      avatar.visible = pAvatar > 0.01;
      avatar.scale.setScalar(s);
    }
    if (solarSystem) {
      const s = (solarSystem.userData.baseScale || 1) * Math.max(pSkills, 0.0001);
      solarSystem.visible = pSkills > 0.01;
      solarSystem.scale.setScalar(s);
    }
    if (sunLight) sunLight.visible = pSkills > 0.01;
    if (projectGroup) {
      projectGroup.visible = pProjects > 0.01;
      projectGroup.scale.setScalar(Math.max(pProjects, 0.0001));
    }
    if (consoleGroup) {
      consoleGroup.visible = pContact > 0.01;
      consoleGroup.scale.setScalar(Math.max(pContact, 0.0001));
    }

    const overview = smooth((state.progress - 0.68) / 0.24);
    if (overviewMats.length) {
      overviewMats.forEach((item) => {
        item.material.opacity = item.base * overview;
      });
    }
    stationBeacons.forEach((beacon) => {
      beacon.material.opacity = (0.1 + overview * 0.35) * lerp(1, 0.6, state.themeMix);
    });
    if (journeyLine) {
      journeyLine.material.opacity = lerp(0.55, 0.3, state.themeMix) + overview * 0.35;
    }
  }

  function animateStars(dt) {    stars.forEach((group, i) => {
      group.rotation.y += dt * (0.0022 + i * 0.001);
      group.rotation.z = Math.sin(state.time * 0.03 + i) * 0.015;
    });
    if (dust) {
      dust.rotation.y += dt * 0.006;
      dust.position.y = Math.sin(state.time * 0.12) * 0.15;
    }
    if (cloudGroup) {
      cloudGroup.children.forEach((cloud) => {
        cloud.position.x = cloud.userData.baseX + Math.sin(state.time * 0.04 + cloud.userData.phase) * 8;
      });
    }
  }

  function animateAvatar(dt) {
    if (!avatar) return;
    const t = state.time;
    const hover = state.avatarHover;
    avatar.position.y = Math.sin(t * 1.15) * 0.055 - 0.02;
    if (avatarBody) {
      avatarBody.rotation.y = damp(avatarBody.rotation.y, hover ? state.pointer.nx * 0.18 : Math.sin(t * 0.35) * 0.05, 4, dt);
      const breathe = 1 + Math.sin(t * 1.7) * 0.008;
      avatarBody.scale.set(1, breathe, 1);
    }
    if (avatarHead) {
      const targetY = clamp(state.pointer.nx * 0.3 - (state.isMobile ? 0 : 0.18), -0.45, 0.35);
      const targetX = clamp(-state.pointer.ny * 0.16, -0.22, 0.22);
      avatarHead.rotation.y = damp(avatarHead.rotation.y, hover ? targetY : targetY * 0.45, 5, dt);
      avatarHead.rotation.x = damp(avatarHead.rotation.x, hover ? targetX : targetX * 0.4, 5, dt);
    }
    // blink
    if (t > blinkAt) {
      blinkUntil = t + 0.13;
      blinkAt = t + 2.4 + Math.random() * 3.8;
    }
    const blinking = t < blinkUntil;
    avatarEyes.forEach((eye) => {
      eye.scale.y = damp(eye.scale.y, blinking ? 0.08 : 1, 22, dt);
    });
    // wave
    if (avatarArmR) {
      if (t < state.waveUntil) {
        const wave = Math.sin(t * 11) * 0.22;
        avatarArmR.rotation.z = damp(avatarArmR.rotation.z, 2.1 + wave, 8, dt);
        avatarArmR.rotation.x = damp(avatarArmR.rotation.x, -0.1, 8, dt);
      } else {
        avatarArmR.rotation.z = damp(avatarArmR.rotation.z, avatarArmR.userData.baseRotZ + (hover ? 0.55 : 0), 4, dt);
        avatarArmR.rotation.x = damp(avatarArmR.rotation.x, 0, 4, dt);
      }
    }
    if (avatarArmL) {
      avatarArmL.rotation.z = damp(avatarArmL.rotation.z, avatarArmL.userData.baseRotZ - (hover ? 0.2 : 0) + Math.sin(t * 1.3) * 0.03, 4, dt);
    }
    if (avatar.userData.legs) {
      avatar.userData.legs.forEach((leg, i) => {
        leg.rotation.x = leg.userData.baseRotX + Math.sin(t * 1.2 + i * 1.7) * 0.04;
      });
    }
    avatarRings.forEach((ring) => {
      if (ring.userData.spin) ring.rotation.z += dt * ring.userData.spin;
    });
    if (avatarParticles) {
      const arr = avatarParticles.geometry.attributes.position.array;
      avatarParticleData.forEach((p, i) => {
        p.y += dt * p.speed;
        if (p.y > 3.8) p.y = 0.1;
        const a = p.angle + state.time * 0.18;
        const r = p.radius + Math.sin(state.time * p.speed * 2 + p.wobble) * 0.06;
        arr[i * 3] = Math.cos(a) * r;
        arr[i * 3 + 1] = p.y;
        arr[i * 3 + 2] = Math.sin(a) * r;
      });
      avatarParticles.geometry.attributes.position.needsUpdate = true;
      avatarParticles.material.opacity = 0.65 + Math.sin(state.time * 2) * 0.2;
    }
    // avatar hover triggers a wave + bubble
    if (state.avatarHover && state.time - state.avatarHoverAt > 2.6) {
      state.avatarHoverAt = state.time;
      state.waveUntil = state.time + 1.7;
      showBubble("Chào bạn! Cùng xem dự án nhé ✦", 2400);
    }
  }

  function animateSolar(dt) {
    if (!solarSystem) return;
    const t = state.time;
    if (sun) {
      sun.rotation.y += dt * 0.18;
      sun.rotation.x = Math.sin(t * 0.2) * 0.08;
      if (sun.userData.glow) {
        sun.userData.glow.position.set(0, 0, 0);
        sun.userData.glow.material.opacity = (0.42 + Math.sin(t * 1.4) * 0.1) * lerp(1, 0.55, state.themeMix);
      }
      if (sun.userData.coreGlow) {
        sun.userData.coreGlow.material.opacity = (0.55 + Math.sin(t * 2.1) * 0.12) * lerp(1, 0.5, state.themeMix);
      }
    }
    if (solarSystem.userData.corona) {
      solarSystem.userData.corona.rotation.z += dt * solarSystem.userData.corona.userData.spin;
      solarSystem.userData.corona.rotation.y = Math.sin(t * 0.25) * 0.2;
    }
    if (sunLight) sunLight.position.set(0, 0, 0);
    planets.forEach((p) => {
      p.orbit.rotation.y += dt * p.data.speed * 0.42;
      p.mesh.rotation.y += dt * 0.8;
      p.group.position.y = Math.sin(t * 0.7 + p.index) * 0.055;
      const hovered = state.planetHover === p.index;
      const target = hovered ? 1.4 : 1;
      p.scale = damp(p.scale, target, 7, dt);
      p.group.scale.setScalar(p.scale);
      if (p.label) {
        p.label.material.opacity = damp(p.label.material.opacity, hovered ? 1 : 0, 8, dt);
        const s = hovered ? 1.08 : 1;
        p.label.scale.x = p.label.userData.baseScaleX * s;
        p.label.scale.y = p.label.userData.baseScaleY * s;
      }
      if (p.glow) {
        const base = 0.28;
        p.glow.material.opacity = (hovered ? 0.5 : base) * lerp(1, 0.5, state.themeMix);
      }
      p.mesh.material.color.setScalar(hovered ? 1.18 : 1);
    });
  }

  function animateProjects(dt) {
    if (!cards.length) return;
    const t = state.time;
    cards.forEach((card, i) => {
      const u = card.userData;
      u.flip = damp(u.flip, u.flipTarget, 5.5, dt);
      if (u.flipTarget === 1 && u.flip > 0.985) u.flip = 1;
      const bob = Math.sin(t * 0.85 + u.phase) * 0.055;
      const hover = state.cardHover === i;
      u.scale = damp(u.scale, hover ? 1.07 : 1, 5, dt);
      card.position.x = damp(card.position.x, u.baseX, 6, dt);
      card.position.y = damp(card.position.y, u.baseY + bob + (hover ? 0.16 : 0), 6, dt);
      card.position.z = damp(card.position.z, u.baseZ + (hover ? 0.5 : 0), 5, dt);
      const tiltX = hover ? state.pointer.ny * 0.045 : Math.sin(t * 0.55 + u.phase) * 0.016;
      const tiltZ = hover ? -state.pointer.nx * 0.028 : Math.cos(t * 0.5 + u.phase) * 0.012;
      card.rotation.x = damp(card.rotation.x, tiltX, 4, dt);
      card.rotation.z = damp(card.rotation.z, tiltZ, 4, dt);
      card.rotation.y = damp(card.rotation.y, u.baseRotY + u.flip * Math.PI, 6, dt);
      const bump = 1 + Math.sin(u.flip * Math.PI) * 0.035;
      card.scale.setScalar(u.scale * bump);
      if (u.glow) {
        u.glow.material.opacity = (hover ? 0.32 : 0.14) * lerp(1, 0.5, state.themeMix);
      }
      u.edges.material.opacity = hover ? 0.95 : 0.55;
    });
  }

  function animateContact(dt) {
    if (!consoleGroup) return;
    const t = state.time;
    socials.forEach((icon, i) => {
      icon.position.y = icon.userData.baseY + Math.sin(t * 1.1 + icon.userData.phase) * 0.075;
      icon.rotation.y = Math.sin(t * 0.5 + i) * 0.1;
      const hover = state.socialHover === i;
      icon.userData.scale = damp(icon.userData.scale, hover ? 1.18 : 1, 7, dt);
      icon.scale.setScalar(icon.userData.scale);
      icon.userData.label.material.opacity = hover ? 1 : 0.75;
    });
    if (screenScan) {
      const phase = (t * 0.22) % 1;
      screenScan.position.y = -0.75 + phase * 1.5;
      screenScan.material.opacity = 0.18 + Math.sin(phase * Math.PI) * 0.24;
    }
    consoleGroup.position.y = Math.sin(t * 0.6) * 0.035;
  }

  function animateRipples(dt) {
    for (let i = floorRipples.length - 1; i >= 0; i--) {
      const r = floorRipples[i];
      r.life += dt;
      const k = r.life / 1.25;
      if (k >= 1) {
        scene.remove(r.mesh);
        r.mesh.geometry.dispose();
        r.mesh.material.dispose();
        floorRipples.splice(i, 1);
        continue;
      }
      const s = 0.4 + k * 8;
      r.mesh.scale.set(s, s, s);
      r.mesh.material.opacity = (1 - k) * 0.7;
    }
  }

  /* ------------------------------ ray hover ----------------------------- */
  function updateRayHover() {
    if (!state.ready || !camera) return;
    const pointer = new THREE.Vector2(state.pointer.nx, state.pointer.ny);
    raycaster.setFromCamera(pointer, camera);
    const pos = state.stationPos;
    const station = Math.round(pos);
    let hover = null;

    if (!state.overUI) {
      if (Math.abs(pos - 0) < 0.55) {
        const hits = raycaster.intersectObjects(avatarHits, false);
        if (hits.length) hover = { type: "avatar" };
        state.avatarHover = !!hover;
      } else {
        state.avatarHover = false;
      }

      if (Math.abs(pos - 1) < 0.55) {
        const hits = raycaster.intersectObjects(planetHits, false);
        if (hits.length) {
          const idx = hits[0].object.userData.skillIndex;
          hover = { type: "planet", index: idx };
          if (state.planetHover !== idx) {
            state.planetHover = idx;
            showPlanetTip(idx);
          }
        } else if (state.planetHover !== -1) {
          state.planetHover = -1;
          hidePlanetTip();
        }
      } else if (state.planetHover !== -1) {
        state.planetHover = -1;
        hidePlanetTip();
      }

      if (Math.abs(pos - 2) < 0.55) {
        const hits = raycaster.intersectObjects(cards.map((c) => c.children[c.children.length - 1]), false);
        if (hits.length) {
          const idx = hits[0].object.userData.cardIndex;
          hover = { type: "card", index: idx };
          if (state.cardHover !== idx) {
            state.cardHover = idx;
            const hint = $(".project-hint__text");
            if (hint) hint.textContent = "Bấm để lật thẻ · " + PROJECTS[idx].title;
          }
        } else if (state.cardHover !== -1) {
          state.cardHover = -1;
          const hint = $(".project-hint__text");
          if (hint) hint.textContent = "Bấm vào thẻ · kéo nhẹ để nghiêng";
        }
      } else if (state.cardHover !== -1) {
        state.cardHover = -1;
      }

      if (Math.abs(pos - 3) < 0.55) {
        const hits = raycaster.intersectObjects(socialHits, false);
        if (hits.length) {
          const idx = hits[0].object.userData.socialIndex;
          hover = { type: "social", index: idx };
          state.socialHover = idx;
        } else if (state.socialHover !== -1) {
          state.socialHover = -1;
        }
      } else if (state.socialHover !== -1) {
        state.socialHover = -1;
      }
    } else {
      state.avatarHover = false;
      if (state.planetHover !== -1) {
        state.planetHover = -1;
        hidePlanetTip();
      }
      state.cardHover = -1;
      state.socialHover = -1;
    }

    state.hover3D = hover;
    if (hover) {
      cursor.hoverSources.add("3d");
      if (state.planetHover >= 0) positionPlanetTip();
    } else {
      cursor.hoverSources.delete("3d");
    }
    syncCursorHover();

    if (hover && state.pointerType === "mouse") {
      document.body.classList.add("cursor-hover");
    }
  }

  function showPlanetTip(index) {
    const s = SKILLS[index];
    if (!s) return;
    dom.planetTipName.textContent = s.name;
    dom.planetTipMeta.textContent = "Mức thành thạo · " + (s.level >= 85 ? "chuyên sâu" : s.level >= 70 ? "thành thạo" : "đang phát triển");
    dom.planetTipLevel.textContent = s.level + "%";
    dom.planetTipFill.style.width = s.level + "%";
    dom.planetTip.style.setProperty("--tip-color", "#" + s.color.toString(16).padStart(6, "0"));
    dom.planetTip.classList.add("is-on");
    positionPlanetTip();
  }
  function positionPlanetTip() {
    if (!dom.planetTip) return;
    dom.planetTip.style.left = (state.pointer.x + 14) + "px";
    dom.planetTip.style.top = (state.pointer.y - 16) + "px";
  }
  function hidePlanetTip() {
    if (dom.planetTip) dom.planetTip.classList.remove("is-on");
  }

  function showBubble(text, duration) {
    if (!state.ready) return;
    dom.bubbleText.textContent = text;
    state.bubbleUntil = state.time + duration / 1000;
    dom.bubble.classList.add("is-on");
  }
  function updateBubble() {
    if (!dom.bubble) return;
    const visible = state.bubbleUntil > state.time && Math.abs(state.stationPos) < 0.55;
    if (!visible) {
      dom.bubble.classList.remove("is-on");
      return;
    }
    if (!avatarHead) return;
    avatarHead.getWorldPosition(tmpVec);
    tmpVec.y += 0.95;
    tmpVec.project(camera);
    if (tmpVec.z > 1) {
      dom.bubble.classList.remove("is-on");
      return;
    }
    const x = (tmpVec.x * 0.5 + 0.5) * window.innerWidth;
    const y = (-tmpVec.y * 0.5 + 0.5) * window.innerHeight;
    dom.bubble.style.left = x + "px";
    dom.bubble.style.top = y + "px";
    dom.bubble.classList.add("is-on");
  }

  /* --------------------------- floor click ripple ----------------------- */
  const floorPlaneMath = new THREE.Plane(new THREE.Vector3(0, 1, 0), 1.5);
  function clickRipple(event) {
    if (!state.ready) return;
    if (event.target.closest("a, button, .contact-card, .skills-legend, .site-footer, .main-nav, .journey, .site-header")) return;
    const color = "#" + accentCurrent.getHexString();
    domRipple(event.clientX, event.clientY, hexA(color, 0.55));
    if (!scene || !camera) return;
    const ndc = new THREE.Vector2(
      (event.clientX / window.innerWidth) * 2 - 1,
      -(event.clientY / window.innerHeight) * 2 + 1
    );
    raycaster.setFromCamera(ndc, camera);
    const hit = new THREE.Vector3();
    if (!raycaster.ray.intersectPlane(floorPlaneMath, hit)) return;
    if (hit.z > 20 || hit.z < -130) return;
    const geo = new THREE.RingGeometry(0.22, 0.3, 64);
    const mat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(color),
      transparent: true,
      opacity: 0.7,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(hit.x, -1.48, hit.z);
    scene.add(mesh);
    floorRipples.push({ mesh, life: 0 });
  }

  function handlePointerUp(event) {
    if (event.pointerType === "touch" && state.pointerType !== "touch") {
      state.pointer.x = event.clientX;
      state.pointer.y = event.clientY;
      state.pointer.nx = (event.clientX / window.innerWidth) * 2 - 1;
      state.pointer.ny = -((event.clientY / window.innerHeight) * 2 - 1);
      state.overUI = !!event.target.closest("a, button, .contact-card, .skills-legend, .site-footer");
    }
    const dx = event.clientX - state.pointerDown.x;
    const dy = event.clientY - state.pointerDown.y;
    const moved = Math.sqrt(dx * dx + dy * dy) > 7;
    if (moved || !state.ready) return;
    if (event.target.closest("a, button, .contact-card, .skills-legend, .site-footer, .main-nav, .journey, .site-header")) return;

    // refresh hover on the exact up position
    state.pointer.x = event.clientX;
    state.pointer.y = event.clientY;
    state.pointer.nx = (event.clientX / window.innerWidth) * 2 - 1;
    state.pointer.ny = -((event.clientY / window.innerHeight) * 2 - 1);
    state.overUI = false;
    updateRayHover();

    const hover = state.hover3D;
    const station = Math.round(state.stationPos);
    if (!hover) {
      clickRipple(event);
      return;
    }
    if (hover.type === "avatar") {
      state.waveUntil = state.time + 2.4;
      showBubble("Rất vui được gặp bạn! ✦", 2600);
      domRipple(event.clientX, event.clientY, "rgba(94,234,212,.6)");
    } else if (hover.type === "card") {
      const card = cards[hover.index];
      const u = card.userData;
      if (u.flipped && u.flip > 0.86) {
        window.open(u.project.link, "_blank", "noopener");
      } else {
        u.flipped = !u.flipped;
        u.flipTarget = u.flipped ? 1 : 0;
        showToast(u.flipped ? "Đã lật thẻ · bấm lần nữa để chơi" : "Đã lật lại mặt trước");
      }
    } else if (hover.type === "social") {
      const icon = socials[hover.index].userData.icon;
      if (icon.href.startsWith("mailto:")) window.location.href = icon.href;
      else window.open(icon.href, "_blank", "noopener");
    } else if (hover.type === "planet") {
      showPlanetTip(hover.index);
    }
  }

  /* ------------------------------- panels ------------------------------- */
  function updatePanels() {
    const pos = state.stationPos;
    const panels = $$(".station");
    panels.forEach((el, i) => {
      const d = pos - i;
      let influence = clamp(1 - Math.abs(d) / 0.58, 0, 1);
      influence = smooth(influence);
      el.style.opacity = influence.toFixed(3);
      el.style.transform = `translate3d(0, ${(-d * 34).toFixed(1)}px, 0) scale(${(0.988 + influence * 0.012).toFixed(4)})`;
      el.classList.toggle("is-visible", influence > 0.02);
      const active = influence > 0.62;
      el.classList.toggle("is-active", active);
      if (el.getAttribute("aria-hidden") !== (active ? "false" : "true")) {
        el.setAttribute("aria-hidden", active ? "false" : "true");
      }
      if (active) el.removeAttribute("inert");
      else el.setAttribute("inert", "");
    });
  }

  function updateHUD() {
    const pos = state.stationPos;
    const nearest = clamp(Math.round(pos), 0, N - 1);
    if (nearest !== state.station || state.firstStation) {
      state.station = nearest;
      state.firstStation = false;
      if (dom.stationIndex) dom.stationIndex.textContent = String(nearest + 1).padStart(2, "0");
      if (dom.stationName) dom.stationName.textContent = STATION_NAMES[nearest];
      $$(".journey-dot").forEach((dot, i) => dot.classList.toggle("is-current", i === nearest));
      $$(".main-nav a").forEach((a) => {
        const idx = parseInt(a.getAttribute("data-goto"), 10);
        a.classList.toggle("is-current", idx === nearest);
      });
      try {
        history.replaceState(null, "", "#" + SECTION_IDS[nearest]);
      } catch (e) { /* ignore */ }
    }
    if (dom.journeyFill) dom.journeyFill.style.height = (state.progress * 100).toFixed(2) + "%";
    if (dom.scrollFill) dom.scrollFill.style.transform = "scaleX(" + state.progress.toFixed(4) + ")";
    document.body.classList.toggle("is-finale", nearest === 4);
  }

  /* ------------------------------- events ------------------------------- */
  function bindSceneEvents() {
    window.addEventListener("resize", () => {
      layoutResponsive();
      if (state.ready && debugStation === null) {
        state.progress = state.target = window.scrollY / maxScroll();
        state.stationPos = state.progress * (N - 1);
      }
    });
    window.addEventListener("pointerup", handlePointerUp);
    document.addEventListener("visibilitychange", () => {
      lastFrame = performance.now();
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        cards.forEach((card) => {
          card.userData.flipped = false;
          card.userData.flipTarget = 0;
        });
        hidePlanetTip();
      }
    });
    // prevent context menu on the canvas area (right click free-look not needed)
    window.addEventListener("contextmenu", (event) => {
      if (event.target.tagName === "CANVAS") event.preventDefault();
    });
  }

  /* -------------------------------- boot -------------------------------- */
  async function boot() {
    bindUI();
    initCursor();
    setLoad(4, "khởi động hệ thống");
    if (!window.THREE) {
      fail("Không tìm thấy thư viện Three.js.");
      return;
    }
    try {
      if (document.fonts && document.fonts.ready) {
        await Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 2600))]);
      }
      await initScene();
      bindSceneEvents();
    } catch (err) {
      fail(err && err.message ? err.message : "Không thể khởi tạo không gian 3D.", err);
    }
  }

  boot();
})();
