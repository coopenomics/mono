/**
 * @brief Заявление на материальную помощь доверенного/председателя КУ
 * (requirement b6 «Экономика КУ», процесс p.brn.aid).
 *
 * Источник выбирается при подаче. Первым идёт собственный персональный
 * кошелёк членских средств получателя (w.brn.person), пополненный
 * распределением членских взносов участка. Если его не хватает — свободные
 * средства инициаторов участка (пул w.mkt.ipool, задача 99D-28). Получатель
 * сам подписывает заявление.
 *
 * НДФЛ удерживает кооператив: он выступает налоговым агентом и перечисляет
 * получателю сумму за вычетом налога (решение владельца 2026-08-13, отменяет
 * прежний порядок «налог платит получатель сам»). `amount` здесь — сумма
 * заявления целиком, разбивка на выплату и удержание считается в `BranchNdfl`
 * на шаге выплаты.
 *
 * Сумма заявления двигается в момент подачи — свободный остаток уменьшается
 * сразу, и два заявления на одни и те же деньги подать нельзя (решение
 * владельца 08.11.2026; блокировок в ledger2 нет, резерв — отдельный кошелёк):
 *  - источник «персональный кошелёк» — o.brn.aidreq переводит сумму с
 *    w.brn.person на кошелёк заявлений w.brn.aidreq (Дт 86 / Кт 86 не
 *    проводится, счёт один);
 *  - источник «средства инициаторов» — сумма выделяется из пула под хэш
 *    заявления (o.mkt.ipool), резерв участка растёт.
 * Источник записывается в `aids.source`. Отказ совета (`onaiddecl`) возвращает
 * сумму в этот же источник; одобрение (`onaidauth`) только регистрирует
 * исходящий платёж в gateway; выплата (`aidconfirm`) после банковского
 * перевода кассиром списывает с кошелька заявлений: o.brn.aidtax (удержание,
 * Дт 86 / Кт 68), o.brn.aidfnd и o.brn.aid (выплата через фонд, Дт 86 / Кт 51).
 *
 * Материальная помощь выводит деньги из кооператива, поэтому решение о выплате
 * принимает совет: заявление вносится на повестку (soviet::createagenda,
 * type=brnaid) со статусом proposed.
 *
 * Guards:
 *  - amount > 0 в валюте кооператива; заявление с таким hash не существует;
 *  - получатель — активный пайщик; заявление подписано получателем;
 *  - получатель — доверенное лицо либо председатель указанного участка;
 *  - сумма в пределах накопленного права получателя по резерву
 *    социально-экономического обеспечения (задача 99D-34);
 *  - средств хватает: персональный кошелёк либо свободные средства
 *    инициаторов (BRANCH_AID_INSUFFICIENT).
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

  // Предел заявления — накопленное право получателя (задача 99D-34, решение
  // владельца 10.11.2026): помощь временно играет роль оплаты труда, право
  // копится каждый период на сумму строки резерва и не сгорает. Проверка
  // включается только потолком больше нуля: прежний ИСТОК после обновления
  // контрактов работает без изменений, пока администратор не задал потолок.
  if (Branch::aid_month_limit(coopname).amount > 0) {
    branch_reserves_index reserves(_branch, coopname.value);
    auto ridx = reserves.get_index<"bybruser"_n>();
    auto rit = ridx.find(combine_ids(braname.value, username.value));
    eosio::check(rit != ridx.end(),
                 "BRANCH_AID_NO_RESERVE: У получателя нет резерва социально-экономического обеспечения на этом участке");

    const uint32_t period = Branch::aid_period(coopname, eosio::time_point_sec(eosio::current_time_point()));
    const eosio::asset available = Branch::outstanding_of(coopname, *rit, period);
    eosio::check(amount <= available,
                 std::string{"BRANCH_AID_OVER_RESERVE: Сумма заявления больше накопленного права получателя: заявлено "} +
                   amount.to_string() + ", доступно " + available.to_string());

    ridx.modify(rit, RamPayer::of(ridx, coopname), [&](auto &r) {
      r.accrued_period = period;
      r.outstanding = available - amount;
    });
  }

  branch_aids_index aids(_branch, coopname.value);
  auto byhash = aids.get_index<"byhash"_n>();
  eosio::check(byhash.find(aid_hash) == byhash.end(),
               "Заявление на материальную помощь с таким идентификатором уже подано");

  // Источник помощи выбирается при подаче и сумма сразу переходит из
  // свободных средств (решение владельца 08.11.2026): иначе можно подать
  // заявлений больше, чем есть, и выплата падала у кассира. Персональный
  // кошелёк получателя — первым; не хватает — средства инициаторов участка
  // выделяются под заявление; нет ни того, ни другого — отказ.
  const eosio::asset person = Ledger2::get_user_available(coopname, ledger2_wallets::BRANCH_PERSONAL, username);
  eosio::name source;
  if (person >= amount) {
    Ledger2::apply(_branch, coopname, operations::branch::AID_REQUEST, processes::branch::AID,
                   amount, username, aid_hash,
                   "Сумма заявления на материальную помощь переведена на кошелёк заявлений");
    source = ledger2_wallets::BRANCH_AID_REQUEST;
  } else if (MarketInvest::free_of(coopname, braname) >= amount) {
    MarketInvest::fund_pool(_branch, coopname, braname, amount, aid_hash);
    source = ledger2_wallets::MARKETPLACE_INVEST_POOL;
  } else {
    eosio::check(false,
                 std::string{"BRANCH_AID_INSUFFICIENT: Недостаточно свободных средств для материальной помощи: заявлено "} +
                   amount.to_string() + ", свободно на персональном кошельке " + person.to_string());
  }

  aids.emplace(RamPayer::of(aids, coopname), [&](auto& a) {
    a.id        = aids.available_primary_key();
    a.hash      = aid_hash;
    a.username  = username;
    a.braname   = braname;
    a.amount    = amount;
    a.status    = AidStatus::PROPOSED;
    a.statement = statement;
    a.source    = source;
  });

  // Мост повестки совета: branch в contracts_whitelist, поэтому createagenda
  // авторизуется от permission_level{_branch, active}. hash=aid_hash, чтобы
  // callback onaidauth/onaiddecl нашёл заявление.
  Soviet::create_agenda(_branch, coopname, username,
                        get_valid_soviet_action(_branch_aid_action),
                        aid_hash, _branch, "onaidauth"_n, "onaiddecl"_n,
                        statement, meta);
}
