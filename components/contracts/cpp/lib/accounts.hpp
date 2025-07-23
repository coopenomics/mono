#include <eosio/binary_extension.hpp>

bool check_auth_and_get_payer(const std::vector<eosio::name>& payers) {
    for (const auto& payer : payers) {
        if (has_auth(payer)) {
            return true;
        }
    }
    return false;
}

eosio::name check_auth_and_get_payer_or_fail(const std::vector<eosio::name>& payers) {
    for (const auto& payer : payers) {
      if (has_auth(payer)) {
        return payer;
      }
    }
    eosio::check(false, "Недостаточно прав доступа");
    return eosio::name{}; // code will never reach here due to check
  }

/**
 * @ingroup public_tables
 * @brief Структура, представляющая верификацию.
 * @details Тип процедуры верификации (procedure) может принимать следующие значения:
 * - 0: Online
 * - 1: Video Call
 * - 2: Qualified Signature
 * - 3: Gosuslugi
 * - 4: С помощью мобильного приложения (App)
 * - 5: Некоторые платежные системы проводят верификацию в Связном (Agent Store)
 * - 6: Верификация в банке (Bank)
 * - 7: Верификация в кооперативе (In Person)
 */
struct verification {
  eosio::name verificator; ///< Организация, которая произвела верификацию
  bool is_verified; ///< Флаг, указывающий, прошла ли верификация
  eosio::name procedure; ///< Тип процедуры верификации
    // ('online')),
    // ('video call')),
    // ('qualified signature')),
    // ('gosuslugi')),
    // ('app')),   -  с помощью мобильного приложения
    // (('agent store')),     - некоторые платежные системы 
    // проводят верификацию в Связном
    // (('bank')),    - верификация в банке
    // (('in person')), - верификация в кооперативе

  eosio::time_point_sec created_at; ///< Время создания записи
  eosio::time_point_sec last_update; ///< Время последнего обновления записи
  std::string notice; ///< Дополнительная информация
};


/**
 * @ingroup public_tables
 * @brief Структура, представляющая учетные записи аккаунтов.
 * @details Эта структура хранит информацию о пользователях аккаунта и их статусе, репутации и других параметрах.
 */
struct [[eosio::table, eosio::contract(REGISTRATOR)]] account {
  eosio::name username; ///< Имя аккаунта гостя. Имя пользователя в системе.
  eosio::name referer; ///< Имя аккаунта, который был реферером при регистрации.
  eosio::name registrator; ///< Имя аккаунта регистратора, который создал этот аккаунт.
  eosio::name type; ///< Тип аккаунта: individual | entrepreneur | org
  eosio::name status; ///< Статус аккаунта
  std::string meta; ///< Дополнительная мета-информация о аккаунте.
  
  std::vector<eosio::name> storages; ///< Хранилища персональных данных и идентификаторы данных в них.
  std::vector<verification> verifications; ///< Информация о верификации пользователя.
  
  eosio::time_point_sec registered_at; ///< Время регистрации аккаунта.
  
  /**
   * @brief Возвращает первичный ключ учетной записи аккаунта.
   * @return uint64_t - первичный ключ, равный значению имени аккаунта.
   */
  uint64_t primary_key() const {
    return username.value;
  } /*!< return username - primary_key */
  
  /**
   * @brief Возвращает ключ по рефереру.
   * @return uint64_t - ключ, равный значению имени реферера.
   */
  uint64_t by_referer() const { return referer.value; }

  /**
   * @brief Возвращает ключ по типу аккаунта.
   * @return uint64_t - ключ, равный значению типа аккаунта.
   */
  uint64_t by_type() const { return type.value; }

  /**
   * @brief Возвращает ключ по статусу аккаунта.
   * @return uint64_t - ключ, равный значению статуса аккаунта.
   */
  uint64_t by_status() const { return status.value; }

  /**
   * @brief Возвращает ключ по регистратору.
   * @return uint64_t - ключ, равный значению имени регистратора.
   */
  uint64_t by_registr() const { return registrator.value; }

  bool is_active() const {
    return status == "active"_n;
  }

