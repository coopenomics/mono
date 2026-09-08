/**
 * @brief Поставщик отказал по гарантийной претензии (p.mkt.claim, задача
 * 99D-13): `pending → refused`.
 *
 * Сумма уходит с кошелька ожидающих претензий на кошелёк отказанных —
 * o.mkt.refuse (TRANSFER w.mkt.claim → w.mkt.refuse, без проводки): кооператив
 * видит по каждому поставщику, на какую сумму он отказался отвечать, и при
 * желании идёт с этим в суд. Запись претензии не стирается — это основание
 * для иска.
 *
 * Guards: actor coopname; `supplier` — поставщик претензии; статус pending;
 * причина 1..500 символов.
 *
 * @ingroup public_marketplace_actions
 */
void marketplace::refuseclaim(eosio::name coopname,
                               eosio::name supplier,
                               checksum256 claim_hash,
                               std::string reason) {
  require_auth(coopname);

  auto c = Marketplace::get_claim_by_hash_or_fail(coopname, claim_hash);
  eosio::check(c.supplier == supplier, "Отвечать по претензии может только поставщик, которому она выставлена");
  eosio::check(c.status == ClaimStatus::PENDING, "По претензии уже дан ответ");
  eosio::check(!reason.empty() && reason.size() <= 500,
               "Причина отказа обязательна и не длиннее 500 символов");

  const auto now = eosio::time_point_sec(eosio::current_time_point().sec_since_epoch());
  Marketplace::update_claim(coopname, c.id, [&](auto& upd) {
    upd.status        = ClaimStatus::REFUSED;
    upd.decided_at    = now;
    upd.refuse_reason = reason;
  });

  Ledger2::apply(_marketplace, coopname,
                 operations::marketplace::REFUSE_CLAIM,
                 processes::marketplace::CLAIM,
                 c.amount, c.supplier, c.hash,
                 Marketplace::Memo::get_refuse_claim_memo(c.id, c.original_order_id));
}
