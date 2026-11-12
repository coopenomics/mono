/**
 * @brief Инициатор вносит деньги в кооперативный участок: трансляция паевого
 * взноса из ЦПП «Цифровой Кошелёк» в договор участия в хозяйственной
 * деятельности по заявлению 1119 (задача 99D-27).
 *
 * Сумму называет пайщик в заявлении. Деньги остаются паевым взносом
 * инициатора на счёте 80: перевод `w.wal.share → w.mkt.invest` без проводки
 * (o.mkt.inv). Пока участок не израсходовал эти деньги, они лежат подушкой:
 * в базу возврата не входят и доступны пулу участка, когда его общего кошелька
 * не хватит на расход или материальную помощь.
 *
 * Строка инициатора по участку создаётся первым паевым взносом (очередь расхода —
 * по порядку входа) или пополняется. Инициатор, у которого возврат уже
 * завершён, новым паевым взносом снова становится активным.
 *
 * Guards: авторизация кооператива; договор участия подписан; участок есть;
 * пайщик — оператор участка (председатель или доверенное лицо); заявление
 * подписано пайщиком; сумма больше нуля в валюте кооператива; на главном
 * паевом достаточно средств.
 *
 * @ingroup public_marketplace_actions
 */
void marketplace::investmoney(eosio::name coopname, eosio::name username, eosio::name braname,
                              checksum256 invest_hash, eosio::asset amount, document2 statement) {
  require_auth(coopname);
  eosio::check(amount.is_valid() && amount.amount > 0 && amount.symbol == _root_govern_symbol,
               "MARKETPLACE_INVEST_AMOUNT_INVALID: Сумма паевого взноса должна быть больше нуля и в валюте кооператива");
  eosio::check(invest_hash != checksum256{},
               "MARKETPLACE_INVEST_HASH_MISSING: Не указан идентификатор паевого взноса");
  eosio::check(!is_empty_document(statement),
               "MARKETPLACE_INVEST_STATEMENT_MISSING: Отсутствует заявление о трансляции паевого взноса в договор участия");
  verify_document_or_fail(statement, { username });
  verify_signer_keys_or_fail(statement, username);
  get_active_participant_or_fail(coopname, username);
  eosio::check(MarketInvest::has_agreement(coopname, username, braname),
               "MARKETPLACE_INVAGR_REQUIRED: Сначала подпишите договор об участии в хозяйственной деятельности этого участка");
  eosio::check(MarketInvest::is_operator(coopname, braname, username),
               "MARKETPLACE_INVEST_NOT_OPERATOR: Вносить средства в участок может председатель или доверенное лицо участка");

  const auto share = Marketplace::get_user_wallet_balance(coopname, ledger2_wallets::SHARE_FUND_PAY, username);
  eosio::check(share.available >= amount,
               std::string{"MARKETPLACE_INVEST_INSUFFICIENT: На главном паевом кошельке недостаточно средств: нужно "} +
                 amount.to_string() + ", доступно " + share.available.to_string());

  Ledger2::apply(_marketplace, coopname, operations::marketplace::INVEST_MONEY,
                 processes::marketplace::INVEST, amount, username, invest_hash,
                 Marketplace::Memo::get_invest_money_memo());

  Marketplace::add_investment(coopname, braname, username, amount, MarketInvest::zero_asset());

  Soviet::make_complete_document(_marketplace, coopname, username, "investmoney"_n,
                                 invest_hash, statement);
}
