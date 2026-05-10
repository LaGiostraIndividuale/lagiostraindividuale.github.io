/**
 * Site-wide enhancements:
 *  1. Header sticky con classe `--scrolled` quando si scorre.
 *  2. Default lazy/decoding sulle <img> rimaste prive di attributi
 *     (utile per le immagini renderizzate da kramdown nei post markdown).
 *
 * Nessuna dipendenza esterna. Compatibile con tutti i browser moderni.
 */
(function () {
  /* ---- 1. Header scroll state ---- */
  var header = document.querySelector(".site-header");
  if (header) {
    var update = function () {
      header.classList.toggle("site-header--scrolled", window.scrollY > 10);
    };
    update();
    var scheduled = false;
    var onScroll = function () {
      if (scheduled) return;
      scheduled = true;
      requestAnimationFrame(function () {
        scheduled = false;
        update();
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
  }

  /* ---- 2. Default loading/decoding sulle img senza attributi espliciti ---- */
  var setImgDefaults = function () {
    var imgs = document.querySelectorAll(
      "img:not([loading]), img:not([decoding])"
    );
    imgs.forEach(function (img) {
      if (!img.hasAttribute("loading")) img.setAttribute("loading", "lazy");
      if (!img.hasAttribute("decoding")) img.setAttribute("decoding", "async");
    });
  };
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", setImgDefaults);
  } else {
    setImgDefaults();
  }
})();
