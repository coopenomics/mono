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
 *  - Создание и управление заявками на обмен, включая предложения и заказы.
 *  - Операции обновления, принятия, отказа и завершения обменных операций.
 *  - Модерация и управление публикацией заявок на обмен.
 *  - Административные функции, такие как создание идентификаторов и авторизация операций.
 *  
 *  \note Контракт маркетплейса является центральной точкой экономической активности на платформе.
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

  // Проверка корректности единиц товара (инварианты)
  static void check_units_invariant(const request& req, const std::string& operation) {
    // Проверяем, что количество единиц не отрицательное
    eosio::check(req.remain_units >= 0, 
      "Инвариант нарушен в операции " + operation + ": remain_units не может быть отрицательным");
    
    eosio::check(req.blocked_units >= 0, 
      "Инвариант нарушен в операции " + operation + ": blocked_units не может быть отрицательным");
      
    eosio::check(req.delivered_units >= 0, 
      "Инвариант нарушен в операции " + operation + ": delivered_units не может быть отрицательным");
    
    // Логирование для отладки
    eosio::print("Units check [", operation, "]: remain=", req.remain_units, 
                 " blocked=", req.blocked_units, " delivered=", req.delivered_units);
  }
  
  // ... определение методов контракта ...
  
  //marketplace.cpp
  [[eosio::action]] void newid(uint64_t id, eosio::name type);

  //soviet.cpp
  [[eosio::action]] void authorize(eosio::name coopname, uint64_t exchange_id, uint64_t contribution_product_decision_id, document2 contribution_product_authorization, uint64_t return_product_decision_id, document2 return_product_authorization);
  
  //change.cpp
  [[eosio::action]] void offer(const exchange_params& params);
  [[eosio::action]] void order(const exchange_params& params);

  static void create(eosio::name type, const exchange_params& params);
  static void create_parent(eosio::name type, const exchange_params& params);
  static void create_child(eosio::name type, const exchange_params& params);
  static void cancel_parent(eosio::name coopname, eosio::name username, uint64_t exchange_id);
  static void cancel_child(eosio::name coopname, eosio::name username, uint64_t exchange_id);

  [[eosio::action]] void accept(eosio::name coopname, eosio::name username, uint64_t exchange_id, document2 document);
  [[eosio::action]] void decline(eosio::name coopname, eosio::name username, uint64_t exchange_id, std::string meta);

  [[eosio::action]] void supplycnfrm(eosio::name coopname, eosio::name username, uint64_t exchange_id, document2 document);
  [[eosio::action]] void supply(eosio::name coopname, eosio::name username, uint64_t exchange_id, document2 document);
  [[eosio::action]] void delivered(eosio::name coopname, eosio::name username, uint64_t exchange_id);
  [[eosio::action]] void recieve(eosio::name coopname, eosio::name username, uint64_t exchange_id, document2 document);
  [[eosio::action]] void recievecnfrm(eosio::name coopname, eosio::name username, uint64_t exchange_id, document2 document);

  [[eosio::action]] void dispute(eosio::name coopname, eosio::name username, uint64_t exchange_id, document2 document);
  
  [[eosio::action]] void complete(eosio::name coopname, eosio::name username, uint64_t exchange_id);

  [[eosio::action]] void cancel(eosio::name coopname, eosio::name username, uint64_t exchange_id);
  
  [[eosio::action]] void update(eosio::name coopname, eosio::name username, uint64_t exchange_id, uint64_t remain_units, eosio::asset unit_cost, std::string data, std::string meta);
  [[eosio::action]] void addunits(eosio::name coopname, eosio::name username, uint64_t exchange_id, uint64_t units);
  
  //admins.cpp
  [[eosio::action]] void moderate(eosio::name coopname, eosio::name username, uint64_t exchange_id, uint64_t cancellation_fee);
  [[eosio::action]] void prohibit(eosio::name coopname, eosio::name username, uint64_t exchange_id, std::string meta);
  [[eosio::action]] void unpublish(eosio::name coopname, eosio::name username, uint64_t exchange_id);
  [[eosio::action]] void publish(eosio::name coopname, eosio::name username, uint64_t exchange_id);

  // Методы для работы с диспутом (гарантийный возврат)
  [[eosio::action]] void wauthorize(eosio::name coopname, uint64_t exchange_id, uint64_t wreturn_decision_id, document2 wreturn_authorization, uint64_t wsupply_decision_id, document2 wsupply_authorization);
  [[eosio::action]] void wreturn(eosio::name coopname, eosio::name username, uint64_t exchange_id, document2 document);
  [[eosio::action]] void woffer(eosio::name coopname, eosio::name username, uint64_t exchange_id, document2 document);
  [[eosio::action]] void waccept(eosio::name coopname, eosio::name username, uint64_t exchange_id, bool accept, document2 document);

  struct [[eosio::table, eosio::contract("marketplace")]] balances : balances_base {};
  struct [[eosio::table, eosio::contract("marketplace")]] counts : counts_base {};
};
