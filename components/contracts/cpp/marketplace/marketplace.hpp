#include <eosio/asset.hpp>
#include <eosio/contract.hpp>
#include <eosio/crypto.hpp>
#include <eosio/eosio.hpp>
#include <eosio/multi_index.hpp>
#include <eosio/system.hpp>
#include <eosio/time.hpp>

#include "../lib/common.hpp"

using namespace Marketplace;

// Инициализация статических констант
const std::vector<eosio::name> valid_segment_types = {
  "s2c"_n,  // supplier to coop (поставщик → кооператив)
  "c2r"_n,  // coop to receiver (кооператив → получатель)
  "wreturn"_n, // warranty return (гарантийный возврат)
  "wsupply"_n  // warranty supply (гарантийная поставка)
};

/**
 *  \ingroup public_contracts
 *  @brief Класс `marketplace` предоставляет функционал кооперативного маркетплейса, позволяя пользователям
 *  создавать, обновлять, принимать и отменять заявки на обмен товаров и услуг. Этот контракт служит
 *  центральной точкой для всех операций обмена в рамках кооперативной экосистемы.
 *
 *  Основные функции класса:
 *  - Создание и управление заявками на обмен, включая предложения и заказы.
 *  - Операции обновления, принятия, отказа и завершения обменных операций.
 *  - Модерация и управление публикацией заявок на обмен.
 *  - Административные функции, такие как создание идентификаторов и авторизация операций.
 *  
 *  ## Направления процессов поставки:
 *  
 *  ### OFFER → ORDER (deliver_on_offer)
 *  - Parent: имущественный паевой взнос (поставщик создает предложение)
 *  - Child: денежный паевой взнос (заказчик создает встречную заявку)
 *  - При accept заказчик подает: заявление на конвертацию + заявление на возврат паевого взноса
 *  
 *  ### ORDER → OFFER (deliver_on_order)  
 *  - Parent: денежный паевой взнос (заказчик создает заказ)
 *  - Child: имущественный паевой взнос (поставщик создает встречную заявку)
 *  - При accept поставщик подает: заявление на взнос имуществом + заявление на конвертацию
 *  
 *  \note Контракт маркетплейса является центральной точкой экономической активности на платформе.
 *  \note Каждое направление имеет свой набор методов с префиксами "offer" и "order" соответственно.
 */       
class [[eosio::contract(MARKETPLACE)]] marketplace : public eosio::contract {

public:
  marketplace(eosio::name receiver, eosio::name code,
              eosio::datastream<const char *> ds)
      : eosio::contract(receiver, code, ds) {}

  void apply(uint64_t receiver, uint64_t code, uint64_t action);
  [[eosio::action]] void migrate();
  
  // Утилитарные функции для работы с сегментами
  static segment get_segment(eosio::name coopname, uint64_t segment_id) {
    segments_index segments(_marketplace, coopname.value);
    auto seg = segments.find(segment_id);
    eosio::check(seg != segments.end(), "Сегмент не найден");
    return *seg;
  }

  static segment get_segment_by_request_and_type(eosio::name coopname, uint64_t request_id, eosio::name type) {
    segments_index segments(_marketplace, coopname.value);
    auto idx = segments.get_index<"byrequest"_n>();
    auto lower = idx.lower_bound(request_id);
    auto upper = idx.upper_bound(request_id);
    
    for (auto itr = lower; itr != upper; ++itr) {
      if (itr->type == type) {
        return *itr;
      }
    }
    
    eosio::check(false, "Сегмент не найден для заявки и типа");
    return segment{}; // никогда не достигнется
  }

  static uint64_t create_segment(eosio::name coopname, uint64_t request_id, eosio::name type) {
    segments_index segments(_marketplace, coopname.value);
    uint64_t id = get_global_id(_marketplace, "segment"_n);
    
    segments.emplace(_marketplace, [&](auto &s) {
      s.id = id;
      s.request_id = request_id;
      s.type = type;
      s.status = "created"_n;
      s.created_at = eosio::time_point_sec(eosio::current_time_point().sec_since_epoch());
      s.updated_at = eosio::time_point_sec(eosio::current_time_point().sec_since_epoch());
    });
    
    return id;
  }

