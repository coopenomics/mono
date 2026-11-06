/**
 * Заведение пяти стандартных фондов кооператива в `funds` (задача 99D-25).
 *
 * Общий для `init` и `migrate` помощник: дописывает недостающие строки с
 * процентами по умолчанию, существующие не трогает — председатель мог изменить
 * процент или описание. Остатков у строк нет: они на кошельках ledger2.
 */
namespace Fund {
inline void ensure_standard_funds(eosio::name coopname) {
  funds_index funds(_fund, coopname.value);
  for (const auto &f : STANDARD_FUNDS) {
    if (funds.find(f.id) != funds.end()) continue;
    funds.emplace(RamPayer::of(funds, coopname), [&](auto &row) {
      row.id = f.id;
      row.coopname = coopname;
      row.kind = f.kind;
      row.name = std::string(f.name);
      row.description = "";
      row.percent = f.percent;
      row.wallet = f.wallet;
    });
  }
}
} // namespace Fund

/**
 * @brief Инициализация фондов кооператива при его старте.
 *
 * Заводит пять стандартных фондов по Положению о фондах: неделимый (1 %),
 * резервный (15 %), развития кооперации (5 %), обеспечения хозяйственной
 * деятельности и взаимного обеспечения. У каждого — свой кошелёк ledger2 на
 * счёте 86; остатки живут только там. Повторный вызов ничего не меняет.
 *
 * Параметр `initial` сохранён ради сигнатуры: прежний учёт начальных паевых в
 * `coopwallet` отключён (задача 99D-25).
 *
 * @param coopname Наименование кооператива
 * @param initial Не используется
 * @ingroup public_actions
 * @ingroup public_fund_actions
 * @note Авторизация требуется от аккаунта: @p _soviet или @p _registrator
 */
[[eosio::action]] void fund::init(eosio::name coopname, eosio::asset initial) {
  check_auth_and_get_payer_or_fail({_soviet, _registrator});
  (void)initial;
  Fund::ensure_standard_funds(coopname);
}
