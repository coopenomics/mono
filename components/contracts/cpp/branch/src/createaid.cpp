/**
 * @brief Заявление на материальную помощь доверенного/председателя КУ
 * (requirement b6 «Экономика КУ», процесс p.brn.aid).
 *
 * Источник — собственный персональный кошелёк членских средств получателя
 * (w.brn.person), пополненный распределением членских взносов участка.
 * Получатель сам подписывает заявление.
 *
 * НДФЛ удерживает кооператив: он выступает налоговым агентом и перечисляет
 * получателю сумму за вычетом налога (решение владельца 2026-08-13, отменяет
 * прежний порядок «налог платит получатель сам»). `amount` здесь — сумма
 * заявления целиком: именно она списывается с персонального кошелька, а
 * разбивка на выплату и удержание считается в `BranchNdfl` на шаге выплаты.
 *
 * Действие НЕ применяет ledger2 и НЕ создаёт исходящий платёж. Материальная
 * помощь выводит деньги из кооператива, поэтому решение о выплате принимает
 * совет: здесь заявление лишь вносится на повестку (soviet::createagenda,
 * type=brnaid) со статусом proposed. Регистрация исходящего платежа в gateway
 * происходит в callback'е `onaidauth` после положительного решения; при отказе
 * совета срабатывает `onaiddecl` и заявление закрывается, не доходя до кассира.
 * Списание выполняется ещё позже — в `aidconfirm`, после фактического
 * банковского перевода кассиром, и идёт двумя операциями: o.brn.aidtax
 * (удержание, Дт 86 / Кт 68) и o.brn.aid (выплата, Дт 86 / Кт 51).
 *
 * Средства под заявление не блокируются ни на одном шаге: если к моменту
 * подтверждения кассиром баланса уже не хватает (получатель параллельно
 * перевёл их в «Стол заказов»), списание упадёт и кассир не сможет подтвердить
 * выплату.
 *
 * Guards:
 *  - amount > 0 в валюте кооператива; заявление с таким hash не существует;
 *  - получатель — активный пайщик; заявление подписано получателем;
 *  - получатель — доверенное лицо либо председатель указанного участка;
 *  - на персональном кошельке достаточно средств на момент подачи.
 *
 * @note Авторизация требуется от аккаунта: @p coopname.
 *
 * @ingroup public_branch_actions
 */
[[eosio::action]] void branch::createaid(eosio::name coopname, eosio::name username,
                                          eosio::name braname,
                                          eosio::checksum256 aid_hash,
                                          eosio::asset amount,
                                          document2 statement,
                                          std::string meta) {
  check_auth_or_fail(_branch, coopname, coopname, "createaid"_n);

  eosio::check(amount.is_valid() && amount.amount > 0,
               "Сумма материальной помощи должна быть больше нуля");
  eosio::check(amount.symbol == _root_govern_symbol,
               "Некорректный символ валюты в сумме материальной помощи");

  get_participant_or_fail(coopname, username);
  verify_document_or_fail(statement, { username });

  // Материальная помощь выплачивается из средств, распределённых на участнике
  // реестра распределения участка, — получателем может быть только доверенное
  // лицо или председатель этого участка.
  auto branch = get_branch_or_fail(coopname, braname);
  eosio::check(branch.is_user_authorized(username),
               "Материальная помощь доступна только доверенному лицу или председателю кооперативного участка");

  branch_aids_index aids(_branch, coopname.value);
  auto byhash = aids.get_index<"byhash"_n>();
  eosio::check(byhash.find(aid_hash) == byhash.end(),
               "Заявление на материальную помощь с таким идентификатором уже подано");

  aids.emplace(coopname, [&](auto& a) {
    a.id        = aids.available_primary_key();
    a.hash      = aid_hash;
    a.username  = username;
    a.braname   = braname;
    a.amount    = amount;
    a.status    = AidStatus::PROPOSED;
    a.statement = statement;
  });

  // Мост повестки совета: branch в contracts_whitelist, поэтому createagenda
  // авторизуется от permission_level{_branch, active}. hash=aid_hash, чтобы
  // callback onaidauth/onaiddecl нашёл заявление.
  Soviet::create_agenda(_branch, coopname, username,
                        get_valid_soviet_action(_branch_aid_action),
                        aid_hash, _branch, "onaidauth"_n, "onaiddecl"_n,
                        statement, meta);
}
