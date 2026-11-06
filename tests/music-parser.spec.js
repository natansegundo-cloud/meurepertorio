const { test, expect } = require('@playwright/test');
const MusicParser = require('../music-parser.js');
const Cifra = require('../engine.js');

test('importa o formato copiado do Cifra Club preservando posições', () => {
  const result = MusicParser.parse([
    'Uma Vez Mais',
    'Natiruts',
    'Tom: A',
    '',
    'A7M        Bbº',
    'Mais uma vez',
    'Bm7',
    'Prisioneiro da solidão',
    'E7(9)',
    'E ela está chorando'
  ].join('\n'));

  expect(result.valid).toBeTruthy();
  expect(result.title).toBe('Uma Vez Mais');
  expect(result.artist).toBe('Natiruts');
  expect(result.key).toBe('A');
  expect(result.structure.chordCount).toBe(4);
  expect(result.structure.lines[0].kind).toBe('chord-lyric');
  expect(result.structure.lines[0].chords[0]).toEqual({ position: 0, symbol: 'A7M' });
  expect(result.structure.lines[0].chords[1]).toEqual({ position: 11, symbol: 'Bbº' });
  expect(result.structure.lines[1].chords[0].symbol).toBe('Bm7');
  expect(result.structure.lines[2].chords[0].symbol).toBe('E7(9)');
});

test('reconhece acordes complexos e acordes no meio de frases', () => {
  const result = MusicParser.parse('Verso\n\nEu [C#m7] canto [E7(9)/G#] aqui\nF#m7 A7M D7M G13 C(add9)\n\nSó letra nesta linha');
  const mixed = result.structure.lines.find(line => line.kind === 'chord-lyric');
  const chords = result.structure.lines.flatMap(line => line.chords || []).map(chord => chord.symbol);

  expect(mixed.lyric).toBe('Eu  canto  aqui');
  expect(mixed.chords.map(chord => chord.position)).toEqual([3, 10]);
  expect(chords).toEqual(expect.arrayContaining(['C#m7', 'E7(9)/G#', 'F#m7', 'A7M', 'D7M', 'G13', 'C(add9)']));
  expect(result.structure.lines.some(line => line.kind === 'lyric' && line.text === 'Só letra nesta linha')).toBeTruthy();
});

test('funciona sem tom e mantém a posição durante transposição', () => {
  const result = MusicParser.parse('Bm7\nLinha sem título\n\nA/C#    G7(13)');
  expect(result.valid).toBeTruthy();
  expect(result.key).toBe('');
  expect(result.structure.lines[0].chords[0].symbol).toBe('Bm7');
  expect(Cifra.transposeSym('A/C#', 2, 'sharp', false)).toBe('B/D#');
  expect(Cifra.transposeSym('E7(9)', -2, 'flat', false)).toBe('D7(9)');
});

test('rejeita conteúdo vazio sem criar estrutura falsa', () => {
  const result = MusicParser.parse(' \n\t ');
  expect(result.valid).toBeFalsy();
  expect(result.errors.length).toBeGreaterThan(0);
});
