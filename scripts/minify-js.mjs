#!/usr/bin/env node
/**
 * Minifica i JS del sito (sorgenti in `assets/js/*.js`) producendo i .min.js
 * affianco. Esclude i bundle vendor (già minificati) e i file di output.
 *
 * Esegui con: `npm run minify`
 */
import { build } from "esbuild";
import { mkdirSync, readdirSync, statSync } from "node:fs";
import { dirname, join, basename, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC_DIR = resolve(__dirname, "..", "assets", "js");

/** File saltati: vendor pre-minificati e file di output stessi. */
const SKIP_DIR_NAMES = new Set(["vendor"]);
const SKIP_FILE_PATTERNS = [/\.min\.js$/, /\.map$/];

function listSources(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) {
      if (!SKIP_DIR_NAMES.has(name)) out.push(...listSources(p));
      continue;
    }
    if (!name.endsWith(".js")) continue;
    if (SKIP_FILE_PATTERNS.some((re) => re.test(name))) continue;
    out.push(p);
  }
  return out;
}

const sources = listSources(SRC_DIR);
if (sources.length === 0) {
  console.warn("[minify] Nessun JS sorgente trovato in", SRC_DIR);
  process.exit(0);
}

const tasks = sources.map((src) => {
  const out = src.replace(/\.js$/, ".min.js");
  mkdirSync(dirname(out), { recursive: true });
  /* I file ESM con `import` esterni (es. simulator: import 'three') vanno emessi
     come ESM trasformato senza bundling: l'import si risolve a runtime via importmap. */
  const isEsm = /molkky-throw-simulator\.js$/.test(src);
  return build({
    entryPoints: [src],
    outfile: out,
    minify: true,
    target: "es2018",
    legalComments: "none",
    bundle: false,
    format: isEsm ? "esm" : undefined,
    logLevel: "warning",
  }).then((res) => ({ src, out, res }));
});

const results = await Promise.all(tasks);
for (const { src, out } of results) {
  console.log(`[minify] ${basename(src)} → ${basename(out)}`);
}
console.log(`[minify] OK: ${results.length} file`);
