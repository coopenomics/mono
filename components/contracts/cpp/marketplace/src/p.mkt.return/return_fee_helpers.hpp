#pragma once

/**
 * Возврат членского взноса участка при гарантийном возврате (p.mkt.return,
 * задача 99D-15). Общая часть `onmktrtauth` и `payretfee`: взнос ушёл участку
 * на выдаче (o.brn.common), и к моменту возврата участок мог его распределить.
 * Тогда `branch::retfee` не проходит, а ронять из-за этого решение совета
 * нельзя — имущество и паевой возвращаются сразу, взнос доводится позже.
 */
namespace Marketplace {

/// Взнос по заявке на возврат: из общего кошелька участка в пул взносов
/// (branch::retfee) и из пула на членский кошелёк программы (o.mkt.refund).
inline void refund_return_fee(eosio::name coopname, eosio::name braname, const return_request& r) {
  Branch::retfee(_marketplace, coopname, braname, r.fee_refund,
                 processes::marketplace::RETURN, r.hash,
                 Memo::get_return_fee_from_common_memo(r.id, r.original_order_id));
  Ledger2::apply(_marketplace, coopname,
                 operations::marketplace::MEMBERSHIP_FEE_REFUND,
                 processes::marketplace::RETURN,
                 r.fee_refund, r.orderer, r.hash,
                 Memo::get_return_fee_to_member_memo(r.id, r.original_order_id));
}

/// Взнос возвращается, только если общий кошелёк участка его держит; иначе
/// false — заявка остаётся ждать пополнения (статус feepend).
inline bool refund_return_fee_if_available(eosio::name coopname, eosio::name braname, const return_request& r) {
  const auto common = get_user_wallet_balance(coopname, ledger2_wallets::BRANCH_COMMON, braname);
  if (!common.exists || common.available < r.fee_refund) return false;
  refund_return_fee(coopname, braname, r);
  return true;
}

} // namespace Marketplace
