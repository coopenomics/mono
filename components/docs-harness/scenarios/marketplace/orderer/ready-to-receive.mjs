// Сценарий: orderer-стол «Готово к получению» (Story 6.7).
// Лента заказов в статусе READY_TO_RECEIVE — то, что пайщик сейчас может
// забрать на ПВЗ. Снимаем заполненную ленту пайщицы Екатерины: её заказ
// прошёл магистраль до открытия выдачи председателем КУ (signiss1) и теперь
// ждёт получения. Финальная подпись получения (signiss2) выполняется на столе
// оператора ПВЗ при сверке штрих-кода — здесь только очередь самого пайщика.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cleanViteOverlays, env, loginAs } from '../../../lib/harness.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const loadFixture = (username) =>
  JSON.parse(
    fs.readFileSync(path.resolve(__dirname, `../../../state/participants/${username}.json`), 'utf8'),
  );

export const meta = {
  title: 'Стол заказчика — «Готово к получению»',
  docPath: 'new/marketplace/orderer/ready-to-receive.md',
  assetsDir: 'assets/new/marketplace/orderer/ready-to-receive',
  role: 'user',
  fixture: 'ekaterina',
  fixtures: ['ekaterina'],
};

async function signAllAgreements(page) {
  for (let i = 0; i < 8; i++) {
    const clicked = await page.evaluate(() => {
      const portals = Array.from(document.querySelectorAll('[id^="q-portal--dialog--"]'))
        .filter((p) => getComputedStyle(p).display !== 'none');
      if (portals.length === 0) return false;
      const top = portals[portals.length - 1];
      const btn = Array.from(top.querySelectorAll('button'))
        .find((b) => b.textContent?.trim() === 'Подписать' && !b.disabled);
      if (!btn) return false;
      btn.scrollIntoView({ block: 'center', behavior: 'instant' });
      btn.click();
      return true;
    });
    if (!clicked) break;
    await page.waitForTimeout(3500);
  }
}

export default async ({ page, shot }) => {
  const fixture = loadFixture('ekaterina');

  await loginAs(page, fixture);
  await page.evaluate(() => localStorage.setItem('harness:noBranchOverlay', '1'));

  await page.waitForFunction(
    () => !document.body.innerText.includes('Формируем документ'),
    { timeout: 30000 },
  ).catch(() => {});
  await page.waitForTimeout(1500);
  await signAllAgreements(page);
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});

  // Навигация с ретраем: core-guard роута асинхронно проверяет agreements/роли,
  // и на холодном/нагруженном стенде может отбросить на /user/wallet (онбординг)
  // до того, как marketplace-сессия загрузится. Повторяем переход, пока URL
  // не закрепится на market/ready-to-receive.
  const target = `${env.APP_PREFIX}/${env.COOPNAME}/market/ready-to-receive`;
  for (let attempt = 0; attempt < 5; attempt++) {
    await page.goto(target, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});
    await page.waitForTimeout(2500);
    await signAllAgreements(page);
    if (page.url().includes('ready-to-receive')) break;
    await page.waitForTimeout(2000);
  }
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(1500);
  await cleanViteOverlays(page);

  await shot(
    page,
    '01-ready-to-receive',
    `Раздел «Готово к получению» пайщицы Екатерины: лента её заказов в статусе READY_TO_RECEIVE. По заказу видны идентификатор, пункт выдачи (КУ krg), количество, сумма и дата открытия выдачи председателем участка. Это сигнал «приходи на ПВЗ за имуществом»; саму выдачу с финальной подписью оформляет оператор на ПВЗ при сверке штрих-кода.`,
  );
};
