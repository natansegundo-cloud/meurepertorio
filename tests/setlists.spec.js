const { test, expect } = require('@playwright/test');
const fs = require('fs');

async function seedFixture(page) {
  await page.goto('/#lista');
  await page.waitForFunction(() => window.__cifras && window.__cifras.DB);
  await page.evaluate(async () => {
    const songs = [
      { id: 'pw-a', title: 'Playwright A', artist: 'Teste', key: 'C', body: 'C\nPrimeira', semi: 0, pref: 'auto' },
      { id: 'pw-b', title: 'Playwright B', artist: 'Teste', key: 'G', body: 'G\nSegunda', semi: 0, pref: 'auto' },
      { id: 'pw-c', title: 'Playwright C', artist: 'Teste', key: 'Am', body: 'Am\nTerceira', semi: 0, pref: 'auto' }
    ];
    await Promise.all(songs.map((song, i) => window.__cifras.DB.put(Object.assign(song, { createdAt: Date.now() + i, updatedAt: Date.now() + i }))));
    await window.__cifras.DB.putRepertoire({ id: 'pw-setlist', name: 'Show Playwright', items: songs.map(song => ({ songId: song.id, semi: null, pref: null })), createdAt: Date.now(), updatedAt: Date.now(), deleted: false });
  });
  await page.reload();
  await page.goto('/#repertorios');
  await expect(page.locator('.rep-card')).toContainText('Show Playwright');
}

