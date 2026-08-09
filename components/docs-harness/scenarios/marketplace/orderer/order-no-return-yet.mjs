// Сценарий: по ещё не полученному заказу заявление на возврат подать нельзя.
//
// Возврат привязан не к оплате, а к факту выдачи: пока имущество не передано
// пайщику, возвращать нечего, и гарантийный срок ещё даже не начался — он
// отсчитывается от выдачи. Поэтому в карточке заказа, который только оформлен,
// блок гарантийного возврата есть, но действия подачи в нём нет.
//
// Место в цепочке: строго в группе «Заказ», до отгрузки и выдачи. Позже тот же
// заказ станет полученным, и проверка перестанет воспроизводиться.
//
// Фикстура: ekaterina — её заказ на этот момент оформлен, но не выдан.

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
  title: 'Стол заказчика — возврат до выдачи недоступен',
  docPath: 'new/marketplace/orderer/order-no-return-yet.md',
  assetsDir: 'assets/new/marketplace/orderer/order-no-return-yet',
  role: 'user',
  mode: 'docs',
  fixture: 'ekaterina',
  fixtures: ['ekaterina'],
  feature: 'marketplace.return',
  cases: ['mkt.ret.side.06'],
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
  await loginAs(page, loadFixture('ekaterina'));
  await pickBranchIfAsked(page);

  await page.goto(`${env.APP_PREFIX}/${env.COOPNAME}/market/my-orders`, {
    waitUntil: 'domcontentloaded',
    timeout: 60000,
  });
  await page.waitForSelector('text=Мои заказы', { timeout: 90000 });
  await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(2500);
  await cleanViteOverlays(page);

  await page.getByText('Берёзовый сок').first().click({ force: true });
  await page.waitForFunction(
    () => document.body.innerText.includes('Гарантийный возврат'),
    { timeout: 60000 },
  );
  await page.waitForTimeout(1500);
  await cleanViteOverlays(page);

  await shot(
    page,
    '01-order-not-received',
    'Карточка оформленного, но ещё не выданного заказа. Блок гарантийного возврата на месте, но подать заявление нельзя: возврат отсчитывается от факта выдачи, а его ещё не было.',
    {
      expect: async (p) => {
        // Действия подачи быть не должно — это и есть проверяемое правило.
        await expect(p.locator('button:has-text("Подать заявление на возврат")')).toHaveCount(0);
        // Заодно убеждаемся, что заказ действительно ещё не получен: иначе
        // отсутствие кнопки означало бы что-то другое (например, уже поданное
        // заявление), и проверка была бы пустой.
        await expect(p.locator('text=Факт выдачи')).toHaveCount(0);
      },
    },
  );
};
