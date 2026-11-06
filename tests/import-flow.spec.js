const { test, expect } = require('@playwright/test');

test('cola, interpreta e salva diretamente sem etapa de prévia', async ({ page }) => {
  await page.goto('/index.html#nova');
  await page.locator('#f-body').waitFor();
  expect(await page.locator('#song').count()).toBe(0);

  await page.locator('#f-body').fill([
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
  await page.locator('[data-act="import-save"]').click();
  await expect(page.locator('#toast')).toHaveText('Cifra salva');
  await expect(page).toHaveURL(/#musica-/);
  await expect(page.locator('.song .ch')).toHaveCount(4);

  const song = await page.evaluate(() => window.__cifras.S.cur);
  expect(song.title).toBe('Uma Vez Mais');
  expect(song.key).toBe('A');
  expect(song.structure.chordCount).toBe(4);
  expect(song.structure.lines[0].chords[1].position).toBe(11);
});

test('não salva conteúdo inválido', async ({ page }) => {
  await page.goto('/index.html#nova');
  await page.locator('#f-body').fill('   \n\t ');
  await page.locator('[data-act="import-save"]').click();
  await expect(page.locator('#err')).toContainText('Cole o conteúdo completo');
  expect(page.url()).toMatch(/#nova$/);
});
