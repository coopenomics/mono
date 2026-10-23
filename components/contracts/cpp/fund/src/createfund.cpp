/**
 * @brief Создание нового фонда кооператива.
 * Создает новый фонд накопления или списания в кооперативе.
 * Только председатель совета может создавать фонды.
 * @param coopname Наименование кооператива
 * @param username Имя пользователя, создающего фонд
 * @param type Тип фонда (accumulation - накопления, expend - списания)
 * @param contract Внешний контракт, управляющий фондом
 * @param name Название фонда
 * @param description Описание фонда
 * @param percent Процент отчислений (только для фондов накопления, 0 для списания)
 * @ingroup public_actions
 * @ingroup public_fund_actions

 * @note Авторизация требуется от аккаунта: @p username (председатель совета)
 */
// type: accumulation, expend
[[eosio::action]] void fund::createfund(eosio::name coopname,
                                        eosio::name username, eosio::name type,
                                        eosio::name contract, std::string name,
                                        std::string description,
                                        uint64_t percent) {
  require_auth(username);

  eosio::check(type == "accumulation"_n || type == "expend"_n,
               "Неверный тип фонда");

  auto cooperative = get_cooperative_or_fail(coopname);

  auto soviet = get_board_by_type_or_fail(coopname, "soviet"_n);
  auto chairman = soviet.get_chairman();

  eosio::check(username == chairman,
               "Только председатель может управлять фондами");

  uint64_t id;

  if (type == "accumulation"_n) {
    eosio::check(percent > 0 && percent <= HUNDR_PERCENTS,
                 "Процент фонда накопления должен быть больше нуля и меньше 1 "
                 "000 000 (= 100%)");

    accfunds_index accfunds(_fund, coopname.value);
    uint64_t total_percent = percent;

    // получаем сумму процентов всех фондов
    for (auto it = accfunds.begin(); it != accfunds.end(); it++) {
      total_percent += it->percent;
    }

    // сумма не должна превышать 100%
    check(total_percent <= HUNDR_PERCENTS,
          "Сумма всех процентов превышает 100% (1 000 000)");
    id = get_global_id(_fund, "funds"_n);
    accfunds.emplace(RamPayer::of(accfunds, coopname), [&](auto &a) {
      a.id = get_global_id_in_scope(_fund, coopname, "funds"_n);
      a.coopname = coopname;
      a.contract = contract;
      a.name = name;
      a.description = description;
      a.percent = percent;
      a.available = asset(0, cooperative.initial.symbol);
      a.withdrawed = asset(0, cooperative.initial.symbol);
    });
  } else if (type == "expend"_n) {
    eosio::check(
        percent == 0,
        "Процент для фонда списания должен быть равен нулю (не используется)");

    expfunds_index expfunds(_fund, coopname.value);
    id = get_global_id_in_scope(_fund, coopname, "funds"_n);

    expfunds.emplace(RamPayer::of(expfunds, coopname), [&](auto &e) {
      e.id = id;
      e.coopname = coopname;
      e.contract = contract;
      e.name = name;
      e.description = description;
      e.expended = asset(0, cooperative.initial.symbol);
    });
  };

  action(permission_level{_fund, "active"_n}, _fund, "newfund"_n,
         std::make_tuple(coopname, type, id))
      .send();
};