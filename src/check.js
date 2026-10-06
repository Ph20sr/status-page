/**
 * Verifica um endereço. "No ar" = respondeu dentro do timeout com um status
 * esperado (padrão: 2xx/3xx). APIs que exigem token podem esperar 401: o
 * importante é o serviço estar respondendo.
 */
export async function checkSite(site, { fetch: fetchFn = globalThis.fetch, now = () => Date.now() } = {}) {
  const started = now();
  const timeoutMs = site.timeoutMs ?? 10_000;
  try {
    const res = await fetchFn(site.url, {
      method: site.method ?? 'GET',
      redirect: 'follow',
      headers: { 'user-agent': 'status-page-monitor/1.0 (+https://github.com/Ph20sr/status-page)' },
      signal: AbortSignal.timeout(timeoutMs),
    });
    const ms = now() - started;
    const ok = site.expect ? site.expect.includes(res.status) : res.status >= 200 && res.status < 400;
    return { name: site.name, ok, status: res.status, ms, at: started, error: ok ? null : `HTTP ${res.status}` };
  } catch (err) {
    const timedOut = err?.name === 'TimeoutError' || err?.name === 'AbortError';
    return {
      name: site.name, ok: false, status: null, ms: now() - started, at: started,
      error: timedOut ? `sem resposta em ${timeoutMs / 1000}s` : (err?.cause?.code ?? err?.message ?? 'erro'),
    };
  }
}