  static void update_segment(eosio::name coopname, uint64_t segment_id, std::function<void(segment&)> updater) {
    segments_index segments(_marketplace, coopname.value);
    auto seg = segments.find(segment_id);
    eosio::check(seg != segments.end(), "Сегмент не найден");
    
    segments.modify(seg, _marketplace, [&](auto &s) {
      updater(s);
      s.updated_at = eosio::time_point_sec(eosio::current_time_point().sec_since_epoch());
    });
  }

  static void update_segment_by_request_and_type(eosio::name coopname, uint64_t request_id, eosio::name type, std::function<void(segment&)> updater) {
    segments_index segments(_marketplace, coopname.value);
    auto idx = segments.get_index<"byrequest"_n>();
    auto lower = idx.lower_bound(request_id);
    auto upper = idx.upper_bound(request_id);
    
    for (auto itr = lower; itr != upper; ++itr) {
      if (itr->type == type) {
        idx.modify(itr, _marketplace, [&](auto &s) {
          updater(s);
          s.updated_at = eosio::time_point_sec(eosio::current_time_point().sec_since_epoch());
        });
        return;
      }
    }
    
    eosio::check(false, "Сегмент не найден для обновления");
  }

  static void delete_segments_by_request(eosio::name coopname, uint64_t request_id) {
    segments_index segments(_marketplace, coopname.value);
    auto idx = segments.get_index<"byrequest"_n>();
    auto lower = idx.lower_bound(request_id);
    auto upper = idx.upper_bound(request_id);
    
    // Создаем вектор для хранения итераторов, чтобы избежать инвалидации
    std::vector<segments_index::const_iterator> to_delete;
    for (auto itr = lower; itr != upper; ++itr) {
      to_delete.push_back(segments.find(itr->id));
    }
    
    // Удаляем все найденные сегменты
    for (auto itr : to_delete) {
      segments.erase(itr);
    }
  }



  // Функция валидации имени сегмента
  static eosio::name valid_segment(const std::string& segment_name) {
    eosio::name segment_type(segment_name);
    
    // Проверяем, что сегмент входит в список допустимых
    bool is_valid = false;
    for (const auto& valid_type : valid_segment_types) {
      if (valid_type == segment_type) {
        is_valid = true;
        break;
      }
    }
    
    eosio::check(is_valid, "Недопустимый тип сегмента: " + segment_name);
    return segment_type;
  }

  // Проверка корректности единиц товара (инварианты)
  static void check_units_invariant(const request& req, const std::string& operation) {
    // Проверяем, что количество единиц не отрицательное
    eosio::check(req.remain_units >= 0, 
      "Инвариант нарушен в операции " + operation + ": remain_units не может быть отрицательным");
    
    eosio::check(req.blocked_units >= 0, 
      "Инвариант нарушен в операции " + operation + ": blocked_units не может быть отрицательным");
      
    eosio::check(req.delivered_units >= 0, 
      "Инвариант нарушен в операции " + operation + ": delivered_units не может быть отрицательным");
  }
  
  // ... определение методов контракта ...

  // Новые упрощенные действия для создания заявок
  [[eosio::action]] void parentoffer(eosio::name coopname, eosio::name braname, eosio::name username, uint64_t units, eosio::asset unit_cost, uint32_t product_lifecycle_secs, eosio::asset membership_fee_amount, eosio::asset cancellation_fee_amount, std::string meta);
  [[eosio::action]] void parentorder(eosio::name coopname, eosio::name braname, eosio::name username, uint64_t units, eosio::asset unit_cost, eosio::asset membership_fee_amount, eosio::asset cancellation_fee_amount, std::string meta);
  [[eosio::action]] void childorder(eosio::name coopname, eosio::name braname, eosio::name username, uint64_t parent_id, uint64_t units, eosio::asset unit_cost, document2 document, std::string meta);
  [[eosio::action]] void childoffer(eosio::name coopname, eosio::name braname, eosio::name username, uint64_t parent_id, uint64_t units, eosio::asset unit_cost, uint32_t product_lifecycle_secs, document2 document, std::string meta);
  static void cancel_parent(eosio::name coopname, eosio::name username, checksum256 request_hash);
  static void cancel_child(eosio::name coopname, eosio::name username, checksum256 request_hash);
  
