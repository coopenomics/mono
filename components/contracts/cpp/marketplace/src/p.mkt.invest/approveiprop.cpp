/**
 * @brief Председатель участка одобряет заявление о паевом взносе имуществом и
 * передаёт вопрос в совет (задача 99D-27). Одобрение — та же форма заявления
 * 1120 с подписью председателя участка. Контракт сам ставит вопрос на
 * повестку совета (тип `mktiprop`, hash = хэш паевого взноса); решение совета
 * приходит обратно вызовами `onipropauth` / `onipropdecl`.
 *
 * Guards: авторизация кооператива; заявление в статусе «подано»; одобрение
 * подписано председателем участка.
 *
 * @ingroup public_marketplace_actions
 */
void marketplace::approveiprop(eosio::name coopname, eosio::name braname,
                               checksum256 property_hash, document2 approved_statement,
                               std::string meta) {
  require_auth(coopname);
  const auto prop = MarketInvestProperty::get_or_fail(coopname, property_hash);
  eosio::check(prop.braname == braname,
               "MARKETPLACE_IPROP_BRANCH_MISMATCH: Заявление подано в другой участок");
  eosio::check(prop.status == MarketInvest::PropertyStatus::CREATED,
               "MARKETPLACE_IPROP_STATUS_INVALID: Заявление уже одобрено или рассмотрено");
  const eosio::name trustee = MarketInvestProperty::trustee_of(coopname, braname);
  eosio::check(!is_empty_document(approved_statement),
               "MARKETPLACE_IPROP_APPROVAL_MISSING: Отсутствует одобрение председателя участка");
  verify_document_or_fail(approved_statement, { trustee });
  verify_signer_keys_or_fail(approved_statement, trustee);

  MarketInvestProperty::update(coopname, prop.id, [&](auto& row) {
    row.status             = MarketInvest::PropertyStatus::APPROVED;
    row.approved_statement = approved_statement;
  });

  // Повестка совета: marketplace в contracts_whitelist, createagenda
  // авторизуется от permission_level{_marketplace, active}; hash = хэш
  // паевого взноса, чтобы обратные вызовы нашли заявление.
  action(permission_level{_marketplace, "active"_n}, _soviet, "createagenda"_n,
    std::make_tuple(
      coopname,
      prop.username,
      get_valid_soviet_action(_marketplace_iprop_action),
      property_hash,
      _marketplace,
      "onipropauth"_n,
      "onipropdecl"_n,
      approved_statement,
      meta
    )
  ).send();
}
