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
  
  document2 statement;            /*!< заявление/документ на взнос или возврат */
  uint64_t decision_id;           /*!< идентификатор решения */
  document2 authorization;        /*!< документ авторизации */
  document2 act1;                  /*!< акт приёма-передачи */
  document2 act2;                  /*!< акт приёма-передачи */
  
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
 * @brief Таблица обменов для контракта "marketplace"
 * @ingroup public_tables
 */
struct [[eosio::table, eosio::contract(MARKETPLACE)]] request {
  uint64_t id;                 /*!< идентификатор обмена */
  checksum256 hash;            /*!< хэш заявки */
  uint64_t parent_id;          /*!< идентификатор родительской заявки */
  checksum256 parent_hash;     /*!< хэш родительской заявки */
  eosio::name coopname;        /*!< имя аккаунта кооператива */
  eosio::name type;            /*!< тип обмена */
  eosio::name status;          /*!< статус обмена */
  eosio::name username;        /*!< имя аккаунта владельца заявки */
  eosio::name parent_username; /*!< имя аккаунта владельца объявления */
  eosio::name braname;         /*!< имя кооперативного участка */
  eosio::name token_contract;  /*!< имя контракта токена */
  
  eosio::asset unit_cost;/*!< себестоимость единицы товара от поставщика */
  eosio::asset supplier_amount; /*!< сумма взноса поставщика */
  eosio::asset membership_fee_amount; /*!< членский взнос заказчика */
  
  eosio::asset total_cost;    /*!< сумма взноса */
  
  uint64_t remain_units;      /*!< оставшееся количество товара */
  uint64_t blocked_units;     /*!< заблокированное количество товара */
  uint64_t delivered_units;   /*!< количество доставленного товара */
  std::string meta;            /*!< метаданные заявки */

  eosio::name money_contributor;
  eosio::name product_contributor;
  
  uint64_t product_lifecycle_secs;
  uint64_t cancellation_fee; //up to 100
  eosio::asset cancellation_fee_amount; 

  eosio::time_point_sec created_at;
  eosio::time_point_sec accepted_at;
  eosio::time_point_sec supplied_at;
  eosio::time_point_sec delivered_at;
  eosio::time_point_sec received_at;
  eosio::time_point_sec completed_at;
  eosio::time_point_sec declined_at;
  eosio::time_point_sec disputed_at;
  eosio::time_point_sec canceled_at;

  eosio::time_point_sec warranty_delay_until;
  eosio::time_point_sec deadline_for_receipt;

  bool is_warranty_return = false;
  uint64_t warranty_return_id;

  uint64_t primary_key() const { return id; }
  uint64_t by_coop() const {return coopname.value;}
  uint64_t by_status() const { return status.value; }
  uint64_t by_type() const { return type.value; }
  uint64_t by_parent() const { return parent_id; }
  checksum256 by_hash() const { return hash; }
  checksum256 by_parent_hash() const { return parent_hash; }
  uint64_t by_username() const { return username.value;}
  uint64_t by_parent_username() const { return parent_username.value;}

  uint64_t by_created() const { return created_at.sec_since_epoch();}
  uint64_t by_completed() const { return completed_at.sec_since_epoch();}
  uint64_t by_declined() const { return declined_at.sec_since_epoch();}
  uint64_t by_canceled() const { return canceled_at.sec_since_epoch();}
  uint64_t by_warranty_id() const { return warranty_return_id;}
};

typedef eosio::multi_index<
    "requests"_n, request,
    eosio::indexed_by<"bycoop"_n, eosio::const_mem_fun<request, uint64_t, &request::by_coop>>,
    eosio::indexed_by<"bystatus"_n, eosio::const_mem_fun<request, uint64_t, &request::by_status>>,
    eosio::indexed_by<"bytype"_n, eosio::const_mem_fun<request, uint64_t, &request::by_type>>,
    eosio::indexed_by<"byparent"_n, eosio::const_mem_fun<request, uint64_t, &request::by_parent>>,
    eosio::indexed_by<"byhash"_n, eosio::const_mem_fun<request, checksum256, &request::by_hash>>,
    eosio::indexed_by<"byparenthash"_n, eosio::const_mem_fun<request, checksum256, &request::by_parent_hash>>,
    eosio::indexed_by<"byusername"_n, eosio::const_mem_fun<request, uint64_t, &request::by_username>>,
    eosio::indexed_by<"bypausername"_n, eosio::const_mem_fun<request, uint64_t, &request::by_parent_username>>,
    eosio::indexed_by<"bycreated"_n, eosio::const_mem_fun<request, uint64_t, &request::by_created>>,
    eosio::indexed_by<"bycompleted"_n, eosio::const_mem_fun<request, uint64_t, &request::by_completed>>,
    eosio::indexed_by<"bydeclined"_n, eosio::const_mem_fun<request, uint64_t, &request::by_declined>>,
    eosio::indexed_by<"bycanceled"_n, eosio::const_mem_fun<request, uint64_t, &request::by_canceled>>,
    eosio::indexed_by<"bywarrantyid"_n, eosio::const_mem_fun<request, uint64_t, &request::by_warranty_id>>
> requests_index;

static const std::set<eosio::name> marketplace_callback_actions = {
  "authoffcont"_n, // авторизация сегмента contribute для направления OFFER → ORDER
  "authoffret"_n,  // авторизация сегмента return для направления OFFER → ORDER
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

static request get_request_by_hash_or_fail(eosio::name coopname, checksum256 request_hash, const std::string& error_msg = "Заявка не найдена по хэшу") {
  auto request_opt = get_request_by_hash(coopname, request_hash);
  eosio::check(request_opt.has_value(), error_msg);
  return *request_opt;
}

static std::vector<request> get_requests_by_parent_hash(eosio::name coopname, checksum256 parent_hash) {
  requests_index requests(_marketplace, coopname.value);
  auto idx = requests.get_index<"byparenthash"_n>();
  auto lower = idx.lower_bound(parent_hash);
  auto upper = idx.upper_bound(parent_hash);

  std::vector<request> result;
  for (auto itr = lower; itr != upper; ++itr) {
    result.push_back(*itr);
  }
  return result;
}

/**
 * @brief Завершает один сегмент, отправляя соответствующие транзакции
 * @param change Заявка
 * @param request_hash Хэш заявки
 * @param segment Сегмент для завершения
 * @param action Действие (для return - _product_return_action, для contribute - _product_contribution_action)
 * @param contributor Участник (money_contributor или product_contributor)
 */
static void complete_segment(const request& change, checksum256 request_hash, const segment& segment, eosio::name action, eosio::name contributor) {
  Action::send<newdecision_interface>(
    _soviet,
    "newdecision"_n,
    _marketplace,
    change.coopname,
    contributor,
    action,
    request_hash,
    segment.authorization
  );

  Action::send<newresolved_interface>(
    _soviet,
    "newresolved"_n,
    _marketplace,
    change.coopname,
    contributor,
    action,
    request_hash,
    segment.statement
  );
  
  Action::send<newact_interface>(
    _soviet,
    "newact"_n,
    _marketplace,
    change.coopname,
    contributor,
    action,
    request_hash,
    segment.act1
  );
}

} // namespace Marketplace