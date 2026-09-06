/**
 * @brief Пайщик выводит свободный паевой «Стола заказов» в общий паевой
 * Цифрового кошелька (паевая модель, компонент 68). Один шаг ledger2:
 * o.mkt.recall (TRANSFER w.mkt.share → w.wal.share, без проводки — оба
 * кошелька на 80). Документа не требуется: паевой взнос остаётся паевым в
 * том же кооперативе.
 *
 * Guards:
 *  - actor coopname (require_auth); пайщик активен;
 *  - сумма в валюте кооператива и больше нуля;
 *  - на свободном паевом «Стола заказов» достаточно доступных средств.
 *
 * @ingroup public_marketplace_actions
 */
void marketplace::recallshare(eosio::name coopname,
                               eosio::name username,
                               checksum256 recall_hash,
                               eosio::asset amount) {
  require_auth(coopname);
  eosio::check(amount.is_valid() && amount.amount > 0,
               "Сумма вывода должна быть больше нуля");
  eosio::check(amount.symbol == _root_govern_symbol,
               "Некорректный символ валюты в сумме вывода");
  get_participant_or_fail(coopname, username);

  auto bal_share = Marketplace::get_user_wallet_balance(
      coopname, ledger2_wallets::MARKETPLACE_SHARE_FUND, username);
  eosio::check(bal_share.available >= amount,
               std::string{"Недостаточно свободного паевого «Стола заказов» для вывода: требуется "} +
                 amount.to_string() + ", доступно " + bal_share.available.to_string());

  Ledger2::apply(_marketplace, coopname,
                 operations::marketplace::RECALL_SHARE,
                 processes::marketplace::SUPPLY,
                 amount, username, recall_hash,
                 Marketplace::Memo::get_recall_share_memo());
}
