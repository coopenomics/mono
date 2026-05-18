/**
 * @brief Пополняет пул программных расходов из общего инвестиционного пула программы.
 *
 * Программные расходы — это целевые списания «Благорост», не аллоцированные ни в один проект
 * (хозяйственные расходы программы, оплата инфраструктуры программы и т.п.). Прежде чем
 * создавать запрос на программный расход, председатель пополняет дедикейтнутый пул
 * @c program_expense_pool из общего @c global_available_invest_pool — деньги остаются
 * на том же ledger2-кошельке @c BLAGOROST_FUND, меняется только разбивка по назначению.
 *
 * @param coopname Кооператив (scope state)
 * @param amount   Сумма пополнения (символ строго совпадает с программой)
 * @ingroup public_actions
 * @ingroup public_capital_actions
 *
 * @note Авторизация требуется от аккаунта: @p coopname (председатель).
 */
void capital::topupprogexp(name coopname, eosio::asset amount) {
  require_auth(coopname);

  Capital::State::topup_program_expense_pool(coopname, amount);
}
