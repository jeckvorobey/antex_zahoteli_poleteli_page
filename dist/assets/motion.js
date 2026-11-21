/* Анимации появления с теми же задержками и кривыми, что у прототипа. */
(() => {
  "use strict";

  const root = document.documentElement;
  if (!root.classList.contains("lp-anim") || !window.gsap) return;
  const gsap = window.gsap;
  gsap.registerPlugin(window.CustomEase);
  const ease = CustomEase.create("poleteliOut", "0.22,1,0.36,1");
  root.classList.add("lp-gsap");

  const rise = (target, duration, delay) => gsap.fromTo(target,
    { opacity: 0, y: "2.25rem" },
    { opacity: 1, y: 0, duration, delay, ease, clearProps: "transform,opacity" });

  rise(".lp-hero__kicker", 1.1, 0.15);
  gsap.fromTo(".lp-hero__big > span",
    { opacity: 0, y: "0.45em", filter: "blur(0.06em)" },
    { opacity: 1, y: 0, filter: "blur(0em)", duration: 1.3, delay: 0.3,
      stagger: 0.07, ease, clearProps: "transform,opacity,filter" });
  rise(".lp-hero__lead", 1.2, 1.35);
  rise(".lp-hero__actions", 1.2, 1.5);
  gsap.fromTo(".lp-hero__pass",
    { opacity: 0, "--flight-x": "3rem", "--flight-y": "2.5rem", "--flight-angle": "6deg" },
    { opacity: 1, "--flight-x": "0rem", "--flight-y": "0rem", "--flight-angle": "-4deg",
      duration: 1.6, delay: 1.1, ease, clearProps: "opacity,--flight-x,--flight-y,--flight-angle" });
  gsap.fromTo(".lp-hero .lp-marquee", { opacity: 0 },
    { opacity: 1, duration: 1.4, delay: 1.7, ease, clearProps: "opacity" });

  // Скрипт прототипа отмечает вошедшие блоки и рассчитывает задержки каскада.
  const show = (el) => {
    const delay = parseFloat(el.style.getPropertyValue("--d") || "0") / 1000;
    if (el.matches("[data-reveal]:not(.lp-script, .lp-cta__script, .lp-note)")) rise(el, 1.1, delay);
    if (el.hasAttribute("data-split")) {
      const words = Array.from(el.querySelectorAll(".lp-w__i"));
      if (!words.length) return;
      gsap.fromTo(words, { yPercent: 115 }, { yPercent: 0, duration: 1.2, delay,
        stagger: 0.09, ease, clearProps: "transform" });
      gsap.fromTo(words, { opacity: 0 }, { opacity: 1, duration: 0.42, delay,
        stagger: 0.09, ease, clearProps: "opacity" });
    }
  };
  const observer = new MutationObserver((changes) => {
    for (const change of changes) if (change.target.hasAttribute("data-in")) show(change.target);
  });
  observer.observe(document.body, { subtree: true, attributes: true, attributeFilter: ["data-in"] });
  document.querySelectorAll("[data-in]").forEach(show);
})();
