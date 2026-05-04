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
 * TODO(payer, 2026-04-18): сейчас payer = get_self() (ledger2), что даёт
 * неограниченный рост RAM контракта. Перевести на payer = coopname, когда
 * все caller-контракты возьмут у coopname разрешение `eosio.code` → ledger2
 * через linkauth. Решение по code review Decision #D2.
 *
 * @ingroup public_ledger2_actions
 */
[[eosio::action]]
void ledger2::walletop(eosio::name coopname,
                       uint8_t op_code,
                       eosio::name wallet_from,
                       eosio::name wallet_to,
                       eosio::asset amount,
                       eosio::checksum256 process_hash,
                       std::string memo) {
  require_auth(get_self());

  // Sender-guard: запрещаем top-level вызов. Допустим только inline-dispatch
  // из ledger2::apply / ledger2::walmove / ledger2::revert — так сохраняется
  // парность проводок walletop+debit+credit и нельзя напрямую подписью
  // `ledger2@active` записать одностороннюю операцию.
  eosio::check(eosio::get_sender() == _ledger2,
               "walletop: допустим только inline-вызов из ledger2::apply/walmove/revert");

  // require_recipient не вызываем: apply() уже нотифицировал coopname один раз.
  // Повторная нотификация из каждого inline создаёт 4 хука на одну бизнес-операцию.

  eosio::check(amount.is_valid() && amount.amount > 0,
               "walletop: некорректная сумма");
  eosio::check(amount.symbol == _root_govern_symbol,
               "walletop: некорректный символ валюты");
  eosio::check(memo.size() < 256, "walletop: memo > 255");
  eosio::check(op_code <= 5, "walletop: неизвестный op_code");

  wallets2_index wallets(get_self(), coopname.value);
  const eosio::name payer = get_self();

  auto upsert_wallet = [&](eosio::name wallet_id) -> wallets2_index::const_iterator {
    auto it = wallets.find(wallet_id.value);
    if (it == wallets.end()) {
      const auto human_view = ledger2_get_wallet_human_name(wallet_id);
      eosio::check(!human_view.empty(),
                   std::string{"walletop: unknown wallet "} + wallet_id.to_string());
      const std::string human{human_view};
      it = wallets.emplace(payer, [&](auto& w) {
        w.id        = wallet_id;
        w.name      = human;
        w.available = eosio::asset(0, amount.symbol);
        w.blocked   = eosio::asset(0, amount.symbol);
      });
    }
    return it;
  };

  auto cleanup_if_empty = [&](eosio::name wallet_id) {
    auto it = wallets.find(wallet_id.value);
    if (it != wallets.end() && it->is_empty()) {
      wallets.erase(it);
    }
  };

  switch (static_cast<WalletOp>(op_code)) {
    case WalletOp::ISSUE: {
      eosio::check(wallet_from.value == 0, "walletop ISSUE: wallet_from должен быть пустым");
      eosio::check(wallet_to.value != 0, "walletop ISSUE: требуется wallet_to");
      auto it = upsert_wallet(wallet_to);
      wallets.modify(it, payer, [&](auto& w) { w.available += amount; });
      break;
    }
    case WalletOp::TRANSFER:
    case WalletOp::WALLET_ONLY: {
      // Оба типа — перенос available между кошельками. WALLET_ONLY отличается
      // только отсутствием inline debit/credit (см. apply.cpp).
      eosio::check(wallet_from.value != 0 && wallet_to.value != 0,
                   "walletop TRANSFER/WALLET_ONLY: требуются wallet_from и wallet_to");
      eosio::check(wallet_from != wallet_to,
                   "walletop TRANSFER/WALLET_ONLY: wallet_from == wallet_to");
      auto from_it = wallets.find(wallet_from.value);
      eosio::check(from_it != wallets.end() && from_it->available >= amount,
                   std::string{"walletop TRANSFER: недостаточно средств на кошельке "} +
                     wallet_from.to_string());
      wallets.modify(from_it, payer, [&](auto& w) { w.available -= amount; });
      auto to_it = upsert_wallet(wallet_to);
      wallets.modify(to_it, payer, [&](auto& w) { w.available += amount; });
      cleanup_if_empty(wallet_from);
      break;
    }
    case WalletOp::BLOCK: {
      eosio::check(wallet_from.value != 0, "walletop BLOCK: требуется wallet_from");
      eosio::check(wallet_to.value == 0, "walletop BLOCK: wallet_to должен быть пустым");
      auto it = wallets.find(wallet_from.value);
      eosio::check(it != wallets.end() && it->available >= amount,
                   std::string{"walletop BLOCK: недостаточно available на кошельке "} +
                     wallet_from.to_string());
      wallets.modify(it, payer, [&](auto& w) {
        w.available -= amount;
        w.blocked   += amount;
      });
      break;
    }
    case WalletOp::UNBLOCK: {
      eosio::check(wallet_from.value != 0, "walletop UNBLOCK: требуется wallet_from");
      eosio::check(wallet_to.value == 0, "walletop UNBLOCK: wallet_to должен быть пустым");
      auto it = wallets.find(wallet_from.value);
      eosio::check(it != wallets.end() && it->blocked >= amount,
                   std::string{"walletop UNBLOCK: недостаточно blocked на кошельке "} +
                     wallet_from.to_string());
      wallets.modify(it, payer, [&](auto& w) {
        w.blocked   -= amount;
        w.available += amount;
      });
      break;
    }
    case WalletOp::REVOKE: {
      // Зеркало ISSUE: убираем amount с wallet_from без увеличения куда-либо.
      // Используется только из ledger2::revert при откате ISSUE-операций.
      eosio::check(wallet_from.value != 0, "walletop REVOKE: требуется wallet_from");
      eosio::check(wallet_to.value == 0, "walletop REVOKE: wallet_to должен быть пустым");
      auto it = wallets.find(wallet_from.value);
      eosio::check(it != wallets.end() && it->available >= amount,
                   std::string{"walletop REVOKE: недостаточно available на кошельке "} +
                     wallet_from.to_string());
      wallets.modify(it, payer, [&](auto& w) { w.available -= amount; });
      cleanup_if_empty(wallet_from);
      break;
    }
  }
}
