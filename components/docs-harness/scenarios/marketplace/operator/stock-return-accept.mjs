// Сценарий: председатель участка принимает возврат по заказу из остатка
// кооператива.
//
// Тот же двухступенчатый порядок, что и для обычного заказа (удалённое
// решение → очный осмотр), но результат другой: имущество возвращается
// кооперативу — обратно в тот самый обезличенный остаток, из которого оно
// было продано, а не первому заказчику, чей заказ этот остаток породил.
//
// Фикстура: chairkrg / Иванов Пётр Сергеевич — председатель КУ Красногорск.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loginAs, pickBranchIfAsked } from '../../../lib/harness.mjs';
import { acceptFirstReturnClaim } from '../../../lib/marketplace-returns.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const loadFixture = (username) =>
  JSON.parse(fs.readFileSync(path.resolve(__dirname, `../../../state/participants/${username}.json`), 'utf8'));

export const meta = {
  title: 'Стол ПВЗ — приём возврата по заказу из остатка',
  docPath: 'new/marketplace/operator/stock-return-accept.md',
  assetsDir: 'assets/new/marketplace/operator/stock-return-accept',
  role: 'user',
  mode: 'docs',
  fixture: 'chairkrg',
  fixtures: ['chairkrg'],
  feature: 'marketplace.stock',
  cases: ['mkt.stock.happy.05'],
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

  await acceptFirstReturnClaim(
    { page, shot, expect },
    {
      texts: {
        visitInvite:
          'Приходите с имуществом на участок — осмотрим на месте и примем возврат по гарантии кооператива.',
        inspectionResult:
          'Повреждение упаковки подтверждено при осмотре. Имущество возвращается в остаток кооператива.',
      },
      captions: {
        list: 'Лента возвратов участка: заявление второго пайщика по заказу из остатка кооператива. Для оператора оно ничем не отличается от обычного.',
        detail:
          'Карточка заявления: продавцом здесь был сам кооператив, поэтому и возврат идёт в его пользу — имущество вернётся на склад участка.',
        remoteDecision:
          'Удалённое решение по фотографиям: пайщика приглашают на очный осмотр. До осмотра деньги не двигаются.',
        approvedForVisit:
          'Заявление одобрено к осмотру. Позиция остатка при этом остаётся числиться за заказом второго пайщика.',
        onsiteInspection:
          'Очный осмотр: председатель фиксирует результат и принимает возврат второй подписью на заявлении пайщика.',
        accepted:
          'Возврат принят: деньги восстановлены второму пайщику, а имущество вернулось кооперативу — в тот же обезличенный остаток участка, откуда было продано. Первый заказчик к нему отношения не имеет.',
      },
    }
  );
};
