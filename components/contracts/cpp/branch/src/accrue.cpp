/**
 * @brief Зачисление поступивших членских взносов в общий кошелёк
 * кооперативного участка (requirement b6 «Экономика КУ», раунд 5;
 * процесс p.brn.fees).
 *
 * Вызывается inline контрактом-источником (сегодня — marketplace при
 * финализации заказа, signiss2): 100% фактического членского взноса уходит
 * в общий кошелёк КУ (o.brn.common, username = braname) — приоритет общего
 * кошелька (решение владельца 2026-06-10). Немедленного персонального
 * распределения нет: дальнейшее использование — отдельные команды
 * председателя (distribute / createexp) после контроля планового резерва
 * расходов бэкендом.
 *
 * Средства физически уходят с пула w.mkt.fee — он пополнен операцией
 * o.mkt.fee при создании заказа, неиспользованная часть уже возвращена
 * источником через o.mkt.refund.
 *
 * Имя нитки процесса (`process_type`) передаёт контракт-источник: зачисление
 * идёт внутри его нитки (у marketplace — поставка по хэшу заказа), поэтому сама
 * операция не может называть процесс. Пока имя выводилось из кода операции,
 * поставка подписывалась «Членские взносы кооперативного участка».
 *
 * Guards:
 *  - авторизация: кооператив либо системный контракт из whitelist;
 *  - сумма в валюте кооператива, больше нуля;
 *  - имя нитки известно реестру процессов (проверяет ledger2::apply).
 *
 * @ingroup public_branch_actions
 */
[[eosio::action]] void branch::accrue(eosio::name coopname, eosio::name braname,
                                       eosio::name source_contract,
                                       eosio::asset amount,
                                       eosio::name process_type,
                                       eosio::checksum256 process_hash,
                                       std::string memo) {
  if (!has_auth(coopname)) {
    check_auth_and_get_payer_or_fail(contracts_whitelist);
  }

  eosio::check(amount.is_valid() && amount.amount > 0,
               "Сумма зачисления должна быть больше нуля");
  eosio::check(amount.symbol == _root_govern_symbol,
               "Некорректный символ валюты в сумме зачисления");

  get_branch_or_fail(coopname, braname);

  // source_contract сейчас информационный (источник один — marketplace);
  // параметр сохранён в сигнатуре для универсальности branch как реестра
  // экономики КУ нескольких программ.
  (void)source_contract;

  Ledger2::apply(_branch, coopname,
                 operations::branch::DISTRIBUTE_COMMON,
                 process_type,
                 amount, braname, process_hash, memo);
}
