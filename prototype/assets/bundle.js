/* @ds-bundle: {"format":4,"namespace":"Zp","components":[{"name":"Icon"},{"name":"Button"},{"name":"Chip"},{"name":"Badge"},{"name":"Plate"},{"name":"Notice"},{"name":"SectionHead"},{"name":"CommunityCard"},{"name":"CountryCard"},{"name":"Steps"},{"name":"Hero"},{"name":"SiteHeader"},{"name":"ThemeToggle"},{"name":"AntexPanel"},{"name":"Faq"},{"name":"CtaBand"},{"name":"SiteFooter"},{"name":"Quote"}]} */
(function () {
  var React = window.React;
  var h = React ? React.createElement : null;

  function cx() {
    return Array.prototype.filter.call(arguments, Boolean).join(" ");
  }
  function omit(o, keys) {
    var r = {};
    for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k) && keys.indexOf(k) < 0) r[k] = o[k];
    return r;
  }

  /* Движение: можно ли двигать и как запустить View Transition с нужной хореографией */
  function motionOK() {
    var d = document.documentElement;
    if (d.getAttribute("data-motion") === "reduce") return false;
    return !(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }
  // kind: "theme" — круг из точки from, "filter" — страница стоит, перелетают элементы с view-transition-name
  function transition(update, kind, from) {
    var d = document.documentElement;
    var flush = function () { if (window.ReactDOM && window.ReactDOM.flushSync) window.ReactDOM.flushSync(update); else update(); };
    if (!document.startViewTransition || !motionOK()) { flush(); return null; }
    if (from && from.getBoundingClientRect) {
      var r = from.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2;
      d.style.setProperty("--zp-vt-x", x + "px");
      d.style.setProperty("--zp-vt-y", y + "px");
      d.style.setProperty("--zp-vt-r", Math.ceil(Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y))) + "px");
    }
    d.setAttribute("data-vt", kind || "change");
    var t = (vtNow = document.startViewTransition(flush));
    // прерванный переход (быстрый второй клик) не снимает data-vt со следующего
    t.finished.finally(function () { if (vtNow === t) { vtNow = null; d.removeAttribute("data-vt"); } });
    return t;
  }
  var vtNow = null;
  // во время перехода браузер отдаёт все клики корню документа: такой клик доигрывает переход мгновенно
  // и доходит до элемента под курсором — быстрый второй выбор в фильтре не теряется
  document.addEventListener("click", function (e) {
    if (!vtNow || e.target !== document.documentElement) return;
    var x = e.clientX, y = e.clientY, t = vtNow;
    t.skipTransition();
    t.finished.finally(function () {
      var el = document.elementFromPoint(x, y);
      while (el && !(el instanceof HTMLElement)) el = el.parentElement; // svg-иконка → её кнопка
      if (el && el !== document.documentElement && el !== document.body) el.click();
    });
  }, true);

  /* Появление при прокрутке. Элемент входит в экран → data-in="run" → CSS проигрывает «посадку» (dur-slower)
     в своём темпе, а не вместе с колесом мыши; когда анимация закончилась — data-in="done", и она снимается.
     data-reveal на <html> прячет то, что ещё не показано: без скрипта или без IntersectionObserver всё видно сразу.
     Целиком: .zp-reveal, .zp-head, .zp-steps, .zp-quote, .zp-antex, .zp-cta.
     По одному ребёнку: .zp-reveal-group, .zp-grid, .zp-faq, .zp-antex__list; вошедшие вместе идут каскадом (--_b).
     Пока играет вход главного экрана, остальные ждут его (--_d). */
  var RV_BLOCK = ".zp-reveal, .zp-head, .zp-steps, .zp-quote, .zp-antex, .zp-cta";
  var RV_GROUP = ".zp-reveal-group, .zp-grid, .zp-faq, .zp-antex__list";
  var rv = null;

  function rvMark(el, state) {
    el.setAttribute("data-in", state);
    var g = el.parentElement;
    if (g && g.matches(RV_GROUP)) rv.live.add(g);
  }
  function rvDone(el) {
    rvMark(el, "done");
    el.style.removeProperty("--_b");
    el.style.removeProperty("--_d");
  }
  function rvRun(el, order, wait) {
    el.style.setProperty("--_b", String(order));
    if (wait > 0) el.style.setProperty("--_d", Math.round(wait) + "ms");
    rvMark(el, "run");
    if (!el.getAnimations) { setTimeout(function () { rvDone(el); }, 3500); return; }
    // ждём только конечные анимации по времени: прокруточные и бесконечные (самолёт, кольца) не в счёт
    var own = el.getAnimations({ subtree: true }).filter(function (a) {
      var t = a.effect && a.effect.getComputedTiming();
      return a.timeline === document.timeline && t && isFinite(t.endTime);
    });
    Promise.all(own.map(function (a) { return a.finished.catch(function () {}); })).then(function () { rvDone(el); });
  }
  function rvEnter(entries) {
    var batch = [], i, e;
    for (i = 0; i < entries.length; i++) {
      e = entries[i];
      if (e.isIntersecting) batch.push(e);
      else if (e.boundingClientRect.bottom <= 0) { rv.io.unobserve(e.target); rvDone(e.target); } // уже над экраном или скрыт
    }
    batch.sort(function (a, b) { return a.boundingClientRect.top - b.boundingClientRect.top || a.boundingClientRect.left - b.boundingClientRect.left; });
    var ok = motionOK(), wait = rv.hold - performance.now();
    for (i = 0; i < batch.length; i++) {
      rv.io.unobserve(batch[i].target);
      if (ok) rvRun(batch[i].target, Math.min(i, 6), wait);
      else rvDone(batch[i].target);
    }
  }
  function rvTake(el, late) {
    if (rv.seen.has(el)) return;
    rv.seen.add(el);
    var g = el.parentElement;
    // новый ребёнок группы, до которой уже долистали (фильтр, «Показать все»), появляется сразу — его ведёт View Transition
    if (late && g && rv.live.has(g)) { rvDone(el); return; }
    rv.io.observe(el);
  }
  function rvScan(root, late) {
    if (!root || root.nodeType !== 1) return;
    var i, j, list, p = root.parentElement;
    if (root.matches(RV_BLOCK) || (p && p.matches(RV_GROUP))) rvTake(root, late);
    list = root.querySelectorAll(RV_BLOCK);
    for (i = 0; i < list.length; i++) rvTake(list[i], late);
    list = Array.prototype.slice.call(root.querySelectorAll(RV_GROUP));
    if (root.matches(RV_GROUP)) list.unshift(root);
    for (i = 0; i < list.length; i++) for (j = 0; j < list[i].children.length; j++) rvTake(list[i].children[j], late);
    if (!rv.hold) {
      var hero = root.matches(".zp-hero") ? root : root.querySelector(".zp-hero");
      if (hero && hero.getBoundingClientRect().bottom > 0) rv.hold = performance.now() + 900;
    }
  }
  function reveal() {
    if (rv) return true;
    if (!window.IntersectionObserver || !window.MutationObserver || !window.WeakSet) return false;
    rv = { seen: new WeakSet(), live: new WeakSet(), hold: 0, io: new IntersectionObserver(rvEnter, { rootMargin: "0px 0px -8% 0px" }) };
    document.documentElement.setAttribute("data-reveal", "");
    var start = function () {
      rvScan(document.body, false);
      new MutationObserver(function (muts) {
        for (var i = 0; i < muts.length; i++) for (var j = 0; j < muts[i].addedNodes.length; j++) rvScan(muts[i].addedNodes[j], true);
      }).observe(document.body, { childList: true, subtree: true });
    };
    if (document.body) start();
    else document.addEventListener("DOMContentLoaded", start, { once: true });
    return true;
  }

  // показать сразу, без анимации, всё ещё не показанное внутри root — например, перед перестановкой карточек фильтром
  function revealNow(root) {
    if (!rv || !root) return;
    var sel = RV_BLOCK + ", " + RV_GROUP.split(", ").map(function (g) { return g + " > *"; }).join(", ");
    var list = [root].concat(Array.prototype.slice.call(root.querySelectorAll(sel)));
    for (var i = 0; i < list.length; i++) {
      if (!rv.seen.has(list[i]) || list[i].hasAttribute("data-in")) continue;
      rv.io.unobserve(list[i]);
      rvDone(list[i]);
    }
  }

  window.Zp = window.Zp || {};
  Object.assign(window.Zp, { motionOK: motionOK, transition: transition, reveal: reveal, revealNow: revealNow });
  reveal();
  if (!React) return; // без React доступны только движение и появление — для статичных страниц

  /* Иконки: линейный набор 24×24, штрих 1.75 — пути по мотивам Lucide (ISC). */
  var ICONS = {
    plane: "M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z",
    send: "M14.536 21.686a.5.5 0 0 0 .937-.024l6.5-19a.496.496 0 0 0-.635-.635l-19 6.5a.5.5 0 0 0-.024.937l7.93 3.18a2 2 0 0 1 1.112 1.11zM21.854 2.147l-10.94 10.939",
    arrow: "M5 12h14M12 5l7 7-7 7",
    chat: "M7.9 20A9 9 0 1 0 4 16.1L2 22Z",
    home: "M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z",
    bag: "M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4ZM3 6h18M16 10a4 4 0 0 1-8 0",
    heart: "M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z",
    users: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75",
    list: "M3 6h.01M3 12h.01M3 18h.01M8 6h13M8 12h13M8 18h13",
    sun: "M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41",
    moon: "M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z",
    menu: "M4 6h16M4 12h16M4 18h16",
    close: "M18 6 6 18M6 6l12 12",
    check: "M20 6 9 17l-5-5",
    shield: "M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1zM9 12l2 2 4-4",
    chevron: "M6 9l6 6 6-6",
    pin: "M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0M15 10a3 3 0 1 1-6 0 3 3 0 0 1 6 0",
    exchange: "M8 3 4 7l4 4M4 7h16M16 21l4-4-4-4M20 17H4",
    info: "M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0M12 16v-4M12 8h.01",
    clock: "M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0M12 6v6l4 2",
    external: "M15 3h6v6M10 14 21 3M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6",
  };

  function Icon(p) {
    var d = ICONS[p.name] || ICONS.info;
    return h(
      "svg",
      {
        className: cx("zp-icon", p.size === "s" && "zp-icon--s", p.className),
        viewBox: "0 0 24 24",
        role: p.label ? "img" : undefined,
        "aria-label": p.label,
        "aria-hidden": p.label ? undefined : "true",
        focusable: "false",
      },
      h("path", { d: d })
    );
  }
  Icon.names = Object.keys(ICONS);

  function Button(p) {
    var variant = p.variant || "primary";
    var rest = omit(p, ["variant", "size", "block", "icon", "trailingIcon", "children", "className", "href", "external"]);
    var tag = p.href ? "a" : "button";
    var props = Object.assign(rest, {
      className: cx("zp-btn", "zp-btn--" + variant, p.size && "zp-btn--" + p.size, p.block && "zp-btn--block", !p.children && "zp-btn--icon", p.className),
    });
    if (p.href) {
      props.href = p.href;
      if (p.external) { props.target = "_blank"; props.rel = "noopener"; }
    } else if (!props.type) props.type = "button";
    return h(
      tag,
      props,
      p.icon && h(Icon, { name: p.icon }),
      p.children,
      p.trailingIcon && h(Icon, { name: p.trailingIcon, className: "zp-icon--trail" })
    );
  }

  function Chip(p) {
    var rest = omit(p, ["pressed", "count", "icon", "children", "className", "href"]);
    var cls = cx("zp-chip", p.className);
    var kids = [p.icon && h(Icon, { key: "i", name: p.icon, size: "s" }), h("span", { key: "l" }, p.children), p.count != null && h("span", { key: "c", className: "zp-chip__count" }, p.count)];
    if (p.href) return h("a", Object.assign(rest, { className: cls, href: p.href, "aria-current": p.pressed ? "true" : undefined }), kids);
    return h("button", Object.assign({ type: "button" }, rest, { className: cls, "aria-pressed": p.pressed ? "true" : "false" }), kids);
  }

  function Badge(p) {
    return h("span", { className: cx("zp-badge", p.tone && p.tone !== "neutral" && "zp-badge--" + p.tone, p.className) }, p.icon && h(Icon, { name: p.icon, size: "s" }), p.children);
  }

  function Plate(p) {
    return h(p.as || "span", { className: cx("zp-plate", p.variant && p.variant !== "solid" && "zp-plate--" + p.variant, p.className) }, p.children);
  }

  function Notice(p) {
    var tone = p.tone || "info";
    var icon = p.icon || (tone === "success" ? "check" : tone === "warning" ? "clock" : "info");
    return h(
      "p",
      { className: cx("zp-notice", tone !== "info" && "zp-notice--" + tone, p.plain && "zp-notice--plain", p.className), role: p.role },
      h(Icon, { name: icon, size: "s" }),
      h("span", null, p.children)
    );
  }

  function SectionHead(p) {
    var T = p.as || "h2";
    return h(
      "header",
      { className: cx("zp-head", p.align === "center" && "zp-head--center", p.className) },
      p.eyebrow && h("span", { className: "plate zp-eyebrow" }, p.eyebrow),
      h(T, { className: "display-l zp-head__title", id: p.id }, p.title, p.accent && h("span", { className: "zp-accent" }, p.accent)),
      p.lead && h("p", { className: "lead zp-head__lead" }, p.lead)
    );
  }

  var KINDS = {
    city: { icon: "chat", label: "Городской чат" },
    women: { icon: "heart", label: "Женский чат" },
    rent: { icon: "home", label: "Аренда" },
    market: { icon: "bag", label: "Барахолка" },
    blog: { icon: "plane", label: "Блог" },
    catalog: { icon: "list", label: "Бот-каталог" },
  };

  function CommunityCard(p) {
    var k = KINDS[p.kind] || KINDS.city;
    var T = p.headingAs || "h3";
    return h(
      "article",
      { className: cx("zp-ccard", p.className), style: p.style },
      h(
        "div",
        { className: "zp-ccard__top" },
        h("span", { className: "zp-ccard__mark" }, p.avatar ? h("img", { src: p.avatar, alt: "", loading: "lazy", decoding: "async" }) : h(Icon, { name: k.icon })),
        h("div", { className: "zp-ccard__titles" }, h("span", { className: "plate zp-ccard__where" }, p.city), h(T, { className: "heading-s zp-ccard__title" }, p.title || k.label))
      ),
      p.question && h("p", { className: "small zp-ccard__q" }, p.question),
      h("ul", { className: "zp-ccard__meta" }, h("li", null, h(Badge, { tone: "brand", icon: k.icon }, k.label)), p.format && h("li", null, h(Badge, null, p.format)), p.isNew && h("li", null, h(Badge, { tone: "sun" }, "Новое"))),
      h(
        "div",
        { className: "zp-ccard__foot" },
        h(Button, { variant: "secondary", size: "sm", href: p.href || "#", trailingIcon: "arrow" }, p.cta || "Открыть чат"),
        p.checkedAt && h("span", { className: "caption zp-ccard__checked" }, h(Icon, { name: "check", size: "s" }), "Ссылка проверена " + p.checkedAt)
      )
    );
  }

  function CountryCard(p) {
    var T = p.headingAs || "h3";
    var cities = p.cities || [];
    return h(
      "article",
      { className: cx("zp-country", p.active && "zp-country--active", p.className), style: p.style },
      h("div", { className: "zp-country__head" }, h(T, { className: "heading-m zp-country__name" }, p.name), h(Badge, { tone: p.active ? undefined : "brand" }, cities.length + " " + plural(cities.length, "город", "города", "городов"))),
      p.note && h("p", { className: "small zp-country__note" }, p.note),
      h("ul", { className: "zp-country__cities" }, cities.map(function (c) { return h("li", { key: c }, h(Plate, null, c)); })),
      h(Button, { className: "zp-country__go", variant: p.active ? "on-brand" : "ghost", size: "sm", href: p.href || "#", trailingIcon: "arrow" }, p.cta || "Подборка: " + p.name)
    );
  }

  function plural(n, one, few, many) {
    var m10 = n % 10, m100 = n % 100;
    if (m10 === 1 && m100 !== 11) return one;
    if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return few;
    return many;
  }

  function Steps(p) {
    var items = p.items || [];
    return h(
      "ol",
      { className: cx("zp-steps", p.className) },
      items.map(function (it, i) {
        return h("li", { key: i, className: "zp-step" }, h("span", { className: "zp-step__num", "aria-hidden": "true" }, i + 1), h("h3", { className: "heading-m zp-step__title" }, it.title), h("p", { className: "small zp-step__text" }, it.text));
      })
    );
  }

  function Orbit(p) {
    var avatars = (p.avatars || []).slice(0, 2);
    var plates = (p.plates || []).slice(0, 4);
    return h(
      "div",
      { className: "zp-hero__visual", "aria-hidden": "true" },
      h("div", { className: "zp-orbit__disc" }),
      h("svg", { className: "zp-orbit__ring", viewBox: "0 0 100 100" }, h("circle", { cx: 50, cy: 50, r: 49 }), h("circle", { className: "zp-orbit__inner", cx: 50, cy: 50, r: 34, pathLength: 100, strokeDasharray: "78 22", strokeDashoffset: "-8" })),
      h("span", { className: "zp-orbit__plane" }, h(Icon, { name: "plane" })),
      avatars.map(function (a, i) { return h("img", { key: i, className: "zp-orbit__avatar", src: a.src, alt: "" }); }),
      h("div", { className: "zp-orbit__plates" }, plates.map(function (t) { return h(Plate, { key: t }, t); }))
    );
  }

  function Hero(p) {
    return h(
      "section",
      { className: cx("zp-hero", p.className), "aria-labelledby": "zp-hero-title" },
      h(
        "div",
        { className: "zp-wrap zp-hero__grid" },
        h(
          "div",
          { className: "zp-hero__text" },
          p.eyebrow && h("span", { className: "plate zp-eyebrow" }, p.eyebrow),
          h("h1", { className: "display-xl zp-hero__title", id: "zp-hero-title" }, p.title || "Захотели?", h("span", { className: "zp-script" }, p.accent || "Полетели!")),
          p.lead && h("p", { className: "lead zp-hero__lead" }, p.lead),
          h(
            "div",
            { className: "zp-hero__actions" },
            p.primary && h(Button, { variant: "primary", size: "lg", href: p.primary.href, icon: "send" }, p.primary.label),
            p.secondary && h(Button, { variant: "secondary", size: "lg", href: p.secondary.href }, p.secondary.label)
          ),
          p.hint && h(Notice, { icon: "send" }, p.hint)
        ),
        h(Orbit, { avatars: p.avatars, plates: p.plates })
      )
    );
  }

  function ThemeToggle(p) {
    var init = function () {
      var el = document.documentElement;
      var t = el.getAttribute("data-theme");
      if (t) return t;
      return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    };
    var st = React.useState(init);
    var theme = st[0], setTheme = st[1];
    function apply(e) {
      var next = theme === "dark" ? "light" : "dark";
      transition(function () {
        document.documentElement.setAttribute("data-theme", next);
        setTheme(next);
      }, "theme", e && e.currentTarget);
      try { window.localStorage.setItem("zp-theme", next); } catch (e) {}
      if (p.onChange) p.onChange(next);
    }
    return h(
      "button",
      { type: "button", className: cx("zp-theme", p.className), onClick: apply, "aria-label": theme === "dark" ? "Включить светлую тему" : "Включить тёмную тему", title: theme === "dark" ? "Светлая тема" : "Тёмная тема" },
      h(Icon, { key: theme, name: theme === "dark" ? "sun" : "moon" })
    );
  }

  function SiteHeader(p) {
    var st = React.useState(false);
    var open = st[0], setOpen = st[1];
    var links = p.links || [];
    var cta = p.cta || { label: "Открыть каталог", href: "#" };
    return h(
      "header",
      { className: cx("zp-header", p.className) },
      h(
        "div",
        { className: "zp-wrap" },
        h(
          "div",
          { className: "zp-header__bar" },
          h("a", { className: "zp-logo", href: p.homeHref || "#", "aria-label": "Захотели — Полетели, на главную" }, h("span", { className: "zp-logo__disc" }, h(Icon, { name: "plane" })), h("span", { className: "zp-logo__word" }, "Захотели —", h("span", null, "Полетели"))),
          h("nav", { className: "zp-nav", "aria-label": "Разделы" }, links.map(function (l) { return h("a", { key: l.href, href: l.href, "aria-current": l.href === p.current ? "true" : undefined }, l.label); })),
          h(
            "div",
            { className: "zp-row", style: { gap: "var(--space-2xs)", flexWrap: "nowrap" } },
            h(ThemeToggle, null),
            h(Button, { className: "zp-header__cta", size: "sm", href: cta.href, icon: "send" }, cta.label),
            h(Button, { className: "zp-header__menu-btn", variant: "secondary", "aria-expanded": open ? "true" : "false", "aria-controls": "zp-sheet", "aria-label": open ? "Закрыть меню" : "Открыть меню", onClick: function () { setOpen(!open); }, icon: open ? "close" : "menu" })
          )
        ),
        open &&
          h(
            "nav",
            { id: "zp-sheet", className: "zp-header__sheet", "aria-label": "Меню" },
            links.map(function (l) { return h("a", { key: l.href, href: l.href, onClick: function () { setOpen(false); } }, l.label); }),
            h(Button, { href: cta.href, icon: "send", block: true }, cta.label)
          )
      )
    );
  }

  function AntexPanel(p) {
    var items = p.items || [];
    var cta = p.cta || { label: "Уточнить условия в боте AntEx", href: "#" };
    return h(
      "section",
      { className: cx("zp-antex", p.className), "aria-labelledby": p.id || "zp-antex-title" },
      h(
        "div",
        { className: "zp-antex__body" },
        h("span", { className: "plate zp-antex__eyebrow" }, p.eyebrow || "Отдельный сервис · AntEx"),
        h("h2", { className: "heading-m zp-antex__title", id: p.id || "zp-antex-title" }, p.title),
        p.text && h("p", { className: "small zp-antex__text" }, p.text),
        h(Button, { variant: "antex", href: cta.href, icon: "exchange" }, cta.label),
        p.hint && h("p", { className: "caption zp-antex__hint" }, p.hint)
      ),
      items.length > 0 &&
        h(
          "ul",
          { className: "zp-antex__list" },
          items.map(function (it, i) { return h("li", { key: i, className: "zp-antex__item" }, h(Icon, { name: it.icon || "check" }), h("div", null, h("b", null, it.title), it.text && h("span", null, it.text))); })
        )
    );
  }

  function Faq(p) {
    var items = p.items || [];
    var name = p.name || "zp-faq";
    return h(
      "div",
      { className: cx("zp-faq", p.className) },
      items.map(function (it, i) {
        return h(
          "details",
          { key: i, className: "zp-faq__item", name: p.exclusive === false ? undefined : name, open: it.open },
          h("summary", { className: "zp-faq__q" }, h("span", { className: "heading-s" }, it.q), h(Icon, { name: "chevron" })),
          h("div", { className: "body zp-faq__a" }, it.a)
        );
      })
    );
  }

  function CtaBand(p) {
    var cta = p.cta || { label: "Выбрать город в Telegram", href: "#" };
    return h(
      "section",
      { className: cx("zp-cta", p.className), "aria-labelledby": "zp-cta-title" },
      h("h2", { className: "zp-cta__title", id: "zp-cta-title" }, p.title),
      p.text && h("p", { className: "lead zp-cta__text" }, p.text),
      h(Button, { variant: "on-brand", size: "lg", href: cta.href, icon: "send" }, cta.label),
      p.hint && h("p", { className: "caption" }, p.hint)
    );
  }

  function SiteFooter(p) {
    var cols = p.cols || [];
    return h(
      "footer",
      { className: cx("zp-footer", p.className) },
      h(
        "div",
        { className: "zp-wrap" },
        h(
          "div",
          { className: "zp-footer__grid" },
          h("div", { className: "zp-footer__about" }, h("span", { className: "zp-logo" }, h("span", { className: "zp-logo__disc" }, h(Icon, { name: "plane" })), h("span", { className: "zp-logo__word" }, "Захотели —", h("span", null, "Полетели"))), p.about && h("p", { className: "small" }, p.about)),
          h(
            "div",
            { className: "zp-footer__cols" },
            cols.map(function (c) {
              return h("div", { key: c.title, className: "zp-footer__col" }, h("h3", { className: "plate" }, c.title), c.links.map(function (l) { return h("a", { key: l.label, href: l.href || "#" }, l.label); }));
            })
          )
        ),
        p.legal && h("div", { className: "caption zp-footer__legal" }, p.legal.map(function (t, i) { return h("span", { key: i }, t); }))
      )
    );
  }

  function Quote(p) {
    return h(
      "figure",
      { className: cx("zp-quote", p.className) },
      h("span", { className: "zp-quote__mark", "aria-hidden": "true" }, "\u201c"),
      h("blockquote", { className: "quote zp-quote__text", cite: p.cite }, p.children),
      (p.author || p.place) &&
        h(
          "figcaption",
          { className: "zp-quote__by" },
          p.avatar && h("img", { className: "zp-quote__avatar", src: p.avatar, alt: "" }),
          h("span", { className: "zp-quote__who" }, p.author && h("span", { className: "zp-quote__name" }, p.author), p.place && h("span", { className: "plate zp-quote__where" }, p.place))
        )
    );
  }

  var api = { Icon: Icon, Button: Button, Chip: Chip, Badge: Badge, Plate: Plate, Notice: Notice, SectionHead: SectionHead, CommunityCard: CommunityCard, CountryCard: CountryCard, Steps: Steps, Hero: Hero, SiteHeader: SiteHeader, ThemeToggle: ThemeToggle, AntexPanel: AntexPanel, Faq: Faq, CtaBand: CtaBand, SiteFooter: SiteFooter, Quote: Quote };
  Object.assign(window.Zp, api);
})();
