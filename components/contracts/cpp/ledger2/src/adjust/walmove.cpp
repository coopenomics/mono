/**
 * @brief Перевод между кошельками внутри одного бух.счёта (operation o.adj.walmove).
 *
 * Top-level action — председатель подписывает сам, никаких caller-контрактов.
 * Делает один inline `walletop` с `op_code = WALLET_ONLY` (TRANSFER без Dr/Cr) —
 * так как корректировка между кошельками одного бух.счёта не меняет балансы
 * самих счетов (`accounts2.balance`), только их аналитику.
 *
 * Связь wallet→account не хранится в LEDGER2_WALLET_REGISTRY (она выводится
 * из OPERATION_REGISTRY по месту использования и может теоретически быть
 * многозначной), поэтому соответствие двух кошельков одному `account_id`
 * проверяется на стороне backend (резолвер walmoveWallets смотрит
 * Ledger2.LEDGER2_OPERATION_REGISTRY и отказывает на разные account_id).
 *
 * @ingroup public_ledger2_actions
 */
[[eosio::action]]
void ledger2::walmove(eosio::name coopname,
                      eosio::name initiator,
                      eosio::name username,
                      eosio::name from_wallet,
                      eosio::name to_wallet,
                      eosio::asset amount,
                      eosio::checksum256 process_hash,
                      std::string memo) {
  // -------- auth --------
  if (!has_auth(coopname)) {
    check_auth_and_get_payer_or_fail(contracts_whitelist);
  }

  // -------- validate coopname --------
  eosio::check(coopname.value != 0, "walmove: coopname пустой");
  get_cooperative_or_fail(coopname);
  require_recipient(coopname);

  // -------- validate initiator/username --------
  eosio::check(initiator.value != 0, "walmove: initiator пустой");
  eosio::check(username.value != 0, "walmove: username пустой");

  // -------- validate amount --------
  eosio::check(amount.is_valid(), "walmove: некорректная сумма");
  eosio::check(amount.amount > 0, "walmove: сумма должна быть положительной");
  eosio::check(amount.symbol == _root_govern_symbol,
               "walmove: некорректный символ валюты");

  // -------- validate wallets --------
  eosio::check(from_wallet.value != 0, "walmove: from_wallet обязателен");
  eosio::check(to_wallet.value != 0, "walmove: to_wallet обязателен");
  eosio::check(from_wallet != to_wallet, "walmove: from_wallet == to_wallet");
  eosio::check(ledger2_is_known_wallet(from_wallet),
               std::string{"walmove: неизвестный from_wallet "} + from_wallet.to_string());
  eosio::check(ledger2_is_known_wallet(to_wallet),
               std::string{"walmove: неизвестный to_wallet "} + to_wallet.to_string());

  // -------- validate memo (обязательный для adjustment) --------
  eosio::check(!memo.empty(), "walmove: memo обязателен — укажите обоснование");
  eosio::check(memo.size() < 256, "walmove: memo не должен превышать 255 символов");

  // -------- dispatch inline walletop --------
  // WALLET_ONLY = перенос available между кошельками без Dr/Cr.
  // На уровне walletop.cpp WALLET_ONLY обрабатывается тем же case, что и TRANSFER.
  const auto self_perm = eosio::permission_level{get_self(), "active"_n};
  eosio::action(self_perm, get_self(), "walletop"_n,
    std::make_tuple(coopname,
                    static_cast<uint8_t>(WalletOp::WALLET_ONLY),
                    from_wallet, to_wallet, amount,
                    process_hash, memo)
  ).send();
}
