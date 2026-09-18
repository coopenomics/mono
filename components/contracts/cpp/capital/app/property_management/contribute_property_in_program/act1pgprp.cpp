/**
 * @brief Подписывает акт 1 по программному имущественному взносу
 * Подписывает первый акт по программному имущественному взносу участником:
 * - Проверяет подлинность документа акта от участника
 * - Получает предложение и валидирует его статус (должен быть authorized)
 * - Проверяет права участника на подписание акта
 * - Сохраняет первый акт
 * - Обновляет статус на act1
 * @param coopname Наименование кооператива
 * @param username Наименование пользователя-участника
 * @param property_hash Хеш программного имущественного взноса
 * @param act Документ акта 1
 * @ingroup public_actions
 * @ingroup public_capital_actions

 * @note Авторизация требуется от аккаунта: @p coopname
 */
void capital::act1pgprp(eosio::name coopname, eosio::name username, checksum256 property_hash, document2 act) {
  require_auth(coopname);

  
  // Проверяем документ
  verify_document_or_fail(act, { username });
  // Акт подписан ключом аккаунта передающего имущество. Транзакцию шлёт кооператив, поэтому ключ сверяется с аккаунтом.
  verify_signer_keys_or_fail(act, username);
  
  // Получаем предложение
  auto property = Capital::ProgramProperties::get_program_property_or_fail(coopname, property_hash);
  
  // Проверяем статус
  eosio::check(property.status == Capital::ProgramProperties::Status::AUTHORIZED, 
               "Предложение должно быть в статусе 'authorized'");
  
  // Проверяем права участника
  eosio::check(property.username == username, 
               "Только участник может подписать акт для своего предложения");
  
  // Сохраняем первый акт
  Capital::ProgramProperties::set_program_property_act1(coopname, property.id, act);
  
  // Обновляем статус на act1
  Capital::ProgramProperties::update_program_property_status(coopname, property.id, 
                                                           Capital::ProgramProperties::Status::ACT1);
};
