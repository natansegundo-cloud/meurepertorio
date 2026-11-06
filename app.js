/* Caderno de Cifras: biblioteca, cifra, edição, importação e acordes. Tudo local (IndexedDB). */
(function () {
  'use strict';
  var Cifra = window.Cifra;
  var MusicParser = window.MusicParser;
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
  var mem = {}, memSetlists = {}, useMem = false, dbp = null;
  function openDB() {
    if (!dbp) dbp = new Promise(function (res, rej) {
      try {
        /* A versão 3 também migra o protótipo v2 que usava "repertoires". */
        var r = indexedDB.open('caderno-cifras', 3);
        r.onupgradeneeded = function (e) {
          var db = r.result;
          if (!db.objectStoreNames.contains('songs')) db.createObjectStore('songs', { keyPath: 'id' });
          if (!db.objectStoreNames.contains('setlists')) db.createObjectStore('setlists', { keyPath: 'id' });
          if (db.objectStoreNames.contains('repertoires') && e.oldVersion < 3) {
            var oldStore = r.transaction.objectStore('repertoires'), newStore = r.transaction.objectStore('setlists');
            oldStore.openCursor().onsuccess = function (ev) {
              var c = ev.target.result;
              if (c) { newStore.put(c.value); c.continue(); }
            };
          }
        };
        r.onsuccess = function () { res(r.result); };
        r.onerror = function () { rej(r.error); };
      } catch (e) { rej(e); }
    });
    return dbp;
  }
  function tx(storeName, mode, fn) {
    if (useMem) return Promise.resolve(fn(null, true));
    return openDB().then(function (db) {
      return new Promise(function (res, rej) {
        var t = db.transaction(storeName, mode), rq = fn(t.objectStore(storeName));
        t.oncomplete = function () { res(rq && rq.result); };
        t.onerror = t.onabort = function () { rej(t.error); };
      });
    }).catch(function () { useMem = true; return fn(null, true); });
  }
  var DB = {
    all: function () { return tx('songs', 'readonly', function (s, m) { return m ? Object.keys(mem).map(function (k) { return mem[k]; }) : s.getAll(); }); },
    put: function (o, silent) { var p = tx('songs', 'readwrite', function (s, m) { if (m) { mem[o.id] = o; return null; } return s.put(o); }); if (!silent && window.MeuRepertorioCloud) window.MeuRepertorioCloud.queueUpsert(o); return p; },
    del: function (id, silent) { var p = tx('songs', 'readwrite', function (s, m) { if (m) { delete mem[id]; return null; } return s.delete(id); }); if (!silent && window.MeuRepertorioCloud) window.MeuRepertorioCloud.queueDelete(id); return p; },
    allRepertoires: function () { return tx('setlists', 'readonly', function (s, m) { return m ? Object.keys(memSetlists).map(function (k) { return memSetlists[k]; }) : s.getAll(); }); },
    putRepertoire: function (o, silent) { var p = tx('setlists', 'readwrite', function (s, m) { if (m) { memSetlists[o.id] = o; return null; } return s.put(o); }); if (!silent && window.MeuRepertorioCloud && window.MeuRepertorioCloud.queueRepertoireUpsert) window.MeuRepertorioCloud.queueRepertoireUpsert(o); return p; }
  };

  /* ---------- estado ---------- */
  var S = { songs: [], repertoires: [], q: '', repQ: '', draft: null, repDraft: null, repDeleteConfirm: null, show: null, cur: null, view: '', libraryTab: 'songs', scroll: { on: false, speed: store.get('speed', 3) }, strip: store.get('strip', true) };
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
        var at = raw.indexOf(clean);
        if (at >= 0) { pre = raw.slice(0, at); post = raw.slice(at + clean.length); }
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

  function structuredSongHTML(song, ctx) {
    var lines = song.structure && Array.isArray(song.structure.lines) ? song.structure.lines : [], h = '';
    lines.forEach(function (line) {
      var toks = (line.chords || []).map(function (item) { return { col: Number(item.position) || 0, text: item.symbol }; });
      if (line.kind === 'section') h += '<div class="sec">' + esc(line.label) + '</div>';
      else if (line.kind === 'blank') h += '<div class="gap"></div>';
      else if (line.kind === 'chord-lyric') h += '<div class="pair"><div class="cr">' + chordRowHTML(toks, ctx, false, true) + '</div><div class="ly">' + esc(line.lyric || '') + '</div></div>';
      else if (line.kind === 'chords') h += '<div class="lone chl">' + chordRowHTML(toks, ctx, !!line.loose, false) + '</div>';
      else h += '<div class="lone' + (/^Capotraste/i.test(line.text || '') ? ' note' : '') + '">' + esc(line.text || '') + '</div>';
    });
    return h;
  }
  function songHTML(song) {
    var ctx = ctxFor(song), lines = song.structure && Array.isArray(song.structure.lines) ? null : Cifra.parseBody(song.body), h = '';
    if (song.structure && Array.isArray(song.structure.lines)) return structuredSongHTML(song, ctx);
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
    document.body.classList.toggle('show-mode', v === 'show');
    $('#dock').hidden = true; window.scrollTo(0, 0);
  }

  function showList(tab) {
    setView('list');
    S.libraryTab = tab || S.libraryTab || 'songs';
    topbar({ right: '<button class="ib" data-act="menu" aria-label="Menu">' + ic('dots') + '</button>' });
    $('#view').innerHTML =
      '<h1 class="hd">Meu Repertório</h1><p class="sub" id="cnt"></p>' +
      '<div class="tabs" role="tablist"><button data-act="tab-songs" class="' + (S.libraryTab === 'songs' ? 'on' : '') + '" role="tab" aria-selected="' + (S.libraryTab === 'songs') + '">Músicas</button><button data-act="tab-repertoires" class="' + (S.libraryTab === 'repertoires' ? 'on' : '') + '" role="tab" aria-selected="' + (S.libraryTab === 'repertoires') + '">Repertórios</button></div>' +
      '<div id="library"></div>';
    var d = $('#dock');
    d.innerHTML = S.libraryTab === 'songs' ? '<div class="in"><button class="btn pri" data-act="new">' + ic('clip', 20) + 'Colar cifra</button><button class="btn" data-act="file">' + ic('file', 20) + 'Importar PDF</button></div>' : '<div class="in"><button class="btn pri" data-act="new-repertoire">' + ic('plus', 20) + 'Novo repertório</button></div>';
    d.hidden = false;
    renderLibrary();
  }
  function renderLibrary() { if (S.libraryTab === 'repertoires') renderRepertoireList(); else renderList(); }
  function renderList() {
    var q = norm(S.q), list = S.songs.filter(function (s) { return !q || norm(s.title + ' ' + s.artist).indexOf(q) >= 0; });
    list.sort(function (a, b) { return norm(a.title).localeCompare(norm(b.title)); });
    var lib = $('#library'); if (!lib) return;
    lib.innerHTML = '<div class="search"><span aria-hidden="true">' + ic('search', 20) + '</span><input id="q" type="search" placeholder="Buscar música ou artista" autocomplete="off" value="' + esc(S.q) + '"></div><ul class="songs" id="ul"></ul>';
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

  function renderRepertoireList() {
    var q = norm(S.repQ), list = S.repertoires.filter(function (r) { return !r.deleted && (!q || norm(r.name).indexOf(q) >= 0); });
    list.sort(function (a, b) { return norm(a.name).localeCompare(norm(b.name)); });
    var lib = $('#library'); if (!lib) return;
    $('#cnt').textContent = S.repertoires.filter(function (r) { return !r.deleted; }).length + ' repertórios salvos neste aparelho';
    lib.innerHTML = '<div class="search"><span aria-hidden="true">' + ic('search', 20) + '</span><input id="repq" type="search" placeholder="Buscar repertório" autocomplete="off" value="' + esc(S.repQ) + '"></div><ul class="songs rep-list" id="rep-ul"></ul>';
    var ul = $('#rep-ul');
    if (!list.length) {
      ul.innerHTML = '<li class="empty"><b>' + (S.repertoires.some(function (r) { return !r.deleted; }) ? 'Nada com esse nome' : 'Nenhum repertório ainda') + '</b><span>' + (S.repertoires.some(function (r) { return !r.deleted; }) ? 'Tente outro nome.' : 'Crie um repertório para organizar as músicas do show.') + '</span></li>';
      return;
    }
    ul.innerHTML = list.map(function (r) {
      var count = Array.isArray(r.items) ? r.items.length : 0;
      var confirming = String(S.repDeleteConfirm) === String(r.id);
      return '<li class="rep-card"><a href="#repertorio-' + encodeURIComponent(r.id) + '"><span class="t">' + esc(r.name) + '</span><span class="a">' + count + (count === 1 ? ' música' : ' músicas') + '</span></a>' + (confirming ? '<div class="rep-confirm"><span>Excluir este repertório?</span><button class="btn sm warn" data-act="confirm-delete-repertoire" data-rep-id="' + esc(r.id) + '">Excluir</button><button class="btn sm" data-act="cancel-delete-repertoire">Cancelar</button></div>' : '<div class="rep-actions"><button class="btn sm rep-play" data-act="play-setlist" data-rep-id="' + esc(r.id) + '">' + ic('play', 16) + 'Tocar</button><button class="ib" data-act="rename-repertoire" data-rep-id="' + esc(r.id) + '" aria-label="Renomear ' + esc(r.name) + '">' + ic('edit', 18) + '</button><button class="ib" data-act="duplicate-repertoire" data-rep-id="' + esc(r.id) + '" aria-label="Duplicar ' + esc(r.name) + '">' + ic('clip', 18) + '</button><button class="ib" data-act="delete-repertoire" data-rep-id="' + esc(r.id) + '" aria-label="Excluir ' + esc(r.name) + '">' + ic('trash', 18) + '</button></div>') + '</li>';
    }).join('');
  }

  function repertoireById(id) { return S.repertoires.filter(function (r) { return !r.deleted && String(r.id) === String(id); })[0] || null; }
  function songById(id) { return S.songs.filter(function (s) { return String(s.id) === String(id); })[0] || null; }
  function repItems(items) { return (Array.isArray(items) ? items : []).map(function (x) { return { songId: String(x.songId), semi: x.semi == null ? null : Number(x.semi) || 0, pref: x.pref || null }; }); }
  function repEffectiveSong(song, item) {
    var s = { id: song.id, title: song.title, artist: song.artist, key: song.key, body: song.body, structure: song.structure, semi: item && item.semi != null ? item.semi : (song.semi || 0), pref: item && item.pref ? item.pref : (song.pref || 'auto') };
    return s;
  }
  function repTom(song, item) { return tomLabel(repEffectiveSong(song, item), ctxFor(repEffectiveSong(song, item))); }
  function repItemText(song, item) { return song ? 'Tom ' + repTom(song, item) : 'Música não encontrada'; }

  function showRepertoire(id) {
    var base = id ? repertoireById(decodeURIComponent(id)) : null;
    if (id && !base) { location.replace('#repertorios'); return; }
    setView('repertoire');
    S.repDraft = base ? { id: base.id, name: base.name, items: repItems(base.items), createdAt: base.createdAt, songQ: '' } : { id: uid(), name: '', items: [], createdAt: Date.now(), songQ: '' };
    topbar({ back: true, title: base ? 'Editar repertório' : 'Novo repertório', right: '<button class="btn pri sm" data-act="save-repertoire">Salvar</button>' });
    $('#view').innerHTML = '<div class="rep-editor" id="rep-editor"><div class="field"><label for="rep-name">Nome do repertório</label><input id="rep-name" value="' + esc(S.repDraft.name) + '" autocomplete="off" placeholder="Ex.: Sexta no bar"></div><div class="err" id="rep-err"></div><section class="rep-section"><div class="rep-section-head"><h2>Músicas do repertório</h2><span id="rep-count"></span></div><p class="hint">Arraste pelo puxador ou use os botões para mudar a ordem. O tom pode ser ajustado por música.</p><ul class="rep-items" id="rep-items"></ul></section><section class="rep-section"><div class="rep-section-head"><h2>Escolher músicas</h2></div><div class="search"><span aria-hidden="true">' + ic('search', 20) + '</span><input id="rep-song-q" type="search" placeholder="Buscar música ou artista" autocomplete="off"></div><ul class="rep-picker" id="rep-picker"></ul></section>' + (base ? '<div class="acts"><button class="btn sm warn" data-act="delete-repertoire-editor">' + ic('trash', 18) + 'Excluir repertório</button></div>' : '') + '</div>';
    renderRepertoireEditor();
  }

  function renderRepertoireEditor() {
    var d = S.repDraft, selected = $('#rep-items'), picker = $('#rep-picker');
    if (!d || !selected || !picker) return;
    $('#rep-count').textContent = d.items.length + (d.items.length === 1 ? ' música' : ' músicas');
    selected.innerHTML = d.items.length ? d.items.map(function (item, i) {
      return repertoireItemHTML(item, i, d.items.length);
    }).join('') : '<li class="empty"><b>Nenhuma música escolhida</b><span>Marque músicas abaixo para montar o repertório.</span></li>';
    var q = norm(d.songQ || ''), songs = S.songs.filter(function (s) { return !q || norm(s.title + ' ' + s.artist).indexOf(q) >= 0; }).sort(function (a, b) { return norm(a.title).localeCompare(norm(b.title)); });
    picker.innerHTML = songs.length ? songs.map(function (song) {
      var checked = d.items.some(function (item) { return String(item.songId) === String(song.id); });
      return '<li><label class="rep-pick"><input type="checkbox" data-rep-song-id="' + esc(song.id) + '"' + (checked ? ' checked' : '') + '><span><b>' + esc(song.title) + '</b><small>' + esc(song.artist || 'Sem artista') + '</small></span><em>' + esc(tomLabel(song, ctxFor(song))) + '</em></label></li>';
    }).join('') : '<li class="empty">Nenhuma música encontrada.</li>';
  }

  function repertoireItemHTML(item, i, total) {
    var song = songById(item.songId), disabledUp = i === 0 ? ' disabled' : '', disabledDown = i === total - 1 ? ' disabled' : '';
    if (!song) return '<li class="rep-item rep-removed" data-rep-index="' + i + '"><button class="rep-handle" type="button" aria-label="Arrastar música removida">⋮⋮</button><span class="rep-pos">' + (i + 1) + '</span><div class="rep-item-main"><b>Música removida</b><small>O arquivo original não está mais neste aparelho.</small></div><div class="rep-item-actions"><button class="ib" data-act="rep-item-up" data-rep-index="' + i + '" aria-label="Subir música"' + disabledUp + '>' + ic('up', 16) + '</button><button class="ib" data-act="rep-item-down" data-rep-index="' + i + '" aria-label="Descer música"' + disabledDown + '>' + ic('down', 16) + '</button><button class="ib" data-act="rep-item-remove" data-rep-index="' + i + '" aria-label="Remover música removida">' + ic('trash', 16) + '</button></div></li>';
    return '<li class="rep-item" data-rep-index="' + i + '"><button class="rep-handle" type="button" aria-label="Arrastar ' + esc(song.title) + '">⋮⋮</button><span class="rep-pos">' + (i + 1) + '</span><div class="rep-item-main"><b>' + esc(song.title) + '</b><small>' + esc(song.artist || 'Sem artista') + ' · ' + esc(repItemText(song, item)) + (item.semi != null || item.pref ? ' · tom próprio' : '') + '</small></div><div class="rep-item-actions"><button class="ib" data-act="rep-tone-minus" data-rep-index="' + i + '" aria-label="Baixar o tom">' + ic('minus', 16) + '</button><button class="ib" data-act="rep-tone-plus" data-rep-index="' + i + '" aria-label="Subir o tom">' + ic('plus', 16) + '</button><button class="ib" data-act="rep-tone-pref" data-rep-index="' + i + '" aria-label="Alternar preferência de acidente">♯♭</button><button class="ib" data-act="rep-tone-reset" data-rep-index="' + i + '" aria-label="Usar tom da música">' + ic('back', 16) + '</button><button class="ib" data-act="rep-item-up" data-rep-index="' + i + '" aria-label="Subir música"' + disabledUp + '>' + ic('up', 16) + '</button><button class="ib" data-act="rep-item-down" data-rep-index="' + i + '" aria-label="Descer música"' + disabledDown + '>' + ic('down', 16) + '</button><button class="ib" data-act="rep-item-remove" data-rep-index="' + i + '" aria-label="Remover música">' + ic('trash', 16) + '</button></div></li>';
  }

  function saveRepertoire() {
    var d = S.repDraft, name = $('#rep-name') && $('#rep-name').value.trim();
    if (!d) return;
    if (!name) { $('#rep-err').textContent = 'Dê um nome para o repertório.'; $('#rep-name').focus(); return; }
    var r = { id: d.id, name: name, items: repItems(d.items), createdAt: d.createdAt || Date.now(), updatedAt: Date.now(), deleted: false };
    DB.putRepertoire(r).then(loadRepertoires).then(function () { S.repDraft = null; toast('Repertório salvo'); location.replace('#repertorio-' + encodeURIComponent(r.id)); });
  }

  function duplicateRepertoire(id) {
    var r = repertoireById(id); if (!r) return;
    var copy = { id: uid(), name: r.name + ' (cópia)', items: repItems(r.items), createdAt: Date.now(), updatedAt: Date.now(), deleted: false };
    DB.putRepertoire(copy).then(loadRepertoires).then(function () { toast('Repertório duplicado'); renderLibrary(); });
  }

  function deleteRepertoire(id) {
    var r = repertoireById(id); if (!r) return;
    r.deleted = true; r.updatedAt = Date.now();
    DB.putRepertoire(r).then(loadRepertoires).then(function () { toast('Repertório excluído'); if (S.view === 'list') renderRepertoireList(); else location.replace('#repertorios'); });
  }

  function addCurrentToRepertoire(id) {
    var r = repertoireById(id); if (!r || !S.cur) return;
    r.items = repItems(r.items);
    if (!r.items.some(function (item) { return String(item.songId) === String(S.cur.id); })) {
      r.items.push({ songId: String(S.cur.id), semi: null, pref: null }); r.updatedAt = Date.now();
      DB.putRepertoire(r).then(loadRepertoires).then(function () { closeSheet(); toast('Música adicionada ao repertório'); });
    } else { toast('Essa música já está no repertório'); }
  }

  function addToRepertoireMenu() {
    var list = S.repertoires.filter(function (r) { return !r.deleted; });
    if (!list.length) { closeSheet(); toast('Crie um repertório primeiro'); location.hash = '#novo-repertorio'; return; }
    openSheet('<h3>Adicionar a um repertório</h3>' + list.map(function (r) {
      var has = (r.items || []).some(function (item) { return String(item.songId) === String(S.cur.id); });
      return '<button data-act="add-to-repertoire" data-rep-id="' + esc(r.id) + '">' + ic(has ? 'fit' : 'plus', 20) + esc(r.name) + '<small>' + (has ? 'Já adicionada' : ((r.items || []).length + ' músicas')) + '</small></button>';
    }).join(''));
  }

  function playableSetlistItems(setlist) {
    return (Array.isArray(setlist.items) ? setlist.items : []).map(function (item) {
      var song = songById(item.songId);
      return song ? { item: item, song: song } : null;
    }).filter(Boolean);
  }
  function showCurrent() { return S.show && S.show.playable[S.show.pos]; }
  function showDisplaySong() {
    var current = showCurrent(); return current ? repEffectiveSong(current.song, current.item) : null;
  }
  function showHash(id, pos) { return '#show-' + encodeURIComponent(id) + '-' + pos; }
  function startSetlistShow(id) {
    var setlist = repertoireById(id), playable = setlist && playableSetlistItems(setlist);
    if (!playable || !playable.length) { toast('Adicione músicas antes de tocar'); return; }
    var saved = Number(store.get('show-pos-' + id, 0)) || 0;
    location.hash = showHash(id, Math.max(0, Math.min(playable.length - 1, saved)));
  }
  function rebuildShow() {
    if (!S.show) return;
    S.show.setlist = repertoireById(S.show.id) || S.show.setlist;
    S.show.playable = playableSetlistItems(S.show.setlist);
    S.show.pos = Math.max(0, Math.min(S.show.playable.length - 1, S.show.pos));
  }
  function renderShowHeader() {
    var current = showCurrent(), song = current && current.song;
    topbar({ title: S.show.setlist.name, sub: song ? song.title : 'Sem músicas', right: (S.show.exitConfirm ? '<button class="btn sm warn" data-act="show-exit">Confirmar saída</button><button class="ib" data-act="show-cancel-exit" aria-label="Cancelar saída">' + ic('x', 18) + '</button>' : '<button class="ib" data-act="show-menu" aria-label="Opções do show">' + ic('dots') + '</button><button class="btn sm show-exit" data-act="show-exit">Sair</button>') });
  }
  function renderShowControls() {
    var el = $('#show-controls'), current = showCurrent(), display = showDisplaySong(); if (!el || !current || !display) return;
    el.innerHTML = '<button class="show-quiet" data-act="show-list" aria-label="Abrir músicas do repertório">' + (S.show.pos + 1) + ' / ' + S.show.playable.length + '</button><span class="show-spacer"></span><button class="show-quiet" data-act="show-tone" aria-label="Abrir transposição">Tom ' + esc(tomLabel(display, ctxFor(display))) + '</button><button class="show-quiet" data-act="show-scroll" aria-label="' + (S.scroll.on ? 'Pausar rolagem' : 'Iniciar rolagem') + '">' + (S.scroll.on ? ic('pause', 17) : ic('play', 17)) + '</button>' + (S.scroll.on ? '<div class="speed"><span>Devagar</span><input type="range" id="spd" min="1" max="10" step="1" value="' + S.scroll.speed + '" aria-label="Velocidade da rolagem"><span>Rápido</span></div>' : '');
  }
  function renderShowNav() {
    var nav = $('#show-nav'), current = showCurrent(); if (!nav || !current) return;
    var prev = S.show.pos > 0 ? S.show.playable[S.show.pos - 1].song.title : 'Início do repertório';
    var next = S.show.pos < S.show.playable.length - 1 ? S.show.playable[S.show.pos + 1].song.title : 'Fim do repertório';
    nav.innerHTML = '<button class="show-nav-btn" data-act="show-prev"' + (S.show.pos === 0 ? ' disabled' : '') + '><span>Anterior</span><b>' + esc(prev) + '</b></button><strong>' + (S.show.pos + 1) + ' de ' + S.show.playable.length + '</strong><button class="show-nav-btn" data-act="show-next"' + (S.show.pos === S.show.playable.length - 1 ? ' disabled' : '') + '><span>Próxima</span><b>' + esc(next) + '</b></button>';
  }
  function renderShow(resetTop) {
    rebuildShow();
    var current = showCurrent(), display = showDisplaySong();
    if (!current || !display) { exitShow(); return; }
    S.cur = current.song;
    renderShowHeader();
    var songEl = $('#show-song'); if (songEl) { songEl.innerHTML = songHTML(display); applyFont(); }
    renderShowControls(); renderShowNav();
    if (resetTop) window.scrollTo(0, 0);
  }
  function showMode(id, pos) {
    var setlist = repertoireById(decodeURIComponent(id));
    if (!setlist) { location.replace('#repertorios'); return; }
    var playable = playableSetlistItems(setlist); if (!playable.length) { toast('Adicione músicas antes de tocar'); location.replace('#repertorio-' + encodeURIComponent(setlist.id)); return; }
    var last = Number(store.get('show-pos-' + setlist.id, 0)) || 0;
    pos = isNaN(Number(pos)) ? last : Number(pos);
    setView('show');
    S.show = { id: setlist.id, setlist: setlist, playable: playable, pos: Math.max(0, Math.min(playable.length - 1, pos)), exitConfirm: false };
    $('#view').innerHTML = '<main class="show-shell"><div class="show-controls" id="show-controls"></div><div class="song show-song" id="show-song"></div></main><div class="show-nav" id="show-nav"></div>';
    store.set('show-pos-' + setlist.id, S.show.pos); requestWake(); renderShow(true);
  }
  function moveShowTo(pos) {
    if (!S.show || pos < 0 || pos >= S.show.playable.length) return;
    S.show.pos = pos; S.show.exitConfirm = false; store.set('show-pos-' + S.show.id, pos);
    history.replaceState(null, '', showHash(S.show.id, pos)); renderShow(true);
  }
  function moveShow(delta) { if (S.show) moveShowTo(S.show.pos + delta); }
  function showListMenu() {
    if (!S.show) return;
    openSheet('<h3>' + esc(S.show.setlist.name) + '</h3>' + S.show.playable.map(function (entry, i) { return '<button data-act="show-jump" data-show-pos="' + i + '"' + (i === S.show.pos ? ' class="on"' : '') + '>' + (i + 1) + '. ' + esc(entry.song.title) + '<small>' + esc(repItemText(entry.song, entry.item)) + '</small></button>'; }).join(''));
  }
  function showMenu() {
    var display = showDisplaySong(), pref = display && display.pref || 'auto';
    if (!display) return;
    openSheet('<h3>Modo show</h3><button data-act="show-tone-down">' + ic('minus', 18) + 'Baixar tom</button><button data-act="show-tone-up">' + ic('plus', 18) + 'Subir tom</button><button data-act="show-tone-pref">♯♭ Alternar sustenido/bemol<small>' + esc(pref) + '</small></button><h3>Tela</h3><button data-act="show-font-down">' + ic('type', 18) + 'Letra menor</button><button data-act="show-font-up">' + ic('type', 18) + 'Letra maior</button><button data-act="show-font-fit">' + ic('fit', 18) + 'Ajustar à largura</button><button data-act="show-diagram">' + ic('play', 18) + 'Tocar em acorde abre diagrama<small>' + (store.get('diagram', true) ? 'Ligado' : 'Desligado') + '</small></button>');
  }
  function requestShowTone(change) {
    var display = showDisplaySong(); if (!display || !S.show) return;
    var next = { semi: display.semi || 0, pref: display.pref || 'auto' };
    if (change.delta) next.semi = (((next.semi + change.delta) + 5 + 12) % 12) - 5;
    if (change.pref) next.pref = change.pref;
    S.show.pendingTone = next;
    openSheet('<h3>Salvar mudança de tom?</h3><p>Escolha onde aplicar o novo tom.</p><button data-act="show-apply-rep">' + ic('fit', 18) + 'Só neste repertório<small>padrão</small></button><button data-act="show-apply-song">' + ic('fit', 18) + 'Na música em geral</button>');
  }
  function applyShowTone(scope) {
    var current = showCurrent(), next = S.show && S.show.pendingTone;
    if (!current || !next) return;
    var setlist = S.show.setlist, item = current.item, song = current.song;
    if (scope === 'rep') { item.semi = next.semi; item.pref = next.pref; setlist.updatedAt = Date.now(); DB.putRepertoire(setlist).then(loadRepertoires).then(function () { closeSheet(); S.show.pendingTone = null; renderShow(false); }); }
    else { song.semi = next.semi; song.pref = next.pref; song.updatedAt = Date.now(); item.semi = null; item.pref = null; setlist.updatedAt = Date.now(); Promise.all([DB.put(song), DB.putRepertoire(setlist)]).then(function () { return Promise.all([loadSongs(), loadRepertoires()]); }).then(function () { closeSheet(); S.show.pendingTone = null; renderShow(false); }); }
  }
  function exitShow() { var id = S.show && S.show.id; S.show = null; location.replace('#repertorio-' + encodeURIComponent(id)); }

  function changeRepTone(index, delta) {
    var d = S.repDraft, item = d && d.items[index], song = item && songById(item.songId);
    if (!item || !song) return;
    var base = item.semi == null ? (song.semi || 0) : item.semi;
    item.semi = (((base + delta) + 5 + 12) % 12) - 5;
    renderRepertoireEditor();
  }
  function cycleRepPref(index) {
    var d = S.repDraft, item = d && d.items[index], song = item && songById(item.songId);
    if (!item || !song) return;
    var current = item.pref || song.pref || 'auto', order = ['auto', 'sharp', 'flat'];
    item.pref = order[(order.indexOf(current) + 1) % order.length];
    renderRepertoireEditor();
  }
  function resetRepTone(index) {
    if (!S.repDraft || !S.repDraft.items[index]) return;
    S.repDraft.items[index].semi = null; S.repDraft.items[index].pref = null; renderRepertoireEditor();
  }
  function moveRepItem(index, delta) {
    var d = S.repDraft, to = index + delta;
    if (!d || to < 0 || to >= d.items.length) return;
    var x = d.items.splice(index, 1)[0]; d.items.splice(to, 0, x); renderRepertoireEditor();
  }
  function removeRepItem(index) {
    if (!S.repDraft) return;
    S.repDraft.items.splice(index, 1); renderRepertoireEditor();
  }

  var repDrag = null;
  function syncRepItemNodes() {
    Array.prototype.slice.call(document.querySelectorAll('#rep-items .rep-item')).forEach(function (el, i) {
      el.setAttribute('data-rep-index', i);
      var pos = el.querySelector('.rep-pos'); if (pos) pos.textContent = i + 1;
    });
  }
  document.addEventListener('pointerdown', function (e) {
    var handle = e.target.closest && e.target.closest('.rep-handle'), row = handle && handle.closest('.rep-item');
    if (!handle || !row || !S.repDraft) return;
    repDrag = { id: e.pointerId, index: +row.getAttribute('data-rep-index'), row: row };
    row.classList.add('dragging');
    if (handle.setPointerCapture) handle.setPointerCapture(e.pointerId);
    e.preventDefault();
  });
  document.addEventListener('pointermove', function (e) {
    if (!repDrag || e.pointerId !== repDrag.id) return;
    e.preventDefault();
    var target = document.elementFromPoint(e.clientX, e.clientY), row = target && target.closest && target.closest('.rep-item'), list = $('#rep-items');
    if (!row || !list || row === repDrag.row || row.parentNode !== list) return;
    var from = repDrag.index, to = +row.getAttribute('data-rep-index');
    if (from === to) return;
    var x = S.repDraft.items.splice(from, 1)[0]; S.repDraft.items.splice(to, 0, x);
    if (to > from) list.insertBefore(repDrag.row, row.nextSibling); else list.insertBefore(repDrag.row, row);
    repDrag.index = to; syncRepItemNodes();
  });
  function endRepDrag(e) {
    if (!repDrag || (e.pointerId != null && e.pointerId !== repDrag.id)) return;
    repDrag.row.classList.remove('dragging'); repDrag = null;
  }
  document.addEventListener('pointerup', endRepDrag);
  document.addEventListener('pointercancel', endRepDrag);

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
  window.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') { hideCard(); closeSheet(); return; }
    if (S.view !== 'show' || e.target && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
    if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); moveShow(-1); }
    else if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.code === 'Space') { e.preventDefault(); moveShow(1); }
  });
  var showTouch = null;
  document.addEventListener('touchstart', function (e) {
    if (S.view === 'show' && e.touches.length === 1 && e.target.closest && e.target.closest('#show-song')) showTouch = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  }, { passive: true });
  document.addEventListener('touchend', function (e) {
    if (!showTouch || S.view !== 'show' || !e.changedTouches.length) return;
    var t = e.changedTouches[0], dx = t.clientX - showTouch.x, dy = t.clientY - showTouch.y;
    showTouch = null;
    if (Math.abs(dx) > 55 && Math.abs(dx) > Math.abs(dy) * 1.25) { e.preventDefault(); moveShow(dx < 0 ? 1 : -1); }
  }, { passive: false });

  /* ---------- rolagem automática e tela acesa ---------- */
  var raf = 0, last = 0, acc = 0, wake = null;
  var SPEEDS = [6, 10, 15, 21, 28, 37, 48, 62, 80, 100];
  function loop(t) {
    if (!S.scroll.on) return;
    var dt = Math.min(0.1, (t - (last || t)) / 1000); last = t;
    acc += SPEEDS[S.scroll.speed - 1] * dt;
    var n = Math.floor(acc);
    if (n) { window.scrollBy(0, n); acc -= n; }
    if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2) { stopScroll(); if (S.view === 'song') renderTools(); else if (S.view === 'show') renderShowControls(); return; }
    raf = requestAnimationFrame(loop);
  }
  function startScroll() { S.scroll.on = true; last = 0; acc = 0; cancelAnimationFrame(raf); raf = requestAnimationFrame(loop); }
  function stopScroll() { S.scroll.on = false; cancelAnimationFrame(raf); }
  ['touchstart', 'wheel'].forEach(function (ev) {
    window.addEventListener(ev, function (e) {
      if (S.scroll.on && (S.view === 'song' || S.view === 'show')) {
        /* O range dispara touchstart antes do arraste. Não recrie os controles
           nesse momento, senão o próprio input desaparece no celular. */
        if (e.target && e.target.closest && e.target.closest('#spd, #show-controls, .show-nav')) return;
        stopScroll(); if (S.view === 'show') renderShowControls(); else renderTools();
      }
    }, { passive: true });
  });
  function requestWake() { try { if (navigator.wakeLock) navigator.wakeLock.request('screen').then(function (l) { wake = l; }, function () {}); } catch (e) {} }
  function releaseWake() { try { if (wake) wake.release(); } catch (e) {} wake = null; }
  document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible' && (S.view === 'song' || S.view === 'show') && !wake) requestWake(); });

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
    var d = song ? { id: song.id, title: song.title, artist: song.artist, key: song.key, body: song.body, structure: song.structure, pdf: song.pdf, pdfPath: song.pdfPath, createdAt: song.createdAt, semi: song.semi, pref: song.pref, report: null, editing: true }
      : (S.draft || { id: uid(), title: '', artist: '', key: '', body: '', report: null, editing: false });
    S.draft = d;
    topbar({ back: true, title: song ? 'Editar cifra' : 'Nova cifra', right: d.editing ? '<button class="btn pri sm" data-act="save">Salvar</button>' : '<button class="btn pri sm" data-act="import-save">Importar e salvar</button>' });
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
      (d.editing ? '<section class="prev"><h2>Prévia (toque num acorde para ver o desenho)</h2><div class="song" id="song"></div></section>' : '');
    paintReport(); previewDraft();
    $('#f-body').addEventListener('input', function () { d.imported = false; clearTimeout(previewDraft.t); previewDraft.t = setTimeout(previewDraft, 160); });
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
    var parsed = MusicParser && MusicParser.parse(d.body, { extractMeta: false });
    var tmp = { body: parsed && parsed.body || d.body, structure: parsed && parsed.structure || d.structure, key: d.key, semi: 0, pref: 'auto' };
    S.cur = tmp;
    el.innerHTML = songHTML(tmp); applyFont();
  }
  function applyImport(text, pdfBlob) {
    var r = MusicParser.parse(text), d = readDraft() || S.draft;
    if (!r.valid) { var importErr = $('#err'); if (importErr) importErr.textContent = r.errors.join(' '); return false; }
    d.title = r.title || d.title; d.artist = r.artist || d.artist; d.key = r.key || d.key; d.body = r.body; d.report = r.report;
    d.structure = r.structure; d.imported = true;
    if (pdfBlob) d.pdf = pdfBlob;
    S.draft = d;
    if ($('#f-body')) { $('#f-title').value = d.title; $('#f-artist').value = d.artist; $('#f-key').value = d.key; $('#f-body').value = d.body; paintReport(); previewDraft(); }
    return true;
  }
  function importAndSaveDraft() {
    var d = readDraft(), r = MusicParser.parse(d && d.body);
    if (!d || !r.valid) { var importErr = $('#err'); if (importErr) importErr.textContent = r.errors.join(' '); return; }
    d.title = d.title || r.title || 'Música sem título';
    d.artist = d.artist || r.artist || '';
    d.key = d.key || r.key || '';
    d.body = r.body; d.structure = r.structure; d.report = r.report; d.imported = true;
    $('#f-title').value = d.title; $('#f-artist').value = d.artist; $('#f-key').value = d.key; $('#f-body').value = d.body;
    saveDraft();
  }
  function saveDraft() {
    var d = readDraft();
    if (!d.title) { $('#err').textContent = 'Dê um título para a música.'; $('#f-title').focus(); return; }
    if (!d.body.trim()) { $('#err').textContent = 'A cifra está vazia.'; $('#f-body').focus(); return; }
    var parsed = MusicParser.parse(d.body, { extractMeta: false });
    if (!parsed.valid) { $('#err').textContent = parsed.errors.join(' '); return; }
    var old = S.songs.filter(function (s) { return s.id === d.id; })[0];
    var song = { id: d.id, title: d.title, artist: d.artist, key: d.key, body: parsed.body.replace(/\s+$/, ''), structure: parsed.structure, createdAt: d.createdAt || Date.now(), updatedAt: Date.now(), semi: old ? old.semi || 0 : 0, pref: old ? old.pref || 'auto' : 'auto' };
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
        var imp = MusicParser.parse(r.text);
        if (!imp.valid) { toast(imp.errors.join(' ')); return; }
        if (!imp.title) imp.title = r.name.replace(/\.[^.]+$/, '');
        S.draft.title = imp.title; S.draft.artist = imp.artist; S.draft.key = imp.key; S.draft.body = imp.body; S.draft.report = imp.report;
        S.draft.structure = imp.structure; S.draft.imported = true;
        if (r.pdf) S.draft.pdf = r.pdf;
        if (location.hash === '#nova') showEditor(null); else location.hash = '#nova';
        return;
      }
      var saves = good.map(function (r) {
        var imp = MusicParser.parse(r.text);
        if (!imp.valid) return null;
        return DB.put({ id: uid(), title: imp.title || r.name.replace(/\.[^.]+$/, ''), artist: imp.artist, key: imp.key, body: imp.body, structure: imp.structure, createdAt: Date.now(), updatedAt: Date.now(), semi: 0, pref: 'auto', pdf: r.pdf || undefined });
      }).filter(Boolean);
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
      return DB.allRepertoires().then(function (repertoires) { return { songs: list, repertoires: repertoires }; });
    }).then(function (data) {
      var blob = new Blob([JSON.stringify({ app: 'meu-repertorio', v: 3, songs: data.songs, setlists: data.repertoires, repertoires: data.repertoires })], { type: 'application/json' });
      var a = document.createElement('a'); a.href = URL.createObjectURL(blob);
      a.download = 'meu-repertorio-' + new Date().toISOString().slice(0, 10) + '.json';
      document.body.appendChild(a); a.click(); a.remove(); toast('Backup gerado');
    });
  }
  function restoreBackup(file) {
    file.text().then(function (t) {
      var j = JSON.parse(t); if (!j || !Array.isArray(j.songs)) throw new Error('fmt');
      var jobs = j.songs.map(function (s) {
        if (typeof s.pdf === 'string') return fetch(s.pdf).then(function (r) { return r.blob(); }).then(function (b) { s.pdf = b; return DB.put(s); });
        return DB.put(s);
      });
      var importedSetlists = Array.isArray(j.setlists) ? j.setlists : (Array.isArray(j.repertoires) ? j.repertoires : []);
      importedSetlists.forEach(function (r) { jobs.push(DB.putRepertoire({ id: r.id || uid(), name: r.name || 'Sem nome', items: repItems(r.items), createdAt: r.createdAt || Date.now(), updatedAt: Date.now(), deleted: !!r.deleted })); });
      return Promise.all(jobs).then(function () { return { songs: j.songs.length, repertoires: importedSetlists.length }; });
    }).then(function (n) { return Promise.all([loadSongs(), loadRepertoires()]).then(function () { toast(n.songs + ' músicas e ' + n.repertoires + ' repertórios restaurados'); showList(); }); })
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
      '<button data-act="diagram">' + ic('play', 18) + 'Tocar em acorde abre diagrama<small>' + (store.get('diagram', true) ? 'Ligado' : 'Desligado') + '</small></button>' +
      '<button data-act="add-to-repertoire-menu">' + ic('plus', 18) + 'Adicionar a um repertório</button>' +
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
    if (ch) { if (!store.get('diagram', true)) return; if (HOVER && ch.classList.contains('ch') && card.sym === ch.getAttribute('data-sym')) { card.pinned = true; return; } card.pinned = !!HOVER; showCard(ch.getAttribute('data-sym'), ch); return; }
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
      case 'tab-songs': if (location.hash === '#lista') showList('songs'); else location.hash = '#lista'; break;
      case 'tab-repertoires': S.repDeleteConfirm = null; if (location.hash === '#repertorios') showList('repertoires'); else location.hash = '#repertorios'; break;
      case 'new-repertoire': location.hash = '#novo-repertorio'; break;
      case 'play-setlist': startSetlistShow(b.getAttribute('data-rep-id')); break;
      case 'rename-repertoire': location.hash = '#repertorio-' + encodeURIComponent(b.getAttribute('data-rep-id')); break;
      case 'duplicate-repertoire': duplicateRepertoire(b.getAttribute('data-rep-id')); break;
      case 'delete-repertoire': S.repDeleteConfirm = b.getAttribute('data-rep-id'); renderRepertoireList(); break;
      case 'confirm-delete-repertoire': deleteRepertoire(b.getAttribute('data-rep-id')); break;
      case 'cancel-delete-repertoire': S.repDeleteConfirm = null; renderRepertoireList(); break;
      case 'save-repertoire': saveRepertoire(); break;
      case 'delete-repertoire-editor': S.repDeleteConfirm = S.repDraft && S.repDraft.id; location.hash = '#repertorios'; break;
      case 'rep-item-up': moveRepItem(+b.getAttribute('data-rep-index'), -1); break;
      case 'rep-item-down': moveRepItem(+b.getAttribute('data-rep-index'), 1); break;
      case 'rep-item-remove': removeRepItem(+b.getAttribute('data-rep-index')); break;
      case 'rep-tone-minus': changeRepTone(+b.getAttribute('data-rep-index'), -1); break;
      case 'rep-tone-plus': changeRepTone(+b.getAttribute('data-rep-index'), 1); break;
      case 'rep-tone-pref': cycleRepPref(+b.getAttribute('data-rep-index')); break;
      case 'rep-tone-reset': resetRepTone(+b.getAttribute('data-rep-index')); break;
      case 'add-to-repertoire-menu': addToRepertoireMenu(); break;
      case 'add-to-repertoire': addCurrentToRepertoire(b.getAttribute('data-rep-id')); break;
      case 'show-menu': showMenu(); break;
      case 'show-list': showListMenu(); break;
      case 'show-jump': closeSheet(); moveShowTo(+b.getAttribute('data-show-pos')); break;
      case 'show-prev': moveShow(-1); break;
      case 'show-next': moveShow(1); break;
      case 'show-scroll': if (S.scroll.on) stopScroll(); else startScroll(); renderShowControls(); break;
      case 'show-tone': showMenu(); break;
      case 'show-tone-down': requestShowTone({ delta: -1 }); break;
      case 'show-tone-up': requestShowTone({ delta: 1 }); break;
      case 'show-tone-pref':
        var showDisplay = showDisplaySong(), showOrder = ['auto', 'sharp', 'flat'], showPref = showDisplay && showDisplay.pref || 'auto';
        requestShowTone({ pref: showOrder[(showOrder.indexOf(showPref) + 1) % showOrder.length] }); break;
      case 'show-apply-rep': applyShowTone('rep'); break;
      case 'show-apply-song': applyShowTone('song'); break;
      case 'show-font-down': store.set('fs', Math.max(9, (Number($('.song') && $('.song').dataset.fs) || 14) - 1)); applyFont(); closeSheet(); break;
      case 'show-font-up': store.set('fs', Math.min(30, (Number($('.song') && $('.song').dataset.fs) || 14) + 1)); applyFont(); closeSheet(); break;
      case 'show-font-fit': store.set('fs', 0); applyFont(); closeSheet(); break;
      case 'show-diagram': store.set('diagram', !store.get('diagram', true)); showMenu(); break;
      case 'show-exit': if (S.show && S.show.exitConfirm) exitShow(); else if (S.show) { S.show.exitConfirm = true; renderShowHeader(); } break;
      case 'show-cancel-exit': if (S.show) { S.show.exitConfirm = false; renderShowHeader(); } break;
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
      case 'diagram': store.set('diagram', !store.get('diagram', true)); menuSong(); break;
      case 'theme': var order = ['auto', 'light', 'dark'], t = store.get('theme', 'auto'); store.set('theme', order[(order.indexOf(t) + 1) % 3]); applyTheme(); b.querySelector('small').textContent = themeLabel(); break;
      case 'export': closeSheet(); exportBackup(); break;
      case 'restore': closeSheet(); $('#pick').click(); break;
      case 'install': closeSheet(); if (installEv) { installEv.prompt(); installEv = null; } break;
      case 'fs-': case 'fs+': var now = Number($('.song').dataset.fs) || 14; store.set('fs', Math.max(9, Math.min(30, now + (a === 'fs+' ? 1 : -1)))); applyFont(); b.querySelector('small') && (b.querySelector('small').textContent = $('.song').dataset.fs + ' px'); break;
      case 'fsfit': store.set('fs', 0); applyFont(); closeSheet(); break;
      case 'strip': S.strip = !S.strip; store.set('strip', S.strip); closeSheet(); renderStrip(); break;
      case 'openpdf': closeSheet(); openPdf(S.view === 'edit' ? S.draft : cur); break;
      case 'import-save': importAndSaveDraft(); break;
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
    else if (e.target.id === 'repq') { S.repQ = e.target.value; renderRepertoireList(); }
    else if (e.target.id === 'rep-song-q' && S.repDraft) { S.repDraft.songQ = e.target.value; renderRepertoireEditor(); var rq = $('#rep-song-q'); if (rq) rq.focus(); }
    else if (e.target.id === 'spd') { S.scroll.speed = +e.target.value; store.set('speed', S.scroll.speed); }
    else if (e.target.id === 'f-title' || e.target.id === 'f-key') { var er = $('#err'); if (er) er.textContent = ''; if (e.target.id === 'f-key') previewDraft(); }
  });
  document.addEventListener('change', function (e) {
    if (!e.target.matches || !e.target.matches('#rep-picker input[type="checkbox"]') || !S.repDraft) return;
    var id = String(e.target.getAttribute('data-rep-song-id'));
    if (e.target.checked) {
      if (!S.repDraft.items.some(function (item) { return String(item.songId) === id; })) S.repDraft.items.push({ songId: id, semi: null, pref: null });
    } else S.repDraft.items = S.repDraft.items.filter(function (item) { return String(item.songId) !== id; });
    renderRepertoireEditor();
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
    else if (h.indexOf('show-') === 0) {
      var showBits = h.slice(5), showSep = showBits.lastIndexOf('-');
      if (showSep > 0) showMode(showBits.slice(0, showSep), showBits.slice(showSep + 1)); else showList('repertoires');
    }
    else if (h === 'repertorios') showList('repertoires');
    else if (h === 'novo-repertorio') showRepertoire(null);
    else if (h.indexOf('repertorio-') === 0) showRepertoire(h.slice(11));
    else showList('songs');
  }
  window.addEventListener('hashchange', route);

  function loadSongs() { return DB.all().then(function (l) { S.songs = l || []; }); }
  function loadRepertoires() { return DB.allRepertoires().then(function (l) { S.repertoires = l || []; }); }

  function seedIfNew() {
    if (store.get('seeded', false) || S.songs.length || !window.CIFRA_SEED) return Promise.resolve();
    var jobs = window.CIFRA_SEED.map(function (raw, i) {
      var r = Cifra.importText(raw);
      return DB.put({ id: 'ex' + i, title: r.title, artist: r.artist, key: r.key, body: r.body, structure: r.structure, createdAt: Date.now() - i, updatedAt: Date.now(), semi: 0, pref: 'auto' });
    });
    return Promise.all(jobs).then(function () { store.set('seeded', true); return loadSongs(); });
  }

  loadSongs().then(seedIfNew).then(loadRepertoires).then(function () {
    route();
    if (window.MeuRepertorioCloud) window.MeuRepertorioCloud.start({
      getSongs: function () { return DB.all(); },
      put: function (song, silent) { return DB.put(song, silent); },
      del: function (id, silent) { return DB.del(id, silent); },
      getRepertoires: function () { return DB.allRepertoires(); },
      putRepertoire: function (rep, silent) { return DB.putRepertoire(rep, silent); },
      reload: function () { return Promise.all([loadSongs(), loadRepertoires()]).then(function () { if (S.view === 'list') renderLibrary(); }); },
      onStatus: function () { if (S.view === 'list' && $('#cnt')) renderLibrary(); }
    });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { if ($('.song')) applyFont(); });
  });

  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
    try { navigator.serviceWorker.register('sw.js').catch(function () {}); } catch (e) {}
  }
  window.__cifras = { S: S, DB: DB, MusicParser: MusicParser, handleFiles: handleFiles, pdfToText: pdfToText };
})();
