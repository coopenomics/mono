/**
 * @brief Атомарная кредитовая проводка на счёт ledger2.
 *
 * Внутренний action ledger2 — вызывается только через inline из apply().
 * Auth: только сам ledger2 (require_auth(get_self())).
 *
 * Прибавляет amount к accounts2[account_id].credit_balance, затем
 * пересчитывает balance согласно account_type. Парная debit-проводка
 * приходит отдельным inline (action `debit`) с тем же `process_hash` —
 * бэкенд связывает их в пару.
 *
 * TODO(payer, 2026-04-18): payer = get_self() → RAM ledger2. Перевести на
 * coopname при общем переходе на coopname-eosio.code permissions.
 * См. Decision #D2 в code review Epic 1.
 *
 * @ingroup public_ledger2_actions
 */
[[eosio::action]]
void ledger2::credit(eosio::name coopname,
                     uint64_t account_id,
                     eosio::asset amount,
                     eosio::checksum256 process_hash,
                     std::string memo) {
  require_auth(get_self());

  // Sender-guard: запрещаем top-level вызов. Допустим только inline-dispatch
  // из ledger2::apply — чтобы исключить одностороннюю проводку без парного debit.
  eosio::check(eosio::get_sender() == _ledger2,
               "credit: допустим только inline-вызов из ledger2::apply");

  // require_recipient не вызываем: apply() уже нотифицировал coopname.

  eosio::check(amount.is_valid() && amount.amount > 0,
               "credit: некорректная сумма");
  eosio::check(amount.symbol == _root_govern_symbol,
               "credit: некорректный символ валюты");
  eosio::check(memo.size() < 256, "credit: memo > 255");

  accounts2_index accounts(get_self(), coopname.value);
  const eosio::name payer = get_self();

  auto it = accounts.find(account_id);
  if (it == accounts.end()) {
    const auto* meta = ledger2_find_account_meta(account_id);
    eosio::check(meta != nullptr,
                 std::string{"credit: unknown account id "} + std::to_string(account_id));
    const std::string acc_name{meta->name};
    accounts.emplace(payer, [&](auto& a) {
      a.id             = account_id;
      a.name           = acc_name;
      a.account_type   = static_cast<uint8_t>(meta->type);
      a.debit_balance  = eosio::asset(0, amount.symbol);
      a.credit_balance = amount;
      a.balance        = account2::compute_balance(
        a.account_type, a.debit_balance, a.credit_balance);
    });
  } else {
    accounts.modify(it, payer, [&](auto& a) {
      a.credit_balance += amount;
      a.balance        = account2::compute_balance(
        a.account_type, a.debit_balance, a.credit_balance);
    });
  }
}
