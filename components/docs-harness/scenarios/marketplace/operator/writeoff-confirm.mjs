// Сценарий: председатель кооперативного участка проводит списание со склада.
//
// Утверждение совета само по себе имущество не списывает — оно лишь разрешает
// списание. Фактическое выбытие оформляет председатель того участка, на складе
// которого имущество лежит: он подписывает Служебную записку о списании, и
// только после его подписи позиция снимается с учёта. Гранулярность
// поучастковая: один протокол совета может касаться складов нескольких КУ, и
// каждый подтверждает своё.
//
// Фикстура: chairkrg — председатель Красногорск.

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
  title: 'Стол ПВЗ — проведение списания со склада',
  docPath: 'new/marketplace/operator/writeoffs.md',
  assetsDir: 'assets/new/marketplace/operator/writeoffs',
  role: 'user',
  mode: 'docs',
  fixture: 'chairkrg',
  fixtures: ['chairkrg'],
  feature: 'marketplace.writeoff',
  cases: ['mkt.wof.happy.03'],
  prepare: [
    'marketplace:01-l1-accept',
    'marketplace:02-branches',
    'marketplace:03-assign-branches',
    'marketplace:04-supplier',
    'marketplace:05-sign-offer',
    'marketplace-deposits:fund',
  ],
};

export default async ({ page, shot, expect }) => {
  await loginAs(page, loadFixture('chairkrg'));
  await pickBranchIfAsked(page);

  await page.goto(`${env.APP_PREFIX}/${env.COOPNAME}/market-pvz/warehouse/writeoffs`, {
    waitUntil: 'domcontentloaded',
    timeout: 60000,
  });
  await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(2500);
  await cleanViteOverlays(page);

  // Утверждённое советом списание обязано ждать здесь подтверждения склада.
  const confirmBtn = page.locator('button:has-text("Подтвердить списание")').first();
  await confirmBtn.waitFor({ state: 'visible', timeout: 60000 });

  await shot(
    page,
    '01-pending-confirmation',
    'Списание, утверждённое советом, ждёт подтверждения склада: состав имущества, причина и ссылка на протокол совета. Пока подпись не поставлена, имущество числится на складе.',
  );

  await confirmBtn.click();

  const dialog = page.locator('.q-dialog').filter({ hasText: 'Подтверждение списания со склада' }).first();
  await dialog.waitFor({ state: 'visible', timeout: 30000 });
  await dialog.locator('.confirm-writeoff__doc').waitFor({ state: 'visible', timeout: 60000 });
  await page.waitForTimeout(800);
  await cleanViteOverlays(page);

  await shot(
    page,
    '02-service-memo',
    'Служебная записка о списании: подписав её, председатель участка подтверждает фактическое выбытие имущества со склада и снятие его с учёта.',
  );

  await dialog.locator('button:has-text("Подписать и списать")').last().click();

  // Списание проводится на цепи попозиционно — ждём дольше обычного.
  await page.locator('text=Нет списаний на подтверждение').first()
    .waitFor({ state: 'visible', timeout: 180000 });
  await page.waitForTimeout(1500);
  await cleanViteOverlays(page);

  await shot(
    page,
    '03-executed',
    'Имущество списано: подтверждать на участке больше нечего. Позиция снята со склада, проект списания ушёл в архив исполненным.',
    {
      expect: async (p) => {
        // Проверяем результат, а не факт подписи: очередь подтверждений на
        // участке обязана опустеть, а действие — исчезнуть.
        await expect(p.locator('text=Нет списаний на подтверждение').first())
          .toBeVisible({ timeout: 20000 });
        await expect(p.locator('button:has-text("Подтвердить списание")')).toHaveCount(0);
      },
    },
  );
};
