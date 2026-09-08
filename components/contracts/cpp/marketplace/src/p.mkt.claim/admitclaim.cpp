/**
 * @brief Поставщик признал гарантийную претензию (p.mkt.claim, задача 99D-13):
 * `pending → admitted`.
 *
 * Претензия выставлена контрактом при исполнении решения совета об отмене
 * сделки (onmktrtauth): имущество оплачено поставщику, но вернулось на склад
 * по рекламации пайщика с двумя подписями. Признание переводит сумму с
 * кошелька ожидающих претензий на кошелёк признанного долга поставщика —
 * o.mkt.admit (TRANSFER w.mkt.claim → w.mkt.debt, Дт 76 / Кт 91): у
 * кооператива возникает дебиторка поставщика, которая гасится удержанием из
 * следующих выплат ему (`payout` / `payconfirm`, o.mkt.deduct).
 *
 * Guards: actor coopname; `supplier` — поставщик претензии; статус pending.
 *
 * @ingroup public_marketplace_actions
 */
void marketplace::admitclaim(eosio::name coopname,
                              eosio::name supplier,
                              checksum256 claim_hash) {
  require_auth(coopname);

  auto c = Marketplace::get_claim_by_hash_or_fail(coopname, claim_hash);
  eosio::check(c.supplier == supplier, "Отвечать по претензии может только поставщик, которому она выставлена");
  eosio::check(c.status == ClaimStatus::PENDING, "По претензии уже дан ответ");

  const auto now = eosio::time_point_sec(eosio::current_time_point().sec_since_epoch());
  Marketplace::update_claim(coopname, c.id, [&](auto& upd) {
    upd.status     = ClaimStatus::ADMITTED;
    upd.decided_at = now;
  });

  Ledger2::apply(_marketplace, coopname,
                 operations::marketplace::ADMIT_CLAIM,
                 processes::marketplace::CLAIM,
                 c.amount, c.supplier, c.hash,
                 Marketplace::Memo::get_admit_claim_memo(c.id, c.original_order_id));
}
