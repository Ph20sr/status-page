// Histórico agregado por dia (pequeno o bastante para ficar no git) +
// incidentes (períodos fora do ar).

export const DAYS_KEPT = 90;
const dayKey = (ms) => new Date(ms).toISOString().slice(0, 10);

export function emptyHistory() {
  return { updatedAt: null, sites: {} };
}

/** Registra os resultados de uma rodada de verificações. Retorna um novo objeto. */
export function record(history, results) {
  const next = structuredClone(history);
  for (const r of results) {
    const site = next.sites[r.name] ??= { days: {}, last: null, incidents: [] };
    const day = site.days[dayKey(r.at)] ??= { checks: 0, up: 0, totalMs: 0 };
    day.checks++;
    if (r.ok) {
      day.up++;
      day.totalMs += r.ms;
    }

    const open = site.incidents.find((i) => i.end === null);
    if (!r.ok && !open) site.incidents.push({ start: r.at, end: null, error: r.error });
    if (r.ok && open) open.end = r.at;

    site.last = { ok: r.ok, status: r.status, ms: r.ms, at: r.at, error: r.error };
    next.updatedAt = Math.max(next.updatedAt ?? 0, r.at);
  }
  return prune(next);
}

/** Mantém só os últimos DAYS_KEPT dias e incidentes recentes. */
export function prune(history, now = history.updatedAt ?? Date.now()) {
  const cutoff = dayKey(now - DAYS_KEPT * 86_400_000);
  for (const site of Object.values(history.sites)) {
    for (const key of Object.keys(site.days)) if (key <= cutoff) delete site.days[key];
    site.incidents = site.incidents.filter((i) => i.end === null || i.end > now - DAYS_KEPT * 86_400_000).slice(-50);
  }
  return history;
}

/** Disponibilidade (0–1) no período, ponderada pelas verificações. */
export function uptime(site, days = DAYS_KEPT) {
  const entries = Object.entries(site.days).sort(([a], [b]) => a.localeCompare(b)).slice(-days);
  const checks = entries.reduce((s, [, d]) => s + d.checks, 0);
  const up = entries.reduce((s, [, d]) => s + d.up, 0);
  return checks ? up / checks : null;
}

export function avgLatency(site, days = 7) {
  const entries = Object.entries(site.days).sort(([a], [b]) => a.localeCompare(b)).slice(-days);
  const up = entries.reduce((s, [, d]) => s + d.up, 0);
  return up ? Math.round(entries.reduce((s, [, d]) => s + d.totalMs, 0) / up) : null;
}

/** Barras dos últimos N dias (dia sem dados = null). */
export function dailyBars(site, now, days = DAYS_KEPT) {
  const bars = [];
  for (let i = days - 1; i >= 0; i--) {
    const key = dayKey(now - i * 86_400_000);
    const d = site.days[key];
    bars.push({ day: key, ratio: d ? d.up / d.checks : null, checks: d?.checks ?? 0 });
  }
  return bars;
}
