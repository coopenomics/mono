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

  get_active_participant_or_fail(coopname, username);
  verify_document_or_fail(statement, { username });
  // Заявление о помощи подписывает сам пайщик.
  verify_signer_keys_or_fail(statement, username);

  // Материальная помощь выплачивается из средств, распределённых на участнике
  // реестра распределения участка, — получателем может быть только доверенное
  // лицо или председатель этого участка.
  auto branch = get_branch_or_fail(coopname, braname);
  eosio::check(branch.is_user_authorized(username),
               "Материальная помощь доступна только доверенному лицу или председателю кооперативного участка");

  // Предел материальной помощи за месяц — резерв социально-экономического
  // обеспечения получателя (задача 99D-20, решение владельца 03.11.2026).
  // Проверка включается только потолком больше нуля: прежний ИСТОК после
  // обновления контрактов работает без изменений, пока администратор не
  // задал потолок. Месяц — по времени блока UTC; истории нет: строка
  // накопителя перезаписывается при первом заявлении нового месяца.
  if (Branch::aid_month_limit(coopname).amount > 0) {
    bool has_reserve = false;
    const eosio::asset reserve = Branch::reserve_of(coopname, braname, username, has_reserve);
    eosio::check(has_reserve,
                 "BRANCH_AID_NO_RESERVE: У получателя нет резерва социально-экономического обеспечения на этом участке");

    const uint32_t period = Branch::utc_month_period(eosio::time_point_sec(eosio::current_time_point()));
    branch_aidmonths_index months(_branch, coopname.value);
    auto month = months.find(username.value);
    const eosio::asset already = (month == months.end() || month->period != period)
      ? eosio::asset(0, _root_govern_symbol)
      : month->total;
    eosio::check(already + amount <= reserve,
                 std::string{"BRANCH_AID_OVER_RESERVE: Материальная помощь за месяц превысит резерв получателя: заявлено "} +
                   amount.to_string() + ", уже подано " + already.to_string() + ", резерв " + reserve.to_string());

    if (month == months.end()) {
      months.emplace(RamPayer::of(months, coopname), [&](auto &m) {
        m.username = username;
        m.period = period;
        m.total = amount;
      });
    } else {
      months.modify(month, RamPayer::of(months, coopname), [&](auto &m) {
        m.period = period;
        m.total = already + amount;
      });
    }
  }

  branch_aids_index aids(_branch, coopname.value);
  auto byhash = aids.get_index<"byhash"_n>();
  eosio::check(byhash.find(aid_hash) == byhash.end(),
               "Заявление на материальную помощь с таким идентификатором уже подано");

  aids.emplace(RamPayer::of(aids, coopname), [&](auto& a) {
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
