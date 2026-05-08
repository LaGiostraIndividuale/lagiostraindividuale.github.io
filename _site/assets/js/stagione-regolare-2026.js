const SEASON_2026_BASE = "/assets/data/stagione-regolare/2026";

async function loadJson2026(path) {
  const response = await fetch(path);
  if (!response.ok) throw new Error(`Errore caricamento: ${path}`);
  return response.json();
}

function avatar2026(giocante, size = "small") {
  if (giocante.foto_url) {
    return `<img class="sr2026-avatar sr2026-avatar-${size}" src="${giocante.foto_url}" alt="${giocante.nome}">`;
  }

  return `
    <div class="sr2026-avatar sr2026-avatar-${size} sr2026-avatar-placeholder" style="background:${giocante.colore_avatar || "#5b4500"}">
      ${giocante.iniziale || giocante.nome.charAt(0)}
    </div>
  `;
}

function conferenceLogo2026(conferenza) {
  if (conferenza.logo_url) {
    return `<img class="sr2026-conference-logo" src="${conferenza.logo_url}" alt="${conferenza.nome}">`;
  }

  return `
    <div class="sr2026-conference-logo sr2026-conference-logo-placeholder">
      ${conferenza.nome_breve.charAt(0)}
    </div>
  `;
}

function getStats2026(classifica, partite, giocantiMap) {
  const leader = classifica[0] ? giocantiMap[classifica[0].giocante_id] : null;
  const giocate = partite.filter(p => p.stato === "giocata").length;

  return {
    leader,
    giocate,
    totali: partite.length,
    giocanti: Object.keys(giocantiMap).length
  };
}

async function loadConferenceData2026(conferenzaId) {
  const base = `${SEASON_2026_BASE}/${conferenzaId}`;

  const [giocanti, classifica, partite] = await Promise.all([
    loadJson2026(`${base}/giocanti.json`),
    loadJson2026(`${base}/classifica.json`),
    loadJson2026(`${base}/partite.json`)
  ]);

  const giocantiMap = Object.fromEntries(
    giocanti.map(giocante => [giocante.id, giocante])
  );

  return { giocanti, classifica, partite, giocantiMap };
}

async function renderConferenceCards2026(conferenze) {
  const cardsData = await Promise.all(
    conferenze.map(async conferenza => {
      try {
        const { classifica, partite, giocantiMap } = await loadConferenceData2026(conferenza.id);
        const stats = getStats2026(classifica, partite, giocantiMap);

        return { conferenza, stats, available: true };
      } catch {
        return {
          conferenza,
          stats: {
            leader: null,
            giocate: 0,
            totali: 0,
            giocanti: 0
          },
          available: false
        };
      }
    })
  );

  return `
    <section class="sr2026-card">
      <div class="sr2026-section-title">
        <span>Seleziona conferenza</span>
        <strong>Campionato 2026</strong>
      </div>

      <div class="sr2026-conference-grid">
        ${cardsData.map(({ conferenza, stats, available }) => `
          <button class="sr2026-conference-card" data-conference="${conferenza.id}" ${available ? "" : "disabled"}>
            ${conferenceLogo2026(conferenza)}

            <div class="sr2026-conference-card-body">
              <h2>${conferenza.nome_breve}</h2>
              <p>${conferenza.area}</p>

              <div class="sr2026-conference-stats">
                <span>${stats.giocanti} giocanti</span>
                <span>${stats.giocate}/${stats.totali} partite</span>
              </div>

              <div class="sr2026-conference-leader">
                <small>Leader</small>
                <strong>${stats.leader ? stats.leader.nome : "In attesa dati"}</strong>
              </div>
            </div>
          </button>
        `).join("")}
      </div>
    </section>
  `;
}

