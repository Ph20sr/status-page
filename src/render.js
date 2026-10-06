import { uptime, avgLatency, dailyBars } from './history.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const pct = (r) => (r == null ? '—' : `${(Math.floor(r * 10000) / 100).toFixed(2)}%`);
const dateBR = (ms) => new Intl.DateTimeFormat('pt-BR', {
  dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Sao_Paulo',
}).format(ms);

function duration(ms) {
  const min = Math.max(1, Math.round(ms / 60_000));
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  return h < 24 ? `${h}h ${min % 60}min` : `${Math.floor(h / 24)}d ${h % 24}h`;
}

const barClass = (ratio) => {
  if (ratio == null) return 'none';
  if (ratio >= 0.999) return 'up';
  if (ratio >= 0.95) return 'partial';
  return 'down';
};

/** Gera a página de status (HTML estático, sem JavaScript). */
export function renderPage(config, history, now = Date.now()) {
  const sites = config.sites.map((s) => ({ ...s, data: history.sites[s.name] }));
  const down = sites.filter((s) => s.data?.last && !s.data.last.ok);
  const overall = down.length === 0
    ? { cls: 'ok', text: 'Todos os sistemas operando normalmente' }
    : { cls: 'bad', text: `${down.length === 1 ? 'Instabilidade' : 'Instabilidades'} em: ${down.map((s) => s.name).join(', ')}` };

  const rows = sites.map((s) => {
    if (!s.data) return `<section class="site"><div class="head"><h2>${esc(s.name)}</h2><span class="pill none">aguardando</span></div></section>`;
    const last = s.data.last;
    const bars = dailyBars(s.data, now).map((b) => `<i class="${barClass(b.ratio)}" title="${b.day}: ${b.checks ? pct(b.ratio) : 'sem dados'}"></i>`).join('');
    const latency = avgLatency(s.data);
    return `
    <section class="site">
      <div class="head">
        <h2>${esc(s.name)}</h2>
        <span class="pill ${last.ok ? 'up' : 'down'}">${last.ok ? 'no ar' : 'fora do ar'}</span>
      </div>
      <div class="bars" role="img" aria-label="Disponibilidade diária dos últimos 90 dias">${bars}</div>
      <div class="meta">
        <span>90 dias: <b>${pct(uptime(s.data))}</b></span>
        <span>7 dias: <b>${pct(uptime(s.data, 7))}</b></span>
        <span>latência média: <b>${latency == null ? '—' : `${latency} ms`}</b></span>
        ${last.ok ? '' : `<span class="err">${esc(last.error)}</span>`}
      </div>
    </section>`;
  }).join('');

  const incidents = sites
    .flatMap((s) => (s.data?.incidents ?? []).map((i) => ({ ...i, name: s.name })))
    .sort((a, b) => b.start - a.start)
    .slice(0, 15)
    .map((i) => `<li><b>${esc(i.name)}</b> · ${dateBR(i.start)} · ${i.end ? `durou ${duration(i.end - i.start)}` : '<span class="err">em andamento</span>'} · <span class="muted">${esc(i.error)}</span></li>`)
    .join('');

  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(config.title)}</title>
<meta name="description" content="${esc(config.description)}">
<style>
:root{color-scheme:light dark;--bg:#f6f8fa;--card:#fff;--fg:#1f2328;--muted:#656d76;--border:#d0d7de;--up:#1a7f37;--partial:#bf8700;--down:#cf222e;--none:#d0d7de;--on:#fff}
@media (prefers-color-scheme:dark){:root{--bg:#0d1117;--card:#161b22;--fg:#e6edf3;--muted:#8d96a0;--border:#30363d;--up:#3fb950;--partial:#d29922;--down:#f85149;--none:#30363d;--on:#0d1117}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--fg);font:15px/1.5 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
main{max-width:860px;margin:0 auto;padding:40px 16px 64px}
h1{font-size:clamp(24px,5vw,32px);margin:0 0 4px}p{margin:0;color:var(--muted)}
.banner{margin:24px 0;padding:16px 18px;border-radius:12px;font-weight:600;color:var(--on)}.banner.ok{background:var(--up)}.banner.bad{background:var(--down)}
.site{background:var(--card);border:1px solid var(--border);border-radius:12px;padding:16px 18px;margin-bottom:12px}
.head{display:flex;justify-content:space-between;align-items:center;gap:12px}h2{font-size:16px;margin:0}
.pill{font-size:12px;font-weight:600;padding:2px 10px;border-radius:999px;color:var(--on)}.pill.up{background:var(--up)}.pill.down{background:var(--down)}.pill.none{background:var(--muted)}
.bars{display:flex;gap:2px;height:34px;margin:14px 0 10px}.bars i{flex:1;border-radius:2px;background:var(--none)}
.bars i.up{background:var(--up)}.bars i.partial{background:var(--partial)}.bars i.down{background:var(--down)}
.meta{display:flex;flex-wrap:wrap;gap:6px 18px;font-size:13px;color:var(--muted)}.meta b{color:var(--fg)}
.err{color:var(--down)}.muted{color:var(--muted)}
h3{margin:32px 0 8px;font-size:16px}ul{padding-left:18px;margin:0;font-size:14px}li{margin:4px 0}
footer{margin-top:32px;font-size:13px;color:var(--muted)}a{color:inherit}
@media (max-width:520px){.bars{height:28px;gap:1px}}
</style>
</head>
<body>
<main>
  <h1>${esc(config.title)}</h1>
  <p>${esc(config.description)}</p>
  <div class="banner ${overall.cls}" role="status">${esc(overall.text)}</div>
  ${rows}
  <h3>Incidentes recentes</h3>
  ${incidents ? `<ul>${incidents}</ul>` : '<p>Nenhum incidente nos últimos 90 dias.</p>'}
  <footer>Atualizado em ${history.updatedAt ? dateBR(history.updatedAt) : '—'} (horário de Brasília) · verificado a cada 30 min por GitHub Actions · <a href="https://github.com/Ph20sr/status-page">código</a></footer>
</main>
</body>
</html>
`;
}
