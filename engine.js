/* Motor de cifras: leitura, limpeza, transposição e posições de acorde no violão.
   Roda no navegador (window.Cifra) e no Node (require) para os testes. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Cifra = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var SHARP = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  var FLAT = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
  var LETTER = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

  function notePc(n) {
    var i = LETTER[n[0]];
    for (var k = 1; k < n.length; k++) i += n[k] === '#' ? 1 : -1;
    return ((i % 12) + 12) % 12;
  }

  /* ---------- Leitura de acordes ---------- */

  var SUFFIX_OK = /^(?:maj|min|dim|aug|sus|add|M|m|Δ|°|º|ø|\+|-|\d|[#b]|[()\/,.])*$/;

  function parseChord(tok) {
    var m = /^([A-G])([#b]?)/.exec(tok);
    if (!m) return null;
    var root = m[1] + m[2];
    var rest = tok.slice(root.length);
    var depth = 0, slash = -1, i;
    for (i = 0; i < rest.length; i++) {
      var c = rest[i];
      if (c === '(') depth++;
      else if (c === ')') { depth--; if (depth < 0) return null; }
      else if (c === '/' && depth === 0) { slash = i; break; }
    }
    if (depth !== 0) return null;
    var suffix = rest, bass = null;
    if (slash >= 0) {
      var b = rest.slice(slash + 1);
      if (/^[A-G][#b]?$/.test(b)) { suffix = rest.slice(0, slash); bass = b; }
      else if (!/^\d+$/.test(b)) return null;
    }
    if (!SUFFIX_OK.test(suffix)) return null;
    return { root: root, rootPc: notePc(root), suffix: suffix, bass: bass, bassPc: bass ? notePc(bass) : null };
  }

  /* aceita "(A7M", "D7M)", "A," etc. */
  function chordOf(tok) {
    var p = parseChord(tok);
    if (p) return p;
    var t = tok.replace(/^\(+/, '');
    if ((p = parseChord(t))) return p;
    t = t.replace(/\)+$/, '');
    if ((p = parseChord(t))) return p;
    t = t.replace(/[,.;:*]+$/, '');
    return parseChord(t);
  }

  var IGNORE = /^(\||\|\||\(|\)|\[|\]|[x×]\d+|\d+[x×]|-|–|—|\/|\.{2,}|%|\*|N\.?C\.?|→|>|<|:|\d+ª?)$/i;

  function tokens(line) {
    var out = [], re = /\S+/g, m;
    while ((m = re.exec(line))) out.push({ col: m.index, text: m[0] });
    return out;
  }

  function isChordLine(line) {
    var t = tokens(line), n = 0;
    if (!t.length) return false;
    for (var i = 0; i < t.length; i++) {
      if (chordOf(t[i].text)) n++;
      else if (!IGNORE.test(t[i].text)) return false;
    }
    return n > 0;
  }

  /* "[Intro] A A7M" -> { label:'Intro', rest:'      A A7M' } */
  function sectionOf(line) {
    var m = /^\s*\[([^\]]+)\]\s*(.*)$/.exec(line);
    if (!m) return null;
    var rest = m[2];
    if (rest && !isChordLine(rest)) return null;
    var pad = line.length - rest.length;
    return { label: m[1].trim(), rest: rest ? new Array(pad + 1).join(' ') + rest : '' };
  }

  /* ---------- Estrutura da cifra ---------- */

  /* body (texto) -> linhas: section | chords | cl (acordes + letra) | lyric | blank */
  function parseBody(body) {
    var raw = (body || '').replace(/\r\n?/g, '\n').split('\n');
    var out = [], i = 0, prevBlank = true;
    while (i < raw.length) {
      var L = raw[i].replace(/\s+$/, '');
      if (!L.trim()) { if (!prevBlank) out.push({ t: 'blank' }); prevBlank = true; i++; continue; }
      prevBlank = false;
      var sec = sectionOf(L);
      if (sec) {
        out.push({ t: 'section', text: sec.label });
        if (sec.rest) out.push({ t: 'chords', toks: tokens(sec.rest).map(function (k) { return { col: 0, text: k.text }; }), loose: true });
        i++; continue;
      }
      if (isChordLine(L)) {
        var nxt = i + 1 < raw.length ? raw[i + 1].replace(/\s+$/, '') : '';
        if (nxt.trim() && !sectionOf(nxt) && !isChordLine(nxt)) {
          out.push({ t: 'cl', toks: tokens(L), lyric: nxt });
          i += 2; continue;
        }
        out.push({ t: 'chords', toks: tokens(L) });
        i++; continue;
      }
      out.push({ t: 'lyric', text: L });
      i++;
    }
    while (out.length && out[out.length - 1].t === 'blank') out.pop();
    return out;
  }

  function uniqueChords(lines) {
    var seen = {}, list = [];
    lines.forEach(function (l) {
      (l.toks || []).forEach(function (k) {
        var c = chordOf(k.text);
        if (c) {
          var s = cleanTok(k.text);
          if (!seen[s]) { seen[s] = 1; list.push(s); }
        }
      });
    });
    return list;
  }

  function cleanTok(t) {
    var p = parseChord(t) ? t : t.replace(/^\(+/, '');
    if (!parseChord(p)) p = p.replace(/\)+$/, '');
    if (!parseChord(p)) p = p.replace(/[,.;:*]+$/, '');
    return p;
  }

  /* ---------- Transposição ---------- */

  var FLAT_MAJOR = { 5: 1, 10: 1, 3: 1, 8: 1, 1: 1 };
  var FLAT_MINOR = { 2: 1, 7: 1, 0: 1, 5: 1, 10: 1 };

  function keyPrefersFlats(pc, minor) { return !!(minor ? FLAT_MINOR : FLAT_MAJOR)[pc]; }

  /* pref: 'auto' | 'sharp' | 'flat'. Em 'auto' e semitons 0 mantém a grafia original. */
  function transposeSym(sym, semi, pref, keyFlat) {
    var p = parseChord(sym);
    if (!p) return sym;
    if (!semi && pref === 'auto') return sym;
    var flats = pref === 'flat' ? true : pref === 'sharp' ? false : !!keyFlat;
    var tbl = flats ? FLAT : SHARP;
    var r = tbl[((p.rootPc + semi) % 12 + 12) % 12];
    var s = r + p.suffix;
    if (p.bass) s += '/' + tbl[((p.bassPc + semi) % 12 + 12) % 12];
    return s;
  }

  function keyInfo(keyText, firstChord) {
    var p = parseChord(keyText || '') || parseChord(firstChord || '');
    if (!p) return null;
    return { pc: p.rootPc, minor: /^(m|min)(?!aj)/.test(p.suffix) };
  }

  /* ---------- Intervalos do acorde (para desenhar) ---------- */

  function chordSpec(p) {
    var s = p.suffix.replace(/[()\/,]/g, ' ').trim();
    var st = { third: 4, fifth: 7, seventh: null, add: [], sus: null, power: false, fifthAlt: false, dim: false };
    var toks = s ? s.split(/\s+/) : [];
    var first = true;
    toks.forEach(function (tk) {
      var rest = tk, m;
      var guard = 0;
      while (rest && guard++ < 12) {
        if ((m = /^(b5|5-|♭5)/.exec(rest))) { st.fifth = 6; st.fifthAlt = true; }
        else if ((m = /^(#5|5\+|♯5)/.exec(rest))) { st.fifth = 8; st.fifthAlt = true; }
        else if ((m = /^(b9|9-)/.exec(rest))) { st.add.push(1); st.seventh = st.seventh == null ? 10 : st.seventh; }
        else if ((m = /^(#9|9\+)/.exec(rest))) { st.add.push(3); st.seventh = st.seventh == null ? 10 : st.seventh; }
        else if ((m = /^(#11|11\+)/.exec(rest))) { st.add.push(6); st.seventh = st.seventh == null ? 10 : st.seventh; }
        else if ((m = /^(b13|13-)/.exec(rest))) { st.add.push(8); st.seventh = st.seventh == null ? 10 : st.seventh; }
        else if ((m = /^(maj9|M9)/.exec(rest))) { st.seventh = 11; st.add.push(2); }
        else if ((m = /^(maj7|M7|7M|Δ7?|maj)/.exec(rest))) { st.seventh = 11; }
        else if ((m = /^(dim|°|º)/.exec(rest))) { st.third = 3; st.fifth = 6; st.fifthAlt = true; st.dim = true; }
        else if ((m = /^ø/.exec(rest))) { st.third = 3; st.fifth = 6; st.fifthAlt = true; st.seventh = 10; }
        else if ((m = /^(aug|\+)/.exec(rest))) { st.fifth = 8; st.fifthAlt = true; }
        else if ((m = /^(sus4|sus2|sus)/.exec(rest))) { st.sus = m[0] === 'sus2' ? 2 : 5; }
        else if ((m = /^(add)(\d+)/.exec(rest))) { var d = +m[2]; st.add.push(d === 9 || d === 2 ? 2 : d === 4 || d === 11 ? 5 : d === 13 || d === 6 ? 9 : 2); }
        else if ((m = /^(min|m)(?!aj)/.exec(rest))) { st.third = 3; }
        else if ((m = /^13/.exec(rest))) { if (st.seventh == null) st.seventh = 10; st.add.push(9); }
        else if ((m = /^11/.exec(rest))) { if (st.seventh == null) st.seventh = 10; st.add.push(5); }
        else if ((m = /^9/.exec(rest))) { if (st.seventh == null) st.seventh = 10; st.add.push(2); }
        else if ((m = /^7/.exec(rest))) { if (st.seventh == null) st.seventh = st.dim ? 9 : 10; }
        else if ((m = /^6/.exec(rest))) { st.add.push(9); }
        else if ((m = /^5/.exec(rest))) { st.power = true; }
        else if ((m = /^4/.exec(rest))) { st.sus = 5; }
        else if ((m = /^2/.exec(rest))) { st.add.push(2); }
        else if ((m = /^-/.exec(rest)) && first) { st.third = 3; }
        else { m = [rest[0]]; }
        rest = rest.slice(m[0].length);
        first = false;
      }
    });
    return st;
  }

  /* níveis: 0 = acorde completo; 1 = sem extensões; 2 = só base */
  function noteSets(p, st, level) {
    var req = {}, opt = {};
    req[0] = 1;
    var third = st.sus ? st.sus : st.power ? null : st.third;
    if (third != null) req[third] = 1;
    if (st.fifthAlt || (!st.seventh && !st.add.length)) req[st.fifth] = 1; else opt[st.fifth] = 1;
    if (st.power) req[7] = 1;
    if (st.seventh != null) req[st.seventh] = 1;
    if (level === 0) st.add.forEach(function (a) { req[a] = 1; });
    else st.add.forEach(function (a) { opt[a] = 1; });
    if (level >= 2 && !st.fifthAlt) { delete req[st.fifth]; opt[st.fifth] = 1; }
    var bassI = p.bassPc != null ? ((p.bassPc - p.rootPc) % 12 + 12) % 12 : 0;
    if (p.bassPc != null) req[bassI] = 1;
    Object.keys(req).forEach(function (k) { delete opt[k]; });
    return { req: Object.keys(req).map(Number), opt: Object.keys(opt).map(Number), bassI: bassI };
  }

  /* ---------- Posições no braço (violão, afinação padrão) ---------- */

  var OPEN = [40, 45, 50, 55, 59, 64];
  var MAXFRET = 15;

  function fingersFor(frets) {
    var fr = [], i;
    for (i = 0; i < 6; i++) if (frets[i] > 0) fr.push({ s: i, f: frets[i] });
    if (!fr.length) return { n: 0, barre: null };
    var minF = Math.min.apply(null, fr.map(function (x) { return x.f; }));
    var onMin = fr.filter(function (x) { return x.f === minF; });
    var barre = null, n = fr.length;
    if (onMin.length >= 2) {
      var a = onMin[0].s, b = onMin[onMin.length - 1].s, ok = true;
      for (i = a; i <= b; i++) if (frets[i] < minF) { ok = false; break; }
      if (ok) { barre = { fret: minF, from: a, to: b }; n = 1 + fr.filter(function (x) { return x.f > minF; }).length; }
    }
    return { n: n, barre: barre };
  }

  function findVoicings(rootPc, sets, minPlayed) {
    var allowed = {}, found = {}, results = [];
    var all = sets.req.concat(sets.opt);
    all.forEach(function (i) { allowed[(rootPc + i) % 12] = 1; });
    var reqPcs = sets.req.map(function (i) { return (rootPc + i) % 12; });
    var bassPc = (rootPc + sets.bassI) % 12;

    for (var base = 1; base <= 11; base++) {
      var frets = [0, 0, 0, 0, 0, 0];
      (function dfs(s, started, ended, playedCount) {
        if (s === 6) {
          if (playedCount < minPlayed) return;
          var have = {}, k, lowest = -1;
          for (k = 0; k < 6; k++) if (frets[k] >= 0) { if (lowest < 0) lowest = k; have[(OPEN[k] + frets[k]) % 12] = 1; }
          if (((OPEN[lowest] + frets[lowest]) % 12) !== bassPc) return;
          for (k = 0; k < reqPcs.length; k++) if (!have[reqPcs[k]]) return;
          var key = frets.join(',');
          if (found[key]) return;
          found[key] = 1;
          var fg = fingersFor(frets);
          if (fg.n > 4) return;
          results.push({ frets: frets.slice(), barre: fg.barre, fingers: fg.n, base: base });
          return;
        }
        var opts = [-1, 0], f;
        for (f = base; f < base + 4 && f <= MAXFRET; f++) opts.push(f);
        for (var oi = 0; oi < opts.length; oi++) {
          var v = opts[oi];
          if (v === -1) {
            if (started && !ended) { frets[s] = -1; dfs(s + 1, started, true, playedCount); }
            else if (!started) { frets[s] = -1; dfs(s + 1, false, false, playedCount); }
            continue;
          }
          if (ended) continue;
          if (!allowed[(OPEN[s] + v) % 12]) continue;
          frets[s] = v;
          dfs(s + 1, true, false, playedCount + 1);
        }
        frets[s] = 0;
      })(0, false, false, 0);
    }
    return results;
  }

  function scoreVoicing(v) {
    var muted = 0, opens = 0, minF = 99, maxF = 0, i, firstF = -1, lastF = -1;
    for (i = 0; i < 6; i++) {
      var f = v.frets[i];
      if (f < 0) muted += i < 2 ? 1.0 : 2.0;
      else if (f === 0) opens++;
      else { if (f < minF) minF = f; if (f > maxF) maxF = f; if (firstF < 0) firstF = i; lastF = i; }
    }
    var inner = 0;
    if (firstF >= 0) for (i = firstF; i <= lastF; i++) if (v.frets[i] === 0) inner++;
    var span = minF < 99 ? maxF - minF : 0;
    var s = muted - 0.4 * opens;
    if (minF < 99) s += 0.5 * minF + 0.3 * span + (span >= 3 ? 2.5 : 0);
    if (opens > 0 && minF >= 3) s += 3;
    if (minF >= 2) s += 0.8 * inner;
    if (v.barre) s += 1.0;
    s += 0.6 * Math.max(0, v.fingers - 2);
    return s;
  }


  /* formas clássicas de primeira posição, usadas como 1ª opção quando existem */
  var PRESET = {
    '0:': 'x32010', '2:': 'xx0232', '4:': '022100', '7:': '320003', '9:': 'x02220', '5:': '133211', '11:': 'x24442',
    '9:m': 'x02210', '11:m': 'x24432', '0:m': 'x35543', '2:m': 'xx0231', '4:m': '022000', '5:m': '133111', '7:m': '355333',
    '0:7': 'x32310', '2:7': 'xx0212', '4:7': '020100', '7:7': '320001', '9:7': 'x02020', '11:7': 'x21202',
    '0:maj7': 'x32000', '2:maj7': 'xx0222', '4:maj7': '021100', '5:maj7': 'xx3210', '7:maj7': '320002', '9:maj7': 'x02120',
    '9:m7': 'x02010', '11:m7': 'x20202', '2:m7': 'xx0211', '4:m7': '022030', '0:m7': 'x35343'
  };
  function presetFor(p, st) {
    if (p.bassPc != null) return null;
    var cls = null, sfx = p.suffix;
    if (sfx === '') cls = '';
    else if (sfx === 'm') cls = 'm';
    else if (sfx === '7') cls = '7';
    else if (sfx === '7M' || sfx === 'maj7' || sfx === 'M7') cls = 'maj7';
    else if (sfx === 'm7') cls = 'm7';
    var str = cls == null ? null : PRESET[p.rootPc + ':' + cls];
    if (!str) return null;
    var frets = str.split('').map(function (c) { return c === 'x' ? -1 : parseInt(c, 10); });
    var fg = fingersFor(frets);
    return { frets: frets, barre: fg.barre, fingers: fg.n, base: 1, score: -99, approx: false, omitted: [] };
  }

  var OMIT = { 1: '♭9', 2: '9ª', 3: '♯9', 5: '11ª', 6: '♯11', 8: '♯5', 9: '13ª' };
  var cache = {};

  /* devolve até `max` posições diferentes, a melhor primeiro */
  function voicingsFor(sym, max) {
    max = max || 6;
    var p = parseChord(sym);
    if (!p) return [];
    var st = chordSpec(p);
    var key = p.rootPc + '|' + p.suffix + '|' + p.bassPc;
    if (cache[key]) return cache[key].slice(0, max);

    var picked = [], seen = {};
    for (var level = 0; level <= 2 && picked.length < 3; level++) {
      var sets = noteSets(p, st, level);
      var minP = level === 2 ? 3 : 4;
      var vs = findVoicings(p.rootPc, sets, minP);
      if (!vs.length && minP > 3) vs = findVoicings(p.rootPc, sets, 3);
      vs.forEach(function (v) { v.score = scoreVoicing(v); });
      vs.sort(function (a, b) { return a.score - b.score; });
      var omitted = [];
      if (level > 0) st.add.forEach(function (a) { if (OMIT[a]) omitted.push(OMIT[a]); });
      var byPos = {};
      for (var k = 0; k < vs.length; k++) {
        var v = vs[k], pos = 99;
        v.frets.forEach(function (f) { if (f > 0 && f < pos) pos = f; });
        if (pos === 99) pos = 0;
        var bucket = pos + ':' + (v.barre ? 'b' : 'n');
        if (byPos[bucket] || seen[v.frets.join(',')]) continue;
        byPos[bucket] = 1;
        seen[v.frets.join(',')] = 1;
        v.approx = level > 0;
        v.omitted = omitted.slice();
        picked.push(v);
        if (picked.length >= 8) break;
      }
      if (level === 0 && picked.length >= 3) break;
    }
    var pre = presetFor(p, st);
    if (pre) { picked = picked.filter(function (v) { return v.frets.join(',') !== pre.frets.join(','); }); picked.unshift(pre); }
    picked.sort(function (a, b) { return (a.approx - b.approx) || (a.score - b.score); });
    var head = picked.slice(0, 1), tail = picked.slice(1);
    tail.sort(function (a, b) { return (a.approx - b.approx) || (a.score - b.score); });
    cache[key] = head.concat(tail).slice(0, 6);
    return cache[key].slice(0, max);
  }

  /* ---------- Limpeza do texto colado ---------- */

  function leadSp(s) { return s.length - s.replace(/^\s+/, '').length; }

  function serializeChordToks(toks) {
    var s = '';
    toks.forEach(function (k) {
      var col = Math.max(k.col, s.length ? s.length + 1 : 0);
      while (s.length < col) s += ' ';
      s += k.text;
    });
    return s;
  }

  function importText(raw) {
    var lines = String(raw || '').replace(/\r\n?/g, '\n').replace(/\u00a0/g, ' ').replace(/\t/g, '    ').split('\n');
    var rep = { glued: 0, joined: 0, removed: 0 };
    var meta = { title: '', artist: '', key: '', capo: '' };

    /* cabeçalho: tudo antes da primeira seção ou linha de acordes */
    var i = 0;
    while (i < lines.length && i < 14 && !sectionOf(lines[i]) && !isChordLine(lines[i])) i++;
    var headEnd = i < lines.length && (sectionOf(lines[i]) || isChordLine(lines[i])) ? i : 0;
    var head = lines.slice(0, headEnd), extra = [];
    head.forEach(function (h) {
      var t = h.trim(), m;
      if (!t) return;
      if ((m = /^Tom:\s*(.+)$/i.exec(t))) { meta.key = m[1].trim(); rep.removed++; return; }
      if (/^Afina[cç][aã]o:/i.test(t) || /^Composi[cç][aã]o/i.test(t) || /^https?:\/\//i.test(t)) { rep.removed++; return; }
      if (/^Capotraste/i.test(t)) { meta.capo = t; return; }
      if ((m = /^\[(.+?)\]\(https?:[^)]*\)$/.exec(t))) { if (!meta.artist) meta.artist = m[1].trim(); else rep.removed++; return; }
      if (!meta.title) { meta.title = t; return; }
      if (!meta.artist) { meta.artist = t; return; }
      extra.push(t);
    });
    var bodyLines = lines.slice(headEnd);

    /* objetos de linha */
    var objs = bodyLines.map(function (L) {
      var text = L.replace(/\s+$/, '');
      var trail = /\S\s+$/.test(L);
      if (!text.trim()) return { k: 'blank' };
      var sec = sectionOf(text);
      if (sec) return { k: 'section', label: sec.label, rest: sec.rest };
      if (isChordLine(text)) return { k: 'chords', toks: tokens(text) };
      return { k: 'lyric', text: text, trail: trail };
    });

    /* expande "[Solo] A B C" em seção + linha de acordes */
    var flat = [];
    objs.forEach(function (o) {
      if (o.k === 'section') {
        flat.push({ k: 'section', label: o.label });
        if (o.rest) { var cc = 0; flat.push({ k: 'chords', toks: tokens(o.rest).map(function (t) { var r = { col: cc, text: t.text }; cc += t.text.length + 2; return r; }) }); }
      } else flat.push(o);
    });
    objs = flat;

    /* acorde colado no fim da letra: "eu tô sempreA#m" */
    var out = [];
    for (i = 0; i < objs.length; i++) {
      var o = objs[i];
      if (o.k === 'lyric') {
        var m2 = /^(.*[a-zà-ÿ,.!?])([A-G][^\s]*)$/.exec(o.text);
        var cand = m2 && !/\s/.test(m2[2]) ? m2[2] : null;
        if (cand && parseChord(cand) && m2[1].trim()) {
          rep.glued++;
          o = { k: 'lyric', text: m2[1].replace(/\s+$/, ''), trail: false };
          out.push(o);
          var nx = objs[i + 1];
          if (nx && nx.k === 'lyric') {
            out.push({ k: 'chords', toks: [{ col: leadSp(nx.text), text: cand }] });
          } else out.push({ k: 'chords', toks: [{ col: 0, text: cand }] });
          continue;
        }
      }
      out.push(o);
    }
    objs = out;

    /* linhas quebradas pelo site (sobra um espaço no fim) */
    out = [];
    for (i = 0; i < objs.length; i++) {
      var a = objs[i];
      if (a.k === 'lyric' && a.trail && a.text.trim().length >= 24) {
        var b = objs[i + 1], c = objs[i + 2];
        if (b && b.k === 'lyric') {
          a = { k: 'lyric', text: a.text.replace(/\s+$/, '') + ' ' + b.text.trim(), trail: b.trail };
          rep.joined++; i += 1;
          out.push(a); continue;
        }
        if (b && b.k === 'chords' && c && c.k === 'lyric' && b.toks.every(function (t) { return chordOf(t.text); })) {
          var base = a.text.replace(/\s+$/, '').length + 1, lead = leadSp(c.text);
          var add = b.toks.map(function (t) { return { col: base + Math.max(0, t.col - lead), text: t.text }; });
          var prev = out[out.length - 1];
          if (prev && prev.k === 'chords') prev.toks = prev.toks.concat(add);
          else out.push({ k: 'chords', toks: add });
          out.push({ k: 'lyric', text: a.text.replace(/\s+$/, '') + ' ' + c.text.trim(), trail: c.trail });
          rep.joined++; i += 2; continue;
        }
      }
      out.push(a);
    }
    objs = out;

    /* texto final */
    var body = [], prevBlank = true;
    if (meta.capo) { body.push(meta.capo, ''); }
    objs.forEach(function (o) {
      if (o.k === 'blank') { if (!prevBlank) body.push(''); prevBlank = true; return; }
      prevBlank = false;
      if (o.k === 'section') body.push('[' + o.label + ']');
      else if (o.k === 'chords') body.push(serializeChordToks(o.toks));
      else body.push(o.text);
    });
    while (body.length && body[body.length - 1] === '') body.pop();
    return { title: meta.title, artist: meta.artist, key: meta.key, body: body.join('\n'), report: rep, extra: extra };
  }

  return {
    parseChord: parseChord, chordOf: chordOf, isChordLine: isChordLine, parseBody: parseBody,
    uniqueChords: uniqueChords, cleanTok: cleanTok, transposeSym: transposeSym, keyInfo: keyInfo,
    keyPrefersFlats: keyPrefersFlats, chordSpec: chordSpec, voicingsFor: voicingsFor,
    importText: importText, notePc: notePc, SHARP: SHARP, FLAT: FLAT
  };
});
