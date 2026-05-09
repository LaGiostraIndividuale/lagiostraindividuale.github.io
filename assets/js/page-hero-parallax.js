/**
 * Parallasse leggero sull’hero delle pagine layout:page con page.image.
 * Rispetta prefers-reduced-motion.
 */
(function () {
  const root = document.querySelector(".js-page-hero-parallax");
  if (!root) return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  let scheduled = false;

  function tick() {
    scheduled = false;
    const rect = root.getBoundingClientRect();
    const vh = window.innerHeight || 1;
    const h = rect.height || 1;
    /* 0 = hero appena sotto il bordo superiore; cresce mentre scrolli verso l’alto */
    const raw = (vh * 0.35 - rect.top) / (h + vh * 0.25);
    const p = Math.min(1, Math.max(0, raw));
    const maxPx = Math.min(56, h * 0.14);
    const y = (p - 0.5) * 2 * maxPx;
    root.style.setProperty("--hero-parallax-y", `${y.toFixed(2)}px`);
  }

  function onScrollOrResize() {
    if (!scheduled) {
      scheduled = true;
      requestAnimationFrame(tick);
    }
  }

  window.addEventListener("scroll", onScrollOrResize, { passive: true });
  window.addEventListener("resize", onScrollOrResize, { passive: true });
  tick();
})();
