/**
 * @brief Принимает предложение по программному имущественному взносу председателем
 * Принимает предложение по программному имущественному взносу и отправляет на рассмотрение совета:
 * - Проверяет подлинность документа председателя
 * - Получает предложение и валидирует его статус
 * - Сохраняет одобренное заявление
 * - Обновляет статус на approved
 * - Отправляет на рассмотрение совета
 * @param coopname Наименование кооператива
 * @param username Наименование пользователя, одобрившего программный имущественный взнос
 * @param property_hash Хеш программного имущественного взноса для принятия
 * @param approved_statement Одобренное заявление председателя
 * @ingroup public_actions
 * @ingroup public_capital_actions

 * @note Авторизация требуется от контракта совета
 */
void capital::approvepgprp(eosio::name coopname, eosio::name username, checksum256 property_hash, document2 approved_statement) {
  require_auth(_soviet);

  auto soviet = get_board_by_type_or_fail(coopname, "soviet"_n);
  auto chairman = soviet.get_chairman();

  // Проверяем документ
  verify_document_or_fail(approved_statement, { chairman });
  // Согласие подписано ключом аккаунта председателя.
  verify_signer_keys_or_fail(approved_statement, chairman);

  // Получаем предложение
  auto property = Capital::ProgramProperties::get_program_property_or_fail(coopname, property_hash);
  
  // Проверяем статус
  eosio::check(property.status == Capital::ProgramProperties::Status::CREATED, 
               "Предложение должно быть в статусе 'created'");
             
  
  // Сохраняем одобренное заявление
  Capital::ProgramProperties::set_program_property_approved_statement(coopname, property.id, approved_statement);
  
  // Обновляем статус на approved
  Capital::ProgramProperties::update_program_property_status(coopname, property.id, 
                                                           Capital::ProgramProperties::Status::APPROVED);
  
  // Отправляем на рассмотрение совета
  ::Soviet::create_agenda(
    _capital,
    coopname,
    property.username,
    Names::Capital::CREATE_PROGRAM_PROPERTY,
    property_hash,
    _capital,
    Names::Capital::AUTHORIZE_PROGRAM_PROPERTY,
    Names::Capital::DECLINE_PROGRAM_PROPERTY,
    property.statement,
    std::string("")
  );
};
