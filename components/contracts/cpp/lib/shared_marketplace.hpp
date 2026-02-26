#pragma once

// Сигнатуры для callback действий marketplace
#define AUTH_SIGNATURE eosio::name coopname, checksum256 request_hash, document2 authorization

using auth_interface = void(AUTH_SIGNATURE);


namespace Marketplace {

/**
 * @brief Сегмент поставки - унифицированная структура для работы с документами
 * @ingroup public_tables
 * 
 * Сегмент представляет собой путь поставки от пайщика в кооператив или из кооператива до пайщика
 * 
 * Типы сегментов:
 * - "contribute" - сегмент поставки имущества в кооператив
 * - "return" - сегмент возврата имущества из кооператива  
 * - "wreturn" - сегмент возврата по гарантии (от заказчика в кооператив)
 * - "wsupply" - сегмент выдачи по гарантии (из кооператива поставщику)
 */
struct [[eosio::table, eosio::contract(MARKETPLACE)]] segment {
  uint64_t id;                    /*!< идентификатор сегмента */
  uint64_t request_id;            /*!< идентификатор заявки, к которой относится сегмент */
  eosio::name type;               /*!< тип сегмента: "contribute", "return", "wreturn", "wsupply" */
  eosio::name status;             /*!< статус сегмента */
  
  document2 convert_in;           /*!< заявление на конвертацию из кошелька */
  document2 statement;            /*!< заявление/документ на взнос или возврат */
  uint64_t decision_id;           /*!< идентификатор решения */
  document2 authorization;        /*!< документ авторизации */
  document2 act1;                  /*!< акт приёма-передачи */
  document2 act2;                  /*!< акт приёма-передачи */
  document2 convert_out;          /*!< заявление на конвертацию в кошелек */
  
  // Документы транспортировки
  document2 transport_act_1;      /*!< акт товарно-транспортной накладной - передача имущества на транспортировку */
  document2 transport_act_2;      /*!< акт товарно-транспортной накладной - прием имущества водителем */
  document2 transport_act_3;      /*!< акт товарно-транспортной накладной - доставка до КУ получателя */
  document2 transport_act_4;      /*!< акт товарно-транспортной накладной - прием имущества председателем КУ */
  
  eosio::name coopactor;   /*!< представитель кооператива, который действует в этом сегменте */
  eosio::name username;    /*!< пользователь, который действует в этом сегменте */
  eosio::name driver_username;    /*!< водитель-пайщик, который принимает имущество на транспортировку */
  eosio::name receive_from_driver_coopactor; /*!< председатель КУ, который принимает имущество от водителя */
  
  eosio::time_point_sec created_at;
  eosio::time_point_sec updated_at;

  uint64_t primary_key() const { return id; }
  uint64_t by_request() const { return request_id; }
  uint64_t by_type() const { return type.value; }
  uint64_t by_status() const { return status.value; }
};

typedef eosio::multi_index<
    "segments"_n, segment,
    eosio::indexed_by<"byrequest"_n, eosio::const_mem_fun<segment, uint64_t, &segment::by_request>>,
    eosio::indexed_by<"bytype"_n, eosio::const_mem_fun<segment, uint64_t, &segment::by_type>>,
    eosio::indexed_by<"bystatus"_n, eosio::const_mem_fun<segment, uint64_t, &segment::by_status>>
> segments_index;


/**
 * @brief Перевозка имущества - объединение нескольких заявок в одну транспортную накладную
 * @ingroup public_tables
 * 
 * Перевозка представляет собой процесс транспортировки множества единиц имущества
 * в рамках одной товарно-транспортной накладной от одного кооперативного участка
 * к одному или нескольким получателям.
 * 
 * Статусы перевозки:
 * - "loading" - идет загрузка товаров в перевозку
 * - "transit" - перевозка в пути (товары загружены и подписана накладная)
 * - "arrived" - перевозка прибыла, ожидает подтверждения получателя
 * - "completed" - все товары из перевозки переданы получателям
 */
struct [[eosio::table, eosio::contract(MARKETPLACE)]] shipment {
  uint64_t id;                           /*!< идентификатор перевозки */
  checksum256 hash;                      /*!< внешний идентификатор перевозки */
  eosio::name coopname;                  /*!< имя кооператива */
  eosio::name driver_username;           /*!< водитель-пайщик */
  eosio::name source_braname;            /*!< КУ отправителя */
  eosio::name destination_braname;       /*!< КУ назначения (может быть промежуточный) */
  eosio::name status;                    /*!< статус перевозки */
  
