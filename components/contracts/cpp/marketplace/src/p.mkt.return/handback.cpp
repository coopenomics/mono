/**
 * @brief Оператор участка выдал имущество заказчику обратно — гарантийный
 * возврат в паевой модели (компонент 68). Допустимо из `retdecl` (совет
 * отказал) и из `retpend` по истечении срока ожидания решения совета
 * (`RETURN_DECISION_WAIT_SECS` от момента приёма имущества): без решения
 * совета баланс не восстанавливается, имущество ждать бесконечно не может.
 *
 * Документа нет — имущество участок юридически не принимал. Запись заявки
 * стирается (`newdeclined` для заявления в пакет документов заказа), заказ
 * остаётся выданным с прежним гарантийным окном.
 *
 * Guards:
 *  - actor coopname; заявку рассматривает участок выдачи заказа;
 *  - signer уполномочен на участке;
 *  - status == retdecl, либо retpend и срок ожидания истёк.
 *
 * @ingroup public_marketplace_actions
 */
void marketplace::handback(eosio::name coopname,
                            eosio::name signer,
                            eosio::name braname,
                            checksum256 request_hash) {
  require_auth(coopname);

  auto r = Marketplace::get_return_request_by_hash_or_fail(coopname, request_hash);
  Marketplace::check_return_request_branch(coopname, r, braname);
  auto branch = get_branch_or_fail(coopname, braname);
  eosio::check(branch.is_user_authorized(signer),
               "Подписант не уполномочен закрывать возвраты данного кооперативного участка");

  if (r.status == ReturnStatus::RETURN_PENDING) {
    const auto now = eosio::time_point_sec(eosio::current_time_point().sec_since_epoch());
    eosio::check(now.sec_since_epoch() >= r.accepted_at.sec_since_epoch() + Marketplace::RETURN_DECISION_WAIT_SECS,
                 "Совет ещё рассматривает заявление — срок ожидания решения не истёк");
  } else {
    eosio::check(r.status == ReturnStatus::RETURN_DECLINED,
                 "Выдать имущество обратно можно только после отказа совета или по истечении срока ожидания");
  }

  Action::send<newdeclined_interface>(_soviet, "newdeclined"_n, _marketplace,
                                      coopname, r.orderer,
                                      r.original_order_hash, r.statement);

  Marketplace::erase_return_request(coopname, r.id);
}
