// Service worker do app da equipe (PWA). Não guarda páginas nem dados em cache —
// tudo vem sempre do servidor (anúncios mudam o tempo todo). Sem internet,
// mostra um aviso simples em vez da tela de erro do navegador.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', (e) => {
  if (e.request.mode !== 'navigate') return;
  e.respondWith(
    fetch(e.request).catch(
      () =>
        new Response(
          '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Sem conexão</title><body style="font-family:system-ui;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;text-align:center;color:#333"><div><h2>Sem conexão</h2><p>Confira a internet e tente de novo.</p><button onclick="location.reload()" style="background:#257CFF;color:#fff;border:0;border-radius:999px;padding:10px 20px;font-weight:bold">Tentar de novo</button></div>',
          { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
        )
    )
  );
});
