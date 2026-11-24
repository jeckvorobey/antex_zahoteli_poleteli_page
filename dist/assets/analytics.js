(() => {
  const productionHosts = ["antex.pro", "www.antex.pro"];
  if (location.protocol !== "https:" || !productionHosts.includes(location.hostname)) return;

  const notice = document.getElementById("lp-analytics");
  const title = document.getElementById("lp-analytics-title");
  const settings = document.getElementById("lp-analytics-settings");
  if (!notice || !title || !settings) return;

  const key = "zp-analytics-consent-v1";
  let choice = null;
  let started = false;

  try {
    choice = localStorage.getItem(key);
  } catch {
    // Выбор действует до закрытия страницы, если браузер запрещает запись.
  }

  function startAnalytics() {
    if (started) return;
    started = true;

    const queue = window.dataLayer = window.dataLayer || [];
    function consent() {
      queue.push(arguments);
    }

    consent("consent", "default", {
      analytics_storage: "denied",
      ad_storage: "denied",
      ad_user_data: "denied",
      ad_personalization: "denied",
    });
    consent("consent", "update", { analytics_storage: "granted" });
    queue.push({ "gtm.start": Date.now(), event: "gtm.js" });

    const script = document.createElement("script");
    script.async = true;
    script.src = "https://www.googletagmanager.com/gtm.js?id=GTM-55RSN3XR";
    document.head.append(script);
  }

  function setNotice(open) {
    notice.hidden = !open;
    settings.setAttribute("aria-expanded", String(open));
  }

  settings.hidden = false;
  settings.addEventListener("click", () => {
    setNotice(true);
    title.focus({ preventScroll: true });
  });

  notice.addEventListener("click", (event) => {
    const button = event.target.closest("[data-analytics-choice]");
    if (!button) return;

    const hadChoice = choice === "granted" || choice === "denied";
    const restoreFocus = hadChoice || button.matches(":focus-visible");
    choice = button.dataset.analyticsChoice;
    try {
      localStorage.setItem(key, choice);
    } catch {
      // Без хранилища решение сохраняется в памяти текущей страницы.
    }

    if (choice === "denied" && started) {
      // После перезагрузки контейнер и его обработчики больше не загружаются.
      location.reload();
      return;
    }
    if (choice === "granted") startAnalytics();

    setNotice(false);
    if (restoreFocus) settings.focus({ preventScroll: hadChoice });
  });

  window.addEventListener("storage", (event) => {
    if (event.key === key && event.newValue !== "granted" && started) location.reload();
  });

  if (choice === "granted") startAnalytics();
  else if (choice !== "denied") setNotice(true);
})();
