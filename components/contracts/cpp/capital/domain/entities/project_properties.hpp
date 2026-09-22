#pragma once


#include "../../../lib/core/ram_payer.hpp"
#include <eosio/eosio.hpp>
#include <eosio/asset.hpp>

using namespace eosio;
using std::string;

namespace Capital::ProjectProperties {
  /**
   * @brief Константы статусов имущественных взносов
   * @ingroup public_consts
   * @ingroup public_capital_consts

   */
   namespace Status {
    constexpr eosio::name CREATED = "created"_n;     ///< Имущественный взнос создан
  }
}

namespace Capital::ProjectProperties {

  /**
   * @brief Таблица имущественных взносов хранит данные о предложениях по имущественным взносам в проекты.
   * @ingroup public_tables
   * @ingroup public_capital_tables

   * @par Область памяти (scope): coopname
   * @par Имя таблицы (table): pjproperties 
   */
  struct [[eosio::table, eosio::contract(CAPITAL)]] property {
    uint64_t id;                                 ///< ID имущественного взноса (внутренний ключ)
    name coopname;                               ///< Имя кооператива
    name username;                               ///< Имя пользователя, подающего предложение
    name status;                                 ///< Статус предложения (created)
    checksum256 project_hash;                    ///< Хэш проекта, связанного с предложением
    checksum256 property_hash;                   ///< Хэш предложения
    eosio::asset property_amount;                ///< Оценочная стоимость имущества
    std::string property_description;            ///< Описание имущества
    time_point_sec created_at;                   ///< Время создания предложения

    uint64_t primary_key() const { return id; } ///< Первичный ключ (1)
    uint64_t by_username() const { return username.value; } ///< Индекс по имени пользователя (2)
    checksum256 by_property_hash() const { return property_hash; } ///< Индекс по хэшу предложения (3)
    checksum256 by_project_hash() const { return project_hash; } ///< Индекс по хэшу проекта (4)
  };

typedef eosio::multi_index<
    "pjproperties"_n, property,
    indexed_by<"byusername"_n, const_mem_fun<property, uint64_t, &property::by_username>>,
    indexed_by<"byhash"_n, const_mem_fun<property, checksum256, &property::by_property_hash>>,
    indexed_by<"byprojhash"_n, const_mem_fun<property, checksum256, &property::by_project_hash>>
> property_index;

/**
 * @brief Получает предложение по хэшу.
 * @param coopname Имя кооператива (scope таблицы).
 * @param hash Хэш предложения.
 * @return `std::optional<property>` - найденное предложение или `std::nullopt`, если его нет.
 */
 inline std::optional<property> get_property(eosio::name coopname, const checksum256 &hash) {
  property_index properties(_capital, coopname.value);
  auto property_hash_index = properties.get_index<"byhash"_n>();

  auto itr = property_hash_index.find(hash);
  if (itr == property_hash_index.end()) {
      return std::nullopt;
  }

  return property(*itr);
}

/**
 * @brief Получает предложение по хэшу или падает с ошибкой.
 * @param coopname Имя кооператива (scope таблицы).
 * @param hash Хэш предложения.
 * @return `property` - найденное предложение.
 */
 inline property get_property_or_fail(eosio::name coopname, const checksum256 &hash) {
  auto property = get_property(coopname, hash);
  eosio::check(property.has_value(), "Предложение по имущественному взносу не найдено");

  return property.value();
}

/**
 * @brief Удаляет предложение по ID.
 * @param coopname Имя кооператива (scope таблицы).
 * @param property_id ID предложения.
 */
inline void delete_property(eosio::name coopname, uint64_t property_id) {
  property_index properties(_capital, coopname.value);
  auto property = properties.find(property_id);
  eosio::check(property != properties.end(), "Предложение по имущественному взносу не найдено");

  properties.erase(property);
}

/**
 * @brief Создает предложение по имущественному взносу и отправляет его на утверждение.
 * @param coopname Имя кооператива.
 * @param username Имя пользователя.
 * @param project_hash Хэш проекта.
 * @param property_hash Хэш предложения.
 * @param property_amount Оценочная стоимость имущества.
 * @param property_description Описание имущества.
 */
inline void create_property_with_approve(
  eosio::name coopname,
  eosio::name username,
  checksum256 project_hash,
  checksum256 property_hash,
  const eosio::asset &property_amount,
  const std::string &property_description
) {
  // Создаем предложение
  property_index properties(_capital, coopname.value);
  auto property_id = get_global_id_in_scope(_capital, coopname, "properties"_n);
  
  // Создаем предложение в таблице properties
  properties.emplace(RamPayer::of(properties, coopname), [&](auto &p) {
    p.id = property_id;
    p.status = Capital::ProjectProperties::Status::CREATED;
    p.coopname = coopname;
    p.username = username;
    p.project_hash = project_hash;
    p.property_hash = property_hash;
    p.property_amount = property_amount;
    p.property_description = property_description;
    p.created_at = current_time_point();
  });

  // Создаем пустой документ
  auto empty_doc = document2{};
  
  // Отправляем на approve председателю
  ::Soviet::create_approval(
    _capital,
    coopname,
    username,
    empty_doc,
    Names::Capital::CREATE_PROPERTY,
    property_hash,
    _capital,
    Names::Capital::APPROVE_PROPERTY,
    Names::Capital::DECLINE_PROPERTY,
    std::string("")
  );
}

} // namespace Capital::ProjectProperties

// Плательщик за оперативную память строк таблицы — правило в lib/core/ram_payer.hpp.
RAM_PAYER_CLASS(Capital::ProjectProperties::property, cooperative);
