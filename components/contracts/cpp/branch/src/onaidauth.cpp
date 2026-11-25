/**
 * @brief Callback контракта Soviet — совет принял положительное решение по
 * заявлению на материальную помощь (requirement b6, процесс p.brn.aid).
 *
 * Приходит inline-вызовом из `soviet::authorize_action_effect` после того, как
 * совет проголосовал за выплату и председатель подписал протокол. Здесь
 * заявление переходит proposed → authorized, протокол совета сохраняется в
 * записи, и только теперь регистрируется исходящий платёж в gateway — заявка
 * появляется у кассира в реестре исходящих платежей.
 *
 * Деньги здесь не двигаются: сумма заявления уже переведена при подаче
 * (`createaid`) — на кошелёк заявлений w.brn.aidreq либо выделена из средств
 * инициаторов. Списание o.brn.aid (Дт 86 / Кт 51) и удержание налога
 * o.brn.aidtax (Дт 86 / Кт 68) произойдут в callback'е `aidconfirm`, после
 * фактического банковского перевода кассиром.
 *
 * Guards:
 *  - require_auth(_soviet);
 *  - заявление найдено по hash решения и находится в статусе proposed
 *    (защита от повторного или позднего callback'а).
 *
 * @ingroup public_branch_actions
 */
[[eosio::action]] void branch::onaidauth(eosio::name coopname,
                                          eosio::checksum256 hash,
                                          document2 authorization) {
  require_auth(_soviet);

  branch_aids_index aids(_branch, coopname.value);
  auto byhash = aids.get_index<"byhash"_n>();
  auto it = byhash.find(hash);
  eosio::check(it != byhash.end(),
               "Заявление на материальную помощь не найдено по идентификатору решения совета");
  eosio::check(it->status == AidStatus::PROPOSED,
               "Заявление на материальную помощь не находится на повестке совета");

  // Источник выбран и средства переведены при подаче (createaid, решение
  // владельца 08.11.2026); решение совета переводит заявление к выплате.
  byhash.modify(it, RamPayer::of(byhash, coopname), [&](auto& a) {
    a.status   = AidStatus::AUTHORIZED;
    a.protocol = authorization;
  });

  // Заявка передаётся кассиру: списание произойдёт в `aidconfirm` после
  // подтверждения фактического банковского перевода.
  //
  // Кассиру уходит сумма ЗА ВЫЧЕТОМ налога — кооператив налоговый агент и
  // перечисляет получателю остаток (решение владельца 2026-08-13). Сумма
  // заявления при этом остаётся в записи целиком: из неё в `aidconfirm`
  // считается и выплата, и удержание, чтобы обе половины сошлись к одному
  // числу и не разъехались при пересчёте.
  Gateway::create_outcome(_branch, coopname, it->username, it->hash,
                          BranchNdfl::calc_net(it->amount),
                          _branch, "aidconfirm"_n, "aiddecline"_n);
}