  std::vector<checksum256> request_hashes; /*!< массив хэшей заявок в перевозке */
  
  std::vector<Document::named_document> documents; /*!< именованные документы перевозки */
  
  eosio::time_point_sec created_at;      /*!< время создания перевозки */
  eosio::time_point_sec loaded_at;       /*!< время завершения загрузки */
  eosio::time_point_sec delivered_at;    /*!< время доставки */
  eosio::time_point_sec completed_at;    /*!< время завершения перевозки */

  uint64_t primary_key() const { return id; }
  checksum256 by_hash() const { return hash; }
  uint64_t by_coop() const { return coopname.value; }
  uint64_t by_driver() const { return driver_username.value; }
  uint64_t by_source() const { return source_braname.value; }
  uint64_t by_destination() const { return destination_braname.value; }
  uint64_t by_status() const { return status.value; }
  uint64_t by_created() const { return created_at.sec_since_epoch(); }
};

typedef eosio::multi_index<
    "shipments"_n, shipment,
    eosio::indexed_by<"byhash"_n, eosio::const_mem_fun<shipment, checksum256, &shipment::by_hash>>,
    eosio::indexed_by<"bycoop"_n, eosio::const_mem_fun<shipment, uint64_t, &shipment::by_coop>>,
    eosio::indexed_by<"bydriver"_n, eosio::const_mem_fun<shipment, uint64_t, &shipment::by_driver>>,
    eosio::indexed_by<"bysource"_n, eosio::const_mem_fun<shipment, uint64_t, &shipment::by_source>>,
    eosio::indexed_by<"bydest"_n, eosio::const_mem_fun<shipment, uint64_t, &shipment::by_destination>>,
    eosio::indexed_by<"bystatus"_n, eosio::const_mem_fun<shipment, uint64_t, &shipment::by_status>>,
    eosio::indexed_by<"bycreated"_n, eosio::const_mem_fun<shipment, uint64_t, &shipment::by_created>>
> shipments_index;


/**
 * @brief Таблица обменов для контракта "marketplace"
 * @ingroup public_tables
 */
struct [[eosio::table, eosio::contract(MARKETPLACE)]] request {
  uint64_t id;                 /*!< идентификатор обмена */
  checksum256 hash;            /*!< хэш заявки */
  eosio::name coopname;        /*!< имя аккаунта кооператива */
  eosio::name type;            /*!< тип обмена: orderoffer или offerorder */
  eosio::name status;          /*!< статус обмена */
  eosio::name username;        /*!< имя аккаунта владельца заявки */
  eosio::name braname;         /*!< имя кооперативного участка */
  eosio::name warehouse;       /*!< имя КУ где хранится имущество */
  eosio::name token_contract;  /*!< имя контракта токена */
  
  eosio::name receiver_braname; /*!< КУ заказчика для получения товара */
  eosio::name supplier_braname; /*!< КУ поставщика для отправки товара */
  
  eosio::asset unit_cost;/*!< себестоимость единицы товара от поставщика */
  eosio::asset base_cost; /*!< базовая стоимость заявки */
  eosio::asset membership_fee_amount; /*!< членский взнос заказчика */
  eosio::asset total_cost;    /*!< общая сумма заявки */
  
  uint64_t units;              /*!< количество единиц товара */
  std::string meta;            /*!< метаданные заявки */

  eosio::name money_contributor; /*!< имя аккаунта, который вносит средства */
  eosio::name product_contributor; /*!< имя аккаунта, который передаёт товар */
  
  std::vector<Document::named_document> documents; /*!< именованные документы заявки */
  
  uint64_t product_lifecycle_secs; // жизненный цикл продукта
  uint64_t warranty_period_secs; // гарантийный срок в секундах
  eosio::asset cancellation_fee_amount; // сумма штрафа за отмену заявки

  eosio::time_point_sec warranty_delay_until;
  eosio::time_point_sec deadline_for_receipt;

  bool is_warranty_return = false;
  uint64_t warranty_return_id;

  eosio::time_point_sec created_at;
  eosio::time_point_sec accepted_at;
  eosio::time_point_sec supplied_at;
  eosio::time_point_sec delivered_at;
  eosio::time_point_sec received_at;
  eosio::time_point_sec completed_at;
  eosio::time_point_sec declined_at;
  eosio::time_point_sec disputed_at;
  eosio::time_point_sec canceled_at;