  uint64_t by_registered_at() const {
    return registered_at.sec_since_epoch();
  }

  /**
   * @brief Проверяет, верифицирована ли организация.
   * @return bool - true, если организация верифицирована, иначе false.
   */
  bool is_verified() const {
    for (const auto& v : verifications) {
      if (v.is_verified) {
        return true;
      }
    }
    return false;
  }


  /**
   * @brief Возвращает индекс для определения, является ли организация верифицированной.
   * @return uint64_t - ключ, равный 1, если организация верифицирована, иначе 0.
   */
  uint64_t is_verified_index() const {
    for (const auto& v : verifications) {
      if (v.is_verified) {
        return 1;
      }
    }
    return 0;
  }
};

typedef eosio::multi_index<
    "accounts"_n, account,
      eosio::indexed_by< "byreferer"_n, eosio::const_mem_fun<account, uint64_t, &account::by_referer>>,
      eosio::indexed_by<"bytype"_n, eosio::const_mem_fun<account, uint64_t, &account::by_type>>,
      eosio::indexed_by<"bystatus"_n, eosio::const_mem_fun<account, uint64_t, &account::by_status>>,
      eosio::indexed_by<"byregistr"_n, eosio::const_mem_fun<account, uint64_t, &account::by_registr>>,
      eosio::indexed_by<"byregistred"_n, eosio::const_mem_fun<account, uint64_t, &account::by_registered_at>>,
      eosio::indexed_by<"byverif"_n, eosio::const_mem_fun<account, uint64_t,&account::is_verified_index>>
    >
    accounts_index;




/**
\ingroup public_tables
\brief Структура данных нового юридического лица
*
* Данная структура содержит всю необходимую информацию для регистрации нового юридического лица в блокчейне.
*/
struct org_data {
    bool is_cooperative = false; ///< Является ли кооперативом
    eosio::name coop_type; ///< Тип кооператива (union, conscoop, prodcoop, agricoop, builderscoop, nonprofitorg)
    std::string announce; ///< Анонс
    std::string description; ///< Описание
    eosio::asset initial; ///< Вступительный взнос физического лица / ип
    eosio::asset minimum; ///< Минимальный паевой взнос физического лица / ип

    eosio::asset org_initial; ///< Вступительный взнос юридического лица
    eosio::asset org_minimum; ///< Минимальный паевой взнос юридического лица

};


/**
 * @ingroup public_tables
 * @brief Структура, представляющая организации.
 * @details Эта структура содержит информацию о юридических лицах (организациях), их верификации и других параметрах.
 */
struct [[eosio::table, eosio::contract(REGISTRATOR)]] cooperative {
  eosio::name username; ///< Имя аккаунта организации.
  eosio::name parent_username; ///< Имя родительской организации, если есть.
  
  std::string announce; ///< Анонс организации.
  std::string description; ///< Описание организации.
  bool is_cooperative = false; ///< Флаг, указывающий, является ли организация кооперативом.
  
  bool is_branched = false; ///< Флаг, указывающий, перешел ли кооператив на собрания уполномоченных
  bool is_enrolled = false; ///< Флаг, указывающий, активен ли кооператив в системе
  
  eosio::name coop_type; ///< Тип некоммерческой организации (если это кооператив).
  
  eosio::asset registration; ///< Регистрационный взнос физического лица / ип
  eosio::asset initial; ///< Вступительный членский взнос физического лица / ип
  eosio::asset minimum; ///< Минимальный паевой взнос физического лица / ип
  
  eosio::binary_extension<eosio::asset> org_registration; ///< Регистрационный взнос юридического лица
  eosio::binary_extension<eosio::asset> org_initial;  ///< Вступительный членский взнос юридического лица
  eosio::binary_extension<eosio::asset> org_minimum; ///< Минимальный паевой взнос юридического лица
  
  eosio::binary_extension<eosio::name> status; ///< Статус процесса подключения
  eosio::binary_extension<eosio::time_point_sec> created_at; ///< Дата поступления заявки на подключение (pending | ... | active | blocked)
  eosio::binary_extension<document> document; ///< Подписанный документ соглашения на подключение
  
  
  /**
   * @brief Возвращает первичный ключ учетной записи организации.
   * @return uint64_t - первичный ключ, равный значению имени аккаунта организации.
  */
  
