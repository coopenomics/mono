// Сценарий: председатель кооперативного участка принимает возвращаемое
// имущество по заявлению пайщика.
//
// Обработка заявления двухступенчатая, и обе ступени делает один и тот же
// человек на одном столе:
//
//  1. удалённо, по фотографиям — пригласить пайщика на очный осмотр либо
//     отказать сразу;
//  2. очно, с имуществом на руках — принять возврат либо отказать на месте.
//
// Принятие возврата — единственный шаг, который двигает деньги: средства
// восстанавливаются пайщику, а имущество зачисляется на склад участка
// обезличенным остатком кооператива. Этот остаток потом и становится
// кандидатом на списание.
//
// Фикстура: chairkrg — председатель КУ Красногорск, к нему привязан заказ.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loginAs, pickBranchIfAsked } from '../../../lib/harness.mjs';
import { acceptFirstReturnClaim } from '../../../lib/marketplace-returns.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const loadFixture = (username) =>
  JSON.parse(
    fs.readFileSync(path.resolve(__dirname, `../../../state/participants/${username}.json`), 'utf8'),
  );

/** Что председатель пишет пайщику, приглашая на очный осмотр. */
const VISIT_INVITE = 'Приходите с продукцией в часы работы участка — осмотрим на месте.';

/** Результат очного осмотра — обязательное поле, без него приём не подтвердить. */
const INSPECTION_RESULT =
  'Упаковка вскрыта, продукт с посторонним запахом — дефект подтверждён при осмотре.';

export const meta = {
  title: 'Стол ПВЗ — приём возвращаемого имущества',
  assetsDir: 'assets/new/marketplace/operator/return-accept',
  role: 'user',
  mode: 'docs',
  fixture: 'chairkrg',
  fixtures: ['chairkrg'],
  feature: 'marketplace.return',
  cases: ['mkt.ret.happy.02'],
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
      texts: { visitInvite: VISIT_INVITE, inspectionResult: INSPECTION_RESULT },
      captions: {
        list: 'Лента гарантийных возвратов участка: заявление пайщика ждёт рассмотрения. Табы разделяют работу по стадиям — ждут рассмотрения, ожидают визита, архив.',
        detail:
          'Карточка заявления: обращение пайщика, фотографии товара, суммы к возврату и хронология. Отсюда принимается решение.',
        remoteDecision:
          'Удалённое решение по фотографиям: пригласить заказчика на очный осмотр либо отказать сразу. Отказ обязан быть мотивирован, приглашение — нет.',
        approvedForVisit:
          'Заявление одобрено к очному осмотру: пайщик приглашён на участок с имуществом. Пока осмотр не проведён, деньги не двигаются.',
        onsiteInspection:
          'Очный осмотр: председатель фиксирует, что обнаружено, и принимает возврат. Подтверждение — вторая подпись на том же заявлении пайщика, контракт требует обе.',
        accepted:
          'Возврат принят: средства восстановлены пайщику, имущество зачислено на склад участка обезличенным остатком кооператива. Дальше председатель либо предлагает его снова, либо списывает.',
      },
    }
  );
};
