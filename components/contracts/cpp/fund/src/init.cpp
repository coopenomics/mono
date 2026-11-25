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

/// Прежние значения стандартных фондов, которые меняет редакция 16.11.2026.
inline constexpr std::string_view MUTUAL_NAME_BEFORE_16_11 = "Фонд взаимного обеспечения";
inline constexpr uint64_t RESERVE_PERCENT_BEFORE_16_11 = 15 * ONE_PERCENT;

/**
 * Редакция стандартных фондов 16.11.2026 (решение владельца): фонд №5
 * называется «Фонд социально-экономического взаимодействия и социального
 * обеспечения», резервный фонд — 10 % вместо 15 %. Меняются только строки,
 * которые совет не правил: название и процент сверяются с прежними значениями
 * по умолчанию, поэтому повторный вызов ничего не меняет.
 */
inline void apply_standard_revision_16_11(eosio::name coopname) {
  funds_index funds(_fund, coopname.value);
  auto mutual = funds.find(MUTUAL_ID);
  if (mutual != funds.end() && mutual->name == MUTUAL_NAME_BEFORE_16_11) {
    funds.modify(mutual, RamPayer::of(funds, coopname), [&](auto &row) {
      row.name = std::string(standard_fund(MUTUAL_ID)->name);
    });
  }
  auto reserve = funds.find(RESERVE_ID);
  if (reserve != funds.end() && reserve->percent == RESERVE_PERCENT_BEFORE_16_11) {
    funds.modify(reserve, RamPayer::of(funds, coopname), [&](auto &row) {
      row.percent = standard_fund(RESERVE_ID)->percent;
    });
  }
}
} // namespace Fund

/**
 * @brief Инициализация фондов кооператива при его старте.
 *
 * Заводит пять стандартных фондов по Положению о фондах: неделимый (1 %),
 * резервный (10 %), развития кооперации (5 %), обеспечения хозяйственной
 * деятельности и социально-экономического взаимодействия и социального
 * обеспечения. У каждого — свой кошелёк ledger2 на
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
