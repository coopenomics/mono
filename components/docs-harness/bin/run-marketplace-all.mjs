#!/usr/bin/env node
/**
 * Сюита UI-тестов Стола заказов: `pnpm test:ui:marketplace`.
 *
 * Порядок не косметический. Сценарии необратимо двигают состояние цепи
 * (предложение → заказ → отгрузка → приёмка → выдача → возврат → списание),
 * поэтому сюита — это ещё и сквозной E2E прямого пути: каждая следующая
 * группа опирается на состояние, созданное предыдущей.
 *
 *   node bin/run-marketplace-all.mjs                  прогон на текущем стенде
 *   node bin/run-marketplace-all.mjs --reboot         с reboot:extra (чистая цепь)
 *   node bin/run-marketplace-all.mjs --only=orderer/catalog,orderer/orders
 *   node bin/run-marketplace-all.mjs --from=operator/warehouse   продолжить с места
 *
 * Сюита НЕ входит в `pnpm test` и не вызывается из release.yaml: прогон
 * требует поднятого стека и живёт минутами, а не секундами. Запуск — только
 * явной командой либо workflow_dispatch.
 *
 * Падение одного сценария не останавливает остальные: в конце печатается
 * сводка и пишется shots/_suite/summary.json, а код возврата ненулевой,
 * если хоть что-то красное.
 */
import { runSuite } from '../lib/suite.mjs';

// ── Порядок прогона ────────────────────────────────────────────────────────
// Группы отражают цепочку состояния, а не разбивку по ролям: роль внутри
// шага меняется (поставщик подписывает акт, потом председатель КУ его
// закрывает), и сортировка по столам разорвала бы процесс.

