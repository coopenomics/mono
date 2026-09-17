/**
 * @brief Создает предложение по программному имущественному взносу
 * Создает предложение по программному имущественному взносу и отправляет на одобрение:
 * - Проверяет подлинность документа-заявления
 * - Валидирует активность основного договора УХД
 * - Валидирует уникальность предложения по хешу
 * - Валидирует сумму и описание имущества
 * - Создает предложение и отправляет на одобрение
 * @param coopname Наименование кооператива
 * @param username Наименование пользователя-участника
 * @param property_hash Хеш программного имущественного взноса
 * @param property_amount Стоимость имущества
 * @param property_description Описание имущества
 * @param statement Заявление об имущественном взносе
 * @ingroup public_actions
 * @ingroup public_capital_actions

 * @note Авторизация требуется от аккаунта: @p coopname
 */
void capital::createpgprp(eosio::name coopname, eosio::name username, 
                         checksum256 property_hash, eosio::asset property_amount, 
                         std::string property_description, document2 statement) {
  require_auth(coopname);
  
  // Проверяем документ-заявление
  verify_document_or_fail(statement);
  // Заявление о передаче имущества подписывает сам пайщик. Транзакцию шлёт кооператив, поэтому ключ сверяется с аккаунтом.
  verify_signer_keys_or_fail(statement, username);
  
  // Проверяем основной договор УХД
  auto contributor = Capital::Contributors::get_contributor(coopname, username);
  eosio::check(contributor.has_value(), "Пайщик не подписывал основной договор УХД");
  eosio::check(contributor->status == Capital::Contributors::Status::ACTIVE, "Основной договор УХД не активен");
  
  // Проверяем, что предложение с указанным хэшем не существует
  auto property = Capital::ProgramProperties::get_program_property(coopname, property_hash);
  eosio::check(!property.has_value(), "Предложение с указанным хэшем уже существует");
  
  // Валидация суммы имущества
  Wallet::validate_asset(property_amount);
  eosio::check(property_amount.amount > 0, "Стоимость имущества должна быть положительной");
  
  // Проверяем описание имущества
  eosio::check(!property_description.empty(), "Описание имущества не может быть пустым");
  
  // Создаем предложение и отправляем на approve
  Capital::ProgramProperties::create_program_property_with_approve(
    coopname,
    username,
    property_hash,
    property_amount,
    property_description,
    statement
  );
}
