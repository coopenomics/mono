/**
 * @brief Кооператив признаёт гарантийную претензию за поставщика по истечении
 * срока ответа (p.mkt.claim, задача 99D-13): `pending → admitted`.
 *
 * Зовётся сторожем бэкенда только при включённом автоприёме в настройках
 * Стола заказов (по умолчанию выключен): если поставщик за
 * CLAIM_AUTO_ADMIT_SECS не ответил, претензия считается признанной. Эффект
 * тот же, что у admitclaim — o.mkt.admit, долг к удержанию из выплат.
 *
 * Guards: actor coopname; статус pending; срок ответа истёк.
 *
 * @ingroup public_marketplace_actions
 */
void marketplace::autoclaim(eosio::name coopname,
                             checksum256 claim_hash) {
  require_auth(coopname);

  auto c = Marketplace::get_claim_by_hash_or_fail(coopname, claim_hash);
  eosio::check(c.status == ClaimStatus::PENDING, "По претензии уже дан ответ");

  const auto now = eosio::time_point_sec(eosio::current_time_point().sec_since_epoch());
  eosio::check(now.sec_since_epoch() >= c.created_at.sec_since_epoch() + Marketplace::CLAIM_AUTO_ADMIT_SECS,
               "Срок ответа поставщика по претензии ещё не истёк");

  Marketplace::update_claim(coopname, c.id, [&](auto& upd) {
    upd.status     = ClaimStatus::ADMITTED;
    upd.decided_at = now;
  });

  Ledger2::apply(_marketplace, coopname,
                 operations::marketplace::ADMIT_CLAIM,
                 processes::marketplace::CLAIM,
                 c.amount, c.supplier, c.hash,
                 Marketplace::Memo::get_auto_admit_claim_memo(c.id, c.original_order_id));
}
