---
layout: landing
title: La Giostra Individuale
description: Campionato nazionale di Mölkky uno contro uno — stagione regolare, riepiloghi e app ufficiale.
image: /assets/img/stagione-2026/la-giostra-individuale-stagione2026.png
molkky_simulator: true
---

<!-- ═══════════════════════════════ HERO ══════════════════════════════ -->
<section id="home" class="lp-section lp-section--hero">
  <div class="lp-grid">
    <div class="lp-cell lp-cell--hero-text">
      <div>
        <span class="lp-overline">Campionato nazionale · Stagione 2026</span>
        <h1 class="lp-title lp-title--hero">La&nbsp;Giostra<br>Individuale</h1>
        <p style="font-size:var(--fs-4);font-weight:700;color:var(--lp-color);margin:1.5rem 0 0;line-height:1.3;">
          ovvero il campionato nazionale di Mölkky uno contro uno
        </p>
      </div>
      <a class="lp-cta" href="#stagione">Scopri la stagione &darr;</a>
    </div>
    <div class="lp-cell lp-cell--image">
      <img
        src="/assets/img/stagione-2026/la-giostra-individuale-stagione2026.png"
        alt="La Giostra Individuale — poster stagione regolare 2026"
        width="1500" height="1475"
        loading="eager" fetchpriority="high" decoding="async"
      >
    </div>
  </div>
</section>

<!-- ══════════════════════════ AGGIORNAMENTI (red) ═══════════════════ -->
<section id="aggiornamenti" class="lp-section lp-section--red lp-section--aggiornamenti">
  <div class="lp-grid">
    <div class="lp-cell lp-cell--aggio-text">
      <span class="lp-overline">{{ site.data.aggiornamenti.label }}</span>
      <h2 class="lp-title lp-title--section">{{ site.data.aggiornamenti.title }}</h2>
      <div class="lp-body">
        {%- for para in site.data.aggiornamenti.paragraphs -%}
        <p>{{ para }}</p>
        {%- endfor -%}
      </div>
    </div>
    <div class="lp-cell lp-cell--aggio-callout">
      <div>
        <p class="lp-aggio-finale-label">{{ site.data.aggiornamenti.finale_label }}</p>
        <p class="lp-aggio-date">{{ site.data.aggiornamenti.finale_data }}<br>{{ site.data.aggiornamenti.finale_luogo }}</p>
      </div>
      <a class="lp-link" href="{{ site.data.aggiornamenti.contact_url }}">{{ site.data.aggiornamenti.contact_label }} &rarr;</a>
    </div>
  </div>
</section>

<!-- ═══════════════════════════════ STAGIONE ═════════════════════════ -->
<section id="stagione" class="lp-section lp-section--stagione">
  <div class="lp-grid--stagione-head">
    <div class="lp-cell lp-cell--meta">
      <span class="lp-overline">Campionato</span>
    </div>
    <div class="lp-cell">
      <h2 class="lp-title lp-title--section">Stagione<br>Regolare 2026</h2>
    </div>
  </div>
  <details class="lp-accordion">
    <summary class="lp-accordion__trigger">
      Classifiche &amp; risultati
      <span class="lp-accordion__icon" aria-hidden="true">+</span>
    </summary>
    <div class="lp-accordion__body">
      <section class="sr-page" data-season="2026">
        <p class="sr-intro">Classifiche, podi e dettagli giocanti delle conferenze.</p>
        <div id="stagione-regolare-app"></div>
      </section>
    </div>
  </details>
</section>

<!-- ══════════════════════════ REGOLAMENTO (light) ═══════════════════ -->
<section id="regolamento" class="lp-section lp-section--light lp-section--regolamento">
  <!-- Riga 1: label · titolo · foto -->
  <div class="lp-grid--reg-head">
    <div class="lp-cell lp-cell--meta">
      <span class="lp-overline">Come funziona</span>
    </div>
    <div class="lp-cell">
      <h2 class="lp-title lp-title--section">Regolamento</h2>
    </div>
    <div class="lp-cell lp-cell--image">
      <img
        src="/assets/img/regolamento.jpg"
        alt="Lancio notturno durante una partita di Mölkky"
        width="1000" height="667"
        loading="lazy" decoding="async"
      >
    </div>
  </div>
  <!-- Riga 2: spacer · tre passi -->
  <div class="lp-grid--reg-steps">
    <div class="lp-cell lp-cell--spacer"></div>
    {%- for step in site.data.regolamento.steps -%}
    <div class="lp-cell">
      <p class="lp-rule-num">{{ step.num }}</p>
      <h3 class="lp-rule-title">{{ step.title }}</h3>
      <p class="lp-rule-body">{{ step.body }}</p>
    </div>
    {%- endfor -%}
  </div>
  <!-- Testo completo del regolamento -->
  {%- assign reg_page = site.pages | where: "permalink", "/regolamento/" | first -%}
  {%- if reg_page -%}
  <details class="lp-accordion lp-reg-accordion">
    <summary class="lp-accordion__trigger">
      Testo completo del regolamento
      <span class="lp-accordion__icon" aria-hidden="true">+</span>
    </summary>
    <div class="lp-accordion__body">
      <div class="lp-reg-full-grid">
        <div class="lp-cell lp-reg-text-col">
          {{ reg_page.content | markdownify }}
        </div>
        <div class="lp-cell lp-cell--image">
          <img
            src="/assets/img/regolamento-old.jpg"
            alt="Lancio durante una partita di Mölkky"
            loading="lazy" decoding="async"
          >
        </div>
      </div>
    </div>
  </details>
  {%- endif -%}