  uint64_t primary_key() const {
    return username.value;
  }

  /**
   * @brief Сравнивает символ токена кооператива и представленный
   */
  void check_symbol_or_fail(eosio::asset contribution) {
    eosio::check(initial.symbol == contribution.symbol && minimum.symbol == contribution.symbol, "Неверный контракт токена");
  }
  
  uint64_t by_status() const { 
    return status.has_value() ? status.value().value : 0; 
  }

  uint64_t by_created() const { 
    return created_at.has_value() ? created_at.value().sec_since_epoch() : 0; 
  }
  /**
   * @brief Возвращает ключ по родительской организации.
   * @return uint64_t - ключ, равный значению имени родительской организации.
   */
  uint64_t by_parent() const {
    return parent_username.value;
  }

  /**
   * @brief Возвращает ключ для индекса кооперативных подразделений организации.
   * @return uint128_t - составной ключ, включающий значения имени организации и родительской организации.
   */
  uint128_t by_coop_childs() const {
    return combine_ids(username.value, parent_username.value);
  }

  /**
   * @brief Возвращает индекс для определения, является ли организация кооперативом.
   * @return uint64_t - ключ, равный 1, если организация является кооперативом, иначе 0.
   */
  uint64_t is_coop_index() const {
    return is_cooperative == true ? 1 : 0;
  }

  /**
   * @brief Возвращает ключ для индекса по типу некоммерческой организации (если это кооператив).
   * @return uint64_t - ключ, равный значению типа некоммерческой организации.
   */
  uint64_t bycooptype() const {
    return coop_type.value;
  }


  /**
   * @brief Проверяет, является ли организация кооперативом.
   * @return bool - true, если организация является кооперативом, иначе false.
   */
  bool is_coop() const {
    return is_cooperative;
  }

};

typedef eosio::multi_index<"orgs"_n, cooperative,
eosio::indexed_by<"iscoop"_n, eosio::const_mem_fun<cooperative, uint64_t,
                                                       &cooperative::is_coop_index>>,
eosio::indexed_by<"byparent"_n, eosio::const_mem_fun<cooperative, uint64_t,
                                                       &cooperative::by_parent>>,
eosio::indexed_by<"bycoopchilds"_n, eosio::const_mem_fun<cooperative, uint128_t, &cooperative::by_coop_childs>>,
eosio::indexed_by<"bycooptype"_n, eosio::const_mem_fun<cooperative, uint64_t, &cooperative::bycooptype>>

// eosio::indexed_by<"bystatus"_n, eosio::const_mem_fun<cooperative, uint64_t, &cooperative::by_status>>,
// eosio::indexed_by<"bycreated"_n, eosio::const_mem_fun<cooperative, uint64_t, &cooperative::by_created>>

> cooperatives_index;


/**
 * @ingroup public_tables
 * @brief Структура, представляющая организации с новым документом document2.
 * @details Эта структура содержит информацию о юридических лицах (организациях), их верификации и других параметрах.
 */
struct [[eosio::table, eosio::contract(REGISTRATOR)]] cooperative2 {
  eosio::name username; ///< Имя аккаунта организации.
  eosio::name parent_username; ///< Имя родительской организации, если есть.
  
  std::string announce; ///< Анонс организации.
  std::string description; ///< Описание организации.
  bool is_cooperative = false; ///< Флаг, указывающий, является ли организация кооперативом.
  
  bool is_branched = false; ///< Флаг, указывающий, перешел ли кооператив на собрания уполномоченных
  bool is_enrolled = false; ///< Флаг, указывающий, активен ли кооператив в системе
  
  eosio::name coop_type; ///< Тип некоммерческой организации (если это кооператив).
  
  eosio::asset registration; ///< Регистрационный взнос физического лица / ип
  eosio::asset initial; ///< Вступительный членский взнос физического лица / ип
  eosio::asset minimum; ///< Минимальный паевой взнос физического лица / ип
  
