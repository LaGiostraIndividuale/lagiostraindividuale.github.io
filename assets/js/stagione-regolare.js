function getSeasonBaseFromPage() {
  const root = document.querySelector(".sr-page");
  const season = root?.dataset?.season;
  return season ? `/assets/data/stagione-regolare/${season}` : null;
}

async function loadJson(path) {
  const url = new URL(path, window.location.origin);
  // Cache-busting for local dev + GitHub Pages edge caches
  url.searchParams.set("_", String(Date.now()));

  const response = await fetch(url.toString(), { cache: "no-store" });
  if (!response.ok) throw new Error(`Errore caricamento: ${path}`);
  return response.json();
}

function avatar(giocante, size = "small") {
  if (giocante.foto_url) {
    return `<img class="sr-avatar sr-avatar-${size}" src="${giocante.foto_url}" alt="${giocante.nome}">`;
  }

  return `
    <div class="sr-avatar sr-avatar-${size} sr-avatar-placeholder" style="background:${giocante.colore_avatar || "#5b4500"}">
      ${giocante.iniziale || giocante.nome.charAt(0)}
    </div>
  `;
}

function conferenceLogo(conferenza) {
  if (conferenza.logo_url) {
    return `<img class="sr-conference-logo" src="${conferenza.logo_url}" alt="${conferenza.nome}">`;
  }

  return `
    <div class="sr-conference-logo sr-conference-logo-placeholder">
      ${conferenza.nome_breve.charAt(0)}
    </div>
  `;
}

function getStats(classifica, partite, giocantiMap) {
  const leader = classifica[0] ? giocantiMap[classifica[0].giocante_id] : null;
  const giocate = partite.filter(p => p.stato === "giocata").length;

  return {
    leader,
    giocate,
    totali: partite.length,
    giocanti: Object.keys(giocantiMap).length
  };
}

async function loadConferenceData(base, conferenzaId) {
  const confBase = `${base}/${conferenzaId}`;

  const [giocanti, classifica, partite] = await Promise.all([
    loadJson(`${confBase}/giocanti.json`),
    loadJson(`${confBase}/classifica.json`),
    loadJson(`${confBase}/partite.json`)
  ]);

  const giocantiMap = Object.fromEntries(
    giocanti.map(giocante => [giocante.id, giocante])
  );

  return { giocanti, classifica, partite, giocantiMap };
}

function hasUsableConferenceData({ giocanti, classifica, partite }) {
  return Array.isArray(giocanti) &&
    Array.isArray(classifica) &&
    Array.isArray(partite) &&
    giocanti.length > 0 &&
    classifica.length > 0 &&
    partite.length > 0;
}

async function renderConferenceCards(conferenze, base) {
  const cardsData = await Promise.all(
    conferenze.map(async conferenza => {
      try {
        const data = await loadConferenceData(base, conferenza.id);
        const { classifica, partite, giocantiMap } = data;
        const stats = getStats(classifica, partite, giocantiMap);
        return { conferenza, stats, available: hasUsableConferenceData(data) };
      } catch {
        return {
          conferenza,
          stats: { leader: null, giocate: 0, totali: 0, giocanti: 0 },
          available: false
        };
      }
    })
  );

  return `
    <section class="sr-card sr-card-carousel">
      <div class="sr-section-title">
        <span>Seleziona conferenza</span>
        <strong>Campionato</strong>
      </div>

      <div class="sr-carousel" aria-label="Conferenze">
        <div class="sr-conference-grid">
          ${cardsData.map(({ conferenza, stats, available }) => `
            <button class="sr-conference-card" data-conference="${conferenza.id}" ${available ? "" : "disabled"}>
              ${conferenceLogo(conferenza)}

              <div class="sr-conference-card-body">
                <h2>${conferenza.nome_breve}</h2>
                <p>${conferenza.area}</p>

                <div class="sr-conference-stats">
                  <span>${stats.giocanti} giocanti</span>
                  <span>${stats.giocate}/${stats.totali} partite</span>
                </div>

                <div class="sr-conference-leader">
                  <small>Leader</small>
                  <strong>${stats.leader ? stats.leader.nome : "In attesa dati"}</strong>
                </div>
              </div>
            </button>
          `).join("")}
        </div>
      </div>
    </section>
  `;
}

