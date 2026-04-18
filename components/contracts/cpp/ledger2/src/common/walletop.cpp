/**
 * @brief Атомарная операция по кошельку (issue/transfer/block/unblock).
 *
 * Внутренний action ledger2 — вызывается только через inline из apply().
 * Auth: только сам ledger2 (require_auth(get_self())).
 *
 * Ровно одна мутация wallets2: ISSUE добавляет на wallet_to, TRANSFER
 * перемещает wallet_from → wallet_to, BLOCK/UNBLOCK переносит между
 * available и blocked на wallet_from.
 *
 * История этого вызова автоматически попадает в blockchain_actions с
 * полями (op_code, wallet_from, wallet_to, amount, process_hash, memo) —
 * этого достаточно бэкенду для восстановления wjournal-эквивалента.
 *
 * @ingroup public_ledger2_actions
 */
[[eosio::action]]
void ledger2::walletop(eosio::name coopname,
                       uint8_t op_code,
                       uint64_t wallet_from,
                       uint64_t wallet_to,
                       eosio::asset amount,
                       eosio::checksum256 process_hash,
                       std::string memo) {
  require_auth(get_self());
  require_recipient(coopname);

  eosio::check(amount.is_valid() && amount.amount > 0,
               "walletop: некорректная сумма");
  eosio::check(amount.symbol == _root_govern_symbol,
               "walletop: некорректный символ валюты");
  eosio::check(memo.size() < 256, "walletop: memo > 255");
  eosio::check(op_code <= 3, "walletop: неизвестный op_code");

  wallets2_index wallets(get_self(), coopname.value);
  const eosio::name payer = get_self();

  auto upsert_wallet = [&](uint64_t wallet_id) -> wallets2_index::const_iterator {
    auto it = wallets.find(wallet_id);
    if (it == wallets.end()) {
      const auto name_view = ledger2_get_wallet_name_by_id(wallet_id);
      eosio::check(!name_view.empty(),
                   std::string{"walletop: unknown wallet id "} + std::to_string(wallet_id));
      const std::string name{name_view};
      it = wallets.emplace(payer, [&](auto& w) {
        w.id        = wallet_id;
        w.name      = name;
        w.available = eosio::asset(0, amount.symbol);
        w.blocked   = eosio::asset(0, amount.symbol);
      });
    }
    return it;
  };

  auto cleanup_if_empty = [&](uint64_t wallet_id) {
    auto it = wallets.find(wallet_id);
    if (it != wallets.end() && it->is_empty()) {
      wallets.erase(it);
    }
  };

  switch (static_cast<WalletOp>(op_code)) {
    case WalletOp::ISSUE: {
      eosio::check(wallet_to != 0, "walletop ISSUE: требуется wallet_to");
      auto it = upsert_wallet(wallet_to);
      wallets.modify(it, payer, [&](auto& w) { w.available += amount; });
      break;
    }
    case WalletOp::TRANSFER: {
      eosio::check(wallet_from != 0 && wallet_to != 0,
                   "walletop TRANSFER: требуются wallet_from и wallet_to");
      eosio::check(wallet_from != wallet_to,
                   "walletop TRANSFER: wallet_from == wallet_to");
      auto from_it = wallets.find(wallet_from);
      eosio::check(from_it != wallets.end() && from_it->available >= amount,
                   std::string{"walletop TRANSFER: недостаточно средств на кошельке "} +
                     std::to_string(wallet_from));
      wallets.modify(from_it, payer, [&](auto& w) { w.available -= amount; });
      auto to_it = upsert_wallet(wallet_to);
      wallets.modify(to_it, payer, [&](auto& w) { w.available += amount; });
      cleanup_if_empty(wallet_from);
      break;
    }
    case WalletOp::BLOCK: {
      eosio::check(wallet_from != 0, "walletop BLOCK: требуется wallet_from");
      auto it = wallets.find(wallet_from);
      eosio::check(it != wallets.end() && it->available >= amount,
                   std::string{"walletop BLOCK: недостаточно available на кошельке "} +
                     std::to_string(wallet_from));
      wallets.modify(it, payer, [&](auto& w) {
        w.available -= amount;
        w.blocked   += amount;
      });
      break;
    }
    case WalletOp::UNBLOCK: {
      eosio::check(wallet_from != 0, "walletop UNBLOCK: требуется wallet_from");
      auto it = wallets.find(wallet_from);
      eosio::check(it != wallets.end() && it->blocked >= amount,
                   std::string{"walletop UNBLOCK: недостаточно blocked на кошельке "} +
                     std::to_string(wallet_from));
      wallets.modify(it, payer, [&](auto& w) {
        w.blocked   -= amount;
        w.available += amount;
      });
      break;
    }
  }
}
