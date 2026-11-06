/**
 * @brief Отклоняет предложение по программному имущественному взносу
 * Отклоняет предложение по программному имущественному взносу и удаляет его из базы:
 * - Получает предложение по программному имущественному взносу
 * - Удаляет предложение из базы данных с указанием причины
 * @param coopname Наименование кооператива
 * @param username Наименование пользователя, отклонившего программный имущественный взнос
 * @param property_hash Ключ отказа: хэш взноса (отказ совета по повестке), хэш заявления или хэш акта (отказ председателя в одобрении)
 * @param reason Причина отклонения предложения
 * @ingroup public_actions
 * @ingroup public_capital_actions

 * @note Авторизация требуется от контракта совета
 */
void capital::declinepgprp(eosio::name coopname, eosio::name username, checksum256 property_hash, std::string reason) {
  require_auth(_soviet);
  
  // Отказ приходит под ключом своего шага: повестка совета — хэш взноса,
  // одобрение заявления — хэш заявления, одобрение акта — хэш акта.
  auto property = Capital::ProgramProperties::get_program_property(coopname, property_hash);
  if (!property.has_value())
    property = Capital::ProgramProperties::find_program_property_by_document<"bystatement"_n>(coopname, property_hash);
  if (!property.has_value())
    property = Capital::ProgramProperties::find_program_property_by_document<"byact"_n>(coopname, property_hash);
  eosio::check(property.has_value(), "CAPITAL_PROPERTY_NOT_FOUND: Предложение по программному имущественному взносу не найдено");
  
  Capital::ProgramProperties::delete_program_property(coopname, property->id);
}
