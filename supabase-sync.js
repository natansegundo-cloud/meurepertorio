/* Sincronizacao offline-first do Meu Repertorio. Usa apenas a publishable key. */
(function (root) {
  'use strict';
  var cfg = root.MEU_REPERTORIO_CONFIG || {}, client = null, user = null, status = 'indisponivel';
  var hooks = {}, running = false, DELETE_KEY = 'mr:cloud-deletes';

  function configured() { return !!(cfg.supabaseUrl && cfg.supabasePublishableKey && root.supabase && root.supabase.createClient); }
  function emit() { if (hooks.onStatus) hooks.onStatus(status, user); }
  function setStatus(s) { status = s; emit(); }
  function readDeletes() { try { return JSON.parse(localStorage.getItem(DELETE_KEY) || '{}'); } catch (e) { return {}; } }
  function saveDeletes(d) { try { localStorage.setItem(DELETE_KEY, JSON.stringify(d)); } catch (e) {} }
  function cloudRow(s, uid) {
    return { user_id: uid || user.id, id: String(s.id), title: s.title || '', artist: s.artist || '', key: s.key || '', body: s.body || '', semi: Number(s.semi || 0), pref: s.pref || 'auto', pdf_path: s.pdfPath || (s.pdf instanceof Blob ? (uid || user.id) + '/' + String(s.id) + '.pdf' : null), created_at: Number(s.createdAt || Date.now()), updated_at: Number(s.updatedAt || Date.now()) };
  }
  function localSong(r, old) {
    return { id: String(r.id), title: r.title || '', artist: r.artist || '', key: r.key || '', body: r.body || '', createdAt: Number(r.created_at || Date.now()), updatedAt: Number(r.updated_at || Date.now()), semi: Number(r.semi || 0), pref: r.pref || 'auto', pdf: old && old.pdf, pdfPath: r.pdf_path || (old && old.pdfPath) };
  }
  function newer(a, b) { return Number(a.updatedAt || 0) > Number(b.updated_at || b.updatedAt || 0); }
  function clearDelete(id) { var d = readDeletes(); delete d[id]; saveDeletes(d); }
  function markDelete(id) { var d = readDeletes(); d[id] = 1; saveDeletes(d); }

  function start(h) {
    hooks = h || {};
    if (!configured()) { setStatus('indisponivel'); return Promise.resolve(); }
    if (client) return client.auth.getSession().then(function (r) { user = r.data && r.data.session ? r.data.session.user : null; setStatus(user ? 'conectado' : 'desconectado'); return user; });
    client = root.supabase.createClient(cfg.supabaseUrl, cfg.supabasePublishableKey, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
    client.auth.onAuthStateChange(function (event, session) {
      user = session ? session.user : null;
      setStatus(user ? 'conectado' : 'desconectado');
      if (user && event !== 'SIGNED_OUT') setTimeout(function () { syncNow(); }, 0);
    });
    root.addEventListener('online', function () { if (user) syncNow(); });
    root.document.addEventListener('visibilitychange', function () { if (root.document.visibilityState === 'visible' && user) syncNow(); });
    return client.auth.getSession().then(function (r) {
      user = r.data && r.data.session ? r.data.session.user : null;
      setStatus(user ? 'conectado' : 'desconectado');
      if (user) return syncNow();
      return user;
    });
  }

  function signIn(email) {
    if (!client) return Promise.resolve({ error: 'Sincronizacao indisponivel' });
    var options = {};
    if (/^https?:$/.test(location.protocol)) options.emailRedirectTo = location.origin + location.pathname;
    return client.auth.signInWithOtp({ email: email, options: options }).then(function (r) { return r.error ? { error: r.error.message } : r; });
  }
  function signOut() { return client ? client.auth.signOut().then(function (r) { user = null; setStatus('desconectado'); return r; }) : Promise.resolve(); }
  function uploadPdf(song) {
    if (!(song && song.pdf instanceof Blob)) return Promise.resolve();
    var path = (user.id + '/' + String(song.id) + '.pdf');
    return client.storage.from('song-pdfs').upload(path, song.pdf, { upsert: true, contentType: song.pdf.type || 'application/pdf' }).then(function (r) { if (r.error) throw r.error; });
  }
  function downloadPdf(path) {
    if (!client || !user || !path) return Promise.resolve(null);
    return client.storage.from('song-pdfs').download(path).then(function (r) { if (r.error) return null; return r.data; });
  }

  function syncNow() {
    if (!client || !user || running || !hooks.getSongs) return Promise.resolve({ ok: false, reason: 'not-ready' });
    running = true; setStatus(root.navigator.onLine === false ? 'offline' : 'sincronizando');
    var deletes = readDeletes();
    return Promise.all([hooks.getSongs(), client.from('songs').select('id,title,artist,key,body,semi,pref,pdf_path,created_at,updated_at')])
      .then(function (pair) {
        var local = pair[0] || [], result = pair[1];
        if (result.error) throw result.error;
        var remote = result.data || [], lm = {}, rm = {}, pushSongs = [], remove = [], apply = [];
        local.forEach(function (s) { lm[s.id] = s; });
        remote.forEach(function (r) { rm[r.id] = r; });
        local.forEach(function (s) {
          if (deletes[s.id]) { remove.push(s.id); return; }
          var r = rm[s.id];
          if (!r || newer(s, r)) pushSongs.push(s);
          else if (newer(localSong(r), s)) apply.push({ song: localSong(r, s), id: s.id });
        });
        remote.forEach(function (r) {
          if (deletes[r.id]) remove.push(r.id);
          else if (!lm[r.id]) apply.push({ song: localSong(r), id: r.id });
        });
        var push = pushSongs.map(function (s) { return cloudRow(s); });
        return Promise.all(apply.map(function (x) { return hooks.put(x.song, true); }))
          .then(function () { return Promise.all(pushSongs.map(uploadPdf)); })
          .then(function () { return push.length ? client.from('songs').upsert(push, { onConflict: 'user_id,id' }) : { error: null }; })
          .then(function (r) { if (r.error) throw r.error; return remove.length ? client.from('songs').delete().in('id', remove) : { error: null }; })
          .then(function (r) {
            if (r.error) throw r.error;
            remove.forEach(clearDelete);
            return hooks.reload ? hooks.reload() : null;
          });
      })
      .then(function () { running = false; setStatus('sincronizado'); return { ok: true }; })
      .catch(function (e) { running = false; setStatus(root.navigator.onLine === false ? 'offline' : 'erro'); return { ok: false, error: e && e.message ? e.message : 'erro' }; });
  }

  root.MeuRepertorioCloud = {
    isConfigured: configured,
    start: start,
    signIn: signIn,
    signOut: signOut,
    syncNow: syncNow,
    downloadPdf: downloadPdf,
    getUser: function () { return user; },
    statusLabel: function () { return status; },
    queueUpsert: function (s) { if (s && s.id) clearDelete(String(s.id)); if (user && root.navigator.onLine !== false) setTimeout(syncNow, 0); },
    queueDelete: function (id) { if (!id) return; markDelete(String(id)); if (user && root.navigator.onLine !== false) setTimeout(syncNow, 0); }
  };
})(globalThis);
