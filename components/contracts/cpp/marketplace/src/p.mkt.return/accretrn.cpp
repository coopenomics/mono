/**
 * @brief Оператор участка принимает имущество у стойки — гарантийный возврат
 * в паевой модели (компонент 68, задача 99D-9): `approvvisit → retpend`.
 *
 * Оператор накладывает вторую подпись на Заявление о внесении паевого взноса
 * имуществом (registry 1116); `statement` несёт обе подписи — заказчика (с
 * подачи) и оператора (приём имущества). Тем же действием контракт ставит
 * повестку совета: инлайн `soviet::createagenda` от
 * `permission_level{_marketplace, active}` с `type=mktretrn`,
 * `hash=request_hash`, обратными вызовами `onmktrtauth` / `onmktrtdecl`.
 *
 * Движений по средствам нет: имущество лежит на участке, баланс заказчика
 * восстанавливается только по решению совета (onmktrtauth). При отказе или
 * без решения оператор выдаёт имущество обратно (handback).
 *
 * Guards:
 *  - actor coopname; status == approvvisit; участок выдачи заказа;
 *  - signer уполномочен на участке; заявление подписано заказчиком и signer.
 *
 * @ingroup public_marketplace_actions
 */
void marketplace::accretrn(eosio::name coopname,
                            eosio::name signer,
                            eosio::name braname,
                            checksum256 request_hash,
                            document2 statement,
                            std::string meta) {
  require_auth(coopname);

  auto r = Marketplace::get_return_request_by_hash_or_fail(coopname, request_hash);
  eosio::check(r.status == ReturnStatus::APPROVED_FOR_VISIT,
               "Заявление не одобрено для очного осмотра");
  Marketplace::check_return_request_branch(coopname, r, braname);
  auto branch = get_branch_or_fail(coopname, braname);
  eosio::check(branch.is_user_authorized(signer),
               "Подписант не уполномочен принимать возвраты данного кооперативного участка");
  eosio::check(!is_empty_document(statement),
               "Приём имущества требует заявления с подписями заказчика и оператора");
  verify_document_or_fail(statement, { r.orderer, signer });

  const auto now = eosio::time_point_sec(eosio::current_time_point().sec_since_epoch());
  Marketplace::update_return_request(coopname, r.id, [&](auto& upd) {
    upd.status      = ReturnStatus::RETURN_PENDING;
    upd.statement   = statement;
    upd.accepted_at = now;
  });

  // Повестка совета: hash = request_hash, чтобы обратные вызовы нашли заявку.
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
