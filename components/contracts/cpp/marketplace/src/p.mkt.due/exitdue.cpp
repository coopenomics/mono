/**
 * @brief Выход пайщика из кооператива состоялся: остаток обеспечительной части
 * к списанию списывается в членский взнос немедленно (решение владельца
 * 31.10.2026, задача 99D-18), его строки счётчиков списания стираются
 * (задача 99D-33). Вызывает только registrator (completexit, confirmexit без
 * выплаты) из `Marketplace::settle_due_on_exit`.
 *
 * Движения одной транзакцией в нитке выхода (хэш выхода, процесс вывода
 * средств):
 *  - o.mkt.exfee — w.mkt.due → w.mkt.fee на весь остаток кошелька;
 *  - o.brn.common — w.mkt.fee → w.brn.common участка, к которому прикреплён
 *    пайщик, Дт 80 / Кт 86 (branch::accrue). Пайщик без участка или участок
 *    удалён — остаток остаётся в пуле.
 *
 * Открытые счётчики участков уменьшаются на суммы пайщика: итог их периодов
 * считается по заказам, которые ещё предстоит списать по ставкам.
 *
 * @ingroup public_marketplace_actions
 */
void marketplace::exitdue(eosio::name coopname, eosio::name username, checksum256 exit_hash) {
  require_auth(_registrator);

  Marketplace::Dues::release_member(coopname, username);

  const eosio::asset balance = Marketplace::get_user_wallet_balance(
      coopname, ledger2_wallets::MARKETPLACE_SECURE_DUE, username).available;
  if (balance.amount <= 0) return;

  Ledger2::apply(_marketplace, coopname, operations::marketplace::EXIT_DUE_TO_POOL,
                 processes::wallet::WITHDRAW, balance, username, exit_hash,
                 "Обеспечительная часть Стола заказов к списанию при выходе, username=" +
                   username.to_string());

  const auto braname = ::get_participant_branch(coopname, username);
  if (!braname.has_value() || !Branch::exists(coopname, *braname)) return;
  Branch::accrue(_marketplace, coopname, *braname, balance, processes::wallet::WITHDRAW, exit_hash,
                 "Обеспечительная часть Стола заказов списана в членский взнос участка при выходе, username=" +
                   username.to_string());
}
