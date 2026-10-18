#pragma once

#include "../core/ram_payer.hpp"

#include <eosio/crypto.hpp>
#include <eosio/eosio.hpp>
#include <eosio/time.hpp>

#include "../consts.hpp"

namespace Registrator {

using namespace eosio;

/**
 * @ingroup public_tables
 * @ingroup public_registrator_tables
 * @par table: platforms (registrator)
 *
 * @brief Выпущенное разрешение `platform` аккаунта — ключ, которым узел
 * кооператива подписывает транзакции от имени аккаунта.
 *
 * Разрешение `platform` (родитель `owner`) входит в `active` вторым входом:
 * `active` = {ключ пайщика, `username@platform`}. Узел подписывает как
 * `username@active` ключом `platform`, и смена ключа пайщика при восстановлении
 * доступа (`changekey`) узел не останавливает: запись в этой таблице говорит
 * `changekey`, что делегирование нужно сохранить. Без записи `changekey` не
 * может сослаться на `platform` — цепь отвергает ссылку на несуществующее
 * разрешение, а проверить его наличие изнутри контракта нечем.
 */
struct [[eosio::table, eosio::contract(REGISTRATOR)]] platform {
  name username;           ///< аккаунт, которому выпущено разрешение
  name coopname;           ///< кооператив, через который выпущено (сам аккаунт — при самостоятельном выпуске)
  public_key public_key;   ///< ключ разрешения `platform`
  time_point_sec issued_at;

  uint64_t primary_key() const { return username.value; }
};

typedef eosio::multi_index<"platforms"_n, platform> platforms_index;

} // namespace Registrator

// Реестр полномочий — служебное хранение: платит контракт.
RAM_PAYER_CLASS(Registrator::platform, contract);
