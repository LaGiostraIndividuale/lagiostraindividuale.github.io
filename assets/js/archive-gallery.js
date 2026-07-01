(() => {
  const GALLERY_SELECTOR = ".js-archive-gallery";

  const isElement = (n) => n && n.nodeType === Node.ELEMENT_NODE;
  const isWhitespaceText = (n) => n && n.nodeType === Node.TEXT_NODE && !n.textContent.trim();

  function findImgInParagraph(p) {
    if (!p || p.tagName !== "P") return null;
    const directImg = p.querySelector(":scope > img");
    if (directImg) return directImg;
    const linkedImg = p.querySelector(":scope > a > img");
    return linkedImg || null;
  }

  function paragraphHasSingleImage(p) {
    const img = findImgInParagraph(p);
    if (!img) return false;

    // ensure there isn't another image elsewhere inside the paragraph
    const allImgs = p.querySelectorAll("img");
    return allImgs.length === 1;
  }

  function paragraphCaptionText(p) {
    // Remove the image (or linked image) text from caption calculation
    const clone = p.cloneNode(true);
    const img = clone.querySelector("img");
    if (img) img.remove();
    const a = clone.querySelector("a");
    if (a && a.querySelector("img")) a.remove();

    const txt = clone.textContent ? clone.textContent.trim() : "";
    return txt || "";
  }

  function paragraphIsImageOnly(el) {
    if (!el || el.tagName !== "P") return false;

    const nodes = Array.from(el.childNodes).filter((n) => !isWhitespaceText(n));
    if (nodes.length === 0) return false;

    return nodes.every((n) => {
      if (!isElement(n)) return false;
      if (n.tagName === "BR") return true;
      if (n.tagName === "IMG") return true;
      if (n.tagName === "A") {
        const imgs = n.querySelectorAll("img");
        return imgs.length === 1 && n.textContent.trim() === "";
      }
      return false;
    });
  }

  function extractImagesFromParagraph(p) {
    const imgs = [];
    for (const child of Array.from(p.children)) {
      if (child.tagName === "IMG") imgs.push(child);
      if (child.tagName === "A") {
        const img = child.querySelector("img");
        if (img) imgs.push(img);
      }
    }
    return imgs;
  }

  function buildGallery(items, loading) {
    const gallery = document.createElement("div");
    gallery.className = "archive-gallery";

    for (const item of items) {
      const { img, caption } = item;
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "archive-thumb";
      btn.setAttribute("aria-label", img.alt ? `Apri immagine: ${img.alt}` : "Apri immagine");

      const clone = img.cloneNode(true);
      clone.loading = loading;
      clone.decoding = "async";
      btn.appendChild(clone);

      btn.addEventListener("click", () => openLightbox(items, item));
      if (caption) {
        const cap = document.createElement("span");
        cap.className = "archive-thumb__caption";
        cap.textContent = caption;
        btn.appendChild(cap);
      }

      gallery.appendChild(btn);
    }

    return gallery;
  }

  function ensureLightbox() {
    let lb = document.querySelector("[data-archive-lightbox]");
    if (lb) return lb;

    lb = document.createElement("div");
    lb.setAttribute("data-archive-lightbox", "true");
    lb.className = "archive-lightbox";
    lb.hidden = true;
    lb.innerHTML = `
      <div class="archive-lightbox__backdrop" data-archive-lightbox-close tabindex="-1"></div>
      <div class="archive-lightbox__dialog" role="dialog" aria-modal="true" aria-label="Immagine">
        <div class="archive-lightbox__nav" aria-hidden="true">
          <button type="button" class="archive-lightbox__navBtn archive-lightbox__prev" data-archive-lightbox-prev aria-label="Immagine precedente">‹</button>
          <button type="button" class="archive-lightbox__navBtn archive-lightbox__next" data-archive-lightbox-next aria-label="Immagine successiva">›</button>
        </div>
        <button type="button" class="archive-lightbox__close" data-archive-lightbox-close aria-label="Chiudi">×</button>
        <img class="archive-lightbox__img" alt="" />
      </div>
    `;

    document.body.appendChild(lb);

    lb.addEventListener("click", (e) => {
      const target = e.target;
      if (target && target.hasAttribute("data-archive-lightbox-close")) closeLightbox();
      if (target && target.hasAttribute("data-archive-lightbox-prev")) nav(-1);
      if (target && target.hasAttribute("data-archive-lightbox-next")) nav(1);
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && !lb.hidden) closeLightbox();
      if (!lb.hidden && (e.key === "ArrowLeft" || e.key === "Left")) nav(-1);
      if (!lb.hidden && (e.key === "ArrowRight" || e.key === "Right")) nav(1);
    });

    return lb;
  }

  let lastActiveEl = null;
  let currentItems = null;
  let currentIndex = -1;

  function setNavDisabled(lb) {
    const prevBtn = lb.querySelector("[data-archive-lightbox-prev]");
    const nextBtn = lb.querySelector("[data-archive-lightbox-next]");
    if (!(prevBtn instanceof HTMLButtonElement) || !(nextBtn instanceof HTMLButtonElement)) return;
    const len = currentItems ? currentItems.length : 0;
    prevBtn.disabled = !(len > 1 && currentIndex > 0);
    nextBtn.disabled = !(len > 1 && currentIndex >= 0 && currentIndex < len - 1);
  }

  function renderCurrent() {
    const lb = ensureLightbox();
    const lbImg = lb.querySelector(".archive-lightbox__img");
    if (!lbImg || !currentItems || currentIndex < 0 || currentIndex >= currentItems.length) return;

    const { img } = currentItems[currentIndex];
    const src = img.currentSrc || img.src;
    lbImg.src = src;
    lbImg.alt = img.alt || "";
    setNavDisabled(lb);
  }

  function nav(delta) {
    if (!currentItems || currentItems.length < 2) return;
    const next = currentIndex + delta;
    if (next < 0 || next >= currentItems.length) return;
    currentIndex = next;
    renderCurrent();
  }

  function openLightbox(items, clickedItem) {
    const lb = ensureLightbox();
    const lbImg = lb.querySelector(".archive-lightbox__img");
    if (!lbImg) return;

    lastActiveEl = document.activeElement instanceof HTMLElement ? document.activeElement : null;

    currentItems = items;
    currentIndex = Math.max(0, items.indexOf(clickedItem));
    renderCurrent();
    lb.hidden = false;
    document.documentElement.classList.add("archive-lightbox-open");

    const closeBtn = lb.querySelector(".archive-lightbox__close");
    if (closeBtn instanceof HTMLElement) closeBtn.focus();
  }

  function closeLightbox() {
    const lb = document.querySelector("[data-archive-lightbox]");
    if (!lb) return;

    const lbImg = lb.querySelector(".archive-lightbox__img");
    if (lbImg) {
      lbImg.removeAttribute("src");
      lbImg.alt = "";
    }

    lb.hidden = true;
    document.documentElement.classList.remove("archive-lightbox-open");

    currentItems = null;
    currentIndex = -1;

    if (lastActiveEl) lastActiveEl.focus();
    lastActiveEl = null;
  }

  function transformContainer(container) {
    const paragraphs = Array.from(container.querySelectorAll(":scope > p"));
    const candidates = paragraphs.filter((p) => paragraphHasSingleImage(p));
    if (candidates.length < 2) return;

    const items = candidates
      .map((p) => {
        const img = findImgInParagraph(p);
        if (!img) return null;
        const caption = paragraphCaptionText(p);
        return { p, img, caption };
      })
      .filter(Boolean);

    if (items.length < 2) return;

    // Inside a closed <details> lazy images never load; use eager so they
    // load on page init even while the accordion is hidden.
    const loading = container.closest("details") ? "eager" : "lazy";
    const gallery = buildGallery(items.map(({ img, caption }) => ({ img, caption })), loading);
    const firstP = items[0].p;
    firstP.parentNode.insertBefore(gallery, firstP);

    // Remove original paragraphs (image-only and image+caption)
    for (const { p } of items) p.remove();
  }

  function init() {
    const containers = document.querySelectorAll(GALLERY_SELECTOR);
    for (const c of containers) transformContainer(c);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();

