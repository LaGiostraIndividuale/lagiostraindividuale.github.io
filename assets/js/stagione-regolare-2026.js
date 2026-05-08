const DATA_BASE_2026 = "/assets/data/stagione-regolare/2026/adriatic-b";

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

function renderPodio2026(classifica, giocantiMap) {
  const top3 = classifica.slice(0, 3);
  const ordinePodio = [top3[1], top3[0], top3[2]].filter(Boolean);

  return `
    <section class="sr2026-card">
      <div class="sr2026-section-title">
        <span>Podio</span>
        <strong>Adriatic B</strong>
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

function renderClassifica2026(classifica, giocantiMap) {
  return `
    <section class="sr2026-card">
      <div class="sr2026-section-title">
        <span>Classifica completa</span>
        <strong>Adriatic B</strong>
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

function renderPartite2026(partite, giocantiMap) {
  const giocate = partite.filter(p => p.stato === "giocata");
  const daGiocare = partite.filter(p => p.stato !== "giocata");

  return `
    <section class="sr2026-card sr2026-accordion">
      <button class="sr2026-accordion-toggle" type="button" aria-expanded="false">
        <span>
          <small>Calendario e referti</small>
          <strong>Partite Adriatic B</strong>
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

function initAccordion2026(app) {
  const toggles = app.querySelectorAll(".sr2026-accordion-toggle");

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

async function initStagioneRegolare2026() {
  const app = document.querySelector("#stagione-regolare-2026-app");
  if (!app) return;

  try {
    const [giocanti, classifica, partite] = await Promise.all([
      loadJson2026(`${DATA_BASE_2026}/giocanti.json`),
      loadJson2026(`${DATA_BASE_2026}/classifica.json`),
      loadJson2026(`${DATA_BASE_2026}/partite.json`)
    ]);

    const giocantiMap = Object.fromEntries(
      giocanti.map(giocante => [giocante.id, giocante])
    );

    app.innerHTML = `
      ${renderPodio2026(classifica, giocantiMap)}
      ${renderClassifica2026(classifica, giocantiMap)}
      ${renderPartite2026(partite, giocantiMap)}
    `;

    app.querySelectorAll("[data-player]").forEach(button => {
      button.addEventListener("click", () => {
        renderPlayerModal2026(giocantiMap[button.dataset.player]);
      });
    });

    initAccordion2026(app);
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