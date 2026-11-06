/**
 * @brief Пайщик подписал акт приёма-передачи имущества (шаблон 1072) — первая
 * подпись. Акт направляется на вторую подпись председателю совета через
 * одобрение (`Soviet::create_approval` → стол председателя, «Запросы одобрений» →
 * `soviet::confirmapprv` → `act2pgprp`), как акт РИД преподавателя
 * (`edubridge::signridact`). Движений средств на этом шаге нет.
 *
 * Guards:
 *  - предложение в статусе authorized (совет принял решение);
 *  - акт подписан тем пайщиком, который подал предложение.
 *
 * Одобрение заводится под хэшем акта: ключ одобрения — одобряемый документ.
 * Заявление председатель одобрял под хэшем заявления, процесс (повестка,
 * проводка, пакет документов) идёт под хэшем взноса.
 *
 * @param coopname Наименование кооператива
 * @param username Наименование пайщика, передающего имущество
 * @param property_hash Хеш программного имущественного взноса
 * @param act Акт приёма-передачи с подписью пайщика
 * @ingroup public_actions
 * @ingroup public_capital_actions

 * @note Авторизация требуется от аккаунта: @p coopname
 */
void capital::act1pgprp(eosio::name coopname, eosio::name username, checksum256 property_hash, document2 act) {
  require_auth(coopname);

  eosio::check(!is_empty_document(act),
               "CAPITAL_PROPERTY_ACT_REQUIRED: Отсутствует акт приёма-передачи имущества");
  verify_document_or_fail(act, { username });
  // Акт подписан ключом аккаунта передающего имущество. Транзакцию шлёт кооператив, поэтому ключ сверяется с аккаунтом.
  verify_signer_keys_or_fail(act, username);

  auto property = Capital::ProgramProperties::get_program_property_or_fail(coopname, property_hash);

  eosio::check(property.status == Capital::ProgramProperties::Status::AUTHORIZED,
               "CAPITAL_PROPERTY_NOT_AUTHORIZED: Акт подписывается после решения совета о приёме имущества");
  eosio::check(property.username == username,
               "CAPITAL_PROPERTY_NOT_OWNER: Акт подписывает пайщик, подавший предложение");

  Capital::ProgramProperties::set_program_property_act1(coopname, property.id, act);
  Capital::ProgramProperties::update_program_property_status(coopname, property.id,
                                                           Capital::ProgramProperties::Status::ACT1);

  // Вторая подпись — председатель совета со стола «Запросы одобрений».
  // Отказ председателя ведёт в declinepgprp: предложение снимается целиком.
  ::Soviet::create_approval(
    _capital,
    coopname,
    username,
    act,
    Names::Capital::SIGN_ACT1_PROGRAM_PROPERTY,
    act.hash,
    _capital,
    Names::Capital::SIGN_ACT2_PROGRAM_PROPERTY,
    Names::Capital::DECLINE_PROGRAM_PROPERTY,
    std::string("")
  );
};