function renderPodio2026(conferenza, classifica, giocantiMap) {
  const top3 = classifica.slice(0, 3);
  const ordinePodio = [top3[1], top3[0], top3[2]].filter(Boolean);

  return `
    <section class="sr2026-card">
      <div class="sr2026-section-title">
        <span>Podio</span>
        <strong>${conferenza.nome_breve}</strong>
      </div>

      <div class="sr2026-podio">
        ${ordinePodio.map(item => {
          const giocante = giocantiMap[item.giocante_id];
          const isWinner = item.posizione === 1;

          return `
            <button class="sr2026-podio-player ${isWinner ? "is-winner" : ""}" data-player="${giocante.id}">
              <div class="sr2026-medal sr2026-medal-${item.posizione}">${item.posizione}</div>
              ${avatar2026(giocante, isWinner ? "large" : "medium")}
              <h3>${giocante.nome}</h3>
              <div class="sr2026-podio-stats">
                <span><strong>${item.sv}</strong> SV</span>
                <span><strong>${item.punti}</strong> punti</span>
                <span><strong>${item.partite_giocate}/${item.partite_totali}</strong> PG</span>
              </div>
            </button>
          `;
        }).join("")}
      </div>
    </section>
  `;
}

function renderClassifica2026(conferenza, classifica, giocantiMap) {
  return `
    <section class="sr2026-card">
      <div class="sr2026-section-title">
        <span>Classifica completa</span>
        <strong>${conferenza.nome_breve}</strong>
      </div>

      <div class="sr2026-table">
        <div class="sr2026-row sr2026-row-head">
          <span>#</span>
          <span>Giocante</span>
          <span>SV</span>
          <span>Punti</span>
          <span>PG</span>
        </div>

        ${classifica.map(item => {
          const giocante = giocantiMap[item.giocante_id];

          return `
            <button class="sr2026-row sr2026-player-row" data-player="${giocante.id}">
              <span class="sr2026-position">${item.posizione}</span>
              <span class="sr2026-player-cell">
                ${avatar2026(giocante, "small")}
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

function renderMatchScore2026(partita) {
  if (partita.stato !== "giocata") return "";

  return `
    <div class="sr2026-match-results">
      <div class="sr2026-match-set-score">
        <span class="sr2026-set-label">Set</span>
        <strong>${partita.set_a}</strong>
        <span>-</span>
        <strong>${partita.set_b}</strong>
      </div>

      <div class="sr2026-match-points">
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

function renderMatchItem2026(partita, giocantiMap, statusClass) {
  const a = giocantiMap[partita.giocante_a_id];
  const b = giocantiMap[partita.giocante_b_id];

  return `
    <article class="sr2026-match sr2026-match-${statusClass}">
      <div class="sr2026-match-main">
        <strong>${a.nome}</strong>
        <span class="sr2026-versus">⚔</span>
        <strong>${b.nome}</strong>
      </div>

      ${renderMatchScore2026(partita)}
    </article>
  `;
}

function renderPartite2026(conferenza, partite, giocantiMap) {
  const giocate = partite.filter(p => p.stato === "giocata");
  const daGiocare = partite.filter(p => p.stato !== "giocata");

  return `
    <section class="sr2026-card sr2026-accordion">
      <button class="sr2026-accordion-toggle" type="button" aria-expanded="false">
        <span>
          <small>Calendario e referti</small>
          <strong>Partite ${conferenza.nome_breve}</strong>
        </span>
        <span class="sr2026-accordion-icon">+</span>
      </button>

      <div class="sr2026-accordion-panel" hidden>
        <div class="sr2026-match-group">
          <div class="sr2026-match-group-title">
            <span>Giocate</span>
            <strong>${giocate.length}</strong>
          </div>

          <div class="sr2026-matches">
            ${giocate.map(partita => renderMatchItem2026(partita, giocantiMap, "played")).join("")}
          </div>
        </div>

        <div class="sr2026-match-group">
          <div class="sr2026-match-group-title">
            <span>Da disputare</span>
            <strong>${daGiocare.length}</strong>
          </div>

          <div class="sr2026-matches">
            ${daGiocare.map(partita => renderMatchItem2026(partita, giocantiMap, "pending")).join("")}
          </div>
        </div>
      </div>
    </section>
  `;
}

function renderPlayerModal2026(giocante) {
  const existing = document.querySelector(".sr2026-modal");
  if (existing) existing.remove();

  const modal = document.createElement("div");
  modal.className = "sr2026-modal";
  modal.innerHTML = `
    <div class="sr2026-modal-backdrop" data-close-modal></div>

    <article class="sr2026-modal-content">
      <button class="sr2026-modal-close" data-close-modal>×</button>

      <div class="sr2026-player-detail">
        ${avatar2026(giocante, "profile")}
        <h2>${giocante.nome}</h2>

        <div class="sr2026-player-meta">
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

function initAccordion2026(container) {
  const toggles = container.querySelectorAll(".sr2026-accordion-toggle");

  toggles.forEach(toggle => {
    toggle.addEventListener("click", () => {
      const panel = toggle.nextElementSibling;
      const icon = toggle.querySelector(".sr2026-accordion-icon");
      const isOpen = toggle.getAttribute("aria-expanded") === "true";

      toggle.setAttribute("aria-expanded", String(!isOpen));
      panel.hidden = isOpen;
      icon.textContent = isOpen ? "+" : "−";
    });
  });
}

async function showConferenceDetail2026(conferenza, detailContainer) {
  detailContainer.innerHTML = `
    <div class="sr2026-loading">
      Caricamento ${conferenza.nome_breve}...
    </div>
  `;

  try {
    const { classifica, partite, giocantiMap } = await loadConferenceData2026(conferenza.id);

    detailContainer.innerHTML = `
      <div class="sr2026-selected-heading">
        <button class="sr2026-back-button" type="button" data-back-conferences>← Conferenze</button>
        <h2>${conferenza.nome_breve}</h2>
      </div>

      ${renderPodio2026(conferenza, classifica, giocantiMap)}
      ${renderClassifica2026(conferenza, classifica, giocantiMap)}
      ${renderPartite2026(conferenza, partite, giocantiMap)}
    `;

    detailContainer.querySelectorAll("[data-player]").forEach(button => {
      button.addEventListener("click", () => {
        renderPlayerModal2026(giocantiMap[button.dataset.player]);
      });
    });

    detailContainer.querySelector("[data-back-conferences]").addEventListener("click", () => {
      detailContainer.innerHTML = "";
      window.scrollTo({ top: 0, behavior: "smooth" });
    });

    initAccordion2026(detailContainer);
    detailContainer.scrollIntoView({ behavior: "smooth", block: "start" });
  } catch (error) {
    detailContainer.innerHTML = `
      <div class="sr2026-card">
        <p>Impossibile caricare i dati di ${conferenza.nome_breve}.</p>
      </div>
    `;
    console.error(error);
  }
}

async function initStagioneRegolare2026() {
  const app = document.querySelector("#stagione-regolare-2026-app");
  if (!app) return;

  try {
    const conferenze = await loadJson2026(`${SEASON_2026_BASE}/conferenze.json`);
    const conferenzeAttive = conferenze.filter(conferenza => conferenza.attiva);

    app.innerHTML = `
      <div id="sr2026-conference-selector">
        ${await renderConferenceCards2026(conferenzeAttive)}
      </div>

      <div id="sr2026-conference-detail"></div>
    `;

    const detailContainer = app.querySelector("#sr2026-conference-detail");

    app.querySelectorAll("[data-conference]").forEach(button => {
      button.addEventListener("click", () => {
        const conferenza = conferenzeAttive.find(item => item.id === button.dataset.conference);
        showConferenceDetail2026(conferenza, detailContainer);
      });
    });
  } catch (error) {
    app.innerHTML = `
      <div class="sr2026-card">
        <p>Impossibile caricare i dati della stagione regolare 2026.</p>
      </div>
    `;
    console.error(error);
  }
}

document.addEventListener("DOMContentLoaded", initStagioneRegolare2026);