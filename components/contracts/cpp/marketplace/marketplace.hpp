#include <eosio/asset.hpp>
#include <eosio/contract.hpp>
#include <eosio/crypto.hpp>
#include <eosio/eosio.hpp>
#include <eosio/multi_index.hpp>
#include <eosio/system.hpp>
#include <eosio/time.hpp>

#include "../lib/common.hpp"

using namespace Marketplace;

/**
 *  \ingroup public_contracts
 *  @brief Класс `marketplace` предоставляет функционал кооперативного маркетплейса, позволяя пользователям
 *  создавать, обновлять, принимать и отменять заявки на обмен товаров и услуг. Этот контракт служит
 *  центральной точкой для всех операций обмена в рамках кооперативной экосистемы.
 *
 *  Основные функции класса:
 *  - Создание и управление заявками типа orderoffer (заказчик → поставщик).
 *  - Операции обновления, принятия, отказа и завершения обменных операций.
 *  - Модерация и управление публикацией заявок на обмен.
 *  - Административные функции, такие как создание идентификаторов и авторизация операций.
 *  
 *  ## Процесс поставки orderoffer:
 *  
 *  1. **orderoffer** - заказчик создает заявку с документами на возврат и конвертацию, средства блокируются
 *  2. **accept** - поставщик принимает заявку и предоставляет документы на взнос и конвертацию
 *  3. **authcontrib/authreturn** - совет авторизует оба заявления раздельно
 *  4. **supply** → **supplcnf** - поставка товара и подтверждение председателем КУ
 *  5. **deliver1** → **deliver2** → **deliver3** → **deliver4** - этапы транспортировки
 *  6. **receive** → **receivecnf** - получение товара заказчиком
 *  7. **complete** - завершение поставки после гарантийного периода
 *  
 *  ## Документооборот:
 *  
 *  Все документы сохраняются в векторе `std::vector<document2> documents` в заявке.
 *  Каждый этап процесса добавляет необходимые документы в этот вектор.
 *  
 *  \note Контракт маркетплейса является центральной точкой экономической активности на платформе.
 *  \note Система упрощена для работы с одной заявкой вместо двух встречных.
 */       
class [[eosio::contract(MARKETPLACE)]] marketplace : public eosio::contract {

public:
  marketplace(eosio::name receiver, eosio::name code,
              eosio::datastream<const char *> ds)
      : eosio::contract(receiver, code, ds) {}

  void apply(uint64_t receiver, uint64_t code, uint64_t action);
  [[eosio::action]] void migrate();

  // Действия для создания заявок
  [[eosio::action]] void orderoffer(eosio::name coopname, eosio::name receiver_braname, eosio::name username, checksum256 hash, uint64_t units, eosio::asset unit_cost, uint32_t product_lifecycle_secs, uint32_t warranty_period_secs, eosio::asset membership_fee_amount, eosio::asset cancellation_fee_amount, document2 convert_in, std::string meta);
  
  static void cancel_request(eosio::name coopname, eosio::name username, checksum256 request_hash);
  
  // Статические методы для отклонения заявок
  static void decline_request(eosio::name coopname, const request& change);

  // Методы для направления заявок
  [[eosio::action]] void accept(eosio::name coopname, eosio::name supplier_braname, eosio::name username, checksum256 request_hash, document2 convert_out, document2 return_document);
  [[eosio::action]] void authcontrib(eosio::name coopname, checksum256 request_hash, document2 authorization);
  [[eosio::action]] void authreturn(eosio::name coopname, checksum256 request_hash, document2 authorization);
  [[eosio::action]] void declineacc(eosio::name coopname, checksum256 hash, std::string reason);
  [[eosio::action]] void supply(eosio::name coopname, eosio::name username, checksum256 request_hash, document2 act);
  [[eosio::action]] void supplcnf(eosio::name coopname, eosio::name username, checksum256 request_hash, document2 act);
  
  // Новая система перевозок
  [[eosio::action]] void createship(eosio::name coopname, checksum256 hash, eosio::name driver_username, eosio::name source_braname, eosio::name destination_braname, std::vector<checksum256> request_hashes, document2 transport_act_sender);
  [[eosio::action]] void signbydriver(eosio::name coopname, checksum256 hash, document2 transport_act_driver);
  [[eosio::action]] void arrived(eosio::name coopname, checksum256 hash, document2 transport_act_delivery);
  [[eosio::action]] void receiveshipm(eosio::name coopname, checksum256 hash, document2 warehouse_receipt_act);
  [[eosio::action]] void retransport(eosio::name coopname, checksum256 completed_hash, eosio::name new_driver_username, eosio::name source_braname, eosio::name new_destination_braname, std::vector<checksum256> request_hashes, document2 transport_act_sender);
  
  // Имущество из запасов кооператива
  [[eosio::action]] void coopstock(eosio::name coopname, eosio::name braname, checksum256 hash, uint64_t units, eosio::asset unit_cost, uint32_t product_lifecycle_secs, uint32_t warranty_period_secs, eosio::asset membership_fee_amount, std::string meta);
  [[eosio::action]] void acceptstock(eosio::name coopname, eosio::name username, checksum256 request_hash, document2 convert_in, document2 return_statement);
  
  // Запрос возврата перед получением
  [[eosio::action]] void requestreturn(eosio::name coopname, eosio::name username, checksum256 request_hash, document2 return_statement);
  
  // Доставка заказчику
  [[eosio::action]] void delivered(eosio::name coopname, eosio::name username, checksum256 request_hash);
  [[eosio::action]] void receive(eosio::name coopname, eosio::name username, checksum256 request_hash, document2 document);
  [[eosio::action]] void receivecnf(eosio::name coopname, eosio::name username, checksum256 request_hash, document2 document);
  [[eosio::action]] void complete(eosio::name coopname, eosio::name username, checksum256 request_hash);
  [[eosio::action]] void decline(eosio::name coopname, eosio::name username, checksum256 request_hash, std::string meta);
  [[eosio::action]] void cancel(eosio::name coopname, eosio::name username, checksum256 request_hash);
    
  // Уничтожение и перепредложение
  [[eosio::action]] void destroy(eosio::name coopname, checksum256 request_hash, document2 destruction_act);
  [[eosio::action]] void reoffer(eosio::name coopname, checksum256 request_hash, checksum256 new_hash, eosio::asset new_unit_cost, std::string new_meta);
  
  // Методы для работы с диспутом (гарантийный возврат)
  [[eosio::action]] void dispute(eosio::name coopname, eosio::name username, checksum256 request_hash, document2 document);
  [[eosio::action]] void wauthorize(eosio::name coopname, checksum256 request_hash, uint64_t wreturn_decision_id, document2 wreturn_authorization, uint64_t wsupply_decision_id, document2 wsupply_authorization);
  [[eosio::action]] void wreturn(eosio::name coopname, eosio::name username, checksum256 request_hash, document2 document);
  [[eosio::action]] void woffer(eosio::name coopname, eosio::name username, checksum256 request_hash, document2 document);
  [[eosio::action]] void waccept(eosio::name coopname, eosio::name username, checksum256 request_hash, bool accept, document2 document);

  struct [[eosio::table, eosio::contract("marketplace")]] balances : balances_base {};
  struct [[eosio::table, eosio::contract("marketplace")]] counts : counts_base {};
};
