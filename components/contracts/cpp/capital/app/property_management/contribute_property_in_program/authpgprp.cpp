/**
 * @brief Авторизует предложение по программному имущественному взносу советом
 * Авторизует предложение по программному имущественному взносу советом:
 * - Проверяет подлинность документа решения совета
 * - Получает предложение и валидирует его статус (должен быть approved)
 * - Сохраняет решение совета
 * - Обновляет статус на authorized
 * @param coopname Наименование кооператива
 * @param property_hash Хеш программного имущественного взноса для авторизации
 * @param decision Документ решения совета
 * @ingroup public_actions
 * @ingroup public_capital_actions

 * @note Авторизация требуется от аккаунта: @p _soviet
 */
void capital::authpgprp(eosio::name coopname, checksum256 property_hash, document2 decision) {
  require_auth(_soviet);

  // Проверяем документ
  verify_document_or_fail(decision);

  // Получаем предложение
  auto property = Capital::ProgramProperties::get_program_property_or_fail(coopname, property_hash);
  
  // Проверяем статус
  eosio::check(property.status == Capital::ProgramProperties::Status::APPROVED, 
               "CAPITAL_PROPERTY_NOT_APPROVED: Совет принимает решение по предложению, одобренному председателем");
  
  // Сохраняем решение совета
  Capital::ProgramProperties::set_program_property_authorization(coopname, property.id, decision);
  
  // Обновляем статус на authorized
  Capital::ProgramProperties::update_program_property_status(coopname, property.id, 
                                                           Capital::ProgramProperties::Status::AUTHORIZED);
};
