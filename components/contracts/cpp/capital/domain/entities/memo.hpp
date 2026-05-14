namespace Capital::Memo {
  inline std::string get_import_contributor_memo(checksum256 contributor_hash, eosio::asset contribution_amount) {
    return "Импорт участника с договором УХД: " + checksum256_to_hex(contributor_hash) + " с паевым взносом по программе 'Благорост': " + contribution_amount.to_string();
  }
  
  inline std::string get_debt_memo(eosio::name username) {
    return "Выдача займа для  " + username.to_string();
  }

  inline std::string get_invest_memo(uint64_t contributor_id) {
    return "Зачёт части целевого паевого взноса по программе 'Цифровой Кошелёк' в качестве паевого взноса по договору УХД с ID: " + std::to_string(contributor_id);
  }

  inline std::string get_convert_to_blagorost_memo() {
    return "Конвертация паевого взноса по программе УХД в ЦПП 'Благорост'";
  }

  inline std::string get_convert_to_wallet_memo() {
    return "Конвертация паевого взноса по программе УХД в ЦПП 'Цифровой Кошелёк'";
  }

  inline std::string get_approve_convert_memo(uint64_t contributor_id, uint64_t convert_id) {
    return "Зачёт части целевого паевого взноса по договору УХД с ID: " + std::to_string(contributor_id) + " в качестве паевого взноса по программе 'Благорост' с ID: " + std::to_string(convert_id);
  }

  inline std::string get_result_withdraw_memo(uint64_t contributor_id) {
    return "Зачёт части целевого паевого взноса по договору УХД с ID: " + std::to_string(contributor_id) + " в качестве паевого взноса по программе 'Цифровой Кошелёк'";
  }
  
  inline std::string get_push_result_memo(uint64_t contributor_id) {
    return "Внесение паевого взноса по договору УХД: " + std::to_string(contributor_id);
  }

  inline std::string get_program_withdraw_memo(uint64_t withdraw_id) {
    return "Зачёт части целевого паевого взноса по программе 'Благорост' в качестве паевого взноса по программе 'Цифровой Кошелёк' с ID: " + std::to_string(withdraw_id);
  }

  inline std::string get_approve_invest_memo(uint64_t contributor_id) {
    return "Зачёт части целевого паевого взноса по программе 'Цифровой Кошелёк' в качестве паевого взноса по договору УХД с contributor_id:" + std::to_string(contributor_id);
  }

  inline std::string get_decline_invest_memo() {
    return "Возврат заблокированных средств по отклоненной инвестиции";
  }

  inline std::string get_coordinator_payment_memo() {
    return "Выплата координатору проекта";
  }

  inline std::string get_external_contract_memo() {
    return "Договор УХД подписан за пределами цифровой платформы";
  }

  inline std::string get_result_memo(uint64_t contributor_id, uint64_t result_id) {
    return "Зачёт части целевого паевого взноса по договору УХД с ID: " + std::to_string(contributor_id) + " в качестве паевого взноса по программе 'Цифровой Кошелёк' с ID: " + std::to_string(result_id);
  }

  inline std::string get_program_invest_memo(uint64_t contributor_id) {
    return "Блокировка средств для инвестиции в программу по договору УХД с ID: " + std::to_string(contributor_id);
  }

  inline std::string get_approve_program_invest_memo(uint64_t contributor_id) {
    return "Зачёт части целевого паевого взноса по программе 'Цифровой Кошелёк' в качестве инвестиции в программу 'Благорост' по договору УХД с ID: " + std::to_string(contributor_id);
  }

  inline std::string get_decline_program_invest_memo(uint64_t contributor_id) {
    return "Возврат заблокированных средств по отклоненной программной инвестиции для договора УХД с ID: " + std::to_string(contributor_id);
  }

  inline std::string get_convert_segment_to_wallet_memo(checksum256 result_hash) {
    return "Конвертация в кошелек: " + checksum256_to_hex(result_hash);
  }

  inline std::string get_convert_segment_to_capital_memo(checksum256 result_hash) {
    return "Конвертация в капитал: " + checksum256_to_hex(result_hash);
  }

  inline std::string get_return_unused_investments_memo() {
    return "Возврат неиспользованных инвестиций из проекта";
  }

  inline std::string get_create_program_withdraw_memo() {
    return "Создание заявки на возврат из программы";
  }

  inline std::string get_program_property_memo(checksum256 property_hash) {
    return "Внесение имущества в программу Благорост: " + checksum256_to_hex(property_hash);
  }

} // namespace Capital::Memo