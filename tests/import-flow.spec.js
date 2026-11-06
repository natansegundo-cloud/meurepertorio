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
  await expect(page.locator('#stripwrap .strip')).toHaveCount(0);
  await page.locator('[data-act="smenu"]').click();
  await expect(page.locator('[data-act="strip"]')).toContainText('Mostrar desenhos');
  await page.locator('[data-act="strip"]').click();
  await expect(page.locator('#stripwrap .strip')).toHaveCount(1);
  await page.locator('[data-act="smenu"]').click();
  await page.locator('[data-act="strip"]').click();
  await expect(page.locator('#stripwrap .strip')).toHaveCount(0);
});

test('não salva conteúdo inválido', async ({ page }) => {
  await page.goto('/index.html#nova');
  await page.locator('#f-body').fill('   \n\t ');
  await page.locator('[data-act="import-save"]').click();
  await expect(page.locator('#err')).toContainText('Cole o conteúdo completo');
  expect(page.url()).toMatch(/#nova$/);
});

test('reprocessa música antiga sem estrutura e exibe acordes clicáveis', async ({ page }) => {
  await page.goto('/index.html#lista');
  await page.waitForFunction(() => window.__cifras && window.__cifras.DB);
  await page.evaluate(() => window.__cifras.DB.put({
    id: 'old-structure', title: 'Cifra antiga', artist: '', key: 'A',
    body: 'A7M        Bbº\nMais uma vez\nBm7\nPrisioneiro da solidão',
    createdAt: Date.now(), updatedAt: Date.now(), semi: 0, pref: 'auto'
  }));
  await page.reload();
  await page.goto('/index.html#musica-old-structure');
  await expect(page.locator('.song .ch')).toHaveCount(3);
  const song = await page.evaluate(() => window.__cifras.S.cur);
  expect(song.structure.chordCount).toBe(3);
});