</section>

<!-- ════════════════════════════════ APP ═════════════════════════════ -->
<section id="app" class="lp-section lp-section--app">
  <div class="lp-grid">
    <div class="lp-cell lp-cell--app-text">
      <div>
        <span class="lp-overline">Ufficiale</span>
        <h2 class="lp-title lp-title--section">L'App</h2>
      </div>
      <div>
        <img
          class="lp-app-icon"
          src="/assets/img/giostra-APP.png"
          alt="Icona dell'app de La Giostra Individuale"
          width="249" height="252"
          loading="lazy" decoding="async"
        >
        <p class="lp-app-desc">Segui classifiche, risultati e dettagli giocanti in tempo reale. Disponibile per iOS e Android.</p>
        <div class="lp-app-badges">
          <a class="lp-app-badge" href="https://apps.apple.com/it/app/la-giostra-individuale/id6741768625" rel="noopener noreferrer">
            <img src="/assets/img/app-store.png" alt="Scarica su App Store" width="200" height="66" loading="lazy" decoding="async">
          </a>
          <a class="lp-app-badge" href="https://play.google.com/store/apps/details?id=it.giostraindividuale.app&pcampaignid=web_share" rel="noopener noreferrer">
            <img src="/assets/img/g-play.png" alt="Disponibile su Google Play" width="200" height="66" loading="lazy" decoding="async">
          </a>
        </div>
      </div>
    </div>
    <div class="lp-cell lp-cell--image">
      <img
        src="/assets/img/iscrizione.jpg"
        alt="Giocante con megafono durante un evento de La Giostra Individuale"
        width="2000" height="1500"
        loading="lazy" decoding="async"
      >
    </div>
  </div>
</section>

<!-- ═══════════════════════════ SIMULATORE (red) ═════════════════════ -->
<section id="simulatore" class="lp-section lp-section--red lp-section--simulatore">
  <div class="lp-grid--sim-head">
    <div class="lp-cell lp-cell--meta">
      <span class="lp-overline">Allenati</span>
    </div>
    <div class="lp-cell">
      <h2 class="lp-title lp-title--section">Simulatore<br>di Lancio</h2>
      <div class="lp-body lp-sim-lead">
        <p>Vinci raggiungendo esattamente <strong>50 punti</strong>: se sfori torni a 25. Tre mancati consecutivi e la partita finisce. Conferma il tiro in tre tempi: potenza, direzione e palombella.</p>
      </div>
    </div>
  </div>
  <div class="lp-grid--sim-body">
    <div class="lp-cell">
      {% include molkky-throw-simulator.html %}
    </div>
    <div class="lp-cell lp-cell--image">
      <img
        src="/assets/img/stagione-2023/la-giostra-individuale-2023-3.jpg"
        alt="Giocante con il cono del campo durante un evento"
        width="1011" height="1500"
        loading="lazy" decoding="async"
      >
    </div>
  </div>
</section>

<!-- ══════════════════════════════ ARCHIVIO ══════════════════════════ -->
<section id="archivio" class="lp-section lp-section--archivio">
  <div class="lp-grid--arch-head">
    <div class="lp-cell lp-cell--meta">
      <span class="lp-overline">Edizioni passate</span>
    </div>
    <div class="lp-cell">
      <h2 class="lp-title lp-title--section">Archivio</h2>
    </div>
  </div>
  {%- for post in site.posts -%}
  <details class="lp-accordion lp-archive-item">
    <summary class="lp-accordion__trigger">
      <span class="lp-archive-item-title">{{ post.title }}</span>
      <span class="lp-accordion__icon" aria-hidden="true">+</span>
    </summary>
    <div class="lp-accordion__body lp-archive-body">
      <div class="lp-archive-content-grid">
        {%- if post.video -%}
        <div class="lp-cell lp-archive-video-cell">
          <div class="lp-archive-video-inner">
            <iframe src="{{ post.video }}" frameborder="0" allow="autoplay; encrypted-media" allowfullscreen loading="lazy"></iframe>
          </div>
        </div>
        {%- endif -%}
        <div class="lp-cell lp-archive-prose js-archive-gallery">{{ post.content }}</div>
      </div>
    </div>
  </details>
  {%- endfor -%}
</section>

<!-- ══════════════════════════════ DOCUMENTI (light) ══════════════════ -->
<section id="documenti" class="lp-section lp-section--light lp-section--documenti">
  <div class="lp-grid--doc-head">
    <div class="lp-cell lp-cell--meta">
      <span class="lp-overline">Modulistica</span>
    </div>
    <div class="lp-cell">
      <h2 class="lp-title lp-title--section">Documenti</h2>
    </div>
  </div>
  <div class="lp-grid--docs">
    {%- for doc in site.data.documenti -%}
    <a class="lp-doc-card" href="/assets/docs/{{ doc.file | url_encode }}" target="_blank" rel="noopener noreferrer">
      <div class="lp-doc-preview">
        <img src="{{ doc.anteprima }}" alt="{{ doc.titolo }}" loading="lazy" decoding="async">
      </div>
      <div class="lp-doc-info">
        <h3 class="lp-doc-title">{{ doc.titolo }}</h3>
        <p class="lp-doc-desc">{{ doc.descrizione }}</p>
        <span class="lp-doc-dl">Scarica PDF &darr;</span>
      </div>
    </a>
    {%- endfor -%}
  </div>
</section>