function renderPodio(conferenza, classifica, giocantiMap) {
  const top3 = classifica.slice(0, 3);
  const ordinePodio = [top3[1], top3[0], top3[2]]
    .filter(Boolean)
    .filter(item => giocantiMap[item.giocante_id]);

  return `
    <section class="sr-card">
      <div class="sr-section-title">
        <span>Podio</span>
        <strong>${conferenza.nome_breve}</strong>
      </div>

      <div class="sr-podio">
        ${ordinePodio.length ? ordinePodio.map(item => {
            const giocante = giocantiMap[item.giocante_id];
            const isWinner = item.posizione === 1;

            return `
              <button class="sr-podio-player ${isWinner ? "is-winner" : ""}" data-player="${giocante.id}">
                <div class="sr-medal sr-medal-${item.posizione}">${item.posizione}</div>
                ${avatar(giocante, isWinner ? "large" : "medium")}
                <h3>${giocante.nome}</h3>
                <div class="sr-podio-stats">
                  <span><strong>${item.sv}</strong> SV</span>
                  <span><strong>${item.punti}</strong> punti</span>
                  <span><strong>${item.partite_giocate}/${item.partite_totali}</strong> PG</span>
                </div>
              </button>
            `;
          }).join("") : `<p class="sr-empty">Podio non disponibile.</p>`}
      </div>
    </section>
  `;
}

function renderClassifica(conferenza, classifica, giocantiMap) {
  return `
    <section class="sr-card">
      <div class="sr-section-title">
        <span>Classifica completa</span>
        <strong>${conferenza.nome_breve}</strong>
      </div>

      <div class="sr-table">
        <div class="sr-row sr-row-head">
          <span>#</span>
          <span>Giocante</span>
          <span>SV</span>
          <span>Punti</span>
          <span>PG</span>
        </div>

        ${classifica.map(item => {
          const giocante = giocantiMap[item.giocante_id];
          return `
            <button class="sr-row sr-player-row" data-player="${giocante.id}">
              <span class="sr-position">${item.posizione}</span>
              <span class="sr-player-cell">
                ${avatar(giocante, "small")}
                <strong>${giocante.nome}</strong>
              </span>
              <span>${item.sv}</span>
              <span>${item.punti}</span>
              <span>${item.partite_giocate}/${item.partite_totali}</span>
            </button>
          `;
        }).join("")}
      </div>
    </section>
  `;
}

function renderMatchScore(partita) {
  if (partita.stato !== "giocata") return "";

  return `
    <div class="sr-match-results">
      <div class="sr-match-set-score">
        <span class="sr-set-label">Set</span>
        <strong>${partita.set_a}</strong>
        <span>-</span>
        <strong>${partita.set_b}</strong>
      </div>

      <div class="sr-match-points">
        <span>${partita.punti_a_set_1}</span>
        <span>-</span>
        <span>${partita.punti_b_set_1}</span>

        <span>${partita.punti_a_set_2}</span>
        <span>-</span>
        <span>${partita.punti_b_set_2}</span>
      </div>
    </div>
  `;
}

function renderMatchItem(partita, giocantiMap, statusClass) {
  const a = giocantiMap[partita.giocante_a_id];
  const b = giocantiMap[partita.giocante_b_id];

  return `
    <article class="sr-match sr-match-${statusClass}">
      <div class="sr-match-main">
        <strong>${a.nome}</strong>
        <span class="sr-versus">⚔</span>
        <strong>${b.nome}</strong>
      </div>

      ${renderMatchScore(partita)}
    </article>
  `;
}

function renderPartite(conferenza, partite, giocantiMap) {
  const giocate = partite.filter(p => p.stato === "giocata");
  const daGiocare = partite.filter(p => p.stato !== "giocata");

  return `
    <section class="sr-card sr-accordion">
      <button class="sr-accordion-toggle" type="button" aria-expanded="false">
        <span>
          <small>Calendario e referti</small>
          <strong>Partite ${conferenza.nome_breve}</strong>
        </span>
        <span class="sr-accordion-icon">+</span>
      </button>

      <div class="sr-accordion-panel" hidden>
        <div class="sr-match-group">
          <div class="sr-match-group-title">
            <span>Giocate</span>
            <strong>${giocate.length}</strong>
          </div>

          <div class="sr-matches">
            ${giocate.map(partita => renderMatchItem(partita, giocantiMap, "played")).join("")}
          </div>
        </div>

        <div class="sr-match-group">
          <div class="sr-match-group-title">
            <span>Da disputare</span>
            <strong>${daGiocare.length}</strong>
          </div>

          <div class="sr-matches">
            ${daGiocare.map(partita => renderMatchItem(partita, giocantiMap, "pending")).join("")}
          </div>
        </div>
      </div>
    </section>
  `;
}

