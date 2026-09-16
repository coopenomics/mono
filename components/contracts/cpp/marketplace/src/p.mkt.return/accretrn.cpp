/**
 * @brief Оператор участка принимает имущество у стойки — гарантийный возврат
 * в паевой модели (компонент 68, задачи 99D-9 / 99D-12): `approvvisit → retpend`.
 *
 * Оператор осмотрел имущество, принял его под свою материальную
 * ответственность и подписал Заявление в совет об отмене сделки (registry
 * 1116): какой заказ и какое имущество принято, результат осмотра, причина
 * обращения пайщика из рекламации (1106, лежит в `return_request.statement`),
 * суммы паевого и членского взносов к восстановлению. `statement` несёт
 * только подпись оператора: пайщик ничего не вносит, сделка отменяется
 * (решение владельца 08.09.2026). `reclamation` — та же рекламация 1106, что
 * лежит в заявке, со второй подписью оператора (канон DocumentAggregate, без
 * регенерации): с двумя подписями она уйдёт поставщику как гарантийная
 * претензия при исполнении решения совета (задача 99D-13). Тем же действием контракт ставит повестку
 * совета: инлайн `soviet::createagenda` от `permission_level{_marketplace,
 * active}` с `type=mktretrn`, `hash=request_hash`, документом повестки —
 * этим заявлением и обратными вызовами `onmktrtauth` / `onmktrtdecl`. Совет
 * лишь легитимизирует решение оператора.
 *
 * Движений по средствам нет: имущество лежит на участке, баланс заказчика
 * восстанавливается только по решению совета (onmktrtauth). При отказе или
 * без решения оператор выдаёт имущество обратно (handback).
 *
 * Guards:
 *  - actor coopname; status == approvvisit; участок выдачи заказа;
 *  - signer уполномочен на участке; заявление подписано signer;
 *  - рекламация — тот же документ, что подан пайщиком (совпадает hash),
 *    подписана пайщиком и signer.
 *
 * @ingroup public_marketplace_actions
 */
void marketplace::accretrn(eosio::name coopname,
                            eosio::name signer,
                            eosio::name braname,
                            checksum256 request_hash,
                            document2 statement,
                            std::string meta,
                            document2 reclamation) {
  require_auth(coopname);

  auto r = Marketplace::get_return_request_by_hash_or_fail(coopname, request_hash);
  eosio::check(r.status == ReturnStatus::APPROVED_FOR_VISIT,
               "Заявление не одобрено для очного осмотра");
  Marketplace::check_return_request_branch(coopname, r, braname);
  auto branch = get_branch_or_fail(coopname, braname);
  eosio::check(branch.is_user_authorized(signer),
               "Подписант не уполномочен принимать возвраты данного кооперативного участка");
  eosio::check(!is_empty_document(statement),
               "Приём имущества требует заявления оператора об отмене сделки с его подписью");
  verify_document_or_fail(statement, { signer });
  eosio::check(!is_empty_document(reclamation),
               "Приём имущества требует рекламации пайщика со второй подписью оператора");
  eosio::check(reclamation.hash == r.statement.hash,
               "Рекламация со второй подписью обязана быть тем же документом, что подал пайщик");
  verify_document_or_fail(reclamation, { r.orderer, signer });

  const auto now = eosio::time_point_sec(eosio::current_time_point().sec_since_epoch());
  Marketplace::update_return_request(coopname, r.id, [&](auto& upd) {
    upd.status      = ReturnStatus::RETURN_PENDING;
    upd.statement   = reclamation;   // та же рекламация, теперь с двумя подписями
    upd.accepted_at.emplace(now);
    upd.cancel_statement.emplace(statement);
  });

  // Повестка совета: hash = request_hash, чтобы обратные вызовы нашли заявку;
  // автор повестки — пайщик (его сделка отменяется), документ — заявление
  // оператора; протокол 1117 берёт деловые поля из его метаданных.
  action(permission_level{_marketplace, "active"_n}, _soviet, "createagenda"_n,
    std::make_tuple(
      coopname,
      r.orderer,
      get_valid_soviet_action(_marketplace_return_action),
      request_hash,
      _marketplace,
      "onmktrtauth"_n,
      "onmktrtdecl"_n,
      statement,
      meta
    )
  ).send();
}
