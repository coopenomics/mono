// Сценарий: оператор участка ставит закрывающую подпись на акте приёмки.
//
// Порядок подписей при приёмке: сначала поставщик (очно, в момент передачи
// имущества), затем оператор участка. Только после закрывающей подписи
// имущество оприходуется на склад участка и становится доступным к выдаче.
//
// Закрывающую подпись на участке накладывает ОПЕРАТОР (решение владельца
// 2026-08-13): председатель совета кооператива в Столе заказов не участвует.
// On-chain действие и роль в коде прежние — сменились только имена, которые
// читает человек.
//
// Прежняя версия сценария требовала ручного ввода «ID кооперативного участка»
// — такого шага больше нет: активный участок берётся из контекста стола.
//
// Фикстура: chairkrg / Иванов Пётр Сергеевич — оператор Красногорск.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cleanViteOverlays, env, loginAs, pickBranchIfAsked } from '../../../lib/harness.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const loadFixture = (username) =>
  JSON.parse(fs.readFileSync(path.resolve(__dirname, `../../../state/participants/${username}.json`), 'utf8'));

export const meta = {
  title: 'Стол ПВЗ — закрывающая подпись приёмки',
  assetsDir: 'assets/new/marketplace/operator/apl-reception-chairman-sign',
  role: 'user',
  mode: 'docs',
  fixture: 'chairkrg',
  fixtures: ['chairkrg'],
  feature: 'marketplace.supply',
  cases: ['mkt.supply.happy.03'],
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

  await page.goto(`${env.APP_PREFIX}/${env.COOPNAME}/market-pvz/reception`, {
    waitUntil: 'domcontentloaded',
    timeout: 60000,
  });
  await page.waitForSelector('text=Ожидаемые поставки', { timeout: 60000 });
  await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(2500);
  await cleanViteOverlays(page);

  await shot(
    page,
    '01-waiting-chairman',
    'Акт приёмки после подписи поставщика: на карточке видно время приёмки и время подписи поставщика, статус — «Ждёт подписи оператора». Имущество ещё не на складе участка.',
    {
      expect: async (p) => {
        await expect(p.locator('text=Ждёт подписи оператора').first()).toBeVisible({ timeout: 20000 });
        await expect(p.locator('text=Поставщик подписал').first()).toBeVisible({ timeout: 20000 });
      },
    },
  );

  // Действие на карточке подписано как «Подписать оператором»; смешивать
  // text= и CSS в одном селекторе нельзя — Playwright такой список не разбирает.
  await page.getByText('Подписать оператором').first().click();
  await page.waitForTimeout(5000);
  await cleanViteOverlays(page);

  await shot(
    page,
    '02-sign-dialog',
    'Акт перед закрывающей подписью: состав партии и сумма поставки. Подпись оператора участка завершает приёмку.',
  );

  // Кнопка подтверждения — в подвале диалога, а не на карточке под ним.
  // При включённом адресном хранении (Эпик 19) диалог двухшаговый:
  // «Сверка» → «Продолжить» → «Оприходование» → «Подписать и оприходовать».
  // Без адресного хранения шаг один, и кнопка называется просто «Подписать».
  const nextBtn = page.locator('.q-dialog button:has-text("Продолжить")').last();
  if (await nextBtn.count()) {
    await nextBtn.click();
    await page.waitForTimeout(2000);
    await cleanViteOverlays(page);
    await shot(
      page,
      '02b-posting-step',
      'Шаг «Оприходование»: принятое имущество можно сразу разложить по местам — в бокс или ячейку склада. Указание места не обязательно: неразложенное останется в колонке «Поступило» стола раскладки, откуда его можно разместить позже.',
    );
  }
  await page.locator('.q-dialog button:has-text("Подписать")').last().click();
  await page.waitForTimeout(10000);
  await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});
  await cleanViteOverlays(page);

  await shot(
    page,
    '03-after-sign',
    'Приёмка завершена: акт подписан обеими сторонами, имущество оприходовано на склад участка и готово к выдаче заказчикам.',
    {
      preserveNotifications: true,
      expect: async (p) => {
        // Ожидание подписи оператора обязано исчезнуть.
        await expect(p.locator('text=Ждёт подписи оператора')).toHaveCount(0, { timeout: 20000 });
      },
    },
  );
};
