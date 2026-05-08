/**
 * @brief Подписывает акт 2 по программному имущественному взносу и зачисляет в программу благороста
 * Подписывает второй акт председателем и зачисляет имущество в программу благороста:
 * - Проверяет что подписывает председатель
 * - Проверяет подлинность документа акта от председателя
 * - Получает предложение и валидирует его статус (должен быть act1)
 * - Сохраняет второй акт и обновляет статус на act2
 * - Начисляет заблокированные средства в кошелек программы благороста
 * - Увеличивает паевой фонд через бухгалтерский учет
 * - Удаляет предложение после успешной обработки
 * @param coopname Наименование кооператива
 * @param username Наименование пользователя-председателя
 * @param property_hash Хеш программного имущественного взноса
 * @param act Документ акта 2
 * @ingroup public_actions
 * @ingroup public_capital_actions

 * @note Авторизация требуется от аккаунта: @p coopname
 */
void capital::act2pgprp(eosio::name coopname, eosio::name username, checksum256 property_hash, document2 act) {
  require_auth(coopname);

  auto soviet = get_board_by_type_or_fail(coopname, "soviet"_n);
  auto chairman = soviet.get_chairman();

  eosio::check(username == chairman,
               "Только председатель может принять имущество");

  // Проверяем документ
  verify_document_or_fail(act, { username });

  // Получаем предложение
  auto property = Capital::ProgramProperties::get_program_property_or_fail(coopname, property_hash);
  
  // Проверяем статус
  eosio::check(property.status == Capital::ProgramProperties::Status::ACT1, 
               "Предложение должно быть в статусе 'act1'");
  
  // Сохраняем второй акт
  Capital::ProgramProperties::set_program_property_act2(coopname, property.id, act);
  
  // Обновляем статус на act2
  Capital::ProgramProperties::update_program_property_status(coopname, property.id, Capital::ProgramProperties::Status::ACT2);
  
  std::string memo = Capital::Memo::get_program_property_memo(property_hash);

  // Увеличиваем паевой фонд через ledger2: ISSUE в BLAGOROST_FUND, Dr 51 / Cr 80.
  Ledger2::apply(_capital, coopname, operations::capital::ACCEPT_PROPERTY, property.property_amount, property.username, property_hash, memo);
  
  // Удаляем предложение после успешной обработки
  Capital::ProgramProperties::delete_program_property(coopname, property.id);
};
