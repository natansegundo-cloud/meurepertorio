/* Guarda o app no aparelho para abrir sem internet. Troque VERSAO ao atualizar os arquivos. */
const VERSAO = 'meu-repertorio-v23';
const ARQUIVOS = [
  './', 'index.html', 'music-parser.js', 'engine.js', 'seed.js', 'supabase-config.js', 'supabase-sync.js', 'app.js', 'manifest.webmanifest',
  'fonts/bricolage.woff2', 'fonts/jetbrains-mono.woff2',
  'icons/icon.svg', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/maskable-512.png',
  'vendor/pdf.min.js', 'vendor/pdf.worker.min.js', 'vendor/supabase.js'
];
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSAO).then((c) => c.addAll(ARQUIVOS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== VERSAO).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request, { ignoreSearch: true }).then((hit) => {
      const rede = fetch(e.request).then((r) => {
        if (r && r.ok && new URL(e.request.url).origin === location.origin) { const cp = r.clone(); caches.open(VERSAO).then((c) => c.put(e.request, cp)); }
        return r;
      }).catch(() => hit);
      return hit || rede;
    })
  );
});
