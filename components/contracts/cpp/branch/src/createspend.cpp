/**
 * @brief Команда оплаты расхода кооперативного участка из общего кошелька
 * (requirement b6 «Экономика КУ», раунд 5; процесс p.brn.spend).
 *
 * Источник — общий кошелёк членских взносов КУ (w.brn.common). Плановый
 * реестр расходов, резерв 30 дней и реквизиты получателя ведёт бэкенд
 * (решение владельца 2026-06-10: плановая информация — оффчейн); контракт
 * лишь исполняет списание. Путь использования включается вместе с шасси
 * расходов — до тех пор кнопка оплаты в UI заглушена, действие закладывает
 * он-чейн возможность.
 *
 * Действие НЕ применяет ledger2 — оно inline-вызовом регистрирует в
 * gateway::outcomes исходящий платёж со статусом pending и callback'ами на
 * branch. Списание o.brn.spend (Дт 86 / Кт 51) произойдёт в `spendconfirm`
 * после фактического банковского перевода кассиром; при `spenddecline`
 * средства остаются на общем кошельке.
 *
 * Средства под команду резервно не блокируются: если к моменту
 * подтверждения кассиром баланса уже не хватает, списание упадёт и кассир
 * не сможет подтвердить выплату.
 *
 * Guards:
 *  - amount > 0 в валюте кооператива; команда с таким hash не существует;
 *  - КУ существует.
 *
 * @note Авторизация требуется от аккаунта: @p coopname.
 *
 * @ingroup public_branch_actions
 */
[[eosio::action]] void branch::createspend(eosio::name coopname, eosio::name braname,
                                            eosio::checksum256 spend_hash,
                                            eosio::asset amount,
                                            std::string memo) {
  check_auth_or_fail(_branch, coopname, coopname, "createspend"_n);

  eosio::check(amount.is_valid() && amount.amount > 0,
               "Сумма оплаты расхода должна быть больше нуля");
  eosio::check(amount.symbol == _root_govern_symbol,
               "Некорректный символ валюты в сумме оплаты расхода");

  get_branch_or_fail(coopname, braname);

  branch_spends_index spends(_branch, coopname.value);
  auto byhash = spends.get_index<"byhash"_n>();
  eosio::check(byhash.find(spend_hash) == byhash.end(),
               "Команда оплаты расхода с таким идентификатором уже создана");

  spends.emplace(coopname, [&](auto& s) {
    s.id      = spends.available_primary_key();
    s.hash    = spend_hash;
    s.braname = braname;
    s.amount  = amount;
    s.memo    = memo;
  });

  // Регистрация исходящего платежа в gateway. Само списание Дт 86 / Кт 51
  // произойдёт в callback'е `spendconfirm` после действия кассира.
  Gateway::create_outcome(_branch, coopname, braname, spend_hash, amount,
                          _branch, "spendconfirm"_n, "spenddecline"_n);
}
