/**
 * @brief Отчисление в фонды накопления кооператива из членского взноса
 * (задача 99D-19, КЭУ-1; решение владельца 02.11.2026).
 *
 * Контракт-источник членского взноса (сегодня — marketplace при списании
 * обеспечительной части паевого взноса участка, действие `chargeperiod`)
 * зовёт это действие инлайн и передаёт сумму отчислений целиком. Контракт
 * fund сам делит её между фондами накопления пропорционально их процентам
 * (`accfunds.percent`): три стандартных фонда каждого кооператива — неделимый
 * 1 %, резервный 15 %, фонд развития кооперации 5 %; дополнительные заводит
 * совет. Остаток округления достаётся последнему фонду по порядку
 * идентификаторов, поэтому сумма долей равна переданной сумме копейка в копейку.
 *
 * Движение по каждому фонду — `o.fnd.accrue`: TRANSFER `w.mkt.fee → w.fnd.accum`
 * с разрезом по имени фонда, Дт 80 / Кт 86, в нитке процесса источника
 * (`process_type`, `process_hash`): отчисление остаётся в нитке заказа, из
 * которого пришли деньги. Поле `accfunds.available` обновляется как зеркало
 * для прежних экранов совета; старый путь (`spreadamount`, `addaccum`,
 * `accumfee`, счета `coopwallet`) не трогается и ledger2 не ведёт.
 *
 * Guards:
 *  - авторизация: кооператив либо контракт из белого списка;
 *  - сумма в валюте кооператива и больше нуля;
 *  - у кооператива есть хотя бы один фонд накопления с ненулевым процентом.
 *
 * Границы: действие не перебирает ничего, кроме фондов накопления
 * кооператива (единицы строк), и не хранит истории.
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

  accfunds_index accfunds(_fund, coopname.value);

  uint64_t total_percent = 0;
  size_t count = 0;
  for (auto it = accfunds.begin(); it != accfunds.end(); ++it) {
    total_percent += it->percent;
    ++count;
  }
  eosio::check(count > 0 && total_percent > 0,
               "FUND_NO_ACCUMULATION_FUNDS: У кооператива нет фондов накопления с процентом отчислений");

  auto last = accfunds.end();
  --last;

  int64_t distributed = 0;
  for (auto it = accfunds.begin(); it != accfunds.end(); ++it) {
    const int64_t share = (it == last)
      ? amount.amount - distributed
      : static_cast<int64_t>(static_cast<uint128_t>(amount.amount) * it->percent / total_percent);
    distributed += share;
    if (share <= 0) continue;

    const eosio::asset part(share, amount.symbol);
    const eosio::name wallet = Fund::wallet_name_of(*it);

    Ledger2::apply(_fund, coopname,
                   operations::fund::ACCRUE,
                   process_type,
                   part, wallet, process_hash, memo);

    accfunds.modify(it, RamPayer::of(accfunds, coopname), [&](auto &a) {
      a.available += part;
      // Имя разреза закрепляется в строке при первом отчислении: у фондов,
      // заведённых до появления поля, оно было выведено из названия или
      // идентификатора и дальше не зависит от переименования фонда.
      if (!a.wallet_name.has_value() || a.wallet_name.value().value == 0) {
        a.wallet_name.emplace(wallet);
      }
    });
  }
}
