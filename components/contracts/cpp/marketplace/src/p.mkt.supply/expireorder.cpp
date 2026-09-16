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
 * Второй случай — непоставка (решение владельца 10.09.2026, задача 99D-16):
 * поставщик принял заказ и за 48 часов от акцепта не привёз. Бэкенд по
 * расписанию закрывает такой заказ тем же действием с полным возвратом без
 * удержания — вина не пайщика. Срок контракт не проверяет: отметки времени
 * акцепта в заказе нет, её держит бэкенд.
 *
 * Guards:
 *  - Order существует и в статусе active либо accepted. После подписи
 *    поставщика на акте приёмки (supplyprep) закрытие по сроку не
 *    применяется: имущество привезено, дальше ход за приёмкой.
 *  - require_auth(coopname) — backend от имени кооператива.
 *
 * @ingroup public_marketplace_actions
 */
void marketplace::expireorder(eosio::name coopname,
                               checksum256 order_hash) {
  require_auth(coopname);

  auto o = Marketplace::get_order_by_hash_or_fail(coopname, order_hash);
  eosio::check(o.status == OrderStatus::ACTIVE || o.status == OrderStatus::ACCEPTED,
               "Закрыть по сроку можно только заказ, который ещё не набран или принят поставщиком и не привезён");

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
