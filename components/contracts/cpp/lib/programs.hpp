#pragma once

// -----------------------------------------------------------------
// Таблица программ
// -----------------------------------------------------------------
struct [[eosio::table, eosio::contract(SOVIET)]] program {
  uint64_t id;                             /*!< идентификатор обмена */
  uint64_t draft_id;                       ///< Ссылка на шаблон условий
  eosio::name program_type;                /*!< тип кооперативной программы (wallet | market | capital) */
  
  eosio::name coopname;                    /*!< имя аккаунта кооператива */
  bool is_active;
  std::string title;
  std::string announce;
  std::string description;
  std::string preview;
  std::string images;
  std::string meta;

  eosio::name calculation_type;            /*!< LEGACY тип настройки платежей по программе ( absolute | relative | free ) */
  uint64_t membership_percent_fee;         /*!< LEGACY процент комиссии со взноса */
  eosio::asset fixed_membership_contribution;  /*!< LEGACY Членский взнос */
  
  eosio::time_point_sec start_at;          /*!< Время открытия */
  eosio::time_point_sec expired_at;        /*!< Временное ограничение */
  
  eosio::binary_extension<eosio::asset> available; ///< доступные паевые взносы для расходов по ЦПП
  eosio::binary_extension<eosio::asset> spendeded; ///< расходы из числа паевых взносов ЦПП
  eosio::binary_extension<eosio::asset> blocked; ///< недоступные средства из числа паевых взносов для расходов по ЦПП
  
  eosio::binary_extension<bool> is_can_coop_spend_share_contributions; ///< может ли кооператив использовать паевые взносы программы на расходы

  eosio::binary_extension<eosio::asset> share_contributions; ///< собранные паевые взносы 
  eosio::binary_extension<eosio::asset> membership_contributions; ///< собранные членские взносы
  
  uint64_t primary_key() const { return id; } /*!< return id - primary_key */
  uint64_t by_program_type() const { return program_type.value;} /*!< return program_type - secondary_key */
  uint64_t by_draft() const { return draft_id; };
};

typedef eosio::multi_index<
  "programs"_n, 
  program,
  eosio::indexed_by<"programtype"_n, eosio::const_mem_fun<program, uint64_t, &program::by_program_type>>,
  eosio::indexed_by<"bydraft"_n,     eosio::const_mem_fun<program, uint64_t, &program::by_draft>>
> programs_index; /*!< Тип мультииндекса для таблицы целевых программ */


program get_program_or_fail(eosio::name coopname, uint64_t program_id) {
  programs_index programs(_soviet, coopname.value);
  print("program_id: ", program_id);
  auto program = programs.find(program_id);
  eosio::check(program != programs.end(), "Программа не найдена");

  return *program;
};


bool is_participant_of_cpp_by_program_id(eosio::name coopname, eosio::name username, uint64_t program_id) {
  progwallets_index progwallets(_soviet, coopname.value);
  
  auto wallets_by_username_and_program = progwallets.template get_index<"byuserprog"_n>();
  auto username_and_program_index = combine_ids(username.value, program_id);
  auto wallet = wallets_by_username_and_program.find(username_and_program_index);
  
  if (wallet == wallets_by_username_and_program.end())
    return false;
  
  auto program = get_program_or_fail(coopname, program_id);

  //достать agreement и проверить статус 
  agreements2_index agreements(_soviet, coopname.value);
  auto agreement = agreements.find(wallet -> agreement_id);
  
  if (agreement -> status == "declined"_n)
    return false;
    
  return true;
}



bool is_valid_participant_of_program_by_type(eosio::name coopname, eosio::name username, eosio::name program_type) {
  programs_index programs(_soviet, coopname.value);
  progwallets_index progwallets(_soviet, coopname.value);
  
  coagreements_index coagreements(_soviet, coopname.value);
  auto coagreement = coagreements.find(program_type.value);
  
  if (coagreement == coagreements.end())
    return false;
  
  auto exist = programs.find(coagreement -> program_id);
  
  if (exist == programs.end())
    return false;
  
  auto wallets_by_username_and_program = progwallets.template get_index<"byuserprog"_n>();
  auto username_and_program_index = combine_ids(username.value, exist -> id);
  auto wallet = wallets_by_username_and_program.find(username_and_program_index);
  
  if (wallet == wallets_by_username_and_program.end())
    return false;
  
  //достать agreement и проверить статус 
  agreements2_index agreements(_soviet, coopname.value);
  auto agreement = agreements.find(wallet -> agreement_id);
  
  if (agreement -> status == "declined"_n)
    return false;
  
  return true;
}


struct ProgramInfo {
    uint64_t program_id;
    uint64_t draft_id;
};

static const std::map<eosio::name, ProgramInfo> program_map = {
    {_wallet_program, {1, 1}},       // program_id = 1, draft_id = 1
    {_marketplace_program, {2, 699}},  // program_id = 2, draft_id = 699
    {_source_program, {3, 0}},    // program_id = 3, draft_id = 0
    {_capital_program, {4, 1000}}    // program_id = 4, draft_id = 1000
};

// Проверка валидности программы
inline void check_valid_program(const eosio::name& type) {
    eosio::check(program_map.find(type) != program_map.end(), "Недопустимый тип программы");
}

// Получение ID программы
inline uint64_t get_program_id(const eosio::name& type) {
    auto it = program_map.find(type);
    eosio::check(it != program_map.end(), "Недопустимый тип программы");
    return it->second.program_id;
}

// Получение draft_id программы
inline uint64_t get_draft_id(const eosio::name& type) {
    auto it = program_map.find(type);
    eosio::check(it != program_map.end(), "Недопустимый тип программы");
    return it->second.draft_id;
}


std::optional<progwallet> get_program_wallet (eosio::name coopname, eosio::name username, name type) {
  auto program_id = get_program_id(type);
  
  progwallets_index progwallets(_soviet, coopname.value);

  auto balances_by_username_and_program = progwallets.template get_index<"byuserprog"_n>();
  auto username_and_program_index = combine_ids(username.value, program_id);
  auto wallet = balances_by_username_and_program.find(username_and_program_index);
  
  if (wallet == balances_by_username_and_program.end()) {
    return std::nullopt;
  }

  return *wallet;
}
