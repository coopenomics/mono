/**
 * @brief Инициатор кооперативного участка Стола заказов (задача 99D-21, КЭУ-3;
 * решение владельца 03.11.2026).
 *
 * Инициатор получает долю экономии месяца участка на свой паевой кошелёк
 * `w.mkt.invest`. Пока строки нет, инициатором считается председатель участка;
 * строка нужна, чтобы смена председателя не лишала инициатора его доли.
 * Пустое имя стирает строку — получателем снова становится председатель.
 * Несколько инициаторов с долями — инвестиционный этап.
 *
 * Guards: авторизация кооператива; участок существует; инициатор — активный
 * пайщик кооператива.
 *
 * @ingroup public_marketplace_actions
 */
void marketplace::setinitiator(eosio::name coopname, eosio::name braname, eosio::name username) {
  require_auth(coopname);
  get_branch_or_fail(coopname, braname);

  mkt_initiators_index initiators(_marketplace, coopname.value);
  auto it = initiators.find(braname.value);

  if (username.value == 0) {
    eosio::check(it != initiators.end(),
                 "MARKETPLACE_INITIATOR_NOT_FOUND: У участка нет отдельного инициатора");
    initiators.erase(it);
    return;
  }

  get_active_participant_or_fail(coopname, username);

  if (it == initiators.end()) {
    initiators.emplace(RamPayer::of(initiators, coopname), [&](auto &row) {
      row.braname = braname;
      row.username = username;
    });
  } else {
    initiators.modify(it, RamPayer::of(initiators, coopname), [&](auto &row) {
      row.username = username;
    });
  }
}
