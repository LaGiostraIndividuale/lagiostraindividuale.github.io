---
layout: stagione-regolare
title: Stagione Regolare 2026
permalink: /stagione-regolare-2026/
description: Classifiche, podi e dettagli giocanti delle Conferenze della Stagione Regolare 2026.
image:
published: true
---

<section class="sr-page" data-season="2026">
  <header class="post-header">
    <h1 class="post-title">{{ page.title | escape }}</h1>
    <p>Classifiche, podi e dettagli giocanti delle conferenze.</p>
  </header>

  <div id="stagione-regolare-app"></div>
</section>

{%- if jekyll.environment == 'production' -%}
<script src="{{ '/assets/js/stagione-regolare.min.js' | relative_url }}" defer></script>
{%- else -%}
<script src="{{ '/assets/js/stagione-regolare.js' | relative_url }}" defer></script>
{%- endif -%}