  uint64_t primary_key() const { return id; }
  uint64_t by_coop() const {return coopname.value;}
  uint64_t by_status() const { return status.value; }
  uint64_t by_type() const { return type.value; }
  checksum256 by_hash() const { return hash; }
  uint64_t by_username() const { return username.value;}

  uint64_t by_created() const { return created_at.sec_since_epoch();}
  uint64_t by_completed() const { return completed_at.sec_since_epoch();}
  uint64_t by_declined() const { return declined_at.sec_since_epoch();}
  uint64_t by_canceled() const { return canceled_at.sec_since_epoch();}
  uint64_t by_warranty_id() const { return warranty_return_id;}
  
  // Логические геттеры для получения актуальных ролей
  eosio::name get_money_contributor() const {
    return is_warranty_return ? product_contributor : money_contributor;
  }
  
  eosio::name get_product_contributor() const {
    return is_warranty_return ? money_contributor : product_contributor;
  }
  
  // Геттеры для понимания ролей в контексте текущей операции
  eosio::name get_payer() const {
    return get_money_contributor();
  }
  
  eosio::name get_supplier() const {
    return get_product_contributor();
  }
  
  // Специальные геттеры для гарантийного возврата
  // Возвращают участников в контексте процесса возврата брака
  
  /**
   * @brief Получить пайщика, который возвращает товар в гарантийном возврате
   * Это тот, кто изначально получил товар и теперь возвращает его как брак
   */
  eosio::name get_product_backer() const {
    return money_contributor;
  }
  
