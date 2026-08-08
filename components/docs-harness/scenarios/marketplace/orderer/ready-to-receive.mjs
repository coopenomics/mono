// Сценарий: заказ получен — что видит заказчица после выдачи.
//
// Акт выдачи подписывает оператор на пункте выдачи («Подписать и отправить
// пайщику»), после чего заказ у заказчицы переходит в «Получен». Отдельной
// страницы «Готово к получению» больше нет — состояние заказа видно в «Моих
// заказах», а код получения живёт в разделе «Показать QR».
//
// Фикстура: ekaterina / Смирнова Екатерина Александровна.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cleanViteOverlays, env, loginAs, pickBranchIfAsked } from '../../../lib/harness.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const loadFixture = (username) =>
  JSON.parse(
    fs.readFileSync(path.resolve(__dirname, `../../../state/participants/${username}.json`), 'utf8'),
  );

export const meta = {
  mode: 'docs',
  feature: 'marketplace.issuance',
  cases: ['mkt.iss.happy.02'],
  fixtures: ['ekaterina'],
  prepare: [
    'marketplace:01-l1-accept',
    'marketplace:02-branches',
    'marketplace:03-assign-branches',
    'marketplace:04-supplier',
    'marketplace:05-sign-offer',
    'marketplace-deposits:fund',
  ],
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

export default async ({ page, shot, expect }) => {
  await loginAs(page, loadFixture('ekaterina'));
  await pickBranchIfAsked(page);

  await page.goto(`${env.APP_PREFIX}/${env.COOPNAME}/market/my-orders`, {
    waitUntil: 'domcontentloaded',
    timeout: 60000,
  });
  await page.waitForSelector('text=Мои заказы', { timeout: 90000 });
  await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(3000);
  await cleanViteOverlays(page);

  await shot(
    page,
    '01-order-received',
    'Заказ после выдачи: статус «Получен», указаны количество, сумма и пункт выдачи. Табы позволяют смотреть заказы по стадиям — от ожидания поставщика до полученных.',
    {
      expect: async (p) => {
        await expect(p.locator('text=Получен').first()).toBeVisible({ timeout: 20000 });
        // Сумму не сверяем числом: она зависит от количества в заказе и от
        // размера членского взноса, и хардкод ломается при любой правке
        // сценария оформления. Проверяем, что карточка заказа на месте и
        // сумма вообще показана.
        await expect(p.locator('text=Берёзовый сок').first()).toBeVisible({ timeout: 20000 });
        await expect(p.locator('text=СУММА').first()).toBeVisible({ timeout: 20000 });
      },
    },
  );
};
