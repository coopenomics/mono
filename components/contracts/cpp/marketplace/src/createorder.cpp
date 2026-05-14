/**
 * @brief Заказчик размещает заказ на товар (Story 4.1, p.mkt.supply шаг 1).
 *
 * Серия операций (атомарно):
 *  1. `o.wal.conv` (TRANSFER w.wal.share → w.wal.member, Дт 80 / Кт 86) —
 *     conditional: только если на `w.wal.member.available` заказчика не хватает.
 *  2. `o.mkt.assign` (TRANSFER w.wal.member → w.mkt.member) — conditional:
 *     только если на `w.mkt.member.available` не хватает после шага 1.
 *  3. `o.mkt.block` (BLOCK на w.mkt.member) — всегда.
 *
 * Guards (из p.mkt.supply.standard.yaml + Locked Decision L6):
 *  - Заказчик — активный пайщик кооператива.
 *  - Заказчик подписал Соглашение ЦПП «Стол заказов» (проверка через
 *    wallet::users.programs[]).
 *  - Совокупных средств заказчика — на трёх кошельках — достаточно для
 *    полной стоимости заказа (L6: «без отрицательного баланса»).
 *  - ku_chairman — председатель валидного КУ кооператива.
 *
 * @ingroup public_marketplace_actions
 *
 * TODO Story 11.1 (Шаг 4): полная реализация по spec I/O matrix.
 */
void marketplace::createorder(eosio::name coopname,
                               eosio::name orderer,
                               checksum256 order_hash,
                               checksum256 offer_hash,
                               eosio::name offerer,
                               eosio::name ku_chairman,
                               uint64_t quantity,
                               eosio::asset unit_price,
                               eosio::name cycle_type,
                               uint32_t warranty_period_secs) {
  require_auth(coopname);
  eosio::check(false, "TODO Story 11.1 Шаг 4: createorder ещё не реализован");
}
