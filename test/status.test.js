import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkSite } from '../src/check.js';
import { emptyHistory, record, uptime, avgLatency, dailyBars, DAYS_KEPT } from '../src/history.js';
import { renderPage } from '../src/render.js';

const DAY = 86_400_000;
const T0 = Date.parse('2026-10-06T12:00:00Z');
const r = (name, ok, at, extra = {}) => ({ name, ok, status: ok ? 200 : 503, ms: 100, at, error: ok ? null : 'HTTP 503', ...extra });

test('checkSite: status esperado, erro HTTP e timeout', async () => {
  const fake = (status) => async () => ({ status });
  assert.equal((await checkSite({ name: 'a', url: 'x' }, { fetch: fake(200) })).ok, true);
  assert.equal((await checkSite({ name: 'a', url: 'x' }, { fetch: fake(301) })).ok, true);
  const down = await checkSite({ name: 'a', url: 'x' }, { fetch: fake(502) });
  assert.equal(down.ok, false);
  assert.equal(down.error, 'HTTP 502');
  assert.equal((await checkSite({ name: 'api', url: 'x', expect: [401] }, { fetch: fake(401) })).ok, true, 'API que exige token');

  // AbortSignal.timeout usa um timer "unref": sem um fetch real segurando o
  // processo, o Node poderia encerrar antes do timeout. Este timer o mantém vivo.
  const slow = (url, { signal }) => new Promise((_, reject) => {
    const keepAlive = setTimeout(() => {}, 5000);
    signal.addEventListener('abort', () => {
      clearTimeout(keepAlive);
      reject(signal.reason);
    });
  });
  const timeout = await checkSite({ name: 'a', url: 'x', timeoutMs: 20 }, { fetch: slow });
  assert.equal(timeout.ok, false);
  assert.equal(timeout.error, 'sem resposta em 0.02s');
});

test('record agrega por dia e calcula disponibilidade', () => {
  let h = emptyHistory();
  h = record(h, [r('Site', true, T0), r('Site', true, T0 + 1000)]);
  h = record(h, [r('Site', false, T0 + 2000)]);
  h = record(h, [r('Site', true, T0 + 3000, { ms: 300 })]);

  const site = h.sites.Site;
  assert.deepEqual(site.days['2026-10-06'], { checks: 4, up: 3, totalMs: 500 });
  assert.equal(uptime(site), 0.75);
  assert.equal(avgLatency(site), 167);
  assert.equal(site.last.ok, true);
  assert.equal(h.updatedAt, T0 + 3000);
});

test('incidentes: abre na primeira falha e fecha na volta', () => {
  let h = emptyHistory();
  h = record(h, [r('API', true, T0)]);
  h = record(h, [r('API', false, T0 + 60_000)]);
  h = record(h, [r('API', false, T0 + 120_000)]);
  assert.deepEqual(h.sites.API.incidents, [{ start: T0 + 60_000, end: null, error: 'HTTP 503' }]);
  h = record(h, [r('API', true, T0 + 180_000)]);
  assert.equal(h.sites.API.incidents[0].end, T0 + 180_000);
  assert.equal(h.sites.API.incidents.length, 1);
});

test('mantém só os últimos 90 dias', () => {
  let h = emptyHistory();
  h = record(h, [r('Site', true, T0 - 120 * DAY)]);
  h = record(h, [r('Site', true, T0)]);
  assert.deepEqual(Object.keys(h.sites.Site.days), ['2026-10-06']);
  assert.equal(DAYS_KEPT, 90);
});

test('barras diárias: dias sem dados ficam nulos', () => {
  let h = emptyHistory();
  h = record(h, [r('Site', true, T0 - DAY), r('Site', false, T0 - DAY + 1)]);
  const bars = dailyBars(h.sites.Site, T0, 3);
  assert.deepEqual(bars.map((b) => [b.day, b.ratio]), [['2026-10-04', null], ['2026-10-05', 0.5], ['2026-10-06', null]]);
});

test('página: banner geral, linhas por site e incidentes', () => {
  const config = { title: 'Status <Teste>', description: 'desc', sites: [{ name: 'Site' }, { name: 'API' }, { name: 'Novo' }] };
  let h = emptyHistory();
  h = record(h, [r('Site', true, T0), r('API', false, T0)]);

  const html = renderPage(config, h, T0);
  assert.match(html, /Status &#60;Teste&#62;/, 'escapa HTML');
  assert.match(html, /Instabilidade em: API/);
  assert.match(html, /em andamento/);
  assert.match(html, /aguardando/, 'site sem dados ainda');
  assert.equal((html.match(/<i class=/g) ?? []).length, 2 * 90);

  const ok = renderPage(config, record(h, [r('API', true, T0 + 600_000)]), T0);
  assert.match(ok, /Todos os sistemas operando normalmente/);
  assert.match(ok, /durou 10 min/);
});
