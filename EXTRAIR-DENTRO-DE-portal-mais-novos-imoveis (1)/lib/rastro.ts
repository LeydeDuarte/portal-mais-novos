// Envia um evento para o painel de dados (sem travar a página).
export function rastrear(tipo: string, ref?: string | null) {
  if (typeof window === 'undefined') return;
  try {
    const corpo = JSON.stringify({ t: tipo, p: window.location.pathname, r: ref ?? undefined });
    if (navigator.sendBeacon) navigator.sendBeacon('/api/ev', new Blob([corpo], { type: 'text/plain' }));
    else fetch('/api/ev', { method: 'POST', body: corpo, keepalive: true }).catch(() => {});
  } catch {
    /* nunca atrapalha a navegação */
  }
}