test('editor e modo show funcionam no celular', async ({ page }) => {
  await seedFixture(page);
  await page.locator('a[href="#repertorio-pw-setlist"]').click();
  await expect(page.locator('.rep-item')).toHaveCount(3);
  await page.locator('[data-act="rep-item-down"][data-rep-index="0"]').click();
  await page.locator('[data-act="rep-item-remove"][data-rep-index="2"]').click();
  await expect(page.locator('.rep-item')).toHaveCount(2);
  await page.locator('[data-act="save-repertoire"]').click();
  await expect(page.locator('#toast')).toHaveText('Repertório salvo');
  await page.goto('/index.html#repertorios');
  await expect(page).toHaveURL(/index\.html#repertorios$/);
  await expect(page.locator('.rep-card')).toContainText('Show Playwright');
  await page.locator('[data-act="rename-repertoire"][data-rep-id="pw-setlist"]').click();
  await page.locator('#rep-name').fill('Show Playwright Renomeado');
  await page.locator('[data-act="save-repertoire"]').click();
  await expect(page.locator('#toast')).toHaveText('Repertório salvo');
  await page.goto('/index.html#repertorios');
  await expect(page).toHaveURL(/index\.html#repertorios$/);
  await page.locator('[data-act="play-setlist"][data-rep-id="pw-setlist"]').click();
  await expect(page.locator('#show-nav')).toContainText('1 de 2');
  await page.locator('[data-act="show-next"]').click();
  await expect(page.locator('#show-nav')).toContainText('2 de 2');
  await page.keyboard.press('ArrowLeft');
  await expect(page.locator('#show-nav')).toContainText('1 de 2');
  await page.locator('#show-song').dispatchEvent('touchstart', { touches: [{ identifier: 1, clientX: 280, clientY: 220 }] });
  await page.locator('#show-song').dispatchEvent('touchend', { changedTouches: [{ identifier: 1, clientX: 90, clientY: 220 }] });
  await expect(page.locator('#show-nav')).toContainText('2 de 2');
  await page.locator('[data-act="show-menu"]').click();
  await page.locator('[data-act="show-tone-up"]').click();
  await page.locator('[data-act="show-apply-rep"]').click();
  await expect(page.locator('#show-song')).toBeVisible();
  const toneCheck = await page.evaluate(async () => ({
    song: (await window.__cifras.DB.all()).find(song => song.id === 'pw-a'),
    setlist: (await window.__cifras.DB.allRepertoires()).find(rep => rep.id === 'pw-setlist')
  }));
  expect(toneCheck.song.semi).toBe(0);
  expect(toneCheck.setlist.items.some(item => item.songId === 'pw-a' && item.semi === 1)).toBeTruthy();
  await page.reload();
  await expect(page.locator('#show-nav')).toContainText('2 de 2');
  await page.context().setOffline(true);
  await page.reload();
  await expect(page.locator('#show-song')).toBeVisible();
  await page.context().setOffline(false);
});

test('salvar edição mantém a música e o voltar retorna à lista', async ({ page }) => {
  await seedFixture(page);
  await page.goto('/index.html#lista');
  await page.locator('a[href="#musica-pw-a"]').click();
  await expect(page).toHaveURL(/#musica-pw-a$/);
  await page.locator('[data-act="edit"]').click();
  await expect(page.locator('#f-title')).toHaveValue('Playwright A');
  await page.locator('#f-title').fill('Playwright A editada');
  await page.locator('[data-act="save"]').click();
  await expect(page).toHaveURL(/#musica-pw-a$/);
  await expect(page.locator('.bar .ttl b')).toHaveText('Playwright A editada');
  await page.locator('[data-act="back"]').click();
  await expect(page).toHaveURL(/#lista$/);
  await expect(page.locator('#ul')).toContainText('Playwright A editada');
});

test('migração de banco v1 preserva músicas', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  await page.goto('/migration-fixture');
  await page.evaluate(() => new Promise((resolve, reject) => {
    const del = indexedDB.deleteDatabase('caderno-cifras');
    del.onerror = () => reject(del.error);
    del.onsuccess = () => {
      const req = indexedDB.open('caderno-cifras', 1);
      req.onupgradeneeded = () => req.result.createObjectStore('songs', { keyPath: 'id' });
      req.onsuccess = () => {
        const db = req.result;
        const tx = db.transaction('songs', 'readwrite');
        tx.objectStore('songs').put({ id: 'migration-song', title: 'Música migrada', artist: '', key: 'C', body: 'C\nPreservada', updatedAt: Date.now() });
        tx.oncomplete = () => { db.close(); resolve(); };
        tx.onerror = () => reject(tx.error);
      };
      req.onerror = () => reject(req.error);
    };
  }));
  await page.goto('/#lista');
  await page.waitForFunction(() => window.__cifras && window.__cifras.S.songs.some(song => song.id === 'migration-song'));
  await expect(page.locator('#ul')).toContainText('Música migrada');
  await context.close();
});

test('backup antigo e novo restauram e não criam overflow nos temas', async ({ page }) => {
  await seedFixture(page);
  await page.goto('/index.html#lista');
  const downloadPromise = page.waitForEvent('download');
  await page.locator('[data-act="menu"]').click();
  await page.locator('[data-act="export"]').click();
  const download = await downloadPromise;
  const backup = JSON.parse(fs.readFileSync(await download.path(), 'utf8'));
  expect(backup.setlists).toHaveLength(1);

  const oldBackup = { app: 'meu-repertorio', v: 2, songs: [{ id: 'old-backup', title: 'Backup antigo', artist: '', key: 'C', body: 'C\nAntigo' }] };
  await page.locator('#pick').setInputFiles({ name: 'backup-antigo.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(oldBackup)) });
  await expect(page.locator('#toast')).toContainText('1 músicas');

  const newBackup = { app: 'meu-repertorio', v: 3, songs: [], setlists: [{ id: 'new-backup-setlist', name: 'Backup novo', items: [], createdAt: Date.now(), updatedAt: Date.now(), deleted: false }] };
  await page.locator('#pick').setInputFiles({ name: 'backup-novo.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(newBackup)) });
  await expect(page.locator('#toast')).toContainText('1 repertórios');

  for (const theme of ['dark', 'light']) {
    await page.evaluate(value => localStorage.setItem('cc:theme', JSON.stringify(value)), theme);
    await page.reload();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
  }
});