const GROUPS = [
  {
    // Префикс «L0» — контракт с раннером: эта группа прогоняется ДО глобальных
    // prepare-фаз, на девственном стенде. Только так процесс подключения ЦПП
    // снимается живым, а не «уже подключено».
    name: 'L0 — подключение кооператива (до подготовки стенда)',
    scenarios: [
      'marketplace/onboarding/install-market',
      'marketplace/onboarding/coop-accept-cpp',
    ],
  },
  {
    name: 'L1 — кооператив подключает Стол заказов',
    scenarios: [
      'marketplace/chairman/branches',
      'marketplace/chairman/category-whitelist',
      // Обратная сторона белого списка — форма поставщика. Стоит до подачи
      // предложения и возвращает каталог открытым, иначе подать будет нельзя.
      'marketplace/chairman/category-disabled-in-offer-form',
    ],
  },
  {
    name: 'L3 — гейт первого входа',
    // Строго ДО сценариев заказчика: там пайщик подписывает ЦПП, и гейт
    // после этого не воспроизводится.
    scenarios: [
      'marketplace/onboarding/member-pick-cpp',
      'marketplace/onboarding/extension-gate',
    ],
  },
  {
    name: 'Предложение поставщика и его модерация',
    scenarios: [
      'marketplace/offerer/offer-create',
      // Между подачей и модерацией: единственное окно, когда витрина уже
      // доступна заказчику, но одобренных предложений в ней ещё нет.
      'marketplace/orderer/catalog-empty',
      'marketplace/chairman/offer-moderation',
      'marketplace/offerer/my-offers',
    ],
  },
  {
    name: 'Заказ',
    scenarios: [
      'marketplace/orderer/catalog',
      'marketplace/orderer/order-create',
      'marketplace/orderer/orders',
      'marketplace/orderer/orders-empty',
      // Пока заказ не выдан: проверка возврата до выдачи возможна только здесь,
      // дальше по цепочке тот же заказ станет полученным.
      'marketplace/orderer/order-no-return-yet',
      'marketplace/orderer/consolidated',
    ],
  },
  {
    name: 'Отгрузка',
    scenarios: [
      'marketplace/offerer/incoming-orders',
      'marketplace/offerer/shipment-prep',
      'marketplace/offerer/ship-party',
    ],
  },
  {
    name: 'Приёмка на участке',
    scenarios: [
      'marketplace/operator/incoming-shipments',
      // Сразу следом: та же партия глазами председателя соседнего участка.
      'marketplace/operator/incoming-shipments-foreign',
      // Боксы заводятся ДО приёмки: шаг «Оприходование» закрывающей подписи
      // должен показывать раскладку в тару, а не «тара не заведена».
      'marketplace/operator/containers',
      'marketplace/operator/apl-reception-create',
      'marketplace/offerer/apl-reception-sign',
      'marketplace/operator/apl-reception-chairman-sign',
      'marketplace/operator/inventory-label',
      // Сетка склада (Эпик 19) снимается, пока склад полон — после выдачи
      // раскладывать нечего. Боксы заведены выше, до приёмки.
      'marketplace/operator/warehouse-cells',
      'marketplace/operator/warehouse',
    ],
  },
  {
    name: 'Выдача',
    scenarios: [
      // Строго ПЕРЕД открытием выдачи: сверяет пересчёт денег при правке
      // количества и цены и уходит без подписи, оставляя заказ нетронутым.
      'marketplace/operator/issuance-correction',
      // Лента выдачи и отказ по произвольному коду снимаются, пока заказ ещё
      // в очереди «Готов к выдаче»: после «Подписать и отправить пайщику»
      // лента пустеет, и кадры выходят бессодержательными.
      'marketplace/operator/issuance',
      'marketplace/operator/issuance-no-code',
      'marketplace/operator/issuance-open',
      'marketplace/orderer/ready-to-receive',
      'marketplace/orderer/receive-code',
      'marketplace/operator/issuance-finalize',
    ],
  },
  {
    name: 'Возврат',
    scenarios: [
      'marketplace/orderer/returns',
      'marketplace/operator/returns',
      'marketplace/operator/return-accept',
    ],
  },
  {
    // Между возвратом и списанием: перепредложение берёт позицию из того же
    // свободного остатка, а списание забирает ВЕСЬ свободный остаток целиком —
    // после него перепредлагать нечего (проверено прогоном: все позиции
    // уходят в WRITTEN_OFF). Здесь имущество проходит второй круг: публикация
    // → заказ другим пайщиком → выдача → возврат в пользу кооператива.
    name: 'Перевыдача остатка второму пайщику',
    scenarios: [
      'marketplace/operator/stock-republish',
      'marketplace/orderer/stock-order',
      'marketplace/operator/stock-issuance',
      'marketplace/orderer/stock-return',
      'marketplace/operator/stock-return-accept',
    ],
  },
  {
    // Строго ПОСЛЕ возврата: обезличенный остаток на складе участка, который
    // председатель выделяет к списанию, появляется именно из принятого
    // гарантийного возврата — без него список кандидатов пуст.
    name: 'Списание',
    scenarios: [
      'marketplace/chairman/writeoff-propose',
      'marketplace/chairman/writeoff-submit',
      'marketplace/chairman/writeoff-authorize',
      'marketplace/operator/writeoff-confirm',
    ],
  },
  {
    // После всех возвратов: приём возврата снимает членский взнос обратно из
    // того же пула участка, который здесь распределяется. Распределив его
    // раньше, мы обрушили бы возврат на пустом кошельке.
    name: 'Экономика участка',
    scenarios: ['marketplace/operator/branch-economy'],
  },
  {
    name: 'Обзорные экраны (состояние не меняют)',
    scenarios: [
      'marketplace/chairman/dashboard-overview',
      'marketplace/chairman/market-tour',
      'marketplace/chairman/ecosystem',
      'marketplace/chairman/warehouse-summary',
      'marketplace/branch-chairman/pvz-list',
      'marketplace/board/payouts-readonly',
      'marketplace/offerer/payments',
      'marketplace/orderer/marketplace-tour',
      'marketplace/chairman/suppliers-registry',
      'marketplace/chairman/offers-registry',
      'marketplace/chairman/economy',
      'marketplace/operator/orders-history',
    ],
  },
];


// Фазы засева ждут всех председателей участков и пул гейта (chairmyt — участок
// Мытищи, petrova — первый кандидат пула), хотя сценарии их по имени не зовут.
process.exit(await runSuite({ app: 'marketplace', groups: GROUPS, args: process.argv.slice(2), extraFixtures: ['chairmyt', 'petrova'] }));
