/**
 * @brief Возврат членских взносов из общего кошелька кооперативного участка
 * в пул взносов программы-источника (процесс p.brn.fees) — точная инверсия
 * accrue.
 *
 * Вызывается inline контрактом-источником (сегодня — marketplace при приёме
 * гарантийного возврата, accretrn): доля членского взноса, приходящаяся на
 * возвращаемое имущество, уходит из общего кошелька участка (o.brn.retfee,
 * username = braname) обратно в пул взносов программы. Оттуда контракт-источник
 * своей операцией возврата довозвращает её на членский кошелёк заказчика —
 * пайщику возвращается полная уплаченная сумма, а не только стоимость
 * имущества.
 *
 * Двухходовка нужна из-за инварианта walletop «один username на обе стороны»:
 * прямой перевод с общего кошелька участка (разрез по braname) на кошелёк
 * пайщика (разрез по пайщику) невозможен, поэтому транзит идёт через
 * кооперативный пул взносов программы.
 *
 * Guards:
 *  - авторизация: кооператив либо системный контракт из whitelist;
 *  - сумма в валюте кооператива, больше нуля;
 *  - средств в общем кошельке участка достаточно. Взнос попадает в общий
 *    кошелёк сразу при выдаче заказа, а возврат приходит в течение
 *    гарантийного срока — к этому моменту участок мог уже распределить или
 *    потратить эти средства. Тогда приём возврата не проходит, и председатель
 *    сперва пополняет общий кошелёк участка.
 *
 * @ingroup public_branch_actions
 */
[[eosio::action]] void branch::retfee(eosio::name coopname, eosio::name braname,
                                       eosio::name source_contract,
                                       eosio::asset amount,
                                       eosio::checksum256 process_hash,
                                       std::string memo) {
  if (!has_auth(coopname)) {
    check_auth_and_get_payer_or_fail(contracts_whitelist);
  }

  eosio::check(amount.is_valid() && amount.amount > 0,
               "Сумма возврата взноса должна быть больше нуля");
  eosio::check(amount.symbol == _root_govern_symbol,
               "Некорректный символ валюты в сумме возврата взноса");

  get_branch_or_fail(coopname, braname);

  // source_contract сейчас информационный (источник один — marketplace);
  // параметр сохранён в сигнатуре симметрично accrue.
  (void)source_contract;

  // Средства должны физически быть в общем кошельке участка: приоритет общего
  // кошелька (раунд 5) отдаёт взнос участку сразу на выдаче, поэтому к моменту
  // гарантийного возврата он мог быть уже распределён доверенным или потрачен.
  userwallets_index user_wallets(_ledger2, coopname.value);
  auto idx = user_wallets.get_index<"byuserwallet"_n>();
  auto it = idx.find(combine_ids(ledger2_wallets::BRANCH_COMMON.value, braname.value));
  const eosio::asset available = (it != idx.end())
      ? it->available
      : eosio::asset(0, _root_govern_symbol);

  eosio::check(available >= amount,
               std::string{"Недостаточно средств в общем кошельке кооперативного участка для возврата членского взноса: требуется "} +
                 amount.to_string() + ", доступно " + available.to_string() +
                 ". Пополните общий кошелёк участка и повторите приём возврата.");

  Ledger2::apply(_branch, coopname,
                 operations::branch::RETURN_FEE_FROM_COMMON,
                 amount, braname, process_hash, memo);
}
