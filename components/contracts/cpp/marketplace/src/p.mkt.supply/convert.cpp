/**
 * @brief Перевод паевого взноса пайщика во внутренний членский кошелёк
 *        «Стола заказов» по Заявлению 1110 (паевая модель, уточнение владельца
 *        06.09.2026). Отдельная транзакция ДО заказа, только когда членского
 *        кошелька не хватает: заявление пишется на недостающую сумму
 *        («прошу перевести с баланса моего Цифрового кошелька на баланс ЦПП
 *        «Стол заказов» N, из них членский взнос M»), а по кошелькам здесь
 *        двигается только членская часть M — паевая часть тела заказа пойдёт
 *        своим путём (паевой резерв) при createorder / stockorder.
 *
 * Одна ledger2-операция (может отсутствовать при amount = 0 — тогда действие
 * только публикует заявление, если переводить в членский нечего):
 *  - `o.mkt.conv`  (TRANSFER w.wal.share → w.mkt.member, Дт 80 / Кт 86) —
 *    обычный заказ, источник — Цифровой кошелёк;
 *  - `o.mkt.convp` (TRANSFER w.mkt.share → w.mkt.member, Дт 80 / Кт 86) —
 *    заказ из остатка и доплата по факту, источник — свободный паевой программы
 *    (`from_market = true`).
 *
 * Guards: amount ≥ 0 в _root_govern_symbol; заявление подписано заказчиком;
 * заказчик — активный пайщик; на источнике достаточно паевого.
 *
 * @ingroup public_marketplace_actions
 */
void marketplace::convert(eosio::name coopname,
                          eosio::name orderer,
                          eosio::asset amount,
                          bool from_market,
                          document2 convert_statement) {
  require_auth(coopname);

  eosio::check(amount.is_valid() && amount.amount >= 0,
               "Некорректная сумма перевода в членский кошелёк");
  eosio::check(amount.symbol == _root_govern_symbol,
               "Некорректный символ валюты в сумме перевода");
  eosio::check(!is_empty_document(convert_statement),
               "Отсутствует заявление о переводе паевого взноса в программу");
  verify_document_or_fail(convert_statement, { orderer });

  get_participant_or_fail(coopname, orderer);

  if (amount.amount > 0) {
    const eosio::name source = from_market ? ledger2_wallets::MARKETPLACE_SHARE_FUND
                                           : ledger2_wallets::SHARE_FUND_PAY;
    auto bal = Marketplace::get_user_wallet_balance(coopname, source, orderer);
    eosio::check(bal.available >= amount,
                 std::string{"Недостаточно паевых средств для перевода в членский кошелёк: требуется "} +
                   amount.to_string() + ", доступно " + bal.available.to_string());
    Ledger2::apply(_marketplace, coopname,
                   from_market ? operations::marketplace::CONVERT_FROM_SHARE
                               : operations::marketplace::CONVERT_TO_MEMBER,
                   processes::marketplace::SUPPLY,
                   amount, orderer, convert_statement.hash,
                   Marketplace::Memo::get_convert_to_member_memo());
  }

  // Заявление публикуется в реестр документов самостоятельным пакетом
  // (package = hash заявления): перевод в программу — операция программы, а не
  // процесса поставки (тот группируется вокруг order_hash).
  Soviet::make_complete_document(_marketplace, coopname, orderer,
                                 "convert"_n,
                                 convert_statement.hash, convert_statement);
}
