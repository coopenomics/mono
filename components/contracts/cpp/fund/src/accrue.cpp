/**
 * @brief Отчисление в фонды накопления кооператива из членского взноса
 * (задачи 99D-19 и 99D-25; решения владельца 02–03.11.2026).
 *
 * Контракт-источник членского взноса (сегодня — marketplace при списании
 * обеспечительной части паевого взноса участка, действие `chargeperiod`)
 * зовёт это действие инлайн и передаёт сумму отчислений целиком. Контракт
 * fund делит её между фондами накопления пропорционально их процентам из
 * `funds`: неделимый 1 %, резервный 15 %, фонд развития кооперации 5 % по
 * умолчанию; проценты правит председатель совета. Остаток округления достаётся
 * последнему фонду по порядку номеров, поэтому сумма долей равна переданной
 * сумме копейка в копейку.
 *
 * Движение по каждому фонду — своя операция на свой кошелёк (кошелёк и есть
 * субсчёт фонда): o.fnd.indiv → w.fnd.indiv, o.fnd.resrv → w.fnd.resrv,
 * o.fnd.devel → w.fnd.devel; все — TRANSFER с w.mkt.fee, Дт 80 / Кт 86, в нитке
 * процесса источника (`process_type`, `process_hash`): отчисление остаётся в
 * нитке заказа, из которого пришли деньги. Зеркала в таблицах контракта нет.
 *
 * Guards:
 *  - авторизация: кооператив либо контракт из белого списка;
 *  - сумма в валюте кооператива и больше нуля;
 *  - у кооператива есть хотя бы один фонд накопления с ненулевым процентом.
 *
 * Границы: действие перебирает только пять строк `funds` кооператива и не
 * хранит истории.
 *
 * @ingroup public_actions
 * @ingroup public_fund_actions
 * @note Авторизация требуется от аккаунта: @p coopname либо контракта из белого списка.
 */
[[eosio::action]] void fund::accrue(eosio::name coopname, eosio::name source_contract,
                                    eosio::asset amount, eosio::name process_type,
                                    eosio::checksum256 process_hash, std::string memo) {
  if (!has_auth(coopname)) {
    check_auth_and_get_payer_or_fail(contracts_whitelist);
  }

  eosio::check(amount.is_valid() && amount.amount > 0,
               "FUND_ACCRUE_AMOUNT_INVALID: Сумма отчисления в фонды должна быть больше нуля");
  eosio::check(amount.symbol == _root_govern_symbol,
               "FUND_ACCRUE_AMOUNT_INVALID: Сумма отчисления в фонды должна быть в валюте кооператива");

  // Источник сейчас информационный (единственный — marketplace); параметр
  // сохранён ради симметрии с branch::accrue и будущих программ.
  (void)source_contract;

  funds_index funds(_fund, coopname.value);

  // Фонды накопления с процентом — получатели отчисления, в порядке номеров.
  uint64_t total_percent = 0;
  uint64_t last_id = 0;
  for (auto it = funds.begin(); it != funds.end(); ++it) {
    if (it->kind != Fund::KIND_ACCUMULATION || it->percent == 0) continue;
    total_percent += it->percent;
    last_id = it->id;
  }
  eosio::check(last_id != 0 && total_percent > 0,
               "FUND_NO_ACCUMULATION_FUNDS: У кооператива нет фондов накопления с процентом отчислений");

  int64_t distributed = 0;
  for (auto it = funds.begin(); it != funds.end(); ++it) {
    if (it->kind != Fund::KIND_ACCUMULATION || it->percent == 0) continue;
    const bool is_last = it->id == last_id;
    const int64_t share = is_last
      ? amount.amount - distributed
      : static_cast<int64_t>(static_cast<uint128_t>(amount.amount) * it->percent / total_percent);
    distributed += share;
    if (share <= 0) continue;

    const auto* standard = Fund::standard_fund(it->id);
    eosio::check(standard != nullptr && standard->accrue_op.value != 0,
                 "FUND_NOT_FOUND: Фонд накопления без операции отчисления");

    // COOPERATIVE-кошельки: username в операции — кооператив, разреза нет.
    Ledger2::apply(_fund, coopname,
                   standard->accrue_op,
                   process_type,
                   eosio::asset(share, amount.symbol), coopname, process_hash, memo);
  }
}
