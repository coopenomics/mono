#pragma once

#include <eosio/eosio.hpp>
#include <eosio/time.hpp>

/**
 * @brief Расписание проверок памяти контрактов платформы.
 *
 * Контракт платформы непривилегированный и собственную квоту памяти узнать не
 * может: вызовы `get_resource_limits` и `get_account_ram_usage` узел разрешает
 * только привилегированным контрактам. Поэтому квоту проверяет системный
 * контракт по заявке `ramreq`, а сам контракт лишь решает, пора ли её подать, —
 * по времени следующей проверки в этой таблице. Одна строка на контракт.
 *
 * Таблицу пишет и хранит системный контракт; прикладные контракты её только
 * читают (базовый класс `coop_contract`). Структура общая, чтобы чтение и
 * запись не разошлись. В ABI она попадает только системного контракта — по
 * атрибуту `eosio::contract`.
 *
 * @ingroup public_tables
 * @ingroup public_system_tables
 * @par Область памяти (scope): eosio
 * @par Имя таблицы (table): ramwatch
 */
struct [[eosio::table("ramwatch"), eosio::contract("eosio.system")]] ram_watch {
  eosio::name contract;             ///< Контракт платформы
  eosio::time_point_sec next_check; ///< Раньше этого момента заявку не подавать
  int64_t granted_bytes = 0;        ///< Сколько памяти выдано контракту бессрочно, всего

  uint64_t primary_key() const { return contract.value; }
};

typedef eosio::multi_index<"ramwatch"_n, ram_watch> ram_watch_table;