  /**
   * @brief Получить поставщика брака в гарантийном возврате  
   * Это тот, кто изначально поставил товар и теперь получает его обратно как брак
   */
  eosio::name get_defective_supplier() const {
    return product_contributor;
  }
};

typedef eosio::multi_index<
    "requests"_n, request,
    eosio::indexed_by<"bycoop"_n, eosio::const_mem_fun<request, uint64_t, &request::by_coop>>,
    eosio::indexed_by<"bystatus"_n, eosio::const_mem_fun<request, uint64_t, &request::by_status>>,
    eosio::indexed_by<"bytype"_n, eosio::const_mem_fun<request, uint64_t, &request::by_type>>,
    eosio::indexed_by<"byhash"_n, eosio::const_mem_fun<request, checksum256, &request::by_hash>>,
    eosio::indexed_by<"byusername"_n, eosio::const_mem_fun<request, uint64_t, &request::by_username>>,
    eosio::indexed_by<"bycreated"_n, eosio::const_mem_fun<request, uint64_t, &request::by_created>>,
    eosio::indexed_by<"bycompleted"_n, eosio::const_mem_fun<request, uint64_t, &request::by_completed>>,
    eosio::indexed_by<"bydeclined"_n, eosio::const_mem_fun<request, uint64_t, &request::by_declined>>,
    eosio::indexed_by<"bycanceled"_n, eosio::const_mem_fun<request, uint64_t, &request::by_canceled>>,
    eosio::indexed_by<"bywarrantyid"_n, eosio::const_mem_fun<request, uint64_t, &request::by_warranty_id>>
> requests_index;

static const std::set<eosio::name> marketplace_callback_actions = {
  "authcontrib"_n, // авторизация взноса имуществом
  "authreturn"_n,  // авторизация возврата имуществом
  "authoffs2c"_n,  // авторизация сегмента contribute для направления OFFER → ORDER
  "authoffc2r"_n,  // авторизация сегмента return для направления OFFER → ORDER
  "authordcont"_n, // авторизация сегмента contribute для направления ORDER → OFFER
  "authordret"_n,  // авторизация сегмента return для направления ORDER → OFFER
  "declineacc"_n,  // отклонение принятия заявки
};

inline eosio::name get_valid_marketplace_action(const eosio::name& action) {
  eosio::check(marketplace_callback_actions.contains(action), "Недопустимое имя действия marketplace");
  return action;
}

// Вспомогательные функции для поиска заявок по хэшу
static std::optional<request> get_request_by_hash(eosio::name coopname, checksum256 request_hash) {
  requests_index requests(_marketplace, coopname.value);
  auto idx = requests.get_index<"byhash"_n>();
  auto req = idx.find(request_hash);

  if (req != idx.end()) {
    return *req;
  }
  return std::nullopt;
}

// Вспомогательные функции для поиска перевозок по хэшу
static std::optional<shipment> get_shipment_by_hash(eosio::name coopname, checksum256 shipment_hash) {
  shipments_index shipments(_marketplace, coopname.value);
  auto idx = shipments.get_index<"byhash"_n>();
  auto ship = idx.find(shipment_hash);

  if (ship != idx.end()) {
    return *ship;
  }
  return std::nullopt;
}

static request get_request_by_hash_or_fail(eosio::name coopname, checksum256 request_hash, const std::string& error_msg = "Заявка не найдена по хэшу") {
  auto request_opt = get_request_by_hash(coopname, request_hash);
  eosio::check(request_opt.has_value(), error_msg);
  return *request_opt;
}

static shipment get_shipment_by_hash_or_fail(eosio::name coopname, checksum256 shipment_hash, const std::string& error_msg = "Перевозка не найдена по хэшу") {
  auto shipment_opt = get_shipment_by_hash(coopname, shipment_hash);
  eosio::check(shipment_opt.has_value(), error_msg);
  return *shipment_opt;
}

/*!
 *  \brief Константы для имен документов маркетплейса (максимум 12 символов)
 */
namespace DocumentNames {
  static constexpr const name RETURN_STMT = "returnstmt"_n;         // заявление на возврат имущества  
  static constexpr const name CONVERT_FROM = "convertfrom"_n;       // заявление на конвертацию из кошелька
  static constexpr const name CONVERT_TO = "convertto"_n;           // заявление на конвертацию в кошелек
  static constexpr const name CONTRIB_STMT = "contribstmt"_n;       // заявление на имущественный паевой взнос
  static constexpr const name CONTRIB_AUTH = "contribauth"_n;       // авторизация взноса
  static constexpr const name RETURN_AUTH = "returnauth"_n;         // авторизация возврата
  static constexpr const name RECEIVE_ACT = "receiveact"_n;         // акт получения
  static constexpr const name RECEIVE_ACT_CONF = "receiveconf"_n;      // подтверждение акта получения
  static constexpr const name TRANSPORT1 = "transport1"_n;          // акт транспортировки 1 (УСТАРЕВШИЙ)
  static constexpr const name TRANSPORT2 = "transport2"_n;          // акт транспортировки 2 (УСТАРЕВШИЙ)
  static constexpr const name TRANSPORT3 = "transport3"_n;          // акт транспортировки 3 (УСТАРЕВШИЙ)
  static constexpr const name TRANSPORT4 = "transport4"_n;          // акт транспортировки 4 (УСТАРЕВШИЙ)
  static constexpr const name SUPPLY_ACT = "supplyact"_n;           // акт поставки
  static constexpr const name SUPPLY_ACT_CONF = "supplyconf"_n;        // подтверждение акта поставки
  static constexpr const name SHIPMENT_ACT = "shipmentact"_n;       // товарно-транспортная накладная
  static constexpr const name DELIVERY_ACT = "deliveryact"_n;       // акт доставки (УСТАРЕВШИЙ)
  
  // Документы новой системы перевозок
  static constexpr const name SHIPMENT_SEND_ACT = "shsendact"_n;              // акт передачи от отправителя
  static constexpr const name SHIPMENT_LOADING_ACT = "shloadact"_n;          // акт приёма водителем
  static constexpr const name SHIPMENT_ARRIVE_ACT = "sharriveact"_n;          // акт прибытия/доставки на склад, подписанный водителем
  static constexpr const name SHIPMENT_RECV_ACT = "shrecvact"_n;              // акт приёма на складе получателем
  
  // Документы гарантийного возврата
  static constexpr const name WDISPUTE = "wdispute"_n;             // претензия на гарантийный возврат
  static constexpr const name WRETURN_AUTH = "wreturnauth"_n;        // авторизация гарантийного возврата
  static constexpr const name WSUPPLY_AUTH = "wsupplyauth"_n;      // авторизация гарантийной выдачи
  static constexpr const name WRETURN_ACT = "wreturnact"_n;        // акт гарантийного возврата
  static constexpr const name WOFFER_ACT = "wofferact"_n;          // акт предложения товара поставщику
  static constexpr const name WACCEPT_ACT = "wacceptact"_n;        // акт принятия/отказа поставщика
  
  // Документы уничтожения
  static constexpr const name DESTROY_ACT = "destroyact"_n;        // акт уничтожения имущества
}

} // namespace Marketplace