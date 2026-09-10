/**
 * @brief Оператор участка выдал имущество заказчику обратно — гарантийный
 * возврат в паевой модели (компонент 68). Допустимо только из `retdecl`
 * (совет отказал). Пока повестка открыта, имущество ждёт решения совета:
 * выдача обратно до решения стирала заявку, и потом решение совета нельзя
 * было ни исполнить, ни снять истечением (решение владельца 10.09.2026,
 * задача 99D-16).
 *
 * Документа нет — имущество участок юридически не принимал. Запись заявки
 * стирается (`newdeclined` для заявления в пакет документов заказа), заказ
 * остаётся выданным с прежним гарантийным окном.
 *
 * Guards:
 *  - actor coopname; заявку рассматривает участок выдачи заказа;
 *  - signer уполномочен на участке;
 *  - status == retdecl.
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

  eosio::check(r.status == ReturnStatus::RETURN_DECLINED,
               r.status == ReturnStatus::RETURN_PENDING
                 ? "Совет ещё рассматривает заявление — выдать имущество обратно можно только после его отказа"
                 : "Выдать имущество обратно можно только после отказа совета");

  Action::send<newdeclined_interface>(_soviet, "newdeclined"_n, _marketplace,
                                      coopname, r.orderer,
                                      r.original_order_hash, r.statement);

  Marketplace::erase_return_request(coopname, r.id);
}
