/* Прототип лендинга «Захотели — Полетели» — арт-направление «Полёт».
   Здесь: появление блоков по входу в экран и заголовки по словам; сцены прокрутки (манифест загорается по словам,
   страны едут вбок, колода историй); табло вылетов в каталоге; телефон с перепиской; посадочный талон
   в первом экране; магнитная кнопка. Тема и перестановка карточек — Zp.transition из дизайн-системы.
   При «меньше движения» (системная настройка или ?motion=reduce) ничего из этого не двигается: страница статична и полна. */
(() => {
  "use strict";

  const Z = window.Zp || {};
  const root = document.documentElement;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const motionOK = () => (Z.motionOK ? Z.motionOK() : !matchMedia("(prefers-reduced-motion: reduce)").matches);
  const go = (update, kind, from) => (Z.transition ? Z.transition(update, kind, from) : update());
  const inView = (el) => { const r = el.getBoundingClientRect(); return r.bottom > 0 && r.top < innerHeight; };
  const EASE = "cubic-bezier(0.22, 1, 0.36, 1)";
  const IO = "IntersectionObserver" in window;

  const ANIM = motionOK();
  const FINE = matchMedia("(pointer: fine)").matches;
  root.classList.toggle("lp-anim", ANIM);
  root.classList.toggle("lp-scrub", ANIM);
  // системную настройку «меньше движения» переключили на ходу — проще перезагрузить, чем разбирать все сцены
  if (!root.hasAttribute("data-motion")) {
    matchMedia("(prefers-reduced-motion: reduce)").addEventListener("change", () => location.reload());
  }

  /* ---------------------------------------------------------------- заголовки по словам */
  // Слова — в отдельные span: заголовок выезжает из-под строки, манифест загорается по словам.
  // Читалке экрана остаётся цельный текст (.lp-sr), разбитая копия от неё скрыта.
  // Делит обычный пробел; неразрывный (&nbsp;) — нет: предлог едет вместе со своим словом.
  function splitWords(el) {
    let wi = 0;
    const out = document.createElement("span");
    out.setAttribute("aria-hidden", "true");
    const walk = (src, dst) => {
      for (const n of Array.from(src.childNodes)) {
        if (n.nodeType === Node.TEXT_NODE) {
          for (const part of n.textContent.split(/([ \t\r\n]+)/)) {
            if (!part) continue;
            if (/^[ \t\r\n]+$/.test(part)) { dst.append(" "); continue; }
            const w = document.createElement("span");
            const i = document.createElement("span");
            w.className = "lp-w";
            i.className = "lp-w__i";
            w.style.setProperty("--wi", wi++);
            i.textContent = part;
            w.append(i);
            dst.append(w);
          }
        } else if (n.nodeType === Node.ELEMENT_NODE) {
          const copy = n.cloneNode(false);
          dst.append(copy);
          walk(n, copy);
        }
      }
    };
    walk(el, out);
    const sr = document.createElement("span");
    sr.className = "lp-sr";
    sr.textContent = el.textContent.replace(/\s+/g, " ").trim();
    el.replaceChildren(sr, out);
    el.style.setProperty("--n", wi);
  }
  if (ANIM) $$("[data-split], [data-words]").forEach(splitWords);

  /* ---------------------------------------------------------------- табло: буквы-перевёртыши */
  function setFlap(el, text) {
    el.replaceChildren(...Array.from(text, (ch, i) => {
      const s = document.createElement("i");
      s.textContent = ch;
      s.style.setProperty("--li", i);
      return s;
    }));
  }
  function flap(el, text, delay = 0) {
    if (ANIM) { el.style.setProperty("--fd", delay + "ms"); el.classList.add("is-flip"); }
    setFlap(el, text); // новые буквы — новые элементы: анимация каждый раз начинается заново
  }
  $$(".lp-flap").forEach((el) => setFlap(el, el.textContent.trim()));

  /* ---------------------------------------------------------------- крупные слова во всю ширину */
  const fitEls = $$("[data-fit]");
  function fit() {
    for (const el of fitEls) {
      el.style.setProperty("--fit", "100px");
      const range = document.createRange();
      range.selectNodeContents(el);
      const w = range.getBoundingClientRect().width;
      const box = el.parentElement;
      const cs = getComputedStyle(box);
      const room = box.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
      if (w > 0 && room > 0) el.style.setProperty("--fit", Math.floor((100 * room / w) * 0.995 * 100) / 100 + "px");
      else el.style.removeProperty("--fit");
    }
  }

  /* ---------------------------------------------------------------- появление по входу в экран */
  // Вошедшие вместе идут каскадом по 110 мс в порядке документа; сама анимация — в CSS, в своём темпе.
  function countUp(el, delay) {
    const to = Number(el.dataset.to) || 0;
    const start = performance.now() + delay, dur = 1600;
    const step = (now) => {
      const p = clamp((now - start) / dur);
      el.textContent = String(Math.round(to * (1 - Math.pow(1 - p, 3))));
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }
  // Границы строк берём у браузера, чтобы сохранить его переносы и неразрывные пробелы.
  function writeWrapped(el, delay) {
    const text = el.firstChild;
    if (!text || text !== el.lastChild || text.nodeType !== Node.TEXT_NODE) return;
    const range = document.createRange();
    range.selectNodeContents(text);
    if (range.getClientRects().length < 2) return;

    const duration = parseFloat(getComputedStyle(el).getPropertyValue("--writing-duration"));
    const start = performance.now() + delay;
    el.setAttribute("data-write-lines", "active");
    function render() {
      el.replaceChildren(text);
      el.style.removeProperty("--writing-width");
      const width = getComputedStyle(el).width;
      range.setStart(text, 0);
      const breaks = [0];
      for (let end = 1; end <= text.length; end++) {
        range.setEnd(text, end);
        if (range.getClientRects().length > breaks.length) breaks.push(end - 1);
      }
      breaks.push(text.length);
      const lines = breaks.slice(1).map((end, i) => {
        const line = document.createElement("span");
        line.className = "lp-writing-line";
        line.textContent = text.data.slice(breaks[i], end);
        return line;
      });
      el.style.setProperty("--writing-width", width);
      el.replaceChildren(...lines.flatMap((line, i) => i ? [document.createElement("br"), line] : [line]));
      const widths = lines.map(line => parseFloat(getComputedStyle(line).width));
      const total = widths.reduce((sum, length) => sum + length, 0);
      if (!total) return;
      let offset = start - performance.now();
      lines.forEach((line, i) => {
        const time = duration * widths[i] / total;
        line.animate([
          { clipPath: "inset(-0.5em 100% -0.5em 0)" },
          { clipPath: "inset(-0.5em -0.04em -0.5em -0.5em)" },
        ], { duration: time, delay: offset, easing: "linear", fill: "backwards" });
        offset += time;
      });
    }
    render();
    window.addEventListener("resize", render);
    setTimeout(() => {
      window.removeEventListener("resize", render);
      el.setAttribute("data-write-lines", "done");
      el.replaceChildren(text);
      el.style.removeProperty("--writing-width");
    }, delay + duration);
  }

  if (ANIM && IO) {
    $$(".lp-count").forEach((c) => { c.textContent = "0"; });
    const rio = new IntersectionObserver((entries) => {
      const ins = entries.filter((e) => e.isIntersecting).map((e) => e.target)
        .sort((a, b) => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1));
      ins.forEach((el, i) => {
        const d = i * 110;
        el.style.setProperty("--d", d + "ms");
        if (el.matches(".lp-script, .lp-cta__script")) writeWrapped(el, d);
        if (el.matches(".lp-note") && el.firstElementChild) writeWrapped(el.firstElementChild, d);
        if (el.matches(".lp-script:not([data-write-lines])")) {
          // Маска проходит только по надписи, включая текст, перенесённый на несколько строк.
          const range = document.createRange();
          range.selectNodeContents(el);
          const text = range.getBoundingClientRect();
          const box = el.getBoundingClientRect();
          if (box.width) {
            el.style.setProperty("--write-start", (box.right - text.left) / box.width * 100 + "%");
            el.style.setProperty("--write-end", (box.right - text.right) / box.width * 100 + "%");
          }
        }
        el.setAttribute("data-in", "");
        rio.unobserve(el);
        const c = el.querySelector(".lp-count");
        if (c) countUp(c, d + 250);
      });
    }, { rootMargin: "0px 0px -10% 0px" });
    $$("[data-reveal], [data-split]").forEach((el) => rio.observe(el));
  }

  /* ---------------------------------------------------------------- сцены прокрутки */
  // Сцена знает, где она (target — доля пройденного, 0…1) и как это нарисовать (render).
  // Нарисованное догоняет прокрутку с постоянной времени 140 мс: движение плавное и не дёргается от колеса мыши.
  const scenes = [];
  function scene(s) { Object.assign(s, { on: false, cur: null, drawn: null }); scenes.push(s); return s; }

  // манифест: слова загораются, пока абзац проходит экран
  const man = $(".lp-manifesto");
  const manScene = man && scene({
    target: (vh) => { const r = man.getBoundingClientRect(); return clamp((vh * 0.85 - r.top) / (r.height + vh * 0.35)); },
    render: (p) => man.style.setProperty("--p", p.toFixed(4)),
  });
  if (manScene) manScene.on = ANIM;

  // При прокрутке вращается носитель жетонов, а подписи сохраняют свой наклон.
  const orbit = $(".lp-antex__orbit");
  if (ANIM && orbit) {
    const visual = orbit.parentElement;
    const orbitScene = scene({
      target: (vh) => {
        const r = visual.getBoundingClientRect();
        return clamp((vh - r.top) / (vh + r.height));
      },
      render: (p) => orbit.style.setProperty("--orbit-angle", (190 * p).toFixed(2) + "deg"),
    });
    let visible = !IO;
    const syncOrbit = () => {
      orbitScene.on = visible && !document.hidden;
      visual.classList.toggle("is-live", orbitScene.on);
      if (orbitScene.on) kick();
    };
    if (IO) new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      syncOrbit();
    }).observe(visual);
    document.addEventListener("visibilitychange", syncOrbit);
    // Первичная синхронизация после инициализации общего цикла прокрутки.
    requestAnimationFrame(syncOrbit);
  }

  // направления (десктоп): раздел стоит, страны едут справа налево
  const dir = $(".lp-dir"), pin = $(".lp-dir__pin"), track = $(".lp-dir__track");
  let shift = 0;
  const dirScene = dir && pin && track && scene({
    target: (vh) => { const r = dir.getBoundingClientRect(), total = r.height - vh; return total > 0 ? clamp(-r.top / total) : 0; },
    render: (p) => {
      const q = clamp((p - 0.06) / 0.88); // в начале и в конце раздел чуть стоит на месте
      track.style.translate = `${(-shift * q).toFixed(1)}px 0`;
      dir.style.setProperty("--dir-p", q.toFixed(4));
    },
  });

  // истории: колода, верхняя карточка улетает в сторону
  const stories = $(".lp-stories"), cards = $$(".lp-story"), deckCount = $(".lp-stories__count b");
  const videos = new Map();
  const watchVideo = IO && new IntersectionObserver(entries => {
    for (const entry of entries) if (!entry.isIntersecting) entry.target.pause();
  });
  for (const card of cards) {
    const video = $("video", card), play = $(".lp-postcard__play", card);
    if (!video || !play) continue;
    videos.set(card, video);
    play.hidden = false;
    play.addEventListener("click", () => {
      play.hidden = true;
      video.focus();
      video.play().catch(() => { play.hidden = false; play.focus(); });
    });
    video.addEventListener("play", () => {
      play.hidden = true;
      for (const other of videos.values()) if (other !== video && !other.paused) other.pause();
    });
    if (watchVideo) watchVideo.observe(video);
  }
  const deckScene = stories && cards.length > 1 && scene({
    target: (vh) => { const r = stories.getBoundingClientRect(), total = r.height - vh; return total > 0 ? clamp(-r.top / total) : 0; },
    render: (p, vh) => {
      const n = cards.length, P = clamp((p - 0.08) / 0.84) * (n - 1);
      const active = Math.round(P);
      cards.forEach((c, i) => {
        const inactive = i !== active;
        if (c.inert !== inactive) c.inert = inactive;
        const video = videos.get(c);
        if (inactive && video && !video.paused) video.pause();
        const d = i - P, side = i % 2 ? 1 : -1;
        let tx = 0, ty, r, s = 1, o;
        if (d >= 0) { const m = Math.min(d, 3); ty = m * 18; s = 1 - m * 0.045; r = side * 1.6 * m; o = clamp(4 - d); }
        else { const e = clamp(-d); ty = -e * vh * 0.8; tx = side * e * innerWidth * 0.2; r = side * 14 * e; o = clamp((1 - e) * 2.4); } // улетает непрозрачной, гаснет в конце
        c.style.transform = `translate3d(${tx.toFixed(1)}px, ${ty.toFixed(1)}px, 0) rotate(${r.toFixed(2)}deg) scale(${s.toFixed(4)})`;
        c.style.opacity = o.toFixed(3);
        c.style.zIndex = String(n - i);
      });
      if (deckCount) deckCount.textContent = String(Math.min(n, Math.round(P) + 1)).padStart(2, "0");
    },
  });
  if (deckScene) {
    deckScene.on = ANIM;
    if (ANIM) stories.style.setProperty("--deck-len", Math.round((0.75 * (cards.length - 1) + 0.5) * 100) + "svh");
  }

  // шапка: тон — по разделу под ней, в меню — раздел у середины экрана
  const header = $(".lp-header");
  const rates = $(".lp-rates");
  const ratesSlot = rates?.parentElement;
  const ratesWindow = rates && $(".lp-rates__window", rates);
  const toned = $$("main > section, .lp-footer");
  const navLinks = $$(".lp-nav a");
  let menuOpen = false;
  function readChrome(vh) {
    const headerHeight = header?.getBoundingClientRect().height || 0;
    const mid = headerHeight / 2;
    const compact = scrollY > 32;
    const docked = ratesSlot && ratesSlot.getBoundingClientRect().top <= headerHeight;
    const dockChanged = ratesSlot && docked !== ratesSlot.classList.contains("is-docked");
    const slotHeight = dockChanged && docked ? rates.getBoundingClientRect().height : 0;
    let tone = null, spy = null;
    for (const s of toned) {
      const r = s.getBoundingClientRect();
      if (r.top <= mid && r.bottom > mid) tone = s; // листы перекрываются — побеждает верхний, то есть последний
      if (s.id && r.top <= vh * 0.4 && r.bottom > vh * 0.4) spy = s.id;
    }
    return () => {
      if (!header) return;
      header.classList.toggle("is-compact", compact);
      if (dockChanged) {
        if (docked) ratesSlot.style.setProperty("--rates-slot", slotHeight + "px");
        else ratesSlot.style.removeProperty("--rates-slot");
        ratesSlot.classList.toggle("is-docked", docked);
        if (docked && !ANIM) {
          ratesWindow.tabIndex = 0;
          ratesWindow.setAttribute("role", "region");
          ratesWindow.setAttribute("aria-label", "Курсы валют, горизонтальная прокрутка");
        } else {
          ratesWindow.removeAttribute("tabindex");
          ratesWindow.removeAttribute("role");
          ratesWindow.removeAttribute("aria-label");
        }
      }
      const t = menuOpen ? "dark" : tone && tone.getAttribute("data-theme");
      const brand = !menuOpen && !!tone && tone.classList.contains("lp-tone-brand");
      if (brand !== (header.dataset.tone === "brand")) brand ? (header.dataset.tone = "brand") : delete header.dataset.tone;
      if (t) { if (header.getAttribute("data-theme") !== t) header.setAttribute("data-theme", t); }
      else header.removeAttribute("data-theme");
      for (const a of navLinks) {
        const on = a.getAttribute("href") === "#" + spy;
        if (on !== a.hasAttribute("aria-current")) on ? a.setAttribute("aria-current", "true") : a.removeAttribute("aria-current");
      }
    };
  }

  let raf = 0, last = 0;
  function frame(now) {
    raf = 0;
    const dt = last ? Math.min(64, now - last) : 16;
    last = now;
    const k = 1 - Math.exp(-dt / 140);
    const vh = innerHeight;
    // сначала всё читаем, потом всё пишем — без лишних пересчётов раскладки
    const targets = scenes.map((s) => (s.on ? s.target(vh) : null));
    const paintChrome = readChrome(vh);
    let moving = false;
    scenes.forEach((s, i) => {
      const t = targets[i];
      if (t == null) return;
      s.cur = s.cur == null ? t : s.cur + (t - s.cur) * k;
      if (Math.abs(t - s.cur) < 0.0004) s.cur = t; else moving = true;
      if (s.cur !== s.drawn) { s.render(s.cur, vh); s.drawn = s.cur; }
    });
    paintChrome();
    if (moving) raf = requestAnimationFrame(frame); else last = 0;
  }
  const kick = () => { if (!raf) raf = requestAnimationFrame(frame); };

  if (header && rates) {
    const chromeSize = new ResizeObserver(() => {
      root.style.setProperty("--lp-header-height", header.getBoundingClientRect().height + "px");
      const dockHeight = ratesSlot.classList.contains("is-docked") ? rates.getBoundingClientRect().height : 0;
      root.style.setProperty("--lp-docked-height", dockHeight + "px");
      kick();
    });
    chromeSize.observe(header, { box: "border-box" });
    chromeSize.observe(rates, { box: "border-box" });
  }

  function measure() {
    // После смены ширины резервируем новую естественную высоту даже вдали от секции.
    if (ratesSlot?.classList.contains("is-docked")) {
      ratesSlot.classList.remove("is-docked");
      ratesSlot.style.setProperty("--rates-slot", rates.getBoundingClientRect().height + "px");
      ratesSlot.classList.add("is-docked");
    }
    fit();
    if (dirScene) {
      track.style.translate = "";
      const pinned = ANIM && getComputedStyle(pin).position === "sticky";
      shift = pinned ? Math.max(0, track.scrollWidth - pin.clientWidth) : 0;
      if (shift > 0) dir.style.setProperty("--dir-len", Math.round(shift / 0.88) + "px");
      else dir.style.removeProperty("--dir-len");
      dirScene.on = shift > 0;
      dirScene.cur = dirScene.drawn = null;
    }
    if (deckScene) deckScene.cur = deckScene.drawn = null;
    kick();
  }

  addEventListener("scroll", kick, { passive: true });
  let lastW = innerWidth, resizeRaf = 0;
  addEventListener("resize", () => {
    // высота меняется и от адресной строки телефона — тогда только перерисовка, без пересчёта
    if (innerWidth === lastW) { kick(); return; }
    lastW = innerWidth;
    cancelAnimationFrame(resizeRaf);
    resizeRaf = requestAnimationFrame(measure);
  });

  /* ---------------------------------------------------------------- первый экран: талон, бегущий город, самолёт */
  const HERO = [
    { code: "TBS", city: "Тбилиси", country: "Грузия", flight: "ZP 101", seat: "городской чат" },
    { code: "BUS", city: "Батуми", country: "Грузия", flight: "ZP 102", seat: "женский чат" },
    { code: "DAD", city: "Дананг", country: "Вьетнам", flight: "ZP 201", seat: "аренда жилья" },
    { code: "CXR", city: "Нячанг", country: "Вьетнам", flight: "ZP 202", seat: "городской чат" },
    { code: "PQC", city: "Фукуок", country: "Вьетнам", flight: "ZP 203", seat: "городской чат" },
    { code: "UTP", city: "Паттайя", country: "Таиланд", flight: "ZP 301", seat: "барахолка" },
  ];
  const hero = $(".lp-hero");
  const heroWord = $(".lp-hero__big");
  if (hero && heroWord) {
    const title = heroWord.parentElement;
    const inner = title.parentElement;
    const kicker = $(".lp-hero__kicker", inner);
    const alignTitle = new ResizeObserver(() => {
      // Исходные координаты сетки сохраняются при визуальном подъёме групп.
      const top = parseFloat(getComputedStyle(title).top);
      const flowTop = title.offsetTop - top;
      if (kicker && header) inner.style.setProperty("--hero-headroom", kicker.offsetTop - top - header.offsetHeight + "px");
      const belowWord = hero.offsetHeight - flowTop - heroWord.offsetHeight / 2;
      inner.style.setProperty("--hero-below-word", belowWord + "px");
    });
    alignTitle.observe(inner);
    alignTitle.observe(heroWord);
    alignTitle.observe($(".lp-hero__bottom", inner));
  }

  // Общий слой хранит все пройденные точки; у каждого самолёта своя кривая и скорость.
  const route = $(".lp-hero__route");
  const trails = ANIM && route ? document.createElement("canvas") : null;
  const ctx = trails?.getContext("2d");
  if (ctx) {
    const plane = $(".lp-route-plane", route);
    const header = $(".lp-header");
    const randomPoint = () => ({ x: Math.random(), y: Math.random() });
    const middle = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
    let left, top, areaWidth, areaHeight, scale, speed;
    let previous = 0, frame = 0, visible = !IO, initialized = false;

    function nextPoint(a, b) {
      const dx = b.x - a.x, dy = b.y - a.y;
      let point;
      for (let attempt = 0; attempt < 32; attempt++) {
        point = randomPoint();
        const nx = point.x - b.x, ny = point.y - b.y;
        const span = Math.hypot(nx, ny);
        if (span > 0.36 && (dx * nx + dy * ny) > -0.88 * Math.hypot(dx, dy) * span) break;
      }
      return point;
    }

    let mouse = null, follower = null;
    const flights = Array.from({ length: 3 }, (_, index) => {
      const node = index ? plane.cloneNode(true) : plane;
      if (index) route.append(node);
      node.classList.add("is-flying");
      const a = randomPoint(), b = randomPoint(), c = nextPoint(a, b);
      return { node, start: middle(a, b), control: b, next: c, end: middle(b, c),
        t: Math.random() * 0.6, pace: 0.88 + Math.random() * 0.24, untilDot: 0 };
    });

    // Координата и касательная квадратичной кривой в долях рабочей области.
    function pose(f) {
      const u = 1 - f.t;
      return {
        x: u * u * f.start.x + 2 * u * f.t * f.control.x + f.t * f.t * f.end.x,
        y: u * u * f.start.y + 2 * u * f.t * f.control.y + f.t * f.t * f.end.y,
        dx: 2 * (u * (f.control.x - f.start.x) + f.t * (f.end.x - f.control.x)) * areaWidth,
        dy: 2 * (u * (f.control.y - f.start.y) + f.t * (f.end.y - f.control.y)) * areaHeight,
      };
    }
    function position(f, p) {
      f.current = p;
      const angle = Math.atan2(p.dy, p.dx) * 180 / Math.PI;
      f.node.setAttribute("transform", `translate(${left + p.x * areaWidth} ${top + p.y * areaHeight}) rotate(${angle}) scale(${scale})`);
    }
    function mark(p) {
      ctx.beginPath();
      ctx.ellipse(p.x * trails.width, p.y * trails.height,
        1.35 * trails.width / areaWidth, 1.35 * trails.height / areaHeight, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    function advance(f, travel) {
      let p = pose(f);
      while (travel > 0.001) {
        if (f.untilDot <= 0.001) { mark(p); f.untilDot = 13; }
        const tangent = Math.max(1, Math.hypot(p.dx, p.dy));
        const dt = Math.min(1 - f.t, 0.05, Math.min(travel, f.untilDot) / tangent);
        const step = dt * tangent;
        f.t += dt;
        travel -= step;
        f.untilDot -= step;
        if (f.t >= 1) {
          f.start = f.end;
          const target = nextPoint(f.control, f.next);
          f.control = f.next;
          f.next = target;
          f.end = middle(f.control, target);
          f.t = 0;
        }
        p = pose(f);
      }
      position(f, p);
    }
    function follow(f, elapsed, time) {
      const p = f.current;
      const targetX = clamp(mouse.x + 22 * Math.sin(time / 337) + 9 * Math.sin(time / 593), 0, areaWidth);
      const targetY = clamp(mouse.y + 19 * Math.cos(time / 401) + 8 * Math.sin(time / 271), 0, areaHeight);
      const blend = 1 - Math.exp(-elapsed * 6);
      const dx = (targetX - p.x * areaWidth) * blend, dy = (targetY - p.y * areaHeight) * blend;
      const distance = Math.hypot(dx, dy);
      if (!distance) return;
      for (; f.untilDot <= distance; f.untilDot += 13) {
        const part = f.untilDot / distance;
        mark({ x: p.x + part * dx / areaWidth, y: p.y + part * dy / areaHeight });
      }
      f.untilDot -= distance;
      position(f, { x: p.x + dx / areaWidth, y: p.y + dy / areaHeight, dx, dy });
    }
    function release() {
      mouse = null;
      if (!follower) return;
      const p = follower.current;
      const length = Math.max(0.001, Math.hypot(p.dx, p.dy));
      const reach = Math.min(areaWidth, areaHeight) * 0.2;
      follower.start = { x: p.x, y: p.y };
      follower.control = { x: clamp(p.x + reach * p.dx / length / areaWidth, 0, 1),
        y: clamp(p.y + reach * p.dy / length / areaHeight, 0, 1) };
      follower.next = nextPoint(follower.start, follower.control);
      follower.end = middle(follower.control, follower.next);
      follower.t = 0;
      follower = null;
    }
    function tint() {
      ctx.fillStyle = getComputedStyle(plane).fill;
      ctx.globalCompositeOperation = "source-in";
      ctx.fillRect(0, 0, trails.width, trails.height);
      ctx.globalCompositeOperation = "source-over";
    }
    function resize() {
      release();
      const { width, height } = route.getBoundingClientRect();
      if (!width || !height) return;
      scale = 2 * Math.max(width / 1440, height / 900);
      left = Math.min(width / 5, 22 * scale);
      top = Math.min(height * 0.45, header.offsetHeight + left);
      areaWidth = width - 2 * left;
      areaHeight = Math.max(1, Math.min(height, innerHeight) - left - top);
      speed = clamp(Math.hypot(width, areaHeight) / 7, 85, 200);
      route.setAttribute("viewBox", `0 0 ${width} ${height}`);
      Object.assign(trails.style, { left: left + "px", top: top + "px",
        width: areaWidth + "px", height: areaHeight + "px" });
      if (!initialized) {
        // Буфер выделяется один раз; при resize масштабируется вместе с координатами самолётов.
        const density = Math.min(devicePixelRatio || 1, 2, 2048 / Math.max(areaWidth, areaHeight));
        trails.width = Math.max(1, Math.round(areaWidth * density));
        trails.height = Math.max(1, Math.round(areaHeight * density));
        tint();
        initialized = true;
      }
      flights.forEach(f => position(f, pose(f)));
    }
    function tick(time) {
      const elapsed = previous ? Math.min(time - previous, 100) / 1000 : 0;
      previous = time;
      if (mouse && !follower) {
        follower = flights.find(f => Math.hypot(f.current.x * areaWidth - mouse.x,
          f.current.y * areaHeight - mouse.y) <= 14 * scale);
      }
      for (const f of flights) {
        if (f === follower) follow(f, elapsed, time);
        else advance(f, elapsed * speed * f.pace);
      }
      frame = requestAnimationFrame(tick);
    }
    function syncFlight() {
      if (!visible || document.hidden) release();
      cancelAnimationFrame(frame);
      previous = 0;
      if (visible && !document.hidden) frame = requestAnimationFrame(tick);
    }

    trails.className = "lp-hero__trails";
    route.before(trails);
    $(".lp-route-line", route).style.display = "none";
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(route);
    observer.observe(header);
    window.addEventListener("resize", resize);
    function updateMouse(clientX, clientY) {
      const bounds = route.getBoundingClientRect();
      if (clientX < bounds.left || clientX >= bounds.right || clientY < bounds.top || clientY >= bounds.bottom) {
        release();
        return;
      }
      mouse = { clientX, clientY, x: clientX - bounds.left - left, y: clientY - bounds.top - top };
    }
    hero.addEventListener("pointermove", event => {
      if (event.pointerType === "mouse") updateMouse(event.clientX, event.clientY);
    });
    hero.addEventListener("pointerleave", release);
    hero.addEventListener("pointercancel", release);
    window.addEventListener("blur", release);
    window.addEventListener("scroll", () => {
      if (mouse) updateMouse(mouse.clientX, mouse.clientY);
    }, { passive: true });
    new MutationObserver(tint).observe(root, { attributes: true, attributeFilter: ["data-theme"] });
    if (IO) new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      syncFlight();
    }).observe(route);
    document.addEventListener("visibilitychange", syncFlight);
    syncFlight();
  }
  const cityTrack = $(".lp-hero .lp-marquee__track");
  if (cityTrack) {
    // В разметке две одинаковые последовательности; дополнительные копии заполняют широкие экраны.
    const items = Array.from(cityTrack.children);
    const sequence = items.slice(0, items.length / 2);
    const copies = [];
    function fillMarquee() {
      const width = cityTrack.parentElement.clientWidth;
      const period = items[sequence.length].getBoundingClientRect().left - items[0].getBoundingClientRect().left;
      if (period <= 0) return;
      const extra = Math.max(0, Math.ceil(width / period) - 1);
      while (copies.length < extra) {
        const copy = sequence.map(item => item.cloneNode(true));
        cityTrack.append(...copy);
        copies.push(copy);
      }
      while (copies.length > extra) copies.pop().forEach(item => item.remove());
      cityTrack.style.setProperty("--marquee-end", -period + "px");
    }
    fillMarquee();
    new ResizeObserver(fillMarquee).observe(cityTrack.parentElement);
    document.fonts.ready.then(fillMarquee);
  }
  /* ---------------------------------------------------------------- курсы AntEx */
  if (rates) {
    const windowEl = $(".lp-rates__window", rates);
    const track = $(".lp-rates__track", rates);
    const list = $(".lp-rates__list", rates);
    const pause = $(".lp-rates__pause", rates);
    const date = $(".lp-rates__date", rates);
    const priceFormat = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 8 });
    const dateFormat = new Intl.DateTimeFormat("ru-RU", {
      timeZone: "Europe/Moscow", dateStyle: "short", timeStyle: "short",
    });

    // Полный первый список остаётся доступен читалкам, копии заполняют остаток экрана и шов.
    function fillRates() {
      if (!ANIM) return;
      rates.classList.add("is-moving");
      const period = list.getBoundingClientRect().width;
      if (!period) return;
      const count = 1 + Math.ceil(windowEl.clientWidth / period);
      while (track.children.length < count) {
        const copy = list.cloneNode(true);
        copy.setAttribute("aria-hidden", "true");
        track.append(copy);
      }
      while (track.children.length > count) track.lastElementChild.remove();
      track.style.setProperty("--marquee-end", -period + "px");
      track.style.setProperty("--period-time", (period / 36) + "s");
      pause.hidden = false;
    }

    function showRates(data) {
      const currencies = ["USDT", "RUB", "THB", "GEL", "VND"];
      if (!Array.isArray(data)) return false;
      const rows = data.filter(row => row && currencies.includes(row.displayCurrencySell)
        && currencies.includes(row.displayCurrencyBuy) && typeof row.priceDisplay === "string"
        && /^\d+(\.\d+)?$/.test(row.priceDisplay) && Number.isFinite(Number(row.priceDisplay))
        && Number(row.priceDisplay) > 0 && typeof row.updatedAt === "string" && Number.isFinite(Date.parse(row.updatedAt)));
      if (!rows.length) return false;
      const items = rows.map(row => {
        const li = document.createElement("li");
        const arrow = document.createElement("span");
        const price = document.createElement("b");
        arrow.textContent = "→ от";
        price.textContent = priceFormat.format(Number(row.priceDisplay)) + " " + row.displayCurrencyBuy;
        li.append("1 " + row.displayCurrencySell + " ", arrow, " ", price);
        return li;
      });
      const times = rows.map(row => Date.parse(row.updatedAt));
      const first = dateFormat.format(Math.min(...times));
      const last = dateFormat.format(Math.max(...times));
      date.title = "Обновлено " + (first === last ? last : first + " — " + last) + " МСК";
      const parts = dateFormat.formatToParts(Math.max(...times));
      const part = type => parts.find(item => item.type === type).value;
      date.firstElementChild.textContent = [part("day"), part("month"), part("year")].join(".");
      date.lastElementChild.textContent = part("hour") + ":" + part("minute") + " МСК";
      list.replaceChildren(...items);
      track.replaceChildren(list);
      fillRates();
      return true;
    }

    async function loadRates() {
      for (const url of ["/api/antex-rates", "https://api.antex.pro/public/rates"]) {
        try {
          const response = await fetch(url, {
            credentials: "omit", signal: AbortSignal.timeout(6500), headers: { Accept: "application/json" },
          });
          if (response.ok && showRates(await response.json())) return;
        } catch { /* Датированный снимок остаётся доступным при сетевой ошибке. */ }
      }
    }

    if (ANIM) {
      fillRates();
      new ResizeObserver(fillRates).observe(windowEl);
      document.fonts.ready.then(fillRates);
      pause.addEventListener("click", () => {
        const stopped = rates.toggleAttribute("data-paused");
        pause.textContent = stopped ? "▶" : "Ⅱ";
        pause.setAttribute("aria-label", stopped ? "Запустить строку курсов" : "Остановить строку курсов");
      });
    }
    if (IO) {
      const nearRates = new IntersectionObserver(entries => {
        if (entries.some(entry => entry.isIntersecting)) {
          nearRates.disconnect();
          loadRates();
        }
      }, { rootMargin: "100% 0px" });
      nearRates.observe(rates);
    } else {
      loadRates();
    }
  }

  const passBox = $(".lp-hero__pass");
  const passCode = $('[data-pass="code"]');
  const field = (k) => $(`[data-pass="${k}"]`);
  const rot = $$(".lp-rotator > span");
  function swap(el, text) {
    if (!el || el.textContent === text) return;
    el.textContent = text;
    if (ANIM && el.animate) el.animate([{ opacity: 0, filter: "blur(6px)" }, { opacity: 1, filter: "blur(0px)" }], { duration: 800, easing: EASE });
  }
  if (ANIM && hero && passCode && rot.length === HERO.length) {
    let hi = 0, heroSeen = true, hover = false;
    const step = () => {
      const prev = hi;
      hi = (hi + 1) % HERO.length;
      rot.forEach((s) => s.classList.remove("is-off"));
      rot[prev].classList.replace("is-on", "is-off");
      rot[hi].classList.add("is-on");
      const c = HERO[hi];
      flap(passCode, c.code);
      swap(field("code2"), c.code);
      swap(field("city"), c.city);
      swap(field("country"), c.country);
      swap(field("flight"), c.flight);
      swap(field("seat"), c.seat);
    };
    const tick = () => {
      if (heroSeen && !hover && !document.hidden) step();
      setTimeout(tick, 3400);
    };
    setTimeout(() => flap(passCode, HERO[0].code), 1600); // талон «прилетел» — код переворачивается
    setTimeout(tick, 4800);
    if (IO) new IntersectionObserver((es) => { heroSeen = es[es.length - 1].isIntersecting; }).observe(hero);
    if (passBox) {
      passBox.addEventListener("pointerenter", () => { hover = true; });
      passBox.addEventListener("pointerleave", () => { hover = false; });
    }

    // талон чуть поворачивается за указателем
    if (FINE && passBox) {
      let tx = 0, ty = 0, cx = 0, cy = 0, tr = 0;
      const loop = () => {
        cx += (tx - cx) * 0.08;
        cy += (ty - cy) * 0.08;
        passBox.style.setProperty("--ry", cx.toFixed(2) + "deg");
        passBox.style.setProperty("--rx", cy.toFixed(2) + "deg");
        tr = Math.abs(tx - cx) + Math.abs(ty - cy) > 0.02 ? requestAnimationFrame(loop) : 0;
      };
      hero.addEventListener("pointermove", (e) => {
        const r = passBox.getBoundingClientRect();
        tx = clamp((e.clientX - (r.left + r.width / 2)) / innerWidth, -0.5, 0.5) * 18;
        ty = -clamp((e.clientY - (r.top + r.height / 2)) / innerHeight, -0.5, 0.5) * 14;
        if (!tr) tr = requestAnimationFrame(loop);
      });
      hero.addEventListener("pointerleave", () => { tx = ty = 0; if (!tr) tr = requestAnimationFrame(loop); });
    }
  }

  /* ---------------------------------------------------------------- как это работает: телефон и шаги */
  const steps = $$(".lp-step");
  const stage = $(".lp-how__stage");
  const stagePhone = stage && $(".lp-phone", stage);
  let curStep = 0, stageSeen = !ANIM;
  const setStep = (i) => {
    curStep = i;
    steps.forEach((s, j) => s.toggleAttribute("data-active", j === i));
    if (stagePhone && stageSeen) stagePhone.dataset.screen = String(i);
  };
  if (stagePhone && ANIM) stagePhone.removeAttribute("data-screen"); // экран оживёт, когда телефон впервые покажется
  setStep(0);
  if (IO) {
    const sio = new IntersectionObserver((es) => {
      for (const e of es) if (e.isIntersecting) setStep(Number(e.target.dataset.step) || 0);
    }, { rootMargin: "-48% 0px -48% 0px" });
    steps.forEach((s) => sio.observe(s));
    if (stage && ANIM) {
      const stIO = new IntersectionObserver((es) => {
        if (!es.some((e) => e.isIntersecting)) return;
        stageSeen = true;
        stIO.disconnect();
        setStep(curStep);
      }, { rootMargin: "0px 0px -15% 0px" });
      stIO.observe(stage);
    }
  }
  // на телефоне и планшете — маленький телефон в каждом шаге, переписка начинается, когда шаг на экране
  if (stagePhone) {
    const mio = ANIM && IO && new IntersectionObserver((es) => {
      for (const e of es) {
        if (!e.isIntersecting) continue;
        const ph = $(".lp-phone", e.target);
        if (ph) ph.dataset.screen = e.target.dataset.screen;
        mio.unobserve(e.target);
      }
    }, { rootMargin: "0px 0px -20% 0px" });
    steps.forEach((s, i) => {
      const box = $(".lp-step__screen", s);
      if (!box) return;
      const ph = stagePhone.cloneNode(true);
      ph.removeAttribute("data-screen");
      box.dataset.screen = String(i);
      box.append(ph);
      if (mio) mio.observe(box); else ph.dataset.screen = String(i);
    });
  }

  /* ---------------------------------------------------------------- каталог: табло вылетов с фильтром */
  const plural = (n, one, few, many) => {
    const a = n % 10, b = n % 100;
    return a === 1 && b !== 11 ? one : a >= 2 && a <= 4 && (b < 10 || b >= 20) ? few : many;
  };
  const communities = (n) => `${n} ${plural(n, "сообщество", "сообщества", "сообществ")}`;
  const COUNTRIES = {
    ge: { name: "Грузия", gen: "Грузии", loc: "в Грузии", cities: ["Тбилиси", "Батуми"] },
    vn: { name: "Вьетнам", gen: "Вьетнама", loc: "во Вьетнаме", cities: ["Дананг", "Нячанг", "Фукуок"] },
    th: { name: "Таиланд", gen: "Таиланда", loc: "в Таиланде", cities: ["Паттайя"] },
  };
  const CITIES = {
    "Тбилиси": { gen: "Тбилиси", loc: "в Тбилиси" },
    "Батуми": { gen: "Батуми", loc: "в Батуми" },
    "Дананг": { gen: "Дананга", loc: "в Дананге" },
    "Нячанг": { gen: "Нячанга", loc: "в Нячанге" },
    "Фукуок": { gen: "Фукуока", loc: "на Фукуоке" },
    "Паттайя": { gen: "Паттайи", loc: "в Паттайе" },
  };
  const TASKS = {
    advice: { name: "совет", about: "с советами" },
    talk: { name: "общение", about: "для общения" },
    home: { name: "жильё", about: "про жильё" },
    stuff: { name: "вещи", about: "про вещи" },
  };

  const board = $("#communities");
  const rowsBox = $(".lp-board__rows");
  const rows = rowsBox ? $$(".lp-flight", rowsBox) : [];
  const filterBox = $(".lp-filter");
  const cityRow = $(".lp-filter__cities");
  const cityChips = cityRow && $(".zp-chips", cityRow);
  const countLine = $(".lp-count-line");
  const resetBtn = $(".lp-reset");
  const moreBox = $(".lp-more");
  const empty = $(".lp-empty");
  const note = $(".lp-boardnote");
  const noteRow = rows.find((c) => c.dataset.cities === "Дананг|Нячанг");
  const st = { country: "all", city: "all", task: "any", all: false };

  const fits = (c) =>
    (st.country === "all" || c.dataset.country === st.country) &&
    (st.city === "all" || c.dataset.cities.split("|").includes(st.city)) &&
    (st.task === "any" || c.dataset.tasks.split(" ").includes(st.task));
  const filtered = () => st.country !== "all" || st.task !== "any";
  const chip = (label, value) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "zp-chip";
    b.dataset.setCity = value;
    const s = document.createElement("span");
    s.textContent = label;
    b.append(s);
    return b;
  };

  function render() {
    if (!board || !rows.length) return;
    const found = rows.filter(fits);
    const short = !filtered() && !st.all;
    const shown = short ? found.filter((c) => c.hasAttribute("data-featured")) : found;
    for (const c of rows) c.hidden = !shown.includes(c);

    $$("[data-set-country]", board).forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.setCountry === st.country)));
    $$("[data-set-task]", board).forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.setTask === st.task)));
    const country = COUNTRIES[st.country];
    if (cityRow && cityChips) {
      cityRow.hidden = !country || country.cities.length < 2;
      if (!cityRow.hidden) {
        if (cityChips.dataset.for !== st.country) {
          cityChips.dataset.for = st.country;
          cityChips.replaceChildren(chip("Все города", "all"), ...country.cities.map((c) => chip(c, c)));
        }
        $$("[data-set-city]", cityChips).forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.setCity === st.city)));
      }
    }

    const place = st.city !== "all" ? st.city : country ? country.name : "Все страны";
    const what = st.task !== "any" ? ", " + TASKS[st.task].name : "";
    if (countLine) {
      countLine.innerHTML = short
        ? `Показано <b>${shown.length}</b> из ${communities(found.length)}`
        : `${place}${what}: <b>${communities(shown.length)}</b>`;
    }
    if (resetBtn) resetBtn.hidden = !filtered();
    if (moreBox) moreBox.hidden = !short;

    if (empty) {
      empty.hidden = shown.length > 0;
      if (!shown.length) {
        const where = st.city !== "all" ? CITIES[st.city] : country || { gen: "", loc: "" };
        $(".lp-empty__text", empty).textContent =
          `Отдельного чата ${(TASKS[st.task] || { about: "" }).about} ${where.loc} пока нет. Спросите в общем чате — там подскажут, где искать.`;
        $(".lp-empty__btn", empty).textContent = `Показать все чаты ${where.gen}`;
      }
    }
    if (note) note.hidden = !shown.includes(noteRow);
  }

  function flipRows(list, base = 0) {
    if (!ANIM) return;
    list.forEach((row, i) => { const f = $(".lp-flap", row); if (f) flap(f, f.textContent, base + i * 90); });
  }
  // табло «перелистывается», когда каталог впервые на экране — и снова, если фильтр сменили издалека
  let flipPending = true;
  if (ANIM && IO && rowsBox) {
    new IntersectionObserver((es) => {
      if (!flipPending || !es.some((e) => e.isIntersecting)) return;
      flipPending = false;
      flipRows(rows.filter((r) => !r.hidden), 100);
    }, { rootMargin: "0px 0px -15% 0px" }).observe(rowsBox);
  }

  // перестановка: если каталог на экране — плавно (View Transition), новые строки перелистываются; иначе мгновенно
  function apply(change) {
    const before = new Set(rows.filter((r) => !r.hidden));
    if (!inView(board)) { change(); render(); flipPending = true; return; }
    go(() => {
      change();
      render();
      flipRows(rows.filter((r) => !r.hidden && !before.has(r)), 200);
    }, "filter");
  }

  if (filterBox) {
    filterBox.addEventListener("click", (e) => {
      const b = e.target.closest("[data-set-country], [data-set-city], [data-set-task]");
      if (!b || b.getAttribute("aria-pressed") === "true") return;
      const d = b.dataset;
      if (d.setCountry) apply(() => { st.country = d.setCountry; st.city = "all"; });
      else if (d.setCity) apply(() => { st.city = d.setCity; });
      else if (d.setTask) apply(() => { st.task = d.setTask; });
    });
  }
  if (resetBtn) resetBtn.addEventListener("click", () => apply(() => { Object.assign(st, { country: "all", city: "all", task: "any" }); }));
  if (moreBox) $("button", moreBox).addEventListener("click", () => apply(() => { st.all = true; }));
  if (empty) $(".lp-empty__btn", empty).addEventListener("click", () => apply(() => { st.task = "any"; }));

  // «Чаты Грузии» в направлениях и в подвале: выбрать страну и плавно доехать до каталога
  $$("[data-go]").forEach((a) => a.addEventListener("click", (e) => {
    const code = a.dataset.go;
    if (!board || !COUNTRIES[code]) return;
    e.preventDefault();
    Object.assign(st, { country: code, city: "all", task: "any", all: false });
    render();
    flipPending = true;
    board.scrollIntoView({ behavior: ANIM ? "smooth" : "auto", block: "start" });
  }));

  render();

  /* ---------------------------------------------------------------- меню на телефоне */
  const burger = $(".lp-burger"), sheet = $("#lp-sheet"), page = $(".lp-page");
  let sheetTimer = 0;
  function setMenu(open) {
    if (!burger || !sheet || open === menuOpen) return;
    menuOpen = open;
    clearTimeout(sheetTimer);
    burger.setAttribute("aria-expanded", String(open));
    burger.setAttribute("aria-label", open ? "Закрыть меню" : "Открыть меню");
    root.classList.toggle("lp-lock", open);
    if (page) page.inert = open;
    if (open) {
      sheet.hidden = false;
      sheet.getBoundingClientRect(); // сначала закрытое состояние, потом — раскрытие
      sheet.setAttribute("data-open", "");
      requestAnimationFrame(() => { const a = $("a", sheet); if (a) a.focus({ preventScroll: true }); });
    } else {
      sheet.removeAttribute("data-open");
      sheetTimer = setTimeout(() => { sheet.hidden = true; }, ANIM ? 1000 : 300);
    }
    kick();
  }
  if (burger && sheet) {
    burger.addEventListener("click", () => setMenu(!menuOpen));
    sheet.addEventListener("click", (e) => { if (e.target.closest("a")) setMenu(false); });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && menuOpen) { setMenu(false); burger.focus(); }
    });
    matchMedia("(width >= 75rem)").addEventListener("change", (e) => { if (e.matches) setMenu(false); });
  }

  /* ---------------------------------------------------------------- тема */
  const themeBtn = $(".lp-theme");
  const syncTheme = () => {
    if (!themeBtn) return;
    const dark = root.getAttribute("data-theme") === "dark";
    themeBtn.setAttribute("aria-label", dark ? "Включить светлую тему" : "Включить тёмную тему");
    themeBtn.title = dark ? "Светлая тема" : "Тёмная тема";
  };
  syncTheme();
  // тему может сменить и хост (claude.ai ставит data-theme на корень сам) — подпись кнопки идёт следом
  new MutationObserver(syncTheme).observe(root, { attributes: true, attributeFilter: ["data-theme"] });
  if (themeBtn) {
    themeBtn.addEventListener("click", () => {
      const next = root.getAttribute("data-theme") === "dark" ? "light" : "dark";
      go(() => { root.setAttribute("data-theme", next); syncTheme(); }, "theme", themeBtn);
      try { localStorage.setItem("zp-theme", next); } catch (err) { /* без сохранения — тоже работает */ }
    });
  }

  /* ---------------------------------------------------------------- магнитная кнопка в финале */
  const orb = $(".lp-orb"), orbWrap = $(".lp-orb-wrap"), orbZone = $(".lp-cta__row");
  if (ANIM && FINE && orb && orbWrap && orbZone) {
    const reset = () => { orb.style.setProperty("--mx", "0px"); orb.style.setProperty("--my", "0px"); };
    orbZone.addEventListener("pointermove", (e) => {
      const r = orbWrap.getBoundingClientRect();
      const dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
      if (Math.hypot(dx, dy) > r.width * 1.5) { reset(); return; }
      orb.style.setProperty("--mx", (dx * 0.28).toFixed(1) + "px");
      orb.style.setProperty("--my", (dy * 0.28).toFixed(1) + "px");
    });
    orbZone.addEventListener("pointerleave", reset);
  }

  /* ---------------------------------------------------------------- старт */
  measure();
  root.classList.add("lp-ready");
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(measure);
  addEventListener("load", measure);
})();
