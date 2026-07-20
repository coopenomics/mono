/**
 * @brief Заявка на материальную помощь доверенного/председателя КУ
 * (requirement b6 «Экономика КУ», процесс p.brn.aid).
 *
 * Источник — собственный персональный кошелёк членских средств получателя
 * (w.brn.person). Получатель сам подписывает заявление и сам платит НДФЛ с
 * полученной суммы — кооператив налог не удерживает (решение владельца
 * 2026-06-10).
 *
 * Действие НЕ применяет ledger2 — оно inline-вызовом регистрирует в
 * gateway::outcomes исходящий платёж со статусом pending и callback'ами на
 * branch. Списание o.brn.aid (Дт 86 / Кт 51) произойдёт в `aidconfirm` после
 * фактического банковского перевода кассиром; при `aiddecline` средства
 * остаются на персональном кошельке.
 *
 * Средства под заявку резервно не блокируются: если к моменту подтверждения
 * кассиром баланса уже не хватает (получатель параллельно перевёл их в
 * «Стол заказов»), списание упадёт и кассир не сможет подтвердить выплату.
 *
 * Guards:
 *  - amount > 0 в валюте кооператива; заявка с таким hash не существует;
 *  - получатель — активный пайщик; заявление подписано получателем;
 *  - на персональном кошельке достаточно средств на момент подачи.
 *
 * @note Авторизация требуется от аккаунта: @p coopname.
 *
 * @ingroup public_branch_actions
 */
[[eosio::action]] void branch::createaid(eosio::name coopname, eosio::name username,
                                          eosio::checksum256 aid_hash,
                                          eosio::asset amount,
                                          document2 statement) {
  check_auth_or_fail(_branch, coopname, coopname, "createaid"_n);

  eosio::check(amount.is_valid() && amount.amount > 0,
               "Сумма материальной помощи должна быть больше нуля");
  eosio::check(amount.symbol == _root_govern_symbol,
               "Некорректный символ валюты в сумме материальной помощи");

  get_participant_or_fail(coopname, username);
  verify_document_or_fail(statement, { username });

  branch_aids_index aids(_branch, coopname.value);
  auto byhash = aids.get_index<"byhash"_n>();
  eosio::check(byhash.find(aid_hash) == byhash.end(),
               "Заявка на материальную помощь с таким идентификатором уже создана");

  aids.emplace(coopname, [&](auto& a) {
    a.id        = aids.available_primary_key();
    a.hash      = aid_hash;
    a.username  = username;
    a.amount    = amount;
    a.statement = statement;
  });

  // Регистрация исходящего платежа в gateway. Само списание Дт 86 / Кт 51
  // произойдёт в callback'е `aidconfirm` после действия кассира.
  Gateway::create_outcome(_branch, coopname, username, aid_hash, amount,
                          _branch, "aidconfirm"_n, "aiddecline"_n);
}
