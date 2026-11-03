/**
 * @brief Правка настроек фонда председателем совета (задача 99D-25).
 *
 * У фонда накопления меняются описание и процент отчислений, у фонда списания —
 * только описание. Название стандартного фонда и внешний контракт управления
 * не меняются: набор фондов фиксирован Положением о фондах, кошельки заданы при
 * сборке. Сумма процентов фондов накопления не превышает 100 %: при большей
 * сумме `closeperiod` Стола заказов не смог бы разделить членский взнос.
 *
 * Отказы — с кодом, приложение проверяет те же правила до обращения в цепь:
 *  - FUND_NOT_CHAIRMAN — подписал не председатель совета;
 *  - FUND_KIND_INVALID — вид фонда не `accumulation` и не `expend`;
 *  - FUND_NOT_FOUND — фонда с таким номером нет;
 *  - FUND_KIND_MISMATCH — вид в вызове расходится с видом фонда;
 *  - FUND_NAME_FIXED — название стандартного фонда не меняется;
 *  - FUND_CONTRACT_FIXED — фонд не передаётся в управление контракту;
 *  - FUND_PERCENT_INVALID — процент фонда накопления вне (0; 100 %], у фонда списания не ноль;
 *  - FUND_PERCENT_SUM_EXCEEDED — сумма процентов фондов накопления выше 100 %.
 *
 * @param coopname Наименование кооператива
 * @param username Председатель совета
 * @param type Вид фонда: `accumulation` или `expend`
 * @param fund_id Номер фонда (1…5)
 * @param contract Должен быть пустым
 * @param name Должно совпадать с названием фонда
 * @param description Новое описание
 * @param percent Новый процент ×10 000 (у фонда списания — 0)
 * @ingroup public_actions
 * @ingroup public_fund_actions
 * @note Авторизация требуется от аккаунта: @p username (председатель совета)
 */
[[eosio::action]] void fund::editfund(eosio::name coopname,
                                      eosio::name username, eosio::name type,
                                      uint64_t fund_id, eosio::name contract,
                                      std::string name, std::string description,
                                      uint64_t percent) {
  require_auth(username);

  eosio::check(type == "accumulation"_n || type == "expend"_n,
               "FUND_KIND_INVALID: Вид фонда — накопления (accumulation) или списания (expend)");

  get_cooperative_or_fail(coopname);
  auto soviet = get_board_by_type_or_fail(coopname, "soviet"_n);
  eosio::check(username == soviet.get_chairman(),
               "FUND_NOT_CHAIRMAN: Настройки фондов меняет только председатель совета");

  funds_index funds(_fund, coopname.value);
  auto row = funds.find(fund_id);
  eosio::check(row != funds.end(), "FUND_NOT_FOUND: Фонд с таким номером не найден");

  const eosio::name kind = type == "accumulation"_n ? Fund::KIND_ACCUMULATION : Fund::KIND_EXPENDITURE;
  eosio::check(row->kind == kind,
               "FUND_KIND_MISMATCH: Вид фонда в вызове расходится с видом фонда в реестре");
  eosio::check(name == row->name,
               "FUND_NAME_FIXED: Название стандартного фонда не меняется");
  eosio::check(contract == ""_n,
               "FUND_CONTRACT_FIXED: Фонд не передаётся в управление контракту");

  if (kind == Fund::KIND_ACCUMULATION) {
    eosio::check(percent > 0 && percent <= HUNDR_PERCENTS,
                 "FUND_PERCENT_INVALID: Процент фонда накопления — от 0 до 100 % включительно, больше нуля");
    // Сумма процентов всех фондов накопления с новым значением этого фонда.
    const uint64_t others = Fund::accumulation_percent_sum(coopname) - row->percent;
    eosio::check(others + percent <= HUNDR_PERCENTS,
                 "FUND_PERCENT_SUM_EXCEEDED: Сумма процентов фондов накопления выше 100 %");
  } else {
    eosio::check(percent == 0,
                 "FUND_PERCENT_INVALID: У фонда списания процента отчислений нет");
  }

  funds.modify(row, RamPayer::of(funds, coopname), [&](auto &r) {
    r.description = description;
    r.percent = percent;
  });
}
