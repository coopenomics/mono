/**
 * @brief Председатель совета подписал акт приёма-передачи имущества — вторая
 * подпись, завершение приёма. Вызывается контрактом совета
 * (`soviet::confirmapprv`) после подтверждения одобрения, заведённого в
 * `act1pgprp`; подпись председателя совет уже проверил.
 *
 * Действия:
 *  - акт сверяется на обе подписи: пайщика и действующего председателя;
 *  - имущество по сумме оценки зачисляется пайщику в программу «Благорост»
 *    (ledger2 `o.cap.actprp`: ISSUE на w.cap.blago, Дт 08 / Кт 80);
 *  - растёт накопительный показатель `contributed_as_propertor` и геймификация
 *    пайщика — как у денежного взноса в программу (`createpinv`);
 *  - двухподписной акт привязывается к пакету процесса (package = property_hash);
 *  - предложение удаляется: процесс завершён.
 *
 * `username` — тот, кто подтвердил одобрение в совете, а не пайщик: пайщик
 * берётся из записи предложения по hash.
 *
 * @param coopname Наименование кооператива
 * @param username Наименование подтвердившего одобрение
 * @param property_hash Хэш акта — ключ одобрения акта (одобрение заводится под хэшем одобряемого документа)
 * @param act Акт приёма-передачи с подписями пайщика и председателя
 * @ingroup public_actions
 * @ingroup public_capital_actions

 * @note Авторизация требуется от контракта совета
 */
void capital::act2pgprp(eosio::name coopname, eosio::name username, checksum256 property_hash, document2 act) {
  require_auth(_soviet);

  auto soviet = get_board_by_type_or_fail(coopname, "soviet"_n);
  auto chairman = soviet.get_chairman();

  // Совет передаёт ключ одобрения — хэш акта; дальше работаем по ID строки.
  auto property = Capital::ProgramProperties::get_program_property_by_act_or_fail(coopname, property_hash);

  eosio::check(property.status == Capital::ProgramProperties::Status::ACT1,
               "CAPITAL_PROPERTY_ACT1_REQUIRED: Председатель подписывает акт после подписи пайщика");

  // Вторая подпись ложится на тот же акт, что подписал пайщик: в документе
  // обе подписи, каждая — ключом своего аккаунта.
  verify_document_or_fail(act, { property.username, chairman });
  verify_signer_keys_or_fail(act, property.username);
  verify_signer_keys_or_fail(act, chairman);

  Capital::ProgramProperties::set_program_property_act2(coopname, property.id, act);
  Capital::ProgramProperties::update_program_property_status(coopname, property.id, Capital::ProgramProperties::Status::ACT2);

  auto contributor = Capital::Contributors::get_active_contributor_or_fail(coopname, property.username);

  std::string memo = Capital::Memo::get_program_property_memo(property.property_hash);

  // Паевой взнос имуществом: ISSUE на w.cap.blago, Дт 08 / Кт 80 (решение владельца 30.10.2026).
  Ledger2::apply(_capital, coopname, operations::capital::ACCEPT_PROPERTY, processes::capital::PROPERTY, property.property_amount, property.username, property.property_hash, memo);

  Capital::Contributors::increase_propertor_contribution(coopname, contributor->id, property.property_amount);

  // Геймификация: программный взнос без сегмента, энергия — от суммы напрямую, как в createpinv.
  Capital::Gamification::add_contribution_and_check_levelup(
      coopname, contributor->id, static_cast<double>(property.property_amount.amount));

  // Двухподписной акт — в пакет процесса, рядом с заявлением и протоколом совета.
  Action::send<newlink_interface>(
    _soviet,
    "newlink"_n,
    _capital,
    coopname,
    property.username,
    Names::Capital::SIGN_ACT2_PROGRAM_PROPERTY,
    property.property_hash,
    act
  );

  Capital::ProgramProperties::delete_program_property(coopname, property.id);
};