  eosio::binary_extension<eosio::asset> org_registration; ///< Регистрационный взнос юридического лица
  eosio::binary_extension<eosio::asset> org_initial;  ///< Вступительный членский взнос юридического лица
  eosio::binary_extension<eosio::asset> org_minimum; ///< Минимальный паевой взнос юридического лица
  
  eosio::binary_extension<eosio::name> status; ///< Статус процесса подключения
  eosio::binary_extension<eosio::time_point_sec> created_at; ///< Дата поступления заявки на подключение (pending | ... | active | blocked)
  eosio::binary_extension<document2> document; ///< Подписанный документ соглашения на подключение
  eosio::binary_extension<uint64_t> active_participants_count; ///< Счетчик активных пайщиков в кооперативе
  
  
  /**
   * @brief Возвращает первичный ключ учетной записи организации.
   * @return uint64_t - первичный ключ, равный значению имени аккаунта организации.
  */
  
  uint64_t primary_key() const {
    return username.value;
  }

  /**
   * @brief Сравнивает символ токена кооператива и представленный
   */
  void check_symbol_or_fail(eosio::asset contribution) {
    eosio::check(initial.symbol == contribution.symbol && minimum.symbol == contribution.symbol, "Неверный контракт токена");
  }
  
  uint64_t by_status() const { 
    return status.has_value() ? status.value().value : 0; 
  }

  uint64_t by_created() const { 
    return created_at.has_value() ? created_at.value().sec_since_epoch() : 0; 
  }
  /**
   * @brief Возвращает ключ по родительской организации.
   * @return uint64_t - ключ, равный значению имени родительской организации.
   */
  uint64_t by_parent() const {
    return parent_username.value;
  }

  /**
   * @brief Возвращает ключ для индекса кооперативных подразделений организации.
   * @return uint128_t - составной ключ, включающий значения имени организации и родительской организации.
   */
  uint128_t by_coop_childs() const {
    return combine_ids(username.value, parent_username.value);
  }

  /**
   * @brief Возвращает индекс для определения, является ли организация кооперативом.
   * @return uint64_t - ключ, равный 1, если организация является кооперативом, иначе 0.
   */
  uint64_t is_coop_index() const {
    return is_cooperative == true ? 1 : 0;
  }

  /**
   * @brief Возвращает ключ для индекса по типу некоммерческой организации (если это кооператив).
   * @return uint64_t - ключ, равный значению типа некоммерческой организации.
   */
  uint64_t bycooptype() const {
    return coop_type.value;
  }


  /**
   * @brief Проверяет, является ли организация кооперативом.
   * @return bool - true, если организация является кооперативом, иначе false.
   */
  bool is_coop() const {
    return is_cooperative;
  }

};

typedef eosio::multi_index<"coops"_n, cooperative2,
eosio::indexed_by<"iscoop"_n, eosio::const_mem_fun<cooperative2, uint64_t,
                                                       &cooperative2::is_coop_index>>,
eosio::indexed_by<"byparent"_n, eosio::const_mem_fun<cooperative2, uint64_t,
                                                       &cooperative2::by_parent>>,
eosio::indexed_by<"bycoopchilds"_n, eosio::const_mem_fun<cooperative2, uint128_t, &cooperative2::by_coop_childs>>,
eosio::indexed_by<"bycooptype"_n, eosio::const_mem_fun<cooperative2, uint64_t, &cooperative2::bycooptype>>
> cooperatives2_index;


cooperative2 get_cooperative_or_fail(eosio::name coopname) {
  cooperatives2_index coops(_registrator, _registrator.value);
  auto org = coops.find(coopname.value);
  eosio::check(org != coops.end(), "Организация не найдена");
  eosio::check(org -> is_coop(), "Организация - не кооператив");
  eosio::check(org -> status.value() == "active"_n, "Кооператив не активен");
  
  return *org;
};


account get_account_or_fail(eosio::name username) {
  accounts_index accounts(_registrator, _registrator.value);
  auto account = accounts.find(username.value);
  eosio::check(account != accounts.end(), "Аккаунт не найден");

  return *account;
};
