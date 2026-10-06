// Uma rodada: verifica todos os sites, atualiza data/history.json e gera site/index.html.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { checkSite } from '../src/check.js';
import { emptyHistory, record } from '../src/history.js';
import { renderPage } from '../src/render.js';

const config = JSON.parse(await readFile('sites.json', 'utf8'));
const history = await readFile('data/history.json', 'utf8').then(JSON.parse).catch(() => emptyHistory());

const results = await Promise.all(config.sites.map((site) => checkSite(site)));
for (const r of results) console.log(`${r.ok ? '✔' : '✖'} ${r.name.padEnd(22)} ${String(r.status ?? '-').padEnd(4)} ${r.ms}ms ${r.error ?? ''}`);

const next = record(history, results);
await mkdir('data', { recursive: true });
await mkdir('site', { recursive: true });
await writeFile('data/history.json', `${JSON.stringify(next, null, 1)}\n`);
await writeFile('site/index.html', renderPage(config, next));
