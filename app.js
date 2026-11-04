/* Caderno de Cifras: biblioteca, cifra, edição, importação e acordes. Tudo local (IndexedDB). */
(function () {
  'use strict';
  var Cifra = window.Cifra;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var norm = function (s) { return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase(); };

  /* ---------- ícones ---------- */
  var P = {
    back: '<path d="M15 18l-6-6 6-6"/>', plus: '<path d="M12 5v14M5 12h14"/>', minus: '<path d="M5 12h14"/>',
    play: '<path d="M7 4v16l13-8z" fill="currentColor"/>', pause: '<path d="M7 4h4v16H7zM13 4h4v16h-4z" fill="currentColor"/>',
    dots: '<circle cx="5" cy="12" r="1.6" fill="currentColor"/><circle cx="12" cy="12" r="1.6" fill="currentColor"/><circle cx="19" cy="12" r="1.6" fill="currentColor"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>', edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/>',
    l: '<path d="M15 6l-6 6 6 6"/>', r: '<path d="M9 6l6 6-6 6"/>', x: '<path d="M6 6l12 12M18 6L6 18"/>',
    up: '<path d="M12 16V4M7 9l5-5 5 5M5 20h14"/>', down: '<path d="M12 4v12M7 11l5 5 5-5M5 20h14"/>',
    clip: '<rect x="6" y="5" width="12" height="16" rx="2"/><path d="M9 5V3h6v2M9 11h6M9 15h6"/>',
    trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>', moon: '<path d="M20 14A8 8 0 1 1 10 4a6.5 6.5 0 0 0 10 10z"/>',
    file: '<path d="M6 3h8l5 5v13H6zM14 3v5h5"/>', fit: '<path d="M4 12h16M8 8l-4 4 4 4M16 8l4 4-4 4"/>',
    type: '<path d="M5 7V5h14v2M12 5v14M9 19h6"/>', phone: '<rect x="7" y="2" width="10" height="20" rx="2"/><path d="M11 18h2"/>'
  };
  var ic = function (n, s) { s = s || 22; return '<svg class="ic" width="' + s + '" height="' + s + '" viewBox="0 0 24 24" aria-hidden="true">' + P[n] + '</svg>'; };

  /* ---------- preferências (localStorage com proteção) ---------- */
  var store = {
    get: function (k, d) { try { var v = localStorage.getItem('cc:' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set: function (k, v) { try { localStorage.setItem('cc:' + k, JSON.stringify(v)); } catch (e) {} }
  };

  /* ---------- banco (IndexedDB, com plano B em memória) ---------- */
  var mem = {}, useMem = false, dbp = null;
  function openDB() {
    if (!dbp) dbp = new Promise(function (res, rej) {
      try {
        var r = indexedDB.open('caderno-cifras', 1);
        r.onupgradeneeded = function () { r.result.createObjectStore('songs', { keyPath: 'id' }); };
        r.onsuccess = function () { res(r.result); };
        r.onerror = function () { rej(r.error); };
      } catch (e) { rej(e); }
    });
    return dbp;
  }
  function tx(mode, fn) {
    if (useMem) return Promise.resolve(fn(null, true));
    return openDB().then(function (db) {
      return new Promise(function (res, rej) {
        var t = db.transaction('songs', mode), rq = fn(t.objectStore('songs'));
        t.oncomplete = function () { res(rq && rq.result); };
        t.onerror = t.onabort = function () { rej(t.error); };
      });
    }).catch(function () { useMem = true; return fn(null, true); });
  }
  var DB = {
    all: function () { return tx('readonly', function (s, m) { return m ? Object.keys(mem).map(function (k) { return mem[k]; }) : s.getAll(); }); },
    put: function (o, silent) { var p = tx('readwrite', function (s, m) { if (m) { mem[o.id] = o; return null; } return s.put(o); }); if (!silent && window.MeuRepertorioCloud) window.MeuRepertorioCloud.queueUpsert(o); return p; },
    del: function (id, silent) { var p = tx('readwrite', function (s, m) { if (m) { delete mem[id]; return null; } return s.delete(id); }); if (!silent && window.MeuRepertorioCloud) window.MeuRepertorioCloud.queueDelete(id); return p; }
  };

  /* ---------- estado ---------- */
  var S = { songs: [], q: '', draft: null, cur: null, view: '', scroll: { on: false, speed: store.get('speed', 3) }, strip: store.get('strip', true) };
  var HOVER = window.matchMedia && matchMedia('(hover:hover) and (pointer:fine)').matches;
  var uid = function () { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); };

  function toast(msg) {
    var t = $('#toast'); t.textContent = msg; t.hidden = false;
    clearTimeout(toast.t); toast.t = setTimeout(function () { t.hidden = true; }, 2800);
  }

  /* ---------- tema ---------- */
  function applyTheme() {
    var th = store.get('theme', 'auto'), r = document.documentElement;
    if (th === 'auto') r.removeAttribute('data-theme'); else r.setAttribute('data-theme', th);
  }
  applyTheme();

  /* ---------- diagrama de acorde ---------- */
  function chordSVG(v) {
    var x0 = 22, dx = 12, y0 = 28, dy = 17, rows = 5, i, o = '';
    var minF = 99, maxF = 0;
    v.frets.forEach(function (f) { if (f > 0) { if (f < minF) minF = f; if (f > maxF) maxF = f; } });
    var base = maxF <= 5 ? 1 : minF;
    for (i = 0; i <= rows; i++) o += '<line class="' + (i === 0 && base === 1 ? 'nut' : 'gl') + '" x1="' + x0 + '" x2="' + (x0 + 5 * dx) + '" y1="' + (y0 + i * dy) + '" y2="' + (y0 + i * dy) + '"/>';
    for (i = 0; i < 6; i++) o += '<line class="gl" x1="' + (x0 + i * dx) + '" x2="' + (x0 + i * dx) + '" y1="' + y0 + '" y2="' + (y0 + rows * dy) + '"/>';
    if (base > 1) o += '<text x="' + (x0 - 6) + '" y="' + (y0 + dy * 0.68) + '" text-anchor="end">' + base + 'ª</text>';
    if (v.barre && v.barre.to - v.barre.from >= 3) {
      var by = y0 + (v.barre.fret - base + 0.5) * dy;
      o += '<rect class="dot" x="' + (x0 + v.barre.from * dx - 5.5) + '" y="' + (by - 5.5) + '" width="' + ((v.barre.to - v.barre.from) * dx + 11) + '" height="11" rx="5.5"/>';
    }
    var drawnBarre = !!(v.barre && v.barre.to - v.barre.from >= 3);
    v.frets.forEach(function (f, s) {
      var cx = x0 + s * dx;
      if (drawnBarre && f === v.barre.fret && s >= v.barre.from && s <= v.barre.to) return;
      if (f < 0) o += '<path class="mu" d="M' + (cx - 3.5) + ' 12.5l7 7M' + (cx + 3.5) + ' 12.5l-7 7"/>';
      else if (f === 0) o += '<circle class="op" cx="' + cx + '" cy="16" r="3.6"/>';
      else o += '<circle class="dot" cx="' + cx + '" cy="' + (y0 + (f - base + 0.5) * dy) + '" r="5.5"/>';
    });
    return '<svg class="cd" viewBox="0 0 100 120" role="img" aria-label="Posição no braço do violão">' + o + '</svg>';
  }

  /* ---------- contexto de transposição ---------- */
  function firstChordOf(song) { var u = Cifra.uniqueChords(Cifra.parseBody(song.body)); return u[0] || ''; }
  function ctxFor(song) {
    var semi = song.semi || 0, pref = song.pref || 'auto';
    var ki = Cifra.keyInfo(song.key, firstChordOf(song)), keyFlat = false;
    if (ki) keyFlat = Cifra.keyPrefersFlats(((ki.pc + semi) % 12 + 12) % 12, ki.minor);
    return { semi: semi, pref: pref, keyFlat: keyFlat, ki: ki };
  }
  function tomLabel(song, ctx) {
    var base = song.key || firstChordOf(song);
    if (!Cifra.parseChord(base)) return song.key || '–';
    return Cifra.transposeSym(base, ctx.semi, ctx.pref, ctx.keyFlat);
  }

  /* ---------- desenho da cifra ---------- */
  function chordRowHTML(toks, ctx, loose, absolute) {
    var out = '', pos = 0, prevEnd = 0, first = toks.length ? toks[0].col : 0;
    toks.forEach(function (k, i) {
      var raw = k.text, clean = Cifra.cleanTok(raw), isC = !!Cifra.parseChord(clean), pre = '', post = '', shown = raw;
      if (isC) {
        var at = raw.indexOf(clean); pre = raw.slice(0, at); post = raw.slice(at + clean.length);
        shown = Cifra.transposeSym(clean, ctx.semi, ctx.pref, ctx.keyFlat);
      }
      var pad;
      if (absolute) pad = Math.max(k.col - pos, i ? 1 : 0);
      else pad = i ? Math.max(loose ? 2 : 1, k.col - prevEnd) : 0;
      out += new Array(pad + 1).join(' ');
      var textLen = pre.length + shown.length + post.length;
      out += esc(pre) + (isC ? '<button class="ch" data-sym="' + esc(shown) + '">' + esc(shown) + '</button>' : esc(shown)) + esc(post);
      pos += pad + textLen;
      prevEnd = k.col + raw.length;
    });
    void first;
    return out;
  }

  function songHTML(song) {
    var ctx = ctxFor(song), lines = Cifra.parseBody(song.body), h = '';
    lines.forEach(function (l) {
      if (l.t === 'section') h += '<div class="sec">' + esc(l.text) + '</div>';
      else if (l.t === 'blank') h += '<div class="gap"></div>';
      else if (l.t === 'cl') h += '<div class="pair"><div class="cr">' + chordRowHTML(l.toks, ctx, false, true) + '</div><div class="ly">' + esc(l.lyric) + '</div></div>';
      else if (l.t === 'chords') h += '<div class="lone chl">' + chordRowHTML(l.toks, ctx, !!l.loose, false) + '</div>';
      else h += '<div class="lone' + (/^Capotraste/i.test(l.text) ? ' note' : '') + '">' + esc(l.text) + '</div>';
    });
    return h;
  }

  /* fonte: ajusta à largura da tela ou usa o tamanho escolhido */
  function longest(body) {
    var m = 0; (body || '').split('\n').forEach(function (l) { if (l.length > m) m = l.length; }); return m + 1;
  }
  function applyFont() {
    var s = $('.song'); if (!s || !S.cur) return;
    var fixed = store.get('fs', 0), size;
    if (fixed) size = fixed;
    else {
      var w = s.clientWidth || (window.innerWidth - 32);
      size = Math.max(10.5, Math.min(20, w / (longest(S.cur.body) * 0.602)));
      size = Math.floor(size * 2) / 2;
    }
    s.style.setProperty('--fs', size + 'px');
    s.dataset.fs = size;
  }

  /* ---------- barra de cima ---------- */
  function topbar(o) {
    var h = '<div class="bar">';
    if (o.back) h += '<button class="ib" data-act="back" aria-label="Voltar">' + ic('back') + '</button>';
    h += '<div class="ttl">' + (o.title ? '<b>' + esc(o.title) + '</b>' : '') + (o.sub ? '<span>' + esc(o.sub) + '</span>' : '') + '</div>';
    h += (o.right || '') + '</div>';
    $('#top').innerHTML = h;
  }
  window.addEventListener('scroll', function () { $('#top').classList.toggle('scrolled', window.scrollY > 4); }, { passive: true });

  /* ---------- telas ---------- */
  function setView(v) {
    S.view = v; stopScroll(); releaseWake(); hideCard();
    $('#dock').hidden = true; window.scrollTo(0, 0);
  }

  function showList() {
    setView('list');
    topbar({ right: '<button class="ib" data-act="menu" aria-label="Menu">' + ic('dots') + '</button>' });
    $('#view').innerHTML =
      '<h1 class="hd">Meu Repertório</h1><p class="sub" id="cnt"></p>' +
      '<div class="search"><span aria-hidden="true">' + ic('search', 20) + '</span><input id="q" type="search" placeholder="Buscar música ou artista" autocomplete="off" value="' + esc(S.q) + '"></div>' +
      '<ul class="songs" id="ul"></ul>';
    var d = $('#dock');
    d.innerHTML = '<div class="in"><button class="btn pri" data-act="new">' + ic('clip', 20) + 'Colar cifra</button><button class="btn" data-act="file">' + ic('file', 20) + 'Importar PDF</button></div>';
    d.hidden = false;
    renderList();
  }
  function renderList() {
    var q = norm(S.q), list = S.songs.filter(function (s) { return !q || norm(s.title + ' ' + s.artist).indexOf(q) >= 0; });
    list.sort(function (a, b) { return norm(a.title).localeCompare(norm(b.title)); });
    $('#cnt').textContent = S.songs.length + (S.songs.length === 1 ? ' música' : ' músicas') + ' no aparelho, funcionam sem internet';
    var ul = $('#ul');
    if (!list.length) {
      ul.innerHTML = '<li class="empty"><b>' + (S.songs.length ? 'Nada com esse nome' : 'Seu caderno está vazio') + '</b>' +
        (S.songs.length ? 'Tente outro trecho do título ou do artista.' : 'Toque em "Colar cifra" para adicionar a primeira música.') + '</li>';
      return;
    }
    ul.innerHTML = list.map(function (s) {
      var ctx = ctxFor(s);
      return '<li><a href="#musica-' + s.id + '"><span class="t">' + esc(s.title) + '</span><span class="a">' + esc(s.artist || 'Sem artista') + '</span>' +
        (s.key || firstChordOf(s) ? '<span class="k">' + esc(tomLabel(s, ctx)) + '</span>' : '') + '</a></li>';
    }).join('');
  }

  function showSong(id) {
    var song = S.songs.filter(function (s) { return s.id === id; })[0];
    if (!song) { location.replace('#lista'); return; }
    setView('song'); S.cur = song;
    topbar({ back: true, title: song.title, sub: song.artist,
      right: '<button class="ib" data-act="edit" aria-label="Editar cifra">' + ic('edit') + '</button><button class="ib" data-act="smenu" aria-label="Mais opções">' + ic('dots') + '</button>' });
    $('#view').innerHTML = '<div class="tools"><div class="in" id="tools"></div></div><div id="stripwrap"></div><div class="song" id="song"></div>';
    renderTools(); renderSong(true);
    requestWake();
  }

  function renderTools() {
    var song = S.cur, ctx = ctxFor(song), sc = S.scroll;
    var prefTxt = { auto: '♯♭ auto', sharp: '♯ sustenido', flat: '♭ bemol' }[ctx.pref];
    $('#tools').innerHTML =
      '<div class="seg" role="group" aria-label="Tom">' +
        '<button data-act="semi-" aria-label="Descer meio tom">' + ic('minus', 18) + '</button>' +
        '<button class="tomv" data-act="semi0" aria-label="Voltar ao tom original"><small>Tom' + (ctx.semi ? ' ' + (ctx.semi > 0 ? '+' : '') + ctx.semi : '') + '</small><b>' + esc(tomLabel(song, ctx)) + '</b></button>' +
        '<button data-act="semi+" aria-label="Subir meio tom">' + ic('plus', 18) + '</button></div>' +
      '<button class="pill" data-act="pref" aria-label="Alternar sustenido e bemol">' + prefTxt + '</button>' +
      '<span class="grow"></span>' +
      '<button class="pill" data-act="scroll" aria-label="' + (sc.on ? 'Pausar' : 'Rolagem automática') + '">' + (sc.on ? ic('pause', 18) : ic('play', 18)) + '</button>' +
      (sc.on ? '<div class="speed"><span>Devagar</span><input type="range" id="spd" min="1" max="10" step="1" value="' + sc.speed + '" aria-label="Velocidade da rolagem"><span>Rápido</span></div>' : '');
  }

  function renderSong(withStrip) {
    $('#song').innerHTML = songHTML(S.cur);
    applyFont();
    if (withStrip) renderStrip();
  }

  function renderStrip() {
    var w = $('#stripwrap'); if (!w) return;
    if (!S.strip) { w.innerHTML = ''; return; }
    var ctx = ctxFor(S.cur);
    var syms = Cifra.uniqueChords(Cifra.parseBody(S.cur.body)).map(function (c) { return Cifra.transposeSym(c, ctx.semi, ctx.pref, ctx.keyFlat); });
    var seen = {}; syms = syms.filter(function (s) { if (seen[s]) return false; seen[s] = 1; return true; });
    w.innerHTML = '<div class="strip">' + syms.map(function (s) { return '<button class="c" data-sym="' + esc(s) + '"><b>' + esc(s) + '</b><span class="mini"></span></button>'; }).join('') + '</div>';
    var btns = Array.prototype.slice.call(w.querySelectorAll('.c')), i = 0, token = S.cur.id + ':' + S.cur.semi + S.cur.pref;
    w._tok = token;
    (function next() {
      if (w._tok !== token || i >= btns.length) return;
      var b = btns[i++], v = Cifra.voicingsFor(b.getAttribute('data-sym'), 6), pick = v[prefIdx(b.getAttribute('data-sym'), v.length)];
      if (pick) b.querySelector('.mini').innerHTML = chordSVG(pick);
      setTimeout(next, 0);
    })();
  }

  /* ---------- cartão do acorde ---------- */
  var card = { sym: null, idx: 0, anchor: null, mode: 'pop' };
  function prefIdx(sym, n) { var m = store.get('var', {}); var i = m[sym] || 0; return i < n ? i : 0; }
  function paintCard() {
    var vs = Cifra.voicingsFor(card.sym, 6), cc = $('#cc');
    if (!vs.length) { cc.innerHTML = '<div class="cc-top"><strong>' + esc(card.sym) + '</strong><span>Sem posição para este acorde</span></div>'; return; }
    var v = vs[card.idx];
    cc.innerHTML =
      '<div class="cc-top"><strong>' + esc(card.sym) + '</strong><span>' + (card.idx + 1) + ' de ' + vs.length + (v.approx ? ' · aproximada' : '') + '</span>' +
      '<button class="ib" style="width:36px;height:36px" data-act="cc-close" aria-label="Fechar">' + ic('x', 18) + '</button></div>' +
      '<div class="cc-main"><button class="ib" data-act="cc-prev" aria-label="Posição anterior">' + ic('l') + '</button><div class="cc-fig">' + chordSVG(v) + '</div><button class="ib" data-act="cc-next" aria-label="Próxima posição">' + ic('r') + '</button></div>' +
      '<div class="cc-notes">' + (v.omitted && v.omitted.length ? 'sem ' + esc(v.omitted.join(', ')) : '') + '</div>' +
      '<div class="cc-all">' + vs.map(function (x, i) { return '<button data-i="' + i + '" class="' + (i === card.idx ? 'on' : '') + '" aria-label="Posição ' + (i + 1) + '">' + chordSVG(x) + '</button>'; }).join('') + '</div>';
  }
  function placeCard() {
    var cc = $('#cc');
    if (card.mode === 'sheet') { cc.classList.add('sheet'); cc.style.left = cc.style.top = ''; return; }
    cc.classList.remove('sheet');
    var r = card.anchor.getBoundingClientRect(), w = cc.offsetWidth, h = cc.offsetHeight;
    var left = Math.max(8, Math.min(window.innerWidth - w - 8, r.left - 12));
    var top = r.bottom + 8; if (top + h > window.innerHeight - 8) top = Math.max(8, r.top - h - 8);
    cc.style.left = left + 'px'; cc.style.top = top + 'px';
  }
  function showCard(sym, anchor) {
    var vs = Cifra.voicingsFor(sym, 6);
    card.sym = sym; card.anchor = anchor; card.mode = HOVER ? 'pop' : 'sheet';
    card.idx = vs.length ? prefIdx(sym, vs.length) : 0;
    document.querySelectorAll('.ch.on').forEach(function (e) { e.classList.remove('on'); });
    if (anchor && anchor.classList.contains('ch')) anchor.classList.add('on');
    $('#cc').hidden = false; $('#ccb').hidden = card.mode !== 'sheet';
    paintCard(); placeCard();
  }
  function hideCard() {
    $('#cc').hidden = true; $('#ccb').hidden = true; card.sym = null;
    document.querySelectorAll('.ch.on').forEach(function (e) { e.classList.remove('on'); });
  }
  function stepCard(d) {
    var n = Cifra.voicingsFor(card.sym, 6).length; if (!n) return;
    card.idx = (card.idx + d + n) % n; var m = store.get('var', {}); m[card.sym] = card.idx; store.set('var', m);
    paintCard(); placeCard(); if (S.view === 'song') renderStrip();
  }
  var hoverT;
  document.addEventListener('mouseover', function (e) {
    if (!HOVER) return;
    var c = e.target.closest && e.target.closest('.ch');
    if (c) { clearTimeout(hoverT); hoverT = setTimeout(function () { showCard(c.getAttribute('data-sym'), c); }, 140); }
    else if (e.target.closest && e.target.closest('#cc')) clearTimeout(hoverT);
  });
  document.addEventListener('mouseout', function (e) {
    if (!HOVER || !card.sym || card.pinned) return;
    var to = e.relatedTarget;
    if (to && to.closest && (to.closest('#cc') || to.closest('.ch'))) return;
    clearTimeout(hoverT); hoverT = setTimeout(hideCard, 220);
  });
  window.addEventListener('scroll', function () { if (card.sym && card.mode === 'pop') hideCard(); }, { passive: true });
  window.addEventListener('keydown', function (e) { if (e.key === 'Escape') { hideCard(); closeSheet(); } });

  /* ---------- rolagem automática e tela acesa ---------- */
  var raf = 0, last = 0, acc = 0, wake = null;
  var SPEEDS = [6, 10, 15, 21, 28, 37, 48, 62, 80, 100];
  function loop(t) {
    if (!S.scroll.on) return;
    var dt = Math.min(0.1, (t - (last || t)) / 1000); last = t;
    acc += SPEEDS[S.scroll.speed - 1] * dt;
    var n = Math.floor(acc);
    if (n) { window.scrollBy(0, n); acc -= n; }
    if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2) { stopScroll(); if (S.view === 'song') renderTools(); return; }
    raf = requestAnimationFrame(loop);
  }
  function startScroll() { S.scroll.on = true; last = 0; acc = 0; cancelAnimationFrame(raf); raf = requestAnimationFrame(loop); }
  function stopScroll() { S.scroll.on = false; cancelAnimationFrame(raf); }
  ['touchstart', 'wheel'].forEach(function (ev) {
    window.addEventListener(ev, function () { if (S.scroll.on && S.view === 'song') { stopScroll(); renderTools(); } }, { passive: true });
  });
  function requestWake() { try { if (navigator.wakeLock) navigator.wakeLock.request('screen').then(function (l) { wake = l; }, function () {}); } catch (e) {} }
  function releaseWake() { try { if (wake) wake.release(); } catch (e) {} wake = null; }
  document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible' && S.view === 'song' && !wake) requestWake(); });

  /* ---------- salvar preferências da música ---------- */
  var saveT;
  function persistCur() {
    clearTimeout(saveT);
    saveT = setTimeout(function () { if (S.cur) DB.put(S.cur); }, 300);
  }

  /* ---------- editor ---------- */
  function showEditor(id) {
    var song = id ? S.songs.filter(function (s) { return s.id === id; })[0] : null;
    if (id && !song) { location.replace('#lista'); return; }
    setView('edit');
    var d = song ? { id: song.id, title: song.title, artist: song.artist, key: song.key, body: song.body, pdf: song.pdf, pdfPath: song.pdfPath, createdAt: song.createdAt, semi: song.semi, pref: song.pref, report: null, editing: true }
      : (S.draft || { id: uid(), title: '', artist: '', key: '', body: '', report: null, editing: false });
    S.draft = d;
    topbar({ back: true, title: song ? 'Editar cifra' : 'Nova cifra', right: '<button class="btn pri sm" data-act="save">Salvar</button>' });
    $('#view').innerHTML =
      (d.editing ? '' : '<p class="hint">Copie a cifra inteira no site, do título até o último acorde, e cole abaixo. O caderno separa título, artista e tom e arruma o texto sozinho. Depois é só conferir e salvar.</p>' +
        '<div class="acts"><button class="btn" data-act="paste">' + ic('clip', 20) + 'Colar da área de transferência</button><button class="btn" data-act="file">' + ic('file', 20) + 'Escolher PDF ou TXT</button></div>') +
      '<div class="row3"><div class="field"><label for="f-title">Título</label><input id="f-title" value="' + esc(d.title) + '" autocomplete="off"></div>' +
      '<div class="field"><label for="f-artist">Artista</label><input id="f-artist" value="' + esc(d.artist) + '" autocomplete="off"></div>' +
      '<div class="field"><label for="f-key">Tom</label><input id="f-key" value="' + esc(d.key) + '" autocomplete="off" placeholder="Am"></div></div>' +
      '<div class="err" id="err"></div>' +
      '<div class="field"><label for="f-body">Cifra</label><textarea id="f-body" class="body" spellcheck="false" autocapitalize="off" placeholder="Cole aqui a cifra completa">' + esc(d.body) + '</textarea></div>' +
      '<div id="rep"></div>' +
      '<div class="acts"><button class="btn sm" data-act="tidy">Organizar de novo</button>' +
      (d.editing && (d.pdf || d.pdfPath) ? '<button class="btn sm" data-act="openpdf">' + ic('file', 18) + 'Abrir PDF original</button>' : '') +
      (d.editing ? '<button class="btn sm warn" data-act="del">' + ic('trash', 18) + 'Excluir cifra</button>' : '') + '</div>' +
      '<section class="prev"><h2>Prévia (toque num acorde para ver o desenho)</h2><div class="song" id="song"></div></section>';
    paintReport(); previewDraft();
    $('#f-body').addEventListener('input', function () { clearTimeout(previewDraft.t); previewDraft.t = setTimeout(previewDraft, 160); });
    $('#f-body').addEventListener('paste', function (e) {
      var ta = e.target;
      if (ta.value.trim()) return;
      var txt = (e.clipboardData || window.clipboardData).getData('text');
      if (txt) { e.preventDefault(); applyImport(txt); }
    });
    if (!d.editing && !d.body) setTimeout(function () { var b = $('#f-body'); if (b && HOVER) b.focus(); }, 50);
  }
  function readDraft() {
    var d = S.draft; if (!d || !$('#f-body')) return d;
    d.title = $('#f-title').value.trim(); d.artist = $('#f-artist').value.trim(); d.key = $('#f-key').value.trim(); d.body = $('#f-body').value;
    return d;
  }
  function paintReport() {
    var d = S.draft, r = d && d.report, el = $('#rep'); if (!el) return;
    if (!r) { el.innerHTML = ''; return; }
    var bits = [];
    if (r.glued) bits.push(r.glued + (r.glued > 1 ? ' acordes colados na letra separados' : ' acorde colado na letra separado'));
    if (r.joined) bits.push(r.joined + (r.joined > 1 ? ' linhas quebradas juntadas' : ' linha quebrada juntada'));
    if (r.removed) bits.push(r.removed + ' linhas de cabeçalho tiradas do corpo');
    el.innerHTML = '<div class="rep"><b>Cifra organizada.</b> ' + (bits.length ? esc(bits.join(', ')) + '. ' : '') + 'Confira a prévia e corrija o que precisar antes de salvar.</div>';
  }
  function previewDraft() {
    var d = readDraft(); if (!d) return;
    var el = $('#song'); if (!el) return;
    var tmp = { body: d.body, key: d.key, semi: 0, pref: 'auto' };
    S.cur = tmp;
    el.innerHTML = songHTML(tmp); applyFont();
  }
  function applyImport(text, pdfBlob) {
    var r = Cifra.importText(text), d = readDraft() || S.draft;
    d.title = r.title || d.title; d.artist = r.artist || d.artist; d.key = r.key || d.key; d.body = r.body; d.report = r.report;
    if (pdfBlob) d.pdf = pdfBlob;
    S.draft = d;
    if ($('#f-body')) { $('#f-title').value = d.title; $('#f-artist').value = d.artist; $('#f-key').value = d.key; $('#f-body').value = d.body; paintReport(); previewDraft(); }
  }
  function saveDraft() {
    var d = readDraft();
    if (!d.title) { $('#err').textContent = 'Dê um título para a música.'; $('#f-title').focus(); return; }
    if (!d.body.trim()) { $('#err').textContent = 'A cifra está vazia.'; $('#f-body').focus(); return; }
    var old = S.songs.filter(function (s) { return s.id === d.id; })[0];
    var song = { id: d.id, title: d.title, artist: d.artist, key: d.key, body: d.body.replace(/\s+$/, ''), createdAt: d.createdAt || Date.now(), updatedAt: Date.now(), semi: old ? old.semi || 0 : 0, pref: old ? old.pref || 'auto' : 'auto' };
    if (d.pdf) song.pdf = d.pdf;
    if (d.pdfPath) song.pdfPath = d.pdfPath;
    DB.put(song).then(loadSongs).then(function () { S.draft = null; toast('Cifra salva'); location.replace('#musica-' + song.id); });
  }

  /* ---------- importar arquivos ---------- */
  function loadPdfjs() {
    if (window.pdfjsLib) return Promise.resolve(window.pdfjsLib);
    return new Promise(function (res, rej) {
      var s = document.createElement('script'), inl = document.getElementById('pdfjs-src');
      function done() {
        var w = document.getElementById('pdfjs-worker');
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = w ? URL.createObjectURL(new Blob([w.textContent], { type: 'text/javascript' })) : 'vendor/pdf.worker.min.js';
        res(window.pdfjsLib);
      }
      if (inl) { s.textContent = inl.textContent; document.head.appendChild(s); done(); }
      else { s.src = 'vendor/pdf.min.js'; s.onload = done; s.onerror = function () { rej(new Error('pdf')); }; document.head.appendChild(s); }
    });
  }
  function pdfToText(file) {
    return loadPdfjs().then(function (lib) {
      return file.arrayBuffer().then(function (buf) { return lib.getDocument({ data: buf }).promise; });
    }).then(function (pdf) {
      var jobs = [];
      for (var p = 1; p <= pdf.numPages; p++) jobs.push(pdf.getPage(p).then(function (pg) { return pg.getTextContent(); }));
      return Promise.all(jobs);
    }).then(function (pages) {
      var widths = [];
      pages.forEach(function (tc) { tc.items.forEach(function (it) { if (it.str && it.str.length >= 3 && it.width) widths.push(it.width / it.str.length); }); });
      widths.sort(function (a, b) { return a - b; });
      var cw = widths.length ? widths[Math.floor(widths.length / 2)] : 6;
      var all = [];
      pages.forEach(function (tc) {
        var rows = [];
        tc.items.forEach(function (it) {
          if (!it.str || !it.str.trim()) return;
          var y = it.transform[5], x = it.transform[4], row = null;
          for (var i = 0; i < rows.length; i++) if (Math.abs(rows[i].y - y) < 2.5) { row = rows[i]; break; }
          if (!row) { row = { y: y, items: [] }; rows.push(row); }
          row.items.push({ x: x, s: it.str });
        });
        rows.sort(function (a, b) { return b.y - a.y; });
        var minX = Math.min.apply(null, rows.map(function (r) { return Math.min.apply(null, r.items.map(function (i) { return i.x; })); }));
        rows.forEach(function (r) {
          r.items.sort(function (a, b) { return a.x - b.x; });
          var line = '';
          r.items.forEach(function (it) {
            var col = Math.round((it.x - minX) / cw);
            if (col <= line.length && line.length) col = line.length + (/\s$/.test(line) || /^\s/.test(it.s) ? 0 : 0);
            while (line.length < col) line += ' ';
            line += it.s;
          });
          all.push(line.replace(/\s+$/, ''));
        });
      });
      return all.filter(function (l) {
        return !/https?:\/\//i.test(l) && !/www\./i.test(l) && !/^\s*\d+\s*\/\s*\d+\s*$/.test(l) && !/^\s*\d{1,2}\/\d{1,2}\/\d{2,4}[,\s].*\d{1,2}:\d{2}/.test(l);
      }).join('\n');
    });
  }
  function readText(file) { return file.text(); }
  function handleFiles(files) {
    files = Array.prototype.slice.call(files || []); if (!files.length) return;
    if (files.length === 1 && /\.json$/i.test(files[0].name)) { restoreBackup(files[0]); return; }
    toast('Lendo ' + (files.length > 1 ? files.length + ' arquivos…' : 'arquivo…'));
    var jobs = files.map(function (f) {
      var isPdf = /\.pdf$/i.test(f.name) || f.type === 'application/pdf';
      return (isPdf ? pdfToText(f) : readText(f)).then(function (t) { return { text: t, pdf: isPdf ? f : null, name: f.name }; })
        .catch(function () { return { error: true, name: f.name }; });
    });
    Promise.all(jobs).then(function (rs) {
      var good = rs.filter(function (r) { return !r.error && r.text && r.text.trim(); }), bad = rs.length - good.length;
      if (!good.length) { toast('Não consegui ler o texto desse arquivo.'); return; }
      if (files.length === 1) {
        var r = good[0];
        S.draft = { id: uid(), title: '', artist: '', key: '', body: '', report: null, editing: false };
        var imp = Cifra.importText(r.text);
        if (!imp.title) imp.title = r.name.replace(/\.[^.]+$/, '');
        S.draft.title = imp.title; S.draft.artist = imp.artist; S.draft.key = imp.key; S.draft.body = imp.body; S.draft.report = imp.report;
        if (r.pdf) S.draft.pdf = r.pdf;
        if (location.hash === '#nova') showEditor(null); else location.hash = '#nova';
        return;
      }
      var saves = good.map(function (r) {
        var imp = Cifra.importText(r.text);
        return DB.put({ id: uid(), title: imp.title || r.name.replace(/\.[^.]+$/, ''), artist: imp.artist, key: imp.key, body: imp.body, createdAt: Date.now(), updatedAt: Date.now(), semi: 0, pref: 'auto', pdf: r.pdf || undefined });
      });
      Promise.all(saves).then(loadSongs).then(function () {
        toast(good.length + ' músicas importadas' + (bad ? ', ' + bad + ' sem texto legível' : '')); showList();
      });
    });
  }

  /* ---------- backup ---------- */
  function blobToDataURL(b) { return new Promise(function (res, rej) { var r = new FileReader(); r.onload = function () { res(r.result); }; r.onerror = rej; r.readAsDataURL(b); }); }
  function exportBackup() {
    DB.all().then(function (songs) {
      return Promise.all(songs.map(function (s) {
        var c = Object.assign({}, s);
        if (c.pdf instanceof Blob) return blobToDataURL(c.pdf).then(function (u) { c.pdf = u; return c; });
        if (c.pdfPath && window.MeuRepertorioCloud) return window.MeuRepertorioCloud.downloadPdf(c.pdfPath).then(function (b) { return b ? blobToDataURL(b).then(function (u) { c.pdf = u; return c; }) : c; });
        return Promise.resolve(c);
      }));
    }).then(function (list) {
      var blob = new Blob([JSON.stringify({ app: 'meu-repertorio', v: 1, songs: list })], { type: 'application/json' });
      var a = document.createElement('a'); a.href = URL.createObjectURL(blob);
      a.download = 'meu-repertorio-' + new Date().toISOString().slice(0, 10) + '.json';
      document.body.appendChild(a); a.click(); a.remove(); toast('Backup gerado');
    });
  }
  function restoreBackup(file) {
    file.text().then(function (t) {
      var j = JSON.parse(t); if (!j || !Array.isArray(j.songs)) throw new Error('fmt');
      return Promise.all(j.songs.map(function (s) {
        if (typeof s.pdf === 'string') return fetch(s.pdf).then(function (r) { return r.blob(); }).then(function (b) { s.pdf = b; return DB.put(s); });
        return DB.put(s);
      })).then(function () { return j.songs.length; });
    }).then(function (n) { return loadSongs().then(function () { toast(n + ' músicas restauradas'); showList(); }); })
      .catch(function () { toast('Esse arquivo não parece um backup do caderno.'); });
  }

  /* ---------- menus ---------- */
  var installEv = null;
  window.addEventListener('beforeinstallprompt', function (e) { e.preventDefault(); installEv = e; });
  function openSheet(html) { var s = $('#sheet'); s.className = 'sheetb'; s.innerHTML = '<div class="shd" role="dialog">' + html + '</div>'; s.hidden = false; }
  function closeSheet() { var s = $('#sheet'); s.hidden = true; s.innerHTML = ''; }
  $('#sheet').addEventListener('click', function (e) { if (e.target === this) closeSheet(); });
  function themeLabel() { return { auto: 'Automático', light: 'Claro', dark: 'Escuro' }[store.get('theme', 'auto')]; }
  function menuList() {
    openSheet('<h3>Meu Repertório</h3>' +
      '<button data-act="cloud">' + ic('up') + 'Sincronizar na nuvem<small>' + (window.MeuRepertorioCloud ? window.MeuRepertorioCloud.statusLabel() : 'indisponível') + '</small></button>' +
      '<button data-act="theme">' + ic('moon') + 'Tema<small>' + themeLabel() + '</small></button>' +
      '<button data-act="export">' + ic('down') + 'Salvar backup (arquivo)</button>' +
      '<button data-act="restore">' + ic('up') + 'Restaurar backup</button>' +
      (installEv ? '<button data-act="install">' + ic('phone') + 'Instalar no aparelho</button>' : ''));
  }
  function cloudMenu() {
    var c = window.MeuRepertorioCloud, user = c && c.getUser(), h = '<h3>Sincronização</h3>';
    if (!c || !c.isConfigured()) { openSheet(h + '<p>A sincronização na nuvem ainda não está configurada.</p>'); return; }
    if (user) {
      h += '<p>Conectado como <b>' + esc(user.email || 'sua conta') + '</b>.</p>';
      h += '<button data-act="cloud-sync">' + ic('up') + 'Sincronizar agora</button>';
      h += '<button data-act="cloud-logout">' + ic('x') + 'Sair desta conta</button>';
    } else {
      h += '<p>Digite seu e-mail. Você receberá um link para entrar sem senha.</p>';
      h += '<input id="cloud-email" type="email" placeholder="seu@email.com" autocomplete="email">';
      h += '<button data-act="cloud-login">' + ic('up') + 'Enviar link de acesso</button>';
    }
    openSheet(h);
  }
  function menuSong() {
    var fs = Number($('.song') && $('.song').dataset.fs) || 14;
    openSheet('<h3>Texto</h3>' +
      '<button data-act="fs-">' + ic('type', 18) + 'Letra menor<small>' + fs + ' px</small></button>' +
      '<button data-act="fs+">' + ic('type', 24) + 'Letra maior</button>' +
      '<button data-act="fsfit">' + ic('fit') + 'Ajustar à largura da tela</button>' +
      '<button data-act="strip">' + ic('play', 18) + (S.strip ? 'Esconder faixa de acordes' : 'Mostrar faixa de acordes') + '</button>' +
      ((S.cur.pdf || S.cur.pdfPath) ? '<button data-act="openpdf">' + ic('file') + 'Abrir PDF original</button>' : '') +
      '<h3>Aparência</h3><button data-act="theme">' + ic('moon') + 'Tema<small>' + themeLabel() + '</small></button>');
  }

  function openPdf(song) {
    if (!song) return;
    var ready = function (blob) { if (!blob) { toast('PDF original indisponível'); return; } var u = URL.createObjectURL(blob); window.open(u, '_blank') || (location.href = u); };
    if (song.pdf instanceof Blob) { ready(song.pdf); return; }
    if (song.pdfPath && window.MeuRepertorioCloud) { toast('Baixando PDF…'); window.MeuRepertorioCloud.downloadPdf(song.pdfPath).then(function (b) { if (b) song.pdf = b; ready(b); }); return; }
    toast('PDF original indisponível');
  }

  /* ---------- cliques ---------- */
  document.addEventListener('click', function (e) {
    var ch = e.target.closest && e.target.closest('.ch, .strip .c');
    if (ch) { if (HOVER && ch.classList.contains('ch') && card.sym === ch.getAttribute('data-sym')) { card.pinned = true; return; } card.pinned = !!HOVER; showCard(ch.getAttribute('data-sym'), ch); return; }
    var th = e.target.closest && e.target.closest('.cc-all button');
    if (th) { card.idx = +th.getAttribute('data-i'); var m = store.get('var', {}); m[card.sym] = card.idx; store.set('var', m); paintCard(); placeCard(); if (S.view === 'song') renderStrip(); return; }
    var b = e.target.closest && e.target.closest('[data-act]');
    if (!b) { if (card.sym && card.mode === 'pop' && !e.target.closest('#cc')) { card.pinned = false; hideCard(); } return; }
    var a = b.getAttribute('data-act'), cur = S.cur;
    function touch() { persistCur(); renderTools(); renderSong(true); }
    switch (a) {
      case 'back': if (history.length > 1 && S.view !== 'list') history.back(); else location.hash = '#lista'; break;
      case 'menu': menuList(); break;
      case 'cloud': cloudMenu(); break;
      case 'cloud-sync': closeSheet(); if (window.MeuRepertorioCloud) window.MeuRepertorioCloud.syncNow().then(function (r) { toast(r && r.ok ? 'Repertório sincronizado' : 'Não foi possível sincronizar agora'); }); break;
      case 'cloud-logout': closeSheet(); if (window.MeuRepertorioCloud) window.MeuRepertorioCloud.signOut().then(function () { toast('Sessão encerrada'); }); break;
      case 'cloud-login':
        var email = ($('#cloud-email') || {}).value || '';
        if (!email.trim()) { toast('Digite seu e-mail'); break; }
        if (window.MeuRepertorioCloud) window.MeuRepertorioCloud.signIn(email.trim()).then(function (r) { if (r && r.error) toast(r.error); else { closeSheet(); toast('Link de acesso enviado para seu e-mail'); } });
        break;
      case 'smenu': menuSong(); break;
      case 'new': S.draft = null; location.hash = '#nova'; break;
      case 'file': closeSheet(); $('#pick').click(); break;
      case 'edit': location.hash = '#editar-' + cur.id; break;
      case 'semi+': cur.semi = (((cur.semi || 0) + 1 + 5) % 12) - 5; touch(); break;
      case 'semi-': cur.semi = (((cur.semi || 0) - 1 + 5 + 12) % 12) - 5; touch(); break;
      case 'semi0': cur.semi = 0; touch(); break;
      case 'pref': cur.pref = { auto: 'sharp', sharp: 'flat', flat: 'auto' }[cur.pref || 'auto']; touch(); break;
      case 'scroll': if (S.scroll.on) stopScroll(); else startScroll(); renderTools(); break;
      case 'cc-close': card.pinned = false; hideCard(); break;
      case 'cc-prev': stepCard(-1); break;
      case 'cc-next': stepCard(1); break;
      case 'theme': var order = ['auto', 'light', 'dark'], t = store.get('theme', 'auto'); store.set('theme', order[(order.indexOf(t) + 1) % 3]); applyTheme(); b.querySelector('small').textContent = themeLabel(); break;
      case 'export': closeSheet(); exportBackup(); break;
      case 'restore': closeSheet(); $('#pick').click(); break;
      case 'install': closeSheet(); if (installEv) { installEv.prompt(); installEv = null; } break;
      case 'fs-': case 'fs+': var now = Number($('.song').dataset.fs) || 14; store.set('fs', Math.max(9, Math.min(30, now + (a === 'fs+' ? 1 : -1)))); applyFont(); b.querySelector('small') && (b.querySelector('small').textContent = $('.song').dataset.fs + ' px'); break;
      case 'fsfit': store.set('fs', 0); applyFont(); closeSheet(); break;
      case 'strip': S.strip = !S.strip; store.set('strip', S.strip); closeSheet(); renderStrip(); break;
      case 'openpdf': closeSheet(); openPdf(S.view === 'edit' ? S.draft : cur); break;
      case 'paste':
        if (navigator.clipboard && navigator.clipboard.readText) navigator.clipboard.readText().then(function (t) { if (t && t.trim()) applyImport(t); else toast('A área de transferência está vazia.'); }, function () { toast('O navegador não deixou ler. Toque no campo da cifra e cole.'); $('#f-body').focus(); });
        else { toast('Toque no campo da cifra e cole.'); $('#f-body').focus(); }
        break;
      case 'tidy': var dd = readDraft(); applyImport(dd.body); toast('Cifra organizada'); break;
      case 'save': saveDraft(); break;
      case 'del':
        if (b.dataset.sure) { var id = S.draft.id; DB.del(id).then(loadSongs).then(function () { S.draft = null; toast('Cifra excluída'); location.replace('#lista'); }); }
        else { b.dataset.sure = '1'; b.lastChild.textContent = 'Toque de novo para excluir'; setTimeout(function () { if (b.isConnected) { delete b.dataset.sure; b.lastChild.textContent = 'Excluir cifra'; } }, 4000); }
        break;
    }
  });
  document.addEventListener('input', function (e) {
    if (e.target.id === 'q') { S.q = e.target.value; renderList(); }
    else if (e.target.id === 'spd') { S.scroll.speed = +e.target.value; store.set('speed', S.scroll.speed); }
    else if (e.target.id === 'f-title' || e.target.id === 'f-key') { var er = $('#err'); if (er) er.textContent = ''; if (e.target.id === 'f-key') previewDraft(); }
  });
  $('#ccb').addEventListener('click', function () { hideCard(); });
  $('#pick').addEventListener('change', function (e) { var f = e.target.files; handleFiles(f); e.target.value = ''; });
  window.addEventListener('resize', function () { if ($('.song')) applyFont(); if (card.sym) placeCard(); });
  document.addEventListener('dragover', function (e) { e.preventDefault(); });
  document.addEventListener('drop', function (e) { if (e.dataTransfer && e.dataTransfer.files.length) { e.preventDefault(); handleFiles(e.dataTransfer.files); } });

  /* ---------- rotas ---------- */
  function route() {
    var h = location.hash.replace(/^#/, '');
    if (h.indexOf('musica-') === 0) showSong(h.slice(7));
    else if (h === 'nova') showEditor(null);
    else if (h.indexOf('editar-') === 0) showEditor(h.slice(7));
    else showList();
  }
  window.addEventListener('hashchange', route);

  function loadSongs() { return DB.all().then(function (l) { S.songs = l || []; }); }

  function seedIfNew() {
    if (store.get('seeded', false) || S.songs.length || !window.CIFRA_SEED) return Promise.resolve();
    var jobs = window.CIFRA_SEED.map(function (raw, i) {
      var r = Cifra.importText(raw);
      return DB.put({ id: 'ex' + i, title: r.title, artist: r.artist, key: r.key, body: r.body, createdAt: Date.now() - i, updatedAt: Date.now(), semi: 0, pref: 'auto' });
    });
    return Promise.all(jobs).then(function () { store.set('seeded', true); return loadSongs(); });
  }

  loadSongs().then(seedIfNew).then(function () {
    route();
    if (window.MeuRepertorioCloud) window.MeuRepertorioCloud.start({
      getSongs: function () { return DB.all(); },
      put: function (song, silent) { return DB.put(song, silent); },
      del: function (id, silent) { return DB.del(id, silent); },
      reload: function () { return loadSongs().then(function () { if (S.view === 'list') renderList(); }); },
      onStatus: function () { if (S.view === 'list' && $('#cnt')) renderList(); }
    });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { if ($('.song')) applyFont(); });
  });

  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
    try { navigator.serviceWorker.register('sw.js').catch(function () {}); } catch (e) {}
  }
  window.__cifras = { S: S, DB: DB, handleFiles: handleFiles, pdfToText: pdfToText };
})();
