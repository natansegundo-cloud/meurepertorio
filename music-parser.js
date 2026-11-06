/* Music Parser: importa cifras copiadas de sites sem depender da interface.
   Mantém as posições dos acordes em uma estrutura JSON e também gera body
   textual para preservar compatibilidade com músicas antigas. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.MusicParser = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var ZERO = /[\u200B-\u200D\u2060\uFEFF\u00AD]/g;
  var IGNORE = /^(?:\||\|\||\(|\)|\[|\]|[x×]\d+|\d+[x×]|-|–|—|\/|\.{2,}|%|\*|N\.?C\.?|→|>|<|:|\d+ª?)$/i;
  var CHORD_SUFFIX = /^(?:(?:maj|min|dim|aug|sus|add|alt)|[mM°ºø+\-−]|\d|[#♯b♭]|[()\/,])*$/i;

  function normalizeText(value) {
    var source = String(value == null ? '' : value).replace(/\r\n?/g, '\n').replace(/[\u2028\u2029]/g, '\n').replace(ZERO, '').replace(/\u00A0/g, ' ');
    return source.split('\n').map(function (line) {
      var out = '', col = 0;
      for (var i = 0; i < line.length; i++) {
        if (line[i] === '\t') {
          var spaces = 4 - (col % 4);
          out += new Array(spaces + 1).join(' '); col += spaces;
        } else { out += line[i]; col++; }
      }
      return out;
    }).join('\n');
  }

  function tokenValue(value) {
    var s = String(value == null ? '' : value).replace(ZERO, '').normalize('NFC').trim();
    s = s.replace(/^[[{<]+/, '').replace(/[\]}>]+$/, '').replace(/[.,;:!?]+$/, '');
    return s.replace(/[♯＃]/g, '#').replace(/[♭]/g, 'b');
  }

  function note(value) {
    var letter = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[value[0].toUpperCase()];
    if (letter == null) return null;
    for (var i = 1; i < value.length; i++) letter += value[i] === '#' ? 1 : -1;
    return ((letter % 12) + 12) % 12;
  }

  /* Reconhecimento flexível, mas limitado a tokens que têm sintaxe musical. */
  function chord(value, allowRootOnly) {
    var raw = String(value == null ? '' : value).replace(ZERO, '').normalize('NFC').trim();
    var bracketed = /^\[([^\]]+)\]$/.exec(raw);
    if (bracketed) raw = bracketed[1];
    raw = raw.replace(/[♯＃]/g, '#').replace(/[♭]/g, 'b').replace(/[−]/g, '-');
    raw = raw.replace(/^[[{<]+/, '').replace(/[\]}>]+$/, '').replace(/[.,;:!?]+$/, '');
    var m = /^([A-G])([#b]?)(.*)$/.exec(raw);
    if (!m || (!allowRootOnly && !m[3])) return null;
    var suffix = m[3], depth = 0;
    for (var i = 0; i < suffix.length; i++) {
      if (suffix[i] === '(') depth++;
      if (suffix[i] === ')' && --depth < 0) return null;
    }
    if (depth) return null;
    var bass = null, slash = -1, inner = 0;
    for (i = 0; i < suffix.length; i++) {
      if (suffix[i] === '(') inner++;
      else if (suffix[i] === ')') inner--;
      else if (suffix[i] === '/' && !inner) { slash = i; break; }
    }
    if (slash >= 0) {
      bass = /^([A-G][#b]?)$/.exec(suffix.slice(slash + 1));
      if (!bass) return null;
      bass = bass[1]; suffix = suffix.slice(0, slash);
    }
    if (!CHORD_SUFFIX.test(suffix)) return null;
    return { symbol: m[1] + m[2] + suffix + (bass ? '/' + bass : ''), root: m[1] + m[2], suffix: suffix, bass: bass, rootPc: note(m[1] + m[2]), bassPc: bass ? note(bass) : null };
  }

  function tokens(line) {
    var out = [], re = /\S+/g, m;
    while ((m = re.exec(line))) out.push({ col: m.index, text: m[0] });
    return out;
  }

  function isChordLine(line) {
    var list = tokens(line), found = 0;
    if (!list.length) return false;
    for (var i = 0; i < list.length; i++) {
      var value = tokenValue(list[i].text);
      if (chord(value, true)) found++;
      else if (!IGNORE.test(value)) return false;
    }
    return found > 0;
  }

  function chordItems(line) {
    return tokens(line).map(function (item) {
      var parsed = chord(tokenValue(item.text), true);
      return parsed ? { position: item.col, symbol: parsed.symbol } : null;
    }).filter(Boolean);
  }

  function addSpan(list, start, end, symbol) {
    if (list.some(function (item) { return item.start === start && item.end === end; })) return;
    list.push({ start: start, end: end, symbol: symbol });
  }

  function spans(line) {
    var out = [], bracket = /\[([^\]]+)\]/g, m;
    while ((m = bracket.exec(line))) {
      var inBracket = chord(m[1], true);
      if (inBracket) addSpan(out, m.index, m.index + m[0].length, inBracket.symbol);
    }
    tokens(line).forEach(function (item) {
      var value = tokenValue(item.text), parsed = chord(value, false);
      if (parsed) {
        var offset = item.text.indexOf(value);
        var wholeBracket = /^\[[^\]]+\]$/.test(item.text);
        addSpan(out, wholeBracket ? item.col : item.col + Math.max(0, offset), item.col + item.text.length, parsed.symbol);
      }
    });
    return out.sort(function (a, b) { return a.start - b.start; });
  }

  function removeSpans(line, list) {
    var text = '', cursor = 0, removed = 0, chords = [];
    list.forEach(function (item) {
      text += line.slice(cursor, item.start);
      chords.push({ position: item.start - removed, symbol: item.symbol });
      removed += item.end - item.start;
      cursor = item.end;
    });
    text += line.slice(cursor);
    return { lyric: text.replace(/\s+$/, ''), chords: chords };
  }

  function section(line) {
    var m = /^\s*\[([^\]]+)\]\s*(.*)$/.exec(line);
    if (m) return { label: m[1].trim(), rest: m[2] };
    m = /^\s*((?:intro|vers(?:o|os)?\s*\d*|refr(?:ão|ao)\s*\d*|pré[- ]?refr(?:ão|ao)|ponte|solo|final))\s*:?[ \t]*(.*)$/i.exec(line);
    return m ? { label: m[1].trim(), rest: m[2] } : null;
  }

  function lineObject(line) {
    var text = line.replace(/\s+$/, '');
    if (!text.trim()) return { kind: 'blank' };
    var sec = section(text);
    if (sec && (!sec.rest || isChordLine(sec.rest))) return { kind: 'section', label: sec.label, rest: sec.rest };
    if (isChordLine(text)) return { kind: 'chords', chords: chordItems(text) };
    var found = spans(text);
    if (found.length) {
      var mixed = removeSpans(text, found);
      if (mixed.lyric.trim()) return { kind: 'chord-lyric', lyric: mixed.lyric, chords: mixed.chords };
      return { kind: 'chords', chords: mixed.chords };
    }
    return { kind: 'lyric', text: text };
  }

  function serializeChords(list) {
    var out = '';
    (list || []).forEach(function (item) {
      var position = Math.max(0, Number(item.position) || 0);
      if (position < out.length) position = out.length + 1;
      while (out.length < position) out += ' ';
      out += item.symbol;
    });
    return out;
  }

  function parseLines(lines) {
    var result = [], i;
    for (i = 0; i < lines.length; i++) {
      var current = lineObject(lines[i]);
      if (current.kind === 'section') {
        result.push({ kind: 'section', label: current.label });
        if (current.rest) result.push({ kind: 'chords', chords: chordItems(current.rest) });
        continue;
      }
      if (current.kind === 'chords' && i + 1 < lines.length) {
        var next = lineObject(lines[i + 1]);
        if (next.kind === 'lyric') {
          result.push({ kind: 'chord-lyric', lyric: next.text, chords: current.chords }); i++; continue;
        }
      }
      result.push(current);
    }
    while (result.length && result[result.length - 1].kind === 'blank') result.pop();
    return result;
  }

  function bodyFromLines(lines, capo) {
    var out = [];
    if (capo) out.push(capo, '');
    (lines || []).forEach(function (line) {
      if (line.kind === 'blank') out.push('');
      else if (line.kind === 'section') out.push('[' + line.label + ']');
      else if (line.kind === 'chords') out.push(serializeChords(line.chords));
      else if (line.kind === 'chord-lyric') out.push(serializeChords(line.chords), line.lyric);
      else out.push(line.text || '');
    });
    while (out.length && out[out.length - 1] === '') out.pop();
    return out.join('\n');
  }

  function headerInfo(lines, options) {
    if (options && options.extractMeta === false) return { start: 0, title: '', artist: '', key: '', capo: '', remove: {} };
    var marker = -1, explicit = {}, i;
    for (i = 0; i < lines.length; i++) {
      var t = lines[i].trim(), m;
      if ((m = /^(?:título|titulo|música|musica)\s*:\s*(.+)$/i.exec(t))) explicit.title = m[1].trim();
      if ((m = /^artista\s*:\s*(.+)$/i.exec(t))) explicit.artist = m[1].trim();
      if ((m = /^tom\s*:\s*(.+)$/i.exec(t))) explicit.key = m[1].trim();
      if (/^capotraste\b/i.test(t)) explicit.capo = t;
      if (/^\[[^\]]+\]\(https?:[^)]*\)$/i.test(t)) continue;
      if (section(lines[i]) || isChordLine(lines[i]) || spans(lines[i]).length) { marker = i; break; }
    }
    if (marker < 0 && !explicit.title && !explicit.artist && !explicit.key && !explicit.capo) return { start: 0, title: '', artist: '', key: '', capo: '', remove: {} };
    var headEnd = marker < 0 ? lines.length : marker, title = explicit.title || '', artist = explicit.artist || '', key = explicit.key || '', capo = explicit.capo || '', remove = {};
    for (i = 0; i < headEnd; i++) {
      var line = lines[i], text = line.trim(), match;
      if (!text) continue;
      if (/^(?:título|titulo|música|musica)\s*:/i.test(text) || /^artista\s*:/i.test(text) || /^tom\s*:/i.test(text)) { remove[i] = true; continue; }
      if (/^capotraste\b/i.test(text)) { capo = capo || text; continue; }
      if ((match = /^\[([^\]]+)\]\(https?:[^)]*\)$/i.exec(text))) { artist = artist || match[1].trim(); remove[i] = true; continue; }
      if (/^https?:\/\//i.test(text) || /^afina[cç][aã]o\s*:/i.test(text)) { remove[i] = true; continue; }
      if (marker < 0) continue;
      if (!title) { title = text; remove[i] = true; }
      else if (!artist) { artist = text; remove[i] = true; }
      else remove[i] = true;
    }
    return { start: marker < 0 ? 0 : marker, title: title, artist: artist, key: key, capo: capo, remove: remove };
  }

  function parse(raw, options) {
    var normalized = normalizeText(raw), all = normalized.split('\n'), head = headerInfo(all, options || {}), bodyLines = [];
    for (var i = head.start; i < all.length; i++) if (!head.remove[i]) bodyLines.push(all[i]);
    var lines = parseLines(bodyLines), body = bodyFromLines(lines, head.capo), nonBlank = lines.some(function (line) { return line.kind !== 'blank'; });
    var chordCount = lines.reduce(function (n, line) { return n + (line.chords ? line.chords.length : 0); }, 0);
    var lyricCount = lines.reduce(function (n, line) { return n + (line.kind === 'lyric' || line.kind === 'chord-lyric' ? 1 : 0); }, 0);
    var errors = [];
    if (!String(raw || '').trim()) errors.push('Cole o conteúdo completo da música.');
    if (!nonBlank) errors.push('Não encontrei letra nem acordes válidos.');
    return {
      valid: !errors.length,
      errors: errors,
      title: head.title,
      artist: head.artist,
      key: head.key,
      capo: head.capo,
      body: body,
      structure: { version: 1, lines: lines, chordCount: chordCount, lyricCount: lyricCount },
      report: { chords: chordCount, lines: lines.length }
    };
  }

  return { parse: parse, normalizeText: normalizeText, chord: chord, isChordLine: isChordLine, parseLines: parseLines, bodyFromLines: bodyFromLines };
});
