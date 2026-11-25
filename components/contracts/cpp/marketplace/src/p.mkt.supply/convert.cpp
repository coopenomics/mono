/**
 * @brief Трансляция паевого взноса пайщика из ЦПП «Цифровой кошелёк» в ЦПП
 *        «Стол заказов» по Заявлению 1110 (задача 99D-18, решение владельца
 *        31.10.2026). Первое действие транзакции оформления, перед заказами,
 *        которые оплачивает.
 *
 * Заявление пишется на то, чего не хватило на свободном паевом «Стола
 * заказов» w.mkt.share: недостающая часть тела заказов и обеспечительной
 * части паевого взноса. Обе части остаются паевыми — перевод идёт внутри
 * счёта 80 без проводки (TRANSFER w.wal.share → w.mkt.share). Затем
 * createorder / stockorder берут со свободного паевого обеспечительную часть
 * и тело.
 *
 * Заявление одно на всё оформление, а нитка процесса ведётся по заказу,
 * поэтому сумма приходит разбитой по заказам (`targets`) и на каждый заказ
 * эмитится своя `o.mkt.conv` с `process_hash = order_hash`. Перевод
 * становится первой операцией нитки того заказа, который оплачивает.
 * Пустой `targets` — действие только публикует заявление.
 *
 * Guards: суммы адресатов ≥ 0 в _root_govern_symbol; заявление подписано
 * заказчиком; заказчик — активный пайщик; на Цифровом кошельке достаточно
 * паевого на всю сумму трансляции.
 *
 * @ingroup public_marketplace_actions
 */
void marketplace::convert(eosio::name coopname,
                          eosio::name orderer,
                          std::vector<convert_target> targets,
                          document2 convert_statement) {
  require_auth(coopname);

  eosio::check(!is_empty_document(convert_statement),
               "MARKETPLACE_CONVERT_STATEMENT_MISSING: Отсутствует заявление о трансляции паевого взноса в программу");
  verify_document_or_fail(convert_statement, { orderer });
  // Заявление о переводе подписывает сам заказчик. Транзакцию шлёт кооператив, поэтому ключ сверяется с аккаунтом.
  verify_signer_keys_or_fail(convert_statement, orderer);

  get_active_participant_or_fail(coopname, orderer);

  // Общая сумма перевода — сумма долей заказов; проверяется одним чтением
  // баланса, чтобы частичного списания не случилось при нехватке на последней.
  eosio::asset total(0, _root_govern_symbol);
  for (const auto& target : targets) {
    eosio::check(target.amount.is_valid() && target.amount.amount >= 0,
                 "MARKETPLACE_CONVERT_AMOUNT_INVALID: Некорректная сумма трансляции паевого взноса");
    eosio::check(target.amount.symbol == _root_govern_symbol,
                 "MARKETPLACE_CONVERT_AMOUNT_INVALID: Некорректный символ валюты в сумме трансляции");
    // Пустой хэш увёл бы операцию в нитку без анкера — ровно то, ради чего
    // адресация и вводилась; сумма без заказа смысла не имеет.
    eosio::check(target.amount.amount == 0 || target.order_hash != checksum256{},
                 "MARKETPLACE_CONVERT_ORDER_MISSING: Не указан заказ, который оплачивает трансляция паевого взноса");
    total += target.amount;
  }

  if (total.amount > 0) {
    auto bal = Marketplace::get_user_wallet_balance(coopname, ledger2_wallets::SHARE_FUND_PAY, orderer);
    eosio::check(bal.available >= total,
                 std::string{"MARKETPLACE_CONVERT_SHORTFALL: Недостаточно паевых средств на Цифровом кошельке для трансляции: требуется "} +
                   total.to_string() + ", доступно " + bal.available.to_string());

    for (const auto& target : targets) {
      if (target.amount.amount == 0) continue;
      Ledger2::apply(_marketplace, coopname,
                     operations::marketplace::TRANSLATE_SHARE,
                     processes::marketplace::SUPPLY,
                     target.amount, orderer, target.order_hash,
                     Marketplace::Memo::get_translate_share_memo());
    }
  }

  // Заявление публикуется в реестр документов самостоятельным пакетом
  // (package = hash заявления): оно одно на всё оформление и может оплачивать
  // сразу несколько заказов, тогда как нитка процесса ведётся по одному.
  Soviet::make_complete_document(_marketplace, coopname, orderer,
                                 "convert"_n,
                                 convert_statement.hash, convert_statement);
}
