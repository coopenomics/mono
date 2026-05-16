/**
 * @brief Председатель приёмного КУ ставит закрывающую подпись на АПП приёмки
 * по одному Order'у (Story 5.3/5.4, p.mkt.supply).
 *
 * Per-Order — только бухгалтерская приёмка имущества:
 *  - Ledger2::apply(o.mkt.purch, total_cost, …, hash=order.hash) — Дт 10 / Кт 86.
 *
 * Имущество приходуется на склад приёмного КУ (`accept_braname`); у кооператива
 * возникает обязательство Кт 86 перед поставщиком. Фактическая выплата деньгами
 * (Дт 86 / Кт 51) — отдельным lazy action'ом `marketplace::payout` после
 * подтверждения кассиром реального банковского перевода (Locked Decision L12,
 * E11 техдолг 598-16).
 *
 * Status: supply_prepared → accepted_to_coop. acceptance_act_signchair
 * сохраняется. `payout_done` не выставляется — это атрибут payout-действия.
 *
 * Guards:
 *  - Order существует и в статусе supply_prepared.
 *  - Подписант (`signer`) авторизован для приёмного КУ — председатель,
 *    trustee либо доверенное лицо в `branches[accept_braname].trusted[]`.
 *  - На акте есть подписи поставщика и подписанта приёмки.
 *
 * @ingroup public_marketplace_actions
 */
void marketplace::signchair(eosio::name coopname,
                             eosio::name signer,
                             checksum256 order_hash,
                             document2 act) {
  require_auth(coopname);

  auto o = Marketplace::get_order_by_hash_or_fail(coopname, order_hash);
  eosio::check(o.status == OrderStatus::SUPPLY_PREPARED,
               "Заказ не готов к приёмке кооперативом");

  // Авторизация подписи: signer должен быть в trusted списке приёмного КУ.
  auto branch = get_branch_or_fail(coopname, o.accept_braname);
  eosio::check(branch.is_user_authorized(signer),
               "Подписант не уполномочен подписывать акты приёмки данного кооперативного участка");

  verify_document_or_fail(act, { o.offerer, signer });

  // Только приёмка имущества; payout — отдельный lazy action (L12).
  Ledger2::apply(_marketplace, coopname,
                 operations::marketplace::PURCHASE_FROM_SUPPLIER,
                 o.total_cost, o.offerer, o.hash,
                 Marketplace::Memo::get_purchase_from_supplier_memo(o.id));

  Marketplace::update_order(coopname, o.id, [&](auto& upd) {
    upd.status = OrderStatus::ACCEPTED_TO_COOP;
    upd.acceptance_act_signchair = act;
    upd.current_warehouse_braname = o.accept_braname;  // имущество на приёмном складе
  });
}
