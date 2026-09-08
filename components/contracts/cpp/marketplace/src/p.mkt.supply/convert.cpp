/**
 * @brief Перевод паевого взноса пайщика во внутренний членский кошелёк
 *        «Стола заказов» по Заявлению 1110 (паевая модель, уточнения владельца
 *        06–07.09.2026). Отдельная транзакция ДО заказа. Заявление пишется на
 *        то, чего не хватило в кошельках программы: «прошу перевести с баланса
 *        моего Цифрового кошелька на баланс ЦПП «Стол заказов» N, из них
 *        членский взнос M», где M — взнос за вычетом остатка членского
 *        кошелька, N — недостающая часть тела (сверх свободного паевого
 *        программы) плюс M. Здесь двигается только членская часть M — паевая
 *        часть тела уйдёт своим путём при createorder / stockorder.
 *
 * Заявление одно на всё оформление, а нитка процесса ведётся по заказу,
 * поэтому сумма приходит разбитой по заказам (`targets`) и на каждый заказ
 * эмитится своя `o.mkt.conv` с `process_hash = order_hash` (TRANSFER
 * w.wal.share → w.mkt.member, Дт 80 / Кт 86). Перевод
 * становится первой операцией нитки того заказа, который оплачивает: своей
 * нитки без анкера он больше не заводит (уточнение владельца 08.09.2026).
 * Пустой `targets` — действие только публикует заявление.
 *
 * Guards: суммы адресатов ≥ 0 в _root_govern_symbol; заявление подписано
 * заказчиком; заказчик — активный пайщик; на Цифровом кошельке достаточно
 * паевого на всю сумму перевода.
 *
 * @ingroup public_marketplace_actions
 */
void marketplace::convert(eosio::name coopname,
                          eosio::name orderer,
                          std::vector<convert_target> targets,
                          document2 convert_statement) {
  require_auth(coopname);

  eosio::check(!is_empty_document(convert_statement),
               "Отсутствует заявление о переводе паевого взноса в программу");
  verify_document_or_fail(convert_statement, { orderer });

  get_participant_or_fail(coopname, orderer);

  // Общая сумма перевода — сумма долей заказов; проверяется одним чтением
  // баланса, чтобы частичного списания не случилось при нехватке на последней.
  eosio::asset total(0, _root_govern_symbol);
  for (const auto& target : targets) {
    eosio::check(target.amount.is_valid() && target.amount.amount >= 0,
                 "Некорректная сумма перевода в членский кошелёк");
    eosio::check(target.amount.symbol == _root_govern_symbol,
                 "Некорректный символ валюты в сумме перевода");
    // Пустой хэш увёл бы операцию в нитку без анкера — ровно то, ради чего
    // адресация и вводилась; сумма без заказа смысла не имеет.
    eosio::check(target.amount.amount == 0 || target.order_hash != checksum256{},
                 "Не указан заказ, который оплачивает перевод в членский кошелёк");
    total += target.amount;
  }

  if (total.amount > 0) {
    auto bal = Marketplace::get_user_wallet_balance(coopname, ledger2_wallets::SHARE_FUND_PAY, orderer);
    eosio::check(bal.available >= total,
                 std::string{"Недостаточно паевых средств для перевода в членский кошелёк: требуется "} +
                   total.to_string() + ", доступно " + bal.available.to_string());

    for (const auto& target : targets) {
      if (target.amount.amount == 0) continue;
      Ledger2::apply(_marketplace, coopname,
                     operations::marketplace::CONVERT_TO_MEMBER,
                     processes::marketplace::SUPPLY,
                     target.amount, orderer, target.order_hash,
                     Marketplace::Memo::get_convert_to_member_memo());
    }
  }

  // Заявление публикуется в реестр документов самостоятельным пакетом
  // (package = hash заявления): оно одно на всё оформление и может оплачивать
  // сразу несколько заказов, тогда как нитка процесса ведётся по одному.
  Soviet::make_complete_document(_marketplace, coopname, orderer,
                                 "convert"_n,
                                 convert_statement.hash, convert_statement);
}
