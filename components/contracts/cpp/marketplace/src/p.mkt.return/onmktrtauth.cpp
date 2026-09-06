/**
 * @brief Обратный вызов от `soviet::exec` после утверждения Протокола решения
 * совета о принятии имущества и восстановлении паевого взноса (registry 1117)
 * — гарантийный возврат в паевой модели (компонент 68, задача 99D-9).
 * Сигнатура `(coopname, hash, authorization)` — `AUTHORIZE_CALLBACK_SIGNATURE`;
 * единственно допустимая авторизация — `_soviet`.
 *
 * Все движения по выданному заказу откатываются одной транзакцией:
 *  - o.mkt.return на fact_cost заявки: ISSUE w.mkt.share, Дт 10 / Кт 80 —
 *    паевой взнос за возвращённое восстановлен на свободном паевом «Стола
 *    заказов», имущество на складе участка; compensating forward к
 *    o.mkt.consum, исходные записи журнала не меняются;
 *  - членский взнос участка за возвращённое: branch::retfee (общий кошелёк
 *    участка → пул взносов) и o.mkt.refund (пул → w.mkt.share, Дт 86 / Кт 80).
 *  - `newresolved` для заявления в пакет документов заказа; запись заявки
 *    стирается. order.return_request_id не сбрасывается — повторный возврат по
 *    тому же заказу не открывается.
 *
 * @ingroup public_marketplace_actions
 */
void marketplace::onmktrtauth(eosio::name coopname,
                               checksum256 hash,
                               document2 authorization) {
  require_auth(_soviet);

  auto r = Marketplace::get_return_request_by_hash_or_fail(coopname, hash);
  eosio::check(r.status == ReturnStatus::RETURN_PENDING,
               "Заявка на возврат не ожидает решения совета (обратный вызов повторный или поздний)");

  auto o = Marketplace::get_order_by_hash_or_fail(coopname, r.original_order_hash);
  const eosio::name braname = o.delivery_braname;

  Ledger2::apply(_marketplace, coopname,
                 operations::marketplace::RETURN_BY_MEMBER,
                 processes::marketplace::RETURN,
                 r.fact_cost, r.orderer, r.hash,
                 Marketplace::Memo::get_return_by_member_memo(r.id, r.original_order_id));

  const eosio::asset fee_refund = r.fee_refund;
  if (fee_refund.amount > 0) {
    Branch::retfee(_marketplace, coopname, braname, fee_refund,
                   processes::marketplace::RETURN, r.hash,
                   Marketplace::Memo::get_return_fee_from_common_memo(r.id, r.original_order_id));
    Ledger2::apply(_marketplace, coopname,
                   operations::marketplace::MEMBERSHIP_FEE_REFUND,
                   processes::marketplace::RETURN,
                   fee_refund, r.orderer, r.hash,
                   Marketplace::Memo::get_return_fee_to_member_memo(r.id, r.original_order_id));
  }

  Action::send<newresolved_interface>(_soviet, "newresolved"_n, _marketplace,
                                      coopname, r.orderer, "onmktrtauth"_n,
                                      r.original_order_hash, r.statement);

  Marketplace::erase_return_request(coopname, r.id);
}
