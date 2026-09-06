/**
 * @brief Backend закрывает один Order по таймауту цикла отсечки заявок
 * (Story 4.3, p.mkt.supply).
 *
 * Вызывается бэкендом после расчёта по batch'у: если за время цикла Offer'а
 * threshold не достигнут, бэкенд проходит циклом по всем active Order'ам
 * этого batch'а и для каждого вызывает `expireorder`. Контракт не знает про
 * threshold — это вычисление backend'а; on-chain — только закрытие конкретного
 * Order'а с возвратом резерва.
 *
 * Per-Order: o.mkt.unlock на total_cost (TRANSFER w.mkt.order → w.mkt.share — возврат паевого резерва на свободный паевой «Стола заказов» заказчика) + статус active → cancelled.
 *
 * Guards:
 *  - Order существует и в статусе active (после акцепта поставщика
 *    expireorder не применим — поставщик уже взял обязательство; такие
 *    Order'ы должны идти через `issueact2` обычным порядком либо через
 *    отдельный механизм просрочки доставки).
 *  - require_auth(coopname) — backend от имени кооператива.
 *
 * @ingroup public_marketplace_actions
 */
void marketplace::expireorder(eosio::name coopname,
                               checksum256 order_hash) {
  require_auth(coopname);

  auto o = Marketplace::get_order_by_hash_or_fail(coopname, order_hash);
  eosio::check(o.status == OrderStatus::ACTIVE,
               "Закрыть по таймауту можно только активный заказ");

  Ledger2::apply(_marketplace, coopname,
                 operations::marketplace::UNLOCK_ORDER,
                 processes::marketplace::SUPPLY,
                 o.total_cost, o.orderer, o.hash,
                 Marketplace::Memo::get_expire_order_memo(o.id));

  // Членский взнос возвращается полностью (o.mkt.refund, requirement b6).
  Marketplace::refund_membership_fee_if_any(coopname, o);

  // Закрытие по таймауту — терминал жизненного цикла заказа: запись
  // стирается из RAM, история остаётся в журнале действий.
  Marketplace::erase_order(coopname, o.id);
}
