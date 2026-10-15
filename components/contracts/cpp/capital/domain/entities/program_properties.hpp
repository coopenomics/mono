#pragma once


#include "../../../lib/core/ram_payer.hpp"
#include <eosio/eosio.hpp>
#include <eosio/asset.hpp>

using namespace eosio;
using std::string;

namespace Capital::ProgramProperties {
  /**
   * @brief Константы статусов программных имущественных взносов
   * @ingroup public_consts
   * @ingroup public_capital_consts

   */
   namespace Status {
    constexpr eosio::name CREATED = "created"_n;     ///< Программный имущественный взнос создан
    constexpr eosio::name APPROVED = "approved"_n;   ///< Программный имущественный взнос одобрен
    constexpr eosio::name AUTHORIZED = "authorized"_n; ///< Программный имущественный взнос авторизован
    constexpr eosio::name ACT1 = "act1"_n;          ///< Первый акт подписан
    constexpr eosio::name ACT2 = "act2"_n;          ///< Второй акт подписан
  }
}

namespace Capital::ProgramProperties {

  /**
   * @brief Таблица программных имущественных взносов хранит данные о предложениях по имущественным взносам в программу благороста.
   * @ingroup public_tables
   * @ingroup public_capital_tables

   * @par Область памяти (scope): coopname
   * @par Имя таблицы (table): pgproperties 
   */
  struct [[eosio::table, eosio::contract(CAPITAL)]] program_property {
    uint64_t id;                                 ///< ID программного имущественного взноса (внутренний ключ)
    name coopname;                               ///< Имя кооператива
    name username;                               ///< Имя пользователя, подающего предложение
    name status;                                 ///< Статус предложения (created | approved | authorized | act1 | act2)
    checksum256 property_hash;                   ///< Хэш предложения
    eosio::asset property_amount;                ///< Оценочная стоимость имущества
    std::string property_description;            ///< Описание имущества
    document2 statement;                         ///< Заявление о внесении имущества
    document2 authorization;                     ///< Решение совета
    document2 act;                              ///< Акт
    time_point_sec created_at;                   ///< Время создания предложения

