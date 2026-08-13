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

function getStats(classifica, giocantiMap) {
  const leader = classifica[0] ? giocantiMap[classifica[0].giocante_id] : null;

  return {
    leader,
    giocanti: Object.keys(giocantiMap).length
  };
}

/**
 * Il campo "posizione" arriva così com'è dal foglio Google Sheets e non è
 * affidabile (es. pareggi risolti in ordine alfabetico invece che per
 * criterio sportivo). Riordiniamo qui per set vinti, poi punti a parità di
 * set, e ricalcoliamo la posizione di conseguenza.
 */
function sortClassifica(classifica) {
  return [...classifica]
    .sort((a, b) => b.sv - a.sv || b.punti - a.punti)
    .map((item, i) => ({ ...item, posizione: i + 1 }));
}

async function loadConferenceData(base, conferenzaId) {
  const confBase = `${base}/${conferenzaId}`;

  const [giocanti, classificaGrezza] = await Promise.all([
    loadJson(`${confBase}/giocanti.json`),
    loadJson(`${confBase}/classifica.json`)
  ]);

  const classifica = sortClassifica(classificaGrezza);

  const giocantiMap = Object.fromEntries(
    giocanti.map(giocante => [giocante.id, giocante])
  );

  return { giocanti, classifica, giocantiMap };
}

function isConferenceCardAvailable({ giocanti, classifica }) {
  return Array.isArray(giocanti) &&
    Array.isArray(classifica) &&
    giocanti.length > 0 &&
    classifica.length > 0;
}

async function renderConferenceCards(conferenze, base) {
  const cardsData = await Promise.all(
    conferenze.map(async conferenza => {
      try {
        const data = await loadConferenceData(base, conferenza.id);
        const { classifica, giocantiMap } = data;
        const stats = getStats(classifica, giocantiMap);
        return { conferenza, stats, available: isConferenceCardAvailable(data) };
      } catch {
        return {
          conferenza,
          stats: { leader: null, giocanti: 0 },
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

async function showConferenceDetail(conferenza, detailContainer, base) {
  detailContainer.innerHTML = `
    <div class="sr-loading">
      Caricamento ${conferenza.nome_breve}...
    </div>
  `;

  try {
    const { classifica, giocantiMap } = await loadConferenceData(base, conferenza.id);

    detailContainer.innerHTML = `
      <div class="sr-selected-heading">
        <button class="sr-back-button" type="button" data-back-conferences>← Conferenze</button>
        <h2>${conferenza.nome_breve}</h2>
      </div>

      ${renderPodio(conferenza, classifica, giocantiMap)}
      ${renderClassifica(conferenza, classifica, giocantiMap)}
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

