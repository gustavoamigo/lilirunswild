// Pack the game for the web: `npm run build` (after `npm ci`) writes dist/, which GitHub Pages serves
// (.github/workflows/pages.yml builds it on every push to main). The game is still written and run from the source files
// as they are (tools/serve.py): this only makes the published one quick to load.
//
// All the code, three.js and the game's data (the map, its tiles, the people, the jobs, the list of spoken lines) become
// one minified file, dist/src/main.js, in place of about a hundred: the data rides in it as LILI_PACK, which
// src/world.js, src/missions.js and src/audio.js read instead of fetching. It stays at src/main.js so that index.html
// is the same and its paths to the sounds (`new URL('../sounds/…', import.meta.url)`) still lead to dist/sounds.
// Sounds, voice clips and icons are copied as they are: they load when they are needed.
import { build } from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'dist'), TMP = path.join(ROOT, '.build');
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');

fs.rmSync(OUT, { recursive: true, force: true }); fs.rmSync(TMP, { recursive: true, force: true });
fs.mkdirSync(TMP);

// ---- the data, as one module that sets LILI_PACK ----
const map = read('world/map.txt');
const tiles = [...new Set([...map.matchAll(/^\S+\s*=\s*([\w-]+)\s*$/gm)].map((m) => m[1]))];
const jobs = read('missions/list.txt').split('\n').map((s) => s.trim()).filter((s) => s && !s.startsWith('#'));
fs.writeFileSync(path.join(TMP, 'pack.js'), [
  ...tiles.map((t, i) => `import t${i} from '../world/tiles/${t}.js';`),
  `import people from '../world/people.js';`,
  `globalThis.LILI_PACK = {`,
  `  map: ${JSON.stringify(map)},`,
  `  tiles: { ${tiles.map((t, i) => `${JSON.stringify(t)}: t${i}`).join(', ')} },`,
  `  people,`,
  `  missions: ${JSON.stringify(jobs.map((j) => read(`missions/${j}.md`)))},`,
  `  lines: ${read('sounds/voice/lines.json').trim()},`,
  `};`,
].join('\n'));
// the pack first, so it is there before the game's modules run
fs.writeFileSync(path.join(TMP, 'entry.js'), `import './pack.js';\nimport '../src/main.js';\n`);

await build({
  entryPoints: [path.join(TMP, 'entry.js')], outfile: path.join(OUT, 'src', 'main.js'),
  bundle: true, format: 'esm', minify: true, target: 'es2022', logLevel: 'warning',
});

// ---- everything else the page loads, as it is ----
for (const f of ['index.html', 'style.css', 'manifest.webmanifest']) fs.copyFileSync(path.join(ROOT, f), path.join(OUT, f));
const copyDir = (from, to, skip = () => false) => fs.cpSync(path.join(ROOT, from), path.join(OUT, to), { recursive: true, filter: (s) => !skip(s) });
copyDir('icons', 'icons');
// (Lili's raw recordings, the folder sounds/lili/, are not part of the game; her growls, sounds/lili-growl-*.wav, are)
const raw = path.join(ROOT, 'sounds', 'lili');
copyDir('sounds', 'sounds', (s) => s === raw || s.startsWith(raw + path.sep));
fs.rmSync(TMP, { recursive: true, force: true });

const size = (f) => (fs.statSync(path.join(OUT, f)).size / 1024).toFixed(0);
console.log(`dist/: src/main.js ${size('src/main.js')} kB, ${tiles.length} tiles, ${jobs.length} jobs packed in`);
