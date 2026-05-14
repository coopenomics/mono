#pragma once

#include <eosio/eosio.hpp>
#include <eosio/time.hpp>

#include "../consts.hpp"

namespace Apps {

using namespace eosio;

/**
 * \brief Реестр кооперативов-клиентов каталога приложений (D3, FR7, FR8, AR3).
 *
 * Хранит факт «оператор каталога подключил кооператив `client_coopname`
 * к каталогу». Сама подписка пакета хранится в `subs`; `clients` —
 * это уровень onboarding'а, отвечающий на вопрос «может ли вообще
 * этот кооператив пользоваться каталогом и его API».
 *
 * Идентификация:
 *  - scope = `catalog_operator` (`eosio::name`). В MVP всегда `voskhod`
 *    (single-operator forever по решению brief'а), но scope-based
 *    layout не блокирует replica-режим: другой operator → другой scope,
 *    миграция данных не нужна.
 *  - PK    = `client_coopname.value` (один кооператив = одна запись
 *    в scope; повторный `regclient` → `eosio_assert("client already registered")`).
 *
 * RAM payer — `catalog_operator` (тот, кто подписал транзакцию).
 * Это ВОСХОД в MVP — он оплачивает «координацию», а не клиенты.
 * `delclient` освобождает RAM назад оператору.
 *
 * Зачем отдельная таблица, а не флаг в общей `coops`. `coops` —
 * не «общая таблица», а сущность из системы регистратора и совет-плоскости
 * (subnet-signing-keys, chain_id подсетей). Класть туда catalog-specific
 * флаги — ломать инкапсуляцию контракта; будущая ротация владельца коопа
 * не должна зависеть от состояния каталога приложений.
 *
 * \see architecture-v2 D3 — выбор scope-per-operator vs single-table.
 * \see architecture-v2 D4 — interaction с `regsub` (membership check).
 */
struct [[eosio::table, eosio::contract(APPS)]] client {
  name           client_coopname;   ///< primary key — кооператив-клиент
  time_point_sec registered_at;     ///< таймштамп `regclient`-вызова

  uint64_t primary_key() const { return client_coopname.value; }
};

typedef eosio::multi_index<"clients"_n, client> clients_index;

} // namespace Apps
