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
  eosio::asset base_cost; /*!< базовая стоимость заявки */
  eosio::asset membership_fee_amount; /*!< членский взнос заказчика */
  eosio::asset total_cost;    /*!< общая сумма заявки */
  
  uint64_t remaining_units;      /*!< оставшееся количество единиц товара */
  uint64_t blocked_units;     /*!< заблокированное количество единиц товара */
  uint64_t supplied_units;     /*!< количество доставленных и принятых единиц товара */
  std::string meta;            /*!< метаданные заявки */

  eosio::name money_contributor; /*!< имя аккаунта, который вносит средства */
  eosio::name product_contributor; /*!< имя аккаунта, который передаёт товар */
  
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
  "authoffs2c"_n, // авторизация сегмента contribute для направления OFFER → ORDER
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


} // namespace Marketplace