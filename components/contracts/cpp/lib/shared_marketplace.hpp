#pragma once

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
  document2 act;                  /*!< акт приёма-передачи */
  document2 act_validation;       /*!< документ валидации акта */
  
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
\ingroup public_tables
\brief Параметры заявки на обмен.
*
* Эта структура предоставляет набор данных, которые требуются для создания или обновления заявки на обмен в контракте "marketplace".
*/
struct exchange_params {
  eosio::name username; /*!< Имя пользователя, инициирующего или обновляющую заявку */
  uint64_t parent_id; /*!< Идентификатор родительской заявки */
  uint64_t program_id; /*!< Идентификатор программы */
  eosio::name coopname; /*!< Имя кооператива */
  uint64_t units; /*!< Количество частей (штук) товара или услуги */
  eosio::asset unit_cost; /*!< Цена за единицу (штуку) товара или услуги */
  uint64_t product_lifecycle_secs; /*!< Время жизни продукта, заявляемое поставщиком */
  std::optional<document2> document; /*!< Сопутствующий подписанный документ на взнос или возврат взноса */
  std::string data; /*!< Дополнительные данные, специфичные для заявки */
  std::string meta; /*!< Метаданные о заявке */
};

/**
 * @brief Таблица обменов для контракта "marketplace"
 * @ingroup public_tables
 */
struct [[eosio::table, eosio::contract(MARKETPLACE)]] request {
  uint64_t id;                 /*!< идентификатор обмена */
  uint64_t parent_id;          /*!< идентификатор родительской заявки */
  uint64_t program_id;         /*!< идентификатор программы */
  eosio::name coopname;        /*!< имя аккаунта кооператива */
  eosio::name type;            /*!< тип обмена */
  eosio::name status;          /*!< статус обмена */
  eosio::name username;        /*!< имя аккаунта владельца заявки */
  eosio::name parent_username; /*!< имя аккаунта владельца объявления */
  eosio::name token_contract;  /*!< имя контракта токена */
  
  eosio::asset unit_cost;/*!< себестоимость единицы товара от поставщика */
  eosio::asset supplier_amount; /*!< сумма взноса поставщика */
  eosio::asset total_cost;    /*!< сумма взноса заказчика */
  eosio::asset membership_fee; /*!< членский взнос заказчика */

  uint64_t remain_units;      /*!< оставшееся количество товара */
  uint64_t blocked_units;     /*!< заблокированное количество товара */
  uint64_t delivered_units;   /*!< количество доставленного товара */
  std::string data;            /*!< дополнительные данные */
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
  eosio::time_point_sec recieved_at;
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
  uint64_t by_program() const { return program_id; }
  uint64_t by_type() const { return type.value; }
  uint64_t by_parent() const { return parent_id; }
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
    eosio::indexed_by<"byprogram"_n, eosio::const_mem_fun<request, uint64_t, &request::by_program>>,
    eosio::indexed_by<"byparent"_n, eosio::const_mem_fun<request, uint64_t, &request::by_parent>>,
    eosio::indexed_by<"byusername"_n, eosio::const_mem_fun<request, uint64_t, &request::by_username>>,
    eosio::indexed_by<"bypausername"_n, eosio::const_mem_fun<request, uint64_t, &request::by_parent_username>>,
    eosio::indexed_by<"bycreated"_n, eosio::const_mem_fun<request, uint64_t, &request::by_created>>,
    eosio::indexed_by<"bycompleted"_n, eosio::const_mem_fun<request, uint64_t, &request::by_completed>>,
    eosio::indexed_by<"bydeclined"_n, eosio::const_mem_fun<request, uint64_t, &request::by_declined>>,
    eosio::indexed_by<"bycanceled"_n, eosio::const_mem_fun<request, uint64_t, &request::by_canceled>>,
    eosio::indexed_by<"bywarrantyid"_n, eosio::const_mem_fun<request, uint64_t, &request::by_warranty_id>>
> requests_index;

}