  // Статические методы для отклонения заявок
  static void decline_child_request(eosio::name coopname, const request& child_change);
  static void decline_parent_request(eosio::name coopname, const request& parent_change);
  static void decline_parent_and_children(eosio::name coopname, const request& parent_change);
  static void decline_child_simple(eosio::name coopname, const request& child_change);

  // Методы для направления OFFER → ORDER (deliver_on_offer)
  [[eosio::action]] void acceptoff(eosio::name coopname, eosio::name username, checksum256 request_hash, document2 conversion_document, document2 return_document);
  [[eosio::action]] void authoffcont(eosio::name coopname, checksum256 request_hash, document2 authorization);
  [[eosio::action]] void authoffret(eosio::name coopname, checksum256 request_hash, document2 authorization);
  [[eosio::action]] void declineacc(eosio::name coopname, checksum256 hash, std::string reason);
  [[eosio::action]] void supplyoff(eosio::name coopname, eosio::name username, checksum256 request_hash, document2 document);
  [[eosio::action]] void supplcnfoff(eosio::name coopname, eosio::name username, checksum256 request_hash, document2 document);
  [[eosio::action]] void deliveroff(eosio::name coopname, eosio::name username, checksum256 request_hash);
  [[eosio::action]] void recvoff(eosio::name coopname, eosio::name username, checksum256 request_hash, document2 document);
  [[eosio::action]] void recvcnfoff(eosio::name coopname, eosio::name username, checksum256 request_hash, document2 document);
  [[eosio::action]] void completeoff(eosio::name coopname, eosio::name username, checksum256 request_hash);
  [[eosio::action]] void declineoff(eosio::name coopname, eosio::name username, checksum256 request_hash, std::string meta);

  // Методы для направления ORDER → OFFER (deliver_on_order)
  [[eosio::action]] void acceptord(eosio::name coopname, eosio::name username, checksum256 request_hash, document2 contribution_document, document2 conversion_document);
  [[eosio::action]] void authordcont(eosio::name coopname, checksum256 request_hash, document2 authorization);
  [[eosio::action]] void authordret(eosio::name coopname, checksum256 request_hash, document2 authorization);
  [[eosio::action]] void supplyord(eosio::name coopname, eosio::name username, checksum256 request_hash, document2 document);
  [[eosio::action]] void supplcnford(eosio::name coopname, eosio::name username, checksum256 request_hash, document2 document);
  [[eosio::action]] void deliverord(eosio::name coopname, eosio::name username, checksum256 request_hash);
  [[eosio::action]] void recvord(eosio::name coopname, eosio::name username, checksum256 request_hash, document2 document);
  [[eosio::action]] void recvcnford(eosio::name coopname, eosio::name username, checksum256 request_hash, document2 document);
  [[eosio::action]] void completeord(eosio::name coopname, eosio::name username, checksum256 request_hash);
  [[eosio::action]] void declineord(eosio::name coopname, eosio::name username, checksum256 request_hash, std::string meta);

  // Диспуты
  [[eosio::action]] void dispute(eosio::name coopname, eosio::name username, checksum256 request_hash, document2 document);

  [[eosio::action]] void cancel(eosio::name coopname, eosio::name username, checksum256 request_hash);
    
  // Методы для работы с диспутом (гарантийный возврат)
  [[eosio::action]] void wauthorize(eosio::name coopname, checksum256 request_hash, uint64_t wreturn_decision_id, document2 wreturn_authorization, uint64_t wsupply_decision_id, document2 wsupply_authorization);
  [[eosio::action]] void wreturn(eosio::name coopname, eosio::name username, checksum256 request_hash, document2 document);
  [[eosio::action]] void woffer(eosio::name coopname, eosio::name username, checksum256 request_hash, document2 document);
  [[eosio::action]] void waccept(eosio::name coopname, eosio::name username, checksum256 request_hash, bool accept, document2 document);

  struct [[eosio::table, eosio::contract("marketplace")]] balances : balances_base {};
  struct [[eosio::table, eosio::contract("marketplace")]] counts : counts_base {};
};