    uint64_t primary_key() const { return id; } ///< Первичный ключ (1)
    uint64_t by_username() const { return username.value; } ///< Индекс по имени пользователя (2)
    checksum256 by_property_hash() const { return property_hash; } ///< Индекс по хэшу предложения (3)
  };

typedef eosio::multi_index<
    "pgproperties"_n, program_property,
    indexed_by<"byusername"_n, const_mem_fun<program_property, uint64_t, &program_property::by_username>>,
    indexed_by<"byhash"_n, const_mem_fun<program_property, checksum256, &program_property::by_property_hash>>
> program_property_index;

/**
 * @brief Получает программное предложение по хэшу.
 * @param coopname Имя кооператива (scope таблицы).
 * @param hash Хэш предложения.
 * @return `std::optional<program_property>` - найденное предложение или `std::nullopt`, если его нет.
 */
 inline std::optional<program_property> get_program_property(eosio::name coopname, const checksum256 &hash) {
  program_property_index properties(_capital, coopname.value);
  auto property_hash_index = properties.get_index<"byhash"_n>();

  auto itr = property_hash_index.find(hash);
  if (itr == property_hash_index.end()) {
      return std::nullopt;
  }

  return program_property(*itr);
}

/**
 * @brief Получает программное предложение по хэшу или падает с ошибкой.
 * @param coopname Имя кооператива (scope таблицы).
 * @param hash Хэш предложения.
 * @return `program_property` - найденное предложение.
 */
 inline program_property get_program_property_or_fail(eosio::name coopname, const checksum256 &hash) {
  auto property = get_program_property(coopname, hash);
  eosio::check(property.has_value(), "Предложение по программному имущественному взносу не найдено");

  return property.value();
}

/**
 * @brief Удаляет программное предложение по ID.
 * @param coopname Имя кооператива (scope таблицы).
 * @param property_id ID предложения.
 */
inline void delete_program_property(eosio::name coopname, uint64_t property_id) {
  program_property_index properties(_capital, coopname.value);
  auto property = properties.find(property_id);
  eosio::check(property != properties.end(), "Предложение по программному имущественному взносу не найдено");

  properties.erase(property);
}

/**
 * @brief Создает предложение по программному имущественному взносу и отправляет его на утверждение.
 * @param coopname Имя кооператива.
 * @param username Имя пользователя.
 * @param property_hash Хэш предложения.
 * @param property_amount Оценочная стоимость имущества.
 * @param property_description Описание имущества.
 * @param statement Заявление о внесении имущества.
 */
inline void create_program_property_with_approve(
  eosio::name coopname,
  eosio::name username,
  checksum256 property_hash,
  const eosio::asset &property_amount,
  const std::string &property_description,
  const document2 &statement
) {
  // Создаем предложение
  program_property_index properties(_capital, coopname.value);
  auto property_id = get_global_id_in_scope(_capital, coopname, "pgproperties"_n);
  
  // Создаем предложение в таблице pgproperties
  properties.emplace(RamPayer::of(properties, coopname), [&](auto &p) {
    p.id = property_id;
    p.status = Capital::ProgramProperties::Status::CREATED;
    p.coopname = coopname;
    p.username = username;
    p.property_hash = property_hash;
    p.property_amount = property_amount;
    p.property_description = property_description;
    p.statement = statement;
    p.created_at = current_time_point();
  });

  // Отправляем на approve председателю
  ::Soviet::create_approval(
    _capital,
    coopname,
    username,
    statement,
    Names::Capital::CREATE_PROGRAM_PROPERTY,
    property_hash,
    _capital,
    Names::Capital::APPROVE_PROGRAM_PROPERTY,
    Names::Capital::DECLINE_PROGRAM_PROPERTY,
    std::string("")
  );
}

/**
 * @brief Обновляет статус программного предложения
 * @param coopname Имя кооператива
 * @param property_id ID предложения
 * @param new_status Новый статус
 */
inline void update_program_property_status(eosio::name coopname, uint64_t property_id, eosio::name new_status) {
  program_property_index properties(_capital, coopname.value);
  auto property = properties.find(property_id);
  eosio::check(property != properties.end(), "Предложение по программному имущественному взносу не найдено");
  
  properties.modify(property, RamPayer::of(properties, coopname), [&](auto &p) {
    p.status = new_status;
  });
}

/**
 * @brief Устанавливает одобренное заявление
 */
inline void set_program_property_approved_statement(eosio::name coopname, uint64_t property_id, const document2 &approved_statement) {
  program_property_index properties(_capital, coopname.value);
  auto property = properties.find(property_id);
  
  eosio::check(property != properties.end(), "Предложение по программному имущественному взносу не найдено");
  
  properties.modify(property, RamPayer::of(properties, coopname), [&](auto &p) {
    p.statement = approved_statement;
  });
}

/**
 * @brief Устанавливает решение совета
 */
inline void set_program_property_authorization(eosio::name coopname, uint64_t property_id, const document2 &authorization) {
  program_property_index properties(_capital, coopname.value);
  auto property = properties.find(property_id);
  eosio::check(property != properties.end(), "Предложение по программному имущественному взносу не найдено");
  
  properties.modify(property, RamPayer::of(properties, coopname), [&](auto &p) {
    p.authorization = authorization;
  });
}

/**
 * @brief Устанавливает первый акт
 */
inline void set_program_property_act1(eosio::name coopname, uint64_t property_id, const document2 &act1) {
  program_property_index properties(_capital, coopname.value);
  auto property = properties.find(property_id);
  eosio::check(property != properties.end(), "Предложение по программному имущественному взносу не найдено");
  
  properties.modify(property, RamPayer::of(properties, coopname), [&](auto &p) {
    p.act = act1;
  });
}

/**
 * @brief Устанавливает второй акт
 */
inline void set_program_property_act2(eosio::name coopname, uint64_t property_id, const document2 &act2) {
  program_property_index properties(_capital, coopname.value);
  auto property = properties.find(property_id);
  eosio::check(property != properties.end(), "Предложение по программному имущественному взносу не найдено");
  
  properties.modify(property, RamPayer::of(properties, coopname), [&](auto &p) {
    p.act = act2;
  });
}

} // namespace Capital::ProgramProperties

// Плательщик за оперативную память строк таблицы — правило в lib/core/ram_payer.hpp.
RAM_PAYER_CLASS(Capital::ProgramProperties::program_property, cooperative);
