/**
 * @brief Пополняет пул программных расходов из общего инвестиционного пула программы.
 *
 * Программные расходы — это целевые списания «Благорост», не аллоцированные ни в один проект
 * (хозяйственные расходы программы, оплата инфраструктуры программы и т.п.). Прежде чем
 * создавать запрос на программный расход, председатель пополняет дедикейтнутый пул
 * @c program_expense_pool из общего @c global_available_invest_pool. Помимо счётчиков
 * state наполняется КООПЕРАТИВНЫЙ ledger2-кошелёк @c PROGRAM_EXPENSE_POOL (w.cap.pgexp) —
 * именно из него шасси expense оплачивает СЗ; личные L3-кошельки пайщиков (w.cap.blago)
 * при расходах не изменяются.
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

  // Кошелёк-резерв пула: ISSUE w.cap.pgexp без бухпроводки (деньги физически
  // на 51 с момента взносов — выделяется только назначение под расходы).
  // Синтетический process_hash — у пополнения нет естественного анкера.
  const uint64_t now_us = eosio::current_time_point().time_since_epoch().count();
  const std::string anchor = coopname.to_string() + ":pgtopup:" + std::to_string(now_us);
  const checksum256 process_hash = eosio::sha256(anchor.c_str(), anchor.size());

  Ledger2::apply(_capital, coopname, operations::capital::PROGRAM_EXPENSE_TOPUP, amount,
                 name{}, process_hash, "capital:topupprogexp");
}