function renderPlayerModal(giocante) {
  const existing = document.querySelector(".sr-modal");
  if (existing) existing.remove();

  const modal = document.createElement("div");
  modal.className = "sr-modal";
  modal.innerHTML = `
    <div class="sr-modal-backdrop" data-close-modal></div>

    <article class="sr-modal-content">
      <button class="sr-modal-close" data-close-modal>×</button>

      <div class="sr-player-detail">
        ${avatar(giocante, "profile")}
        <h2>${giocante.nome}</h2>

        <div class="sr-player-meta">
          <div>
            <span>Conferenza</span>
            <strong>${giocante.conferenza}</strong>
          </div>
          <div>
            <span>Squadra</span>
            <strong>${giocante.squadra}</strong>
          </div>
        </div>

        <blockquote>
          <span>“</span>
          ${giocante.motto}
          <span>”</span>
        </blockquote>
      </div>
    </article>
  `;

  document.body.appendChild(modal);
  modal.querySelectorAll("[data-close-modal]").forEach(button => {
    button.addEventListener("click", () => modal.remove());
  });
}

function initAccordion(container) {
  const toggles = container.querySelectorAll(".sr-accordion-toggle");

  toggles.forEach(toggle => {
    toggle.addEventListener("click", () => {
      const panel = toggle.nextElementSibling;
      const icon = toggle.querySelector(".sr-accordion-icon");
      const isOpen = toggle.getAttribute("aria-expanded") === "true";

      toggle.setAttribute("aria-expanded", String(!isOpen));
      panel.hidden = isOpen;
      icon.textContent = isOpen ? "+" : "−";
    });
  });
}

async function showConferenceDetail(conferenza, detailContainer, base) {
  detailContainer.innerHTML = `
    <div class="sr-loading">
      Caricamento ${conferenza.nome_breve}...
    </div>
  `;

  try {
    const { classifica, partite, giocantiMap } = await loadConferenceData(base, conferenza.id);

    detailContainer.innerHTML = `
      <div class="sr-selected-heading">
        <button class="sr-back-button" type="button" data-back-conferences>← Conferenze</button>
        <h2>${conferenza.nome_breve}</h2>
      </div>

      ${renderPodio(conferenza, classifica, giocantiMap)}
      ${renderClassifica(conferenza, classifica, giocantiMap)}
      ${renderPartite(conferenza, partite, giocantiMap)}
    `;

    detailContainer.querySelectorAll("[data-player]").forEach(button => {
      button.addEventListener("click", () => {
        renderPlayerModal(giocantiMap[button.dataset.player]);
      });
    });

    detailContainer.querySelector("[data-back-conferences]").addEventListener("click", () => {
      detailContainer.innerHTML = "";
      window.scrollTo({ top: 0, behavior: "smooth" });
    });

    initAccordion(detailContainer);
    detailContainer.scrollIntoView({ behavior: "smooth", block: "start" });
  } catch (error) {
    detailContainer.innerHTML = `
      <div class="sr-card">
        <p>Impossibile caricare i dati di ${conferenza.nome_breve}.</p>
      </div>
    `;
    console.error(error);
  }
}

async function initStagioneRegolare() {
  const base = getSeasonBaseFromPage();
  const app = document.querySelector("#stagione-regolare-app");
  if (!app || !base) return;

  try {
    const conferenze = await loadJson(`${base}/conferenze.json`);
    const conferenzeAttive = conferenze.filter(conferenza => conferenza.attiva);

    app.innerHTML = `
      <div id="sr-conference-selector">
        ${await renderConferenceCards(conferenzeAttive, base)}
      </div>

      <div id="sr-conference-detail"></div>
    `;

    const detailContainer = app.querySelector("#sr-conference-detail");

    app.querySelectorAll("[data-conference]").forEach(button => {
      button.addEventListener("click", () => {
        const conferenza = conferenzeAttive.find(item => item.id === button.dataset.conference);
        showConferenceDetail(conferenza, detailContainer, base);
      });
    });
  } catch (error) {
    app.innerHTML = `
      <div class="sr-card">
        <p>Impossibile caricare i dati della stagione regolare.</p>
      </div>
    `;
    console.error(error);
  }
}

document.addEventListener("DOMContentLoaded", initStagioneRegolare);